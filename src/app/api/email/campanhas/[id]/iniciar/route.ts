import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const campanha = await prisma.campanha.findUnique({ where: { id } });
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (campanha.status === "CONCLUIDA") {
    return NextResponse.json({ error: "Campanha já foi concluída" }, { status: 409 });
  }

  const atualizada = await prisma.campanha.update({
    where: { id },
    data: { status: "A_ENVIAR" },
  });

  return NextResponse.json(atualizada);
}
