import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const campanha = await prisma.campanha.findUnique({
    where: { id },
    include: {
      contaEmail: { select: { id: true, nome: true } },
      modeloEmail: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      envios: {
        include: {
          empresa: { select: { nif: true, nome: true, email: true, kanbanCard: { select: { id: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  return NextResponse.json(campanha);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const campanha = await prisma.campanha.findUnique({ where: { id }, select: { status: true } });
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (campanha.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Só é possível editar campanhas em rascunho" }, { status: 409 });
  }

  const { nome, contaEmailId, modeloEmailId } = await req.json();
  if (!nome?.trim() || !contaEmailId || !modeloEmailId) {
    return NextResponse.json({ error: "Nome, conta e modelo são obrigatórios" }, { status: 400 });
  }

  const atualizada = await prisma.campanha.update({
    where: { id },
    data: { nome: nome.trim(), contaEmailId, modeloEmailId },
  });

  return NextResponse.json(atualizada);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const campanha = await prisma.campanha.findUnique({ where: { id }, select: { status: true } });
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (campanha.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Só é possível eliminar campanhas em rascunho" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.envioEmail.deleteMany({ where: { campanhaId: id } }),
    prisma.campanha.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
