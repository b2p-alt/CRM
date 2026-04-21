import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const empresas = await prisma.empresa.findMany({
    where: { enriquecimentoStatus: { not: null } },
    select: {
      nif: true,
      nome: true,
      distrito: true,
      localidade: true,
      telefone: true,
      email: true,
      enriquecimentoStatus: true,
      enriquecimentoAt: true,
      enriquecimentoRaw: true,
      _count: { select: { instalacoes: true } },
    },
    orderBy: { enriquecimentoAt: "desc" },
  });

  return NextResponse.json(empresas);
}
