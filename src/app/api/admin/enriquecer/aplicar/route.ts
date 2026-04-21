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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { selecionados }: { selecionados: ApplyRecord[] } = await req.json();
  if (!selecionados?.length) return NextResponse.json({ atualizadas: 0 });

  let atualizadas = 0;
  for (const r of selecionados) {
    const data: Record<string, string> = {};
    if (r.telefoneEncontrado && !r.telefoneAtual) data.telefone = r.telefoneEncontrado;
    if (r.emailEncontrado    && !r.emailAtual)    data.email    = r.emailEncontrado;
    if (r.websiteEncontrado)                       data.website  = r.websiteEncontrado;
    if (Object.keys(data).length > 0) {
      await prisma.empresa.update({ where: { nif: r.nif }, data });
      atualizadas++;
    }
  }

  return NextResponse.json({ atualizadas });
}
