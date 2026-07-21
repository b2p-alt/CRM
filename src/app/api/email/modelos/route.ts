import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const modelos = await prisma.modeloEmail.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(modelos);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nome, assunto, corpoHtml } = await req.json();

  if (!nome?.trim() || !assunto?.trim() || !corpoHtml?.trim()) {
    return NextResponse.json({ error: "Nome, assunto e corpo são obrigatórios" }, { status: 400 });
  }

  const modelo = await prisma.modeloEmail.create({
    data: { nome: nome.trim(), assunto: assunto.trim(), corpoHtml },
  });

  return NextResponse.json(modelo, { status: 201 });
}
