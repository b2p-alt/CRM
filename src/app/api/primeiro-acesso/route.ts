import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// Step 1: validate email exists and needs activation
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!email) return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { mustChangePassword: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Email não encontrado. Contacte o administrador." }, { status: 404 });
  }

  if (!user.mustChangePassword) {
    return NextResponse.json({ error: "Esta conta já foi ativada. Faça login normalmente." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

// Step 2: set the new password
export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Email e password são obrigatórios" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "A password deve ter pelo menos 6 caracteres" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user || !user.mustChangePassword) {
    return NextResponse.json({ error: "Operação inválida" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { email: email.toLowerCase().trim() },
    data: { password: hashed, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
