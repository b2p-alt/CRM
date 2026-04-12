import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { abortEnrichJob } from "@/lib/importar/enrich-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  abortEnrichJob(jobId);
  return NextResponse.json({ ok: true });
}
