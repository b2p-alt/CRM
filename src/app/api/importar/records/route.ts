import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJob } from "@/lib/importar/job-store";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  if (job.status !== "done") return NextResponse.json({ error: "Job ainda não concluído" }, { status: 409 });

  return NextResponse.json({ records: job.records ?? [], distrito: job.distrito });
}
