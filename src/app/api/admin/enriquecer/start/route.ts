import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { jobStore } from "@/lib/enriquecimento/job-store";
import { lookupNif } from "@/lib/enriquecimento/nifpt";
import { buildWhere } from "../count/route";
import { randomUUID } from "crypto";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { distrito, filtro = "ambos", delayMs = 300 } = await req.json();

  const where = buildWhere(distrito || undefined, filtro);
  const empresas = await prisma.empresa.findMany({
    where,
    select: { nif: true, nome: true, telefone: true, email: true },
    orderBy: { nome: "asc" },
  });

  if (!empresas.length) {
    return NextResponse.json({ error: "Nenhuma empresa encontrada com esses critérios" }, { status: 404 });
  }

  const jobId = randomUUID();
  const job = jobStore.create(jobId, empresas.length);

  // Run enrichment asynchronously (fire after response)
  setImmediate(async () => {
    for (const e of empresas) {
      if (job.aborted) break;

      job.currentNome = e.nome;
      const nif9 = e.nif.replace(/^PT/, "");

      const result = await lookupNif(nif9);

      job.results.push({
        nif: e.nif,
        nome: e.nome,
        telefoneAtual: e.telefone,
        emailAtual: e.email,
        telefoneEncontrado: result.telefone,
        emailEncontrado: result.email,
        websiteEncontrado: result.website,
        found: result.found,
        error: result.error,
      });

      job.done++;
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    job.status = job.aborted ? "aborted" : "done";
    job.currentNome = "";
  });

  return NextResponse.json({ jobId, total: empresas.length });
}
