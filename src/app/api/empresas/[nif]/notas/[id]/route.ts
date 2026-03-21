import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ nif: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const nota = await prisma.nota.findUnique({ where: { id } });
  if (!nota) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  if (session.user?.role !== "MASTER" && nota.userId !== session.user?.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  await prisma.nota.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
