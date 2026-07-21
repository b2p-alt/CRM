import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contaEmailId, modeloEmailId, emails } = await req.json();

  const destinatarios = Array.from(new Set(
    Array.isArray(emails) ? emails.map((e: string) => e.trim()).filter(Boolean) : []
  ));

  if (!contaEmailId || !modeloEmailId || destinatarios.length === 0) {
    return NextResponse.json({ error: "Conta, modelo e pelo menos um email são obrigatórios" }, { status: 400 });
  }

  const campanha = await prisma.campanha.create({
    data: {
      nome: `[TESTE] ${new Date().toLocaleString("pt-PT")}`,
      teste: true,
      mesFiltro: null,
      contaEmailId,
      modeloEmailId,
      criadoPorId: session.user!.id!,
      envios: {
        create: destinatarios.map((emailAvulso) => ({ emailAvulso })),
      },
    },
    include: { _count: { select: { envios: true } } },
  });

  return NextResponse.json(campanha, { status: 201 });
}
