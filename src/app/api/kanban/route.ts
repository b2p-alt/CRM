import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { empresaNif, coluna } = await req.json();
  if (!empresaNif) return NextResponse.json({ error: "empresaNif obrigatório" }, { status: 400 });

  const existing = await prisma.kanbanCard.findUnique({ where: { empresaNif } });
  if (existing) return NextResponse.json({ error: "Empresa já atribuída" }, { status: 409 });

  const card = await prisma.kanbanCard.create({
    data: {
      empresaNif,
      coluna: coluna || "PRIMEIRO_CONTACTO",
      userId: session.user!.id!,
    },
    include: {
      empresa: { include: { _count: { select: { instalacoes: true } } } },
      user: { select: { nome: true } },
    },
  });

  return NextResponse.json(card, { status: 201 });
}
