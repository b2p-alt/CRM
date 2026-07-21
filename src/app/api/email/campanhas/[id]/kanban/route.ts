import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { nifs } = await req.json();

  if (!Array.isArray(nifs) || nifs.length === 0) {
    return NextResponse.json({ error: "nifs obrigatório" }, { status: 400 });
  }

  const envios = await prisma.envioEmail.findMany({
    where: { campanhaId: id, empresaNif: { in: nifs } },
    select: { empresaNif: true },
  });
  const nifsValidos = new Set(
    envios.map((e) => e.empresaNif).filter((nif): nif is string => nif !== null)
  );

  const jaExistentes = await prisma.kanbanCard.findMany({
    where: { empresaNif: { in: Array.from(nifsValidos) } },
    select: { empresaNif: true },
  });
  const existentesSet = new Set(jaExistentes.map((k) => k.empresaNif));

  const aCriar = Array.from(nifsValidos).filter((nif) => !existentesSet.has(nif));

  if (aCriar.length > 0) {
    await prisma.kanbanCard.createMany({
      data: aCriar.map((empresaNif) => ({
        empresaNif,
        coluna: "PRIMEIRO_CONTACTO" as const,
        userId: session.user!.id!,
      })),
    });
  }

  return NextResponse.json({ criados: aCriar.length, ignorados: nifsValidos.size - aCriar.length });
}
