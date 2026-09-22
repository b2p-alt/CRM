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

  const { nome, mesFiltro, publicaFiltro, distritoFiltro, contaEmailId, modeloEmailId, nifsAdicionaisKanban, nifsExplicitos } = await req.json();

  if (!nome?.trim() || !contaEmailId || !modeloEmailId) {
    return NextResponse.json({ error: "Nome, conta e modelo são obrigatórios" }, { status: 400 });
  }

  // Modo reenvio: lista explícita de NIFs (ex: quem não abriu uma campanha anterior),
  // sem passar pelo cálculo de elegibilidade por mês de início de contrato.
  if (Array.isArray(nifsExplicitos) && nifsExplicitos.length > 0) {
    const empresas = await prisma.empresa.findMany({
      where: { nif: { in: nifsExplicitos }, email: { not: null } },
      select: { nif: true },
    });

    if (empresas.length === 0) {
      return NextResponse.json({ error: "Nenhuma empresa válida na lista indicada" }, { status: 400 });
    }

    const campanha = await prisma.campanha.create({
      data: {
        nome: nome.trim(),
        contaEmailId,
        modeloEmailId,
        criadoPorId: session.user!.id!,
        envios: {
          create: empresas.map((e) => ({ empresaNif: e.nif })),
        },
      },
      include: { _count: { select: { envios: true } } },
    });

    return NextResponse.json(campanha, { status: 201 });
  }

  let mes: number | null = null;
  if (mesFiltro !== undefined && mesFiltro !== null && mesFiltro !== "") {
    mes = Number(mesFiltro);
    if (!mes || mes < 1 || mes > 12) {
      return NextResponse.json({ error: "Mês inválido (esperado 1-12)" }, { status: 400 });
    }
  }

  const publica = publicaFiltro === "sim" ? true : publicaFiltro === "nao" ? false : null;
  const distrito = distritoFiltro || null;

  const { elegiveis, jaNoKanban } = await calcularListasCampanha(mes, publica, distrito);

  const kanbanSelecionados = new Set<string>(Array.isArray(nifsAdicionaisKanban) ? nifsAdicionaisKanban : []);
  const incluidos = [
    ...elegiveis,
    ...jaNoKanban.filter((e) => kanbanSelecionados.has(e.nif)),
  ];

  if (incluidos.length === 0) {
    return NextResponse.json({ error: "Nenhuma empresa elegível com estes filtros" }, { status: 400 });
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
