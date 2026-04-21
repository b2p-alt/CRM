import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type ApplyRecord = {
  nif: string;
  telefoneAtual: string | null;
  emailAtual: string | null;
  telefoneEncontrado: string | null;
  emailEncontrado: string | null;
  websiteEncontrado: string | null;
};

type StatusRecord = {
  nif: string;
  nifStatus: string;
  raw: unknown;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body: { selecionados: ApplyRecord[]; todos?: StatusRecord[] } = await req.json();
  const { selecionados, todos } = body;
  if (!selecionados?.length && !todos?.length) return NextResponse.json({ atualizadas: 0 });

  let atualizadas = 0;

  // Apply contact data for selected companies
  for (const r of (selecionados ?? [])) {
    const data: Record<string, string> = {};
    if (r.telefoneEncontrado && !r.telefoneAtual) data.telefone = r.telefoneEncontrado;
    if (r.emailEncontrado    && !r.emailAtual)    data.email    = r.emailEncontrado;
    if (r.websiteEncontrado)                       data.website  = r.websiteEncontrado;
    if (Object.keys(data).length > 0) {
      await prisma.empresa.update({ where: { nif: r.nif }, data });
      atualizadas++;
    }
  }

  // Save enrichment status + raw for all looked-up companies
  if (todos?.length) {
    for (const r of todos) {
      await prisma.empresa.update({
        where: { nif: r.nif },
        data: {
          enriquecimentoStatus: r.nifStatus,
          enriquecimentoRaw: r.raw ? JSON.stringify(r.raw) : null,
        },
      });
    }
  }

  return NextResponse.json({ atualizadas });
}
