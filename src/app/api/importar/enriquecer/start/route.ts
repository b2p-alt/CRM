import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ParsedRecord } from "@/lib/importar/types";
import { createEnrichJob, patchEnrichJob } from "@/lib/importar/enrich-store";
import { enrichNif } from "@/lib/importar/racius";
import { cleanNipc } from "@/lib/importar/parser";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { records, jobId, delayMs = 5000 }: {
    records: ParsedRecord[];
    jobId: string;
    delayMs?: number;
  } = await req.json();

  // Deduplicate NIFs
  const seen = new Set<string>();
  const nifs: string[] = [];
  for (const r of records) {
    const nif = cleanNipc(r.nipc);
    if (nif && !seen.has(nif)) { seen.add(nif); nifs.push(nif); }
  }

  createEnrichJob(jobId, nifs.length);
  patchEnrichJob(jobId, { status: "running" });

  // Process sequentially with delay — fire and forget not safe on Vercel,
  // but this is local-only so the long-running request is fine.
  (async () => {
    for (let i = 0; i < nifs.length; i++) {
      const job = (await import("@/lib/importar/enrich-store")).getEnrichJob(jobId);
      if (!job || job.aborted) break;

      const nif = nifs[i];
      // Apply delay between requests (not before the first one)
      const data = await enrichNif(nif, i === 0 ? 0 : delayMs);

      const current = (await import("@/lib/importar/enrich-store")).getEnrichJob(jobId);
      if (!current) break;

      patchEnrichJob(jobId, {
        processed: i + 1,
        found: current.found + (data.found ? 1 : 0),
        results: { ...current.results, [nif]: data },
      });
    }

    const final = (await import("@/lib/importar/enrich-store")).getEnrichJob(jobId);
    if (final && !final.aborted) {
      patchEnrichJob(jobId, { status: "done" });
    }
  })().catch((err) => {
    patchEnrichJob(jobId, { status: "error", error: String(err) });
  });

  return NextResponse.json({ jobId, total: nifs.length });
}
