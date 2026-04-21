import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/enriquecimento/job-store";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  const job = jobStore.get(jobId);
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });

  return NextResponse.json(job.results);
}
