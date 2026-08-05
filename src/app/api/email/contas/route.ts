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
  userId: true,
  user: { select: { nome: true } },
} as const;

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contas = await prisma.contaEmailSMTP.findMany({
    select: SELECT,
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(contas);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nome, host, porta, usuario, password, assinaturaHtml, limiteDiario, userId } = await req.json();

  if (!nome?.trim() || !host?.trim() || !porta || !usuario?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Nome, host, porta, utilizador e password são obrigatórios" }, { status: 400 });
  }

  try {
    const conta = await prisma.contaEmailSMTP.create({
      data: {
        nome: nome.trim(),
        host: host.trim(),
        porta: Number(porta),
        usuario: usuario.trim(),
        passwordCifrada: encrypt(password),
        assinaturaHtml: assinaturaHtml || null,
        limiteDiario: limiteDiario ? Number(limiteDiario) : undefined,
        userId: userId || null,
      },
      select: SELECT,
    });
    return NextResponse.json(conta, { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Este utilizador já tem uma conta de email associada" }, { status: 409 });
    }
    throw err;
  }
}
