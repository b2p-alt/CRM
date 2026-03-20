import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nif } = await params;
  const { texto } = await req.json();
  if (!texto?.trim()) {
    return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 });
  }

  const nota = await prisma.nota.create({
    data: { texto: texto.trim(), empresaNif: nif, userId: session.user.id },
    include: { user: { select: { nome: true } } },
  });

  return NextResponse.json(nota, { status: 201 });
}
