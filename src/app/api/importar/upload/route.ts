import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createJob } from "@/lib/importar/job-store";
import { runOcrPipeline } from "@/lib/importar/ocr-pipeline";

// Vercel hobby max is 300s; pro is 900s. OCR runs synchronously.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file     = formData.get("pdf") as File | null;
  const distrito = (formData.get("distrito") as string | null)?.trim() || "Desconhecido";

  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Ficheiro PDF inválido" }, { status: 400 });
  }

  const jobId     = crypto.randomUUID();
  const arrayBuf  = await file.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuf);

  createJob(jobId, distrito);

  // Run synchronously so the function doesn't terminate before OCR finishes.
  // On Vercel, fire-and-forget tasks are killed when the response is sent.
  await runOcrPipeline(jobId, pdfBuffer);

  return NextResponse.json({ jobId });
}
