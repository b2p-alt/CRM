import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { enviarEmail, getBaseUrl } from "@/lib/email";

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

  let avisoEmail: string | undefined;

  if (!hasPassword) {
    const conta = await prisma.contaEmailSMTP.findFirst({ where: { ativo: true } });

    if (!conta) {
      avisoEmail = "Utilizador criado, mas não há nenhuma conta de email ativa configurada em Email > Contas — não foi possível enviar o convite.";
    } else {
      try {
        await enviarEmail({
          conta,
          destinatario: user.email,
          assunto: "Bem-vindo(a) à plataforma B2P Energy",
          html: `
            <p>Olá ${user.nome},</p>
            <p>Foi criada uma conta para si na plataforma B2P Energy.</p>
            <p>Para ativar a sua conta e definir a sua password, aceda a:</p>
            <p><a href="${getBaseUrl()}/primeiro-acesso">${getBaseUrl()}/primeiro-acesso</a></p>
            <p>Utilize o email <strong>${user.email}</strong> quando lhe for pedido.</p>
          `,
        });
      } catch (err) {
        avisoEmail = `Utilizador criado, mas o envio do email de boas-vindas falhou: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }

  return NextResponse.json({ ...user, avisoEmail }, { status: 201 });
}
