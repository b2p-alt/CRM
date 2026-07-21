import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { NextResponse } from "next/server";

const SELECT = {
  id: true,
  nome: true,
  host: true,
  porta: true,
  usuario: true,
  assinaturaHtml: true,
  limiteDiario: true,
  ativo: true,
  createdAt: true,
} as const;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { nome, host, porta, usuario, password, assinaturaHtml, limiteDiario, ativo } = await req.json();

  const data: Record<string, unknown> = {};
  if (nome?.trim()) data.nome = nome.trim();
  if (host?.trim()) data.host = host.trim();
  if (porta) data.porta = Number(porta);
  if (usuario?.trim()) data.usuario = usuario.trim();
  if (password?.trim()) data.passwordCifrada = encrypt(password);
  if (assinaturaHtml !== undefined) data.assinaturaHtml = assinaturaHtml || null;
  if (limiteDiario) data.limiteDiario = Number(limiteDiario);
  if (ativo !== undefined) data.ativo = Boolean(ativo);

  const conta = await prisma.contaEmailSMTP.update({
    where: { id },
    data,
    select: SELECT,
  });

  return NextResponse.json(conta);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const emUso = await prisma.campanha.findFirst({ where: { contaEmailId: id } });
  if (emUso) {
    return NextResponse.json({ error: "Conta em uso por uma ou mais campanhas, não pode ser apagada" }, { status: 409 });
  }

  await prisma.contaEmailSMTP.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
