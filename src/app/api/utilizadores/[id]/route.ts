import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { nome, email, telefone, role, password } = await req.json();

  const data: Record<string, unknown> = {};
  if (nome?.trim())  data.nome  = nome.trim();
  if (email?.trim()) data.email = email.trim().toLowerCase();
  if (telefone !== undefined) data.telefone = telefone?.trim() || null;
  if (role) data.role = role === "MASTER" ? "MASTER" : "AGENTE";
  if (password?.trim()) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, nome: true, email: true, telefone: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent deleting yourself
  if (session.user?.id === id) {
    return NextResponse.json({ error: "Não pode apagar a sua própria conta" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
