import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createJob } from "@/lib/importar/job-store";
import { runOcrPipeline } from "@/lib/importar/ocr-pipeline";

export const maxDuration = 1800; // 30 min — only valid on VPS, not Vercel

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

  // Fire-and-forget — runs in background while SSE stream reads progress
  runOcrPipeline(jobId, pdfBuffer).catch(() => {});

  return NextResponse.json({ jobId });
}
