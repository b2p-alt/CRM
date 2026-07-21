import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const campanha = await prisma.campanha.findUnique({
    where: { id },
    include: {
      contaEmail: { select: { nome: true } },
      modeloEmail: { select: { nome: true } },
      criadoPor: { select: { nome: true } },
      envios: {
        include: {
          empresa: { select: { nif: true, nome: true, email: true, kanbanCard: { select: { id: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  return NextResponse.json(campanha);
}
