import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { jobStore, EnrichRecord } from "@/lib/enriquecimento/job-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { jobId, selecionados }: { jobId: string; selecionados: string[] } = await req.json();

  const job = jobStore.get(jobId);
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });

  const nifSet = new Set(selecionados);
  const toApply: EnrichRecord[] = job.results.filter(r => nifSet.has(r.nif) && r.found);

  let atualizadas = 0;
  for (const r of toApply) {
    const data: Record<string, string> = {};
    if (r.telefoneEncontrado && !r.telefoneAtual) data.telefone = r.telefoneEncontrado;
    if (r.emailEncontrado    && !r.emailAtual)    data.email    = r.emailEncontrado;
    if (r.websiteEncontrado)                       data.website  = r.websiteEncontrado;

    if (Object.keys(data).length > 0) {
      await prisma.empresa.update({ where: { nif: r.nif }, data });
      atualizadas++;
    }
  }

  jobStore.delete(jobId);
  return NextResponse.json({ atualizadas });
}
