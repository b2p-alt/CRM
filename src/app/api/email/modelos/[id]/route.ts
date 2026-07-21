import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { nome, assunto, corpoHtml } = await req.json();

  const data: Record<string, unknown> = {};
  if (nome?.trim()) data.nome = nome.trim();
  if (assunto?.trim()) data.assunto = assunto.trim();
  if (corpoHtml !== undefined) data.corpoHtml = corpoHtml;

  const modelo = await prisma.modeloEmail.update({ where: { id }, data });
  return NextResponse.json(modelo);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const emUso = await prisma.campanha.findFirst({ where: { modeloEmailId: id } });
  if (emUso) {
    return NextResponse.json({ error: "Modelo em uso por uma ou mais campanhas, não pode ser apagado" }, { status: 409 });
  }

  await prisma.modeloEmail.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
