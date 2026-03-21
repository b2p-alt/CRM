import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ nif: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nif } = await params;
  const { mesTermino, fornecedor, notaTexto } = await req.json();

  const updates: Record<string, string | null> = {};
  if (mesTermino !== undefined) updates.mesTermino = mesTermino || null;
  if (fornecedor !== undefined) updates.fornecedor = fornecedor || null;

  if (Object.keys(updates).length > 0) {
    await prisma.instalacao.updateMany({
      where: { empresaNif: nif },
      data: updates,
    });
  }

  let nota = null;
  if (notaTexto?.trim()) {
    nota = await prisma.nota.create({
      data: {
        texto: notaTexto.trim(),
        empresaNif: nif,
        userId: session.user!.id!,
      },
      include: { user: { select: { nome: true } } },
    });
  }

  // Return updated installations
  const instalacoes = await prisma.instalacao.findMany({
    where: { empresaNif: nif },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, nota, instalacoes });
}
