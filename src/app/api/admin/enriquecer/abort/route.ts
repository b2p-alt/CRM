import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/enriquecimento/job-store";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const { jobId } = await req.json();
  jobStore.abort(jobId);
  return NextResponse.json({ ok: true });
}
