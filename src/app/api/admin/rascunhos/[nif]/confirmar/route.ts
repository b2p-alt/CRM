import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { nif } = await params;
  const empresa = await prisma.empresa.findUnique({ where: { nif } });
  if (!empresa) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Block confirmation if NIF is still a placeholder
  if (nif.startsWith("RASCUNHO_")) {
    return NextResponse.json(
      { error: "Corrija o NIF antes de confirmar" },
      { status: 400 }
    );
  }

  const updated = await prisma.empresa.update({
    where: { nif },
    data: { rascunho: false, importProblemas: null, updatedAt: new Date() },
  });

  return NextResponse.json(updated);
}
