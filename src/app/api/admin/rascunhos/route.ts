import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const empresas = await prisma.empresa.findMany({
    where: { rascunho: true },
    include: {
      instalacoes: true,
      notas: { include: { user: { select: { nome: true } } }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(empresas);
}
