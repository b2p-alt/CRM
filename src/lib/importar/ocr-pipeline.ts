import { patchJob } from "./job-store";
import { parseOcrText } from "./parser";

/**
 * Runs OCR on a PDF buffer and updates the job store with progress.
 * Designed to run as a fire-and-forget background task.
 */
export async function runOcrPipeline(
  jobId: string,
  pdfBuffer: Buffer,
): Promise<void> {
  try {
    // Dynamic imports so Next.js doesn't bundle these at build time
    const mupdf       = await import("mupdf");
    const { createWorker } = await import("tesseract.js");

    patchJob(jobId, { status: "ocr", progress: 0 });

    const doc      = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const numPages = doc.countPages();
    patchJob(jobId, { totalPages: numPages });

    const worker = await createWorker("por+eng", 1, { logger: () => {} });

    let allText = "";

    for (let p = 0; p < numPages; p++) {
      patchJob(jobId, {
        currentPage: p + 1,
        progress: Math.round((p / numPages) * 90), // 0-90% during OCR
      });

      const page   = doc.loadPage(p);
      const matrix = mupdf.Matrix.scale(3, 3); // ~216 DPI
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
      const pngBuf = Buffer.from(pixmap.asPNG());

      const { data: { text } } = await worker.recognize(pngBuf);
      allText += text + "\n\n";
    }

    await worker.terminate();

    patchJob(jobId, { status: "parsing", progress: 92, ocrText: allText });

    const records = parseOcrText(allText);

    patchJob(jobId, {
      status: "done",
      progress: 100,
      records,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    patchJob(jobId, { status: "error", error: msg });
  }
}
