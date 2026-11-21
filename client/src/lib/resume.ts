export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export async function extractResumeText(file: File): Promise<string> {
  if (file.size <= 0 || file.size > MAX_RESUME_BYTES) throw new Error("SIZE");
  const name = file.name.toLowerCase();
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const looksPdf =
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46;
  const looksZip =
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    head[2] === 0x03 &&
    head[3] === 0x04;
  if ((name.endsWith(".pdf") || file.type === "application/pdf") && looksPdf) {
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 35); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item: any) => (typeof item.str === "string" ? item.str : ""))
          .join(" ")
      );
    }
    const text = pages.join("\n").replace(/\s+/g, " ").trim();
    if (text.length < 30) throw new Error("EMPTY");
    return text.slice(0, 15000);
  }
  if ((name.endsWith(".docx") || file.type === DOCX_MIME) && looksZip) {
    const mammoth: any = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    const text = String(result.value || "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 30) throw new Error("EMPTY");
    return text.slice(0, 15000);
  }
  throw new Error("TYPE");
}
export function resumeFileError(error: unknown) {
  if (error instanceof Error && error.message === "SIZE")
    return "Please choose a non-empty PDF or DOCX file smaller than 10 MB.";
  if (error instanceof Error && error.message === "TYPE")
    return "This file doesn't look like a valid PDF or DOCX. Check the file format and try again.";
  if (error instanceof Error && error.message === "EMPTY")
    return "We couldn't find readable text in this document. Try an exportable PDF or DOCX version.";
  return "We couldn't read this resume. Try a standard text-based PDF or DOCX file.";
}
