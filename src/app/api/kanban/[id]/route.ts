import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const card = await prisma.kanbanCard.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (session.user?.role !== "MASTER" && card.userId !== session.user?.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const updated = await prisma.kanbanCard.update({
    where: { id },
    data: {
      ...(body.coluna && { coluna: body.coluna }),
      ...(body.agendamentoData !== undefined && {
        agendamentoData: body.agendamentoData ? new Date(body.agendamentoData) : null,
      }),
      ...(body.agendamentoNota !== undefined && { agendamentoNota: body.agendamentoNota }),
    },
    include: {
      empresa: { include: { _count: { select: { instalacoes: true } } } },
      user: { select: { nome: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const card = await prisma.kanbanCard.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (session.user?.role !== "MASTER" && card.userId !== session.user?.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  await prisma.kanbanCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
