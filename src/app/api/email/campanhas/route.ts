import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcularListasCampanha } from "@/lib/campanha";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campanhas = await prisma.campanha.findMany({
    include: {
      contaEmail: { select: { nome: true } },
      modeloEmail: { select: { nome: true } },
      criadoPor: { select: { nome: true } },
      _count: { select: { envios: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campanhas);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nome, mesFiltro, contaEmailId, modeloEmailId, nifsAdicionaisKanban } = await req.json();

  const mes = Number(mesFiltro);
  if (!nome?.trim() || !mes || mes < 1 || mes > 12 || !contaEmailId || !modeloEmailId) {
    return NextResponse.json({ error: "Nome, mês (1-12), conta e modelo são obrigatórios" }, { status: 400 });
  }

  const { elegiveis, jaNoKanban } = await calcularListasCampanha(mes);

  const kanbanSelecionados = new Set<string>(Array.isArray(nifsAdicionaisKanban) ? nifsAdicionaisKanban : []);
  const incluidos = [
    ...elegiveis,
    ...jaNoKanban.filter((e) => kanbanSelecionados.has(e.nif)),
  ];

  if (incluidos.length === 0) {
    return NextResponse.json({ error: "Nenhuma empresa elegível para este mês" }, { status: 400 });
  }

  const campanha = await prisma.campanha.create({
    data: {
      nome: nome.trim(),
      mesFiltro: mes,
      contaEmailId,
      modeloEmailId,
      criadoPorId: session.user!.id!,
      envios: {
        create: incluidos.map((e) => ({ empresaNif: e.nif })),
      },
    },
    include: { _count: { select: { envios: true } } },
  });

  return NextResponse.json(campanha, { status: 201 });
}
