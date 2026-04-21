import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { nifs }: { nifs: string[] } = await req.json();
  if (!nifs?.length) return NextResponse.json({ eliminadas: 0 });

  await prisma.$transaction([
    prisma.kanbanCard.deleteMany({ where: { empresaNif: { in: nifs } } }),
    prisma.nota.deleteMany({ where: { empresaNif: { in: nifs } } }),
    prisma.instalacao.deleteMany({ where: { empresaNif: { in: nifs } } }),
    prisma.empresa.deleteMany({ where: { nif: { in: nifs } } }),
  ]);

  return NextResponse.json({ eliminadas: nifs.length });
}
