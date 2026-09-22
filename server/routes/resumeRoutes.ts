import { Router, Request, Response } from 'express';
import zlib from 'zlib';
import { getGeminiClient, extractDocumentTextWithGemini } from '../services/geminiService';

const router = Router();

// Helper to determine mime type accurately
function detectMimeType(fileName: string, fileType: string): string {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.pdf') || fileType.includes('pdf')) return 'application/pdf';
  if (lower.endsWith('.docx') || fileType.includes('wordprocessingml')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc') || fileType.includes('msword')) return 'application/msword';
  if (lower.endsWith('.png') || fileType.includes('png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || fileType.includes('jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp') || fileType.includes('webp')) return 'image/webp';
  if (lower.endsWith('.txt') || fileType.includes('text/plain')) return 'text/plain';
  if (lower.endsWith('.md')) return 'text/markdown';
  return fileType || 'application/octet-stream';
}

function cleanExtractedText(raw: string): string {
  return (raw || '')
    .replace(/\u0000/g, '') // remove null bytes
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// POST /api/resume/parse-document
router.post('/parse-document', async (req: Request, res: Response) => {
  try {
    const { fileData = '', fileName = 'resume.pdf', fileType = '' } = req.body;
    if (!fileData) {
      return res.status(400).json({ success: false, error: 'No file data received.' });
    }

    // Convert base64 data URL to buffer
    const base64Content = fileData.includes(';base64,')
      ? fileData.split(';base64,')[1]
      : fileData.replace(/^data:.*?base64,/, '').trim();

    const buffer = Buffer.from(base64Content, 'base64');
    const lowerName = (fileName || '').toLowerCase();
    const mimeType = detectMimeType(lowerName, fileType);
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    const isWord = mimeType.includes('word') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc');

    let extractedText = '';
    let extractionMethod = 'unknown';

    // Layer 1: Fast Native Parsing (PDF, Word, Text)
    if (isPdf) {
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        const candidate = cleanExtractedText(result.text || '');
        if (candidate.length >= 10) {
          extractedText = candidate;
          extractionMethod = 'native-pdf';
        }
      } catch (pdfErr: any) {
        console.warn('[Resume Parser] PDFParse primary parsing error:', pdfErr?.message || pdfErr);
      }
    } else if (lowerName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
      try {
        const mammoth: any = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ buffer });
        const candidate = cleanExtractedText(result.value || '');
        if (candidate.length >= 10) {
          extractedText = candidate;
          extractionMethod = 'docx-mammoth';
        }
      } catch (docxErr: any) {
        console.warn('[Resume Parser] DOCX mammoth parsing error:', docxErr?.message || docxErr);
      }
    } else if (lowerName.endsWith('.doc') || mimeType.includes('msword')) {
      try {
        const mammoth: any = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ buffer });
        const candidate = cleanExtractedText(result.value || '');
        if (candidate.length >= 10) {
          extractedText = candidate;
          extractionMethod = 'doc-mammoth';
        }
      } catch {
        const printable = cleanExtractedText(
          buffer.toString('utf-8').replace(/[^\x20-\x7E\t\n\r]/g, ' ')
        );
        if (printable.length >= 15) {
          extractedText = printable;
          extractionMethod = 'doc-printable';
        }
      }
    } else if (!isImage) {
      // Plain text, Markdown, etc.
      const candidate = cleanExtractedText(buffer.toString('utf-8'));
      if (candidate.length >= 10) {
        extractedText = candidate;
        extractionMethod = 'plain-text';
      }
    }

    // Layer 2: Gemini Multimodal AI OCR
    // Triggered if native parsing returned few words (< 30 words) or for scanned/image resumes
    const wordCountSoFar = extractedText.split(/\s+/).filter(Boolean).length;
    if ((wordCountSoFar < 30 || isImage) && (isPdf || isImage)) {
      const ai = getGeminiClient();
      if (ai) {
        try {
          console.log(`[Resume Parser] Running Gemini Multimodal OCR on "${fileName}" (${mimeType})...`);
          const { text: ocrText, modelUsed } = await extractDocumentTextWithGemini(ai, base64Content, mimeType);
          const candidate = cleanExtractedText(ocrText);
          // Prefer OCR if it found text or if native parsing had fewer characters
          if (candidate.length >= 10 && (candidate.length > extractedText.length || wordCountSoFar < 15)) {
            extractedText = candidate;
            extractionMethod = `gemini-ocr (${modelUsed})`;
          }
        } catch (ocrErr: any) {
          console.warn('[Resume Parser] Gemini Multimodal OCR failed:', ocrErr?.message || ocrErr);
        }
      }
    }

    // Layer 3: Flate Decompression / Regex Stream Token Fallback (for PDFs if Gemini was unreachable)
    if (isPdf && (!extractedText || extractedText.length < 15)) {
      try {
        const raw = buffer.toString('binary');
        const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
        let streamMatch: RegExpExecArray | null;
        let combinedText = '';

        while ((streamMatch = streamRegex.exec(raw)) !== null) {
          const streamBuffer = Buffer.from(streamMatch[1], 'binary');
          try {
            const decompressed = zlib.inflateSync(streamBuffer).toString('utf-8');
            const printable = decompressed.replace(/[^\x20-\x7E\t\n\r]/g, ' ');
            combinedText += ' ' + printable;
          } catch {
            const printable = streamMatch[1].replace(/[^\x20-\x7E\t\n\r]/g, ' ');
            combinedText += ' ' + printable;
          }
        }

        const tokenMatches = combinedText.match(/\(([^()]{2,})\)/g);
        if (tokenMatches && tokenMatches.length > 3) {
          const streamCandidate = cleanExtractedText(tokenMatches.map((m) => m.slice(1, -1)).join(' '));
          if (streamCandidate.length >= 10) {
            extractedText = streamCandidate;
            extractionMethod = 'pdf-stream-decompressed';
          }
        }
      } catch (streamErr) {
        console.warn('[Resume Parser] Stream fallback error:', streamErr);
      }
    }

    // Final Validation & Cleanup
    extractedText = cleanExtractedText(extractedText);

    if (!extractedText || extractedText.length < 10) {
      return res.status(422).json({
        success: false,
        error: isImage
          ? 'Could not extract text from the image resume. Please verify the image is clear and contains readable text.'
          : 'Could not extract readable text from the document. Please ensure the file contains text and is not password-protected.',
      });
    }

    const words = extractedText.split(/\s+/).filter(Boolean);

    return res.json({
      success: true,
      text: extractedText,
      fileName,
      fileSize: buffer.length,
      wordCount: words.length,
      method: extractionMethod,
    });
  } catch (error: any) {
    console.error('[Resume Parser] Critical error parsing resume document:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to parse resume document',
    });
  }
});

export default router;
