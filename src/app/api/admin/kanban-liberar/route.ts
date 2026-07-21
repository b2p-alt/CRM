import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { KanbanColuna } from "@prisma/client";

const COLUNAS_VALIDAS: KanbanColuna[] = [
  "EM_REVISAO", "PRIMEIRO_CONTACTO", "ENVIAR_EMAIL", "EM_CONTACTO", "PROPOSTA", "CLIENTE",
];

function validar(userId: string | null, coluna: string | null) {
  if (!userId) return "Utilizador é obrigatório";
  if (!coluna || !COLUNAS_VALIDAS.includes(coluna as KanbanColuna)) return "Coluna inválida";
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  const coluna = req.nextUrl.searchParams.get("coluna");
  const erro = validar(userId, coluna);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  const cards = await prisma.kanbanCard.findMany({
    where: { userId: userId!, coluna: coluna as KanbanColuna },
    include: { empresa: { select: { nif: true, nome: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    cards: cards.map((c) => ({ id: c.id, nif: c.empresa.nif, nome: c.empresa.nome, createdAt: c.createdAt })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, coluna } = await req.json();
  const erro = validar(userId, coluna);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  const { count } = await prisma.kanbanCard.deleteMany({
    where: { userId, coluna: coluna as KanbanColuna },
  });

  return NextResponse.json({ removidos: count });
}
