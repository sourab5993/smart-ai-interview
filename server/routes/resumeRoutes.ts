import { Router, Request, Response } from 'express';

const router = Router();

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
    let extractedText = '';

    if (lowerName.endsWith('.pdf') || fileType.includes('pdf')) {
      // PDF text extraction using PDFParse
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        extractedText = result.text || '';
      } catch (pdfErr: any) {
        console.warn('Primary PDFParse error, trying stream fallback:', pdfErr?.message || pdfErr);
        const raw = buffer.toString('binary');
        const matches = raw.match(/\(([^()]{3,})\)/g);
        if (matches && matches.length > 5) {
          extractedText = matches.map((m) => m.slice(1, -1)).join(' ');
        }
      }
    } else if (lowerName.endsWith('.docx') || fileType.includes('wordprocessingml')) {
      // DOCX text extraction using mammoth
      try {
        const mammoth: any = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch (docxErr: any) {
        console.warn('DOCX mammoth parsing error:', docxErr?.message || docxErr);
      }
    } else if (lowerName.endsWith('.doc') || fileType.includes('msword')) {
      // DOC: try mammoth first, fallback to text stream
      try {
        const mammoth: any = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch {
        const printable = buffer.toString('utf-8').replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (printable.length > 80) {
          extractedText = printable;
        }
      }
    } else {
      // Plain text, Markdown, etc.
      extractedText = buffer.toString('utf-8');
    }

    // Clean up whitespace while preserving paragraph lines
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!extractedText || extractedText.length < 20) {
      return res.status(422).json({
        success: false,
        error: 'Could not extract readable text from the document. Please ensure the file contains text and is not password-protected.',
      });
    }

    const words = extractedText.split(/\s+/).filter(Boolean);

    return res.json({
      success: true,
      text: extractedText,
      fileName,
      fileSize: buffer.length,
      wordCount: words.length,
    });
  } catch (error: any) {
    console.error('Error parsing resume document:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to parse resume document' });
  }
});

export default router;
