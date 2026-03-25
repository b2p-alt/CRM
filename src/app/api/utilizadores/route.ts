import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, nome: true, email: true, telefone: true, role: true, createdAt: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nome, email, telefone, password, role } = await req.json();

  if (!nome?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Nome, email e password são obrigatórios" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email já registado" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone?.trim() || null,
      password: hashed,
      role: role === "MASTER" ? "MASTER" : "AGENTE",
    },
    select: { id: true, nome: true, email: true, telefone: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
