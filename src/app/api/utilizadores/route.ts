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
    select: { id: true, nome: true, email: true, telefone: true, role: true, mustChangePassword: true, createdAt: true },
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

  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email já registado" }, { status: 409 });
  }

  const hasPassword = password?.trim();
  const hashed = hasPassword ? await bcrypt.hash(password, 10) : await bcrypt.hash(Math.random().toString(36), 10);

  const user = await prisma.user.create({
    data: {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone?.trim() || null,
      password: hashed,
      role: role === "MASTER" ? "MASTER" : "AGENTE",
      mustChangePassword: !hasPassword,
    },
    select: { id: true, nome: true, email: true, telefone: true, role: true, mustChangePassword: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
