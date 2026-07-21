import { prisma } from "@/lib/prisma";

export type EmpresaResumo = { nif: string; nome: string; email: string };

export async function calcularListasCampanha(mes: number) {
  const rows = await prisma.$queryRaw<{ empresaNif: string }[]>`
    SELECT DISTINCT "empresaNif"
    FROM "Instalacao"
    WHERE EXTRACT(MONTH FROM "dataInicioContrato") = ${mes}
  `;
  const nifs = rows.map((r) => r.empresaNif);

  const empresas = await prisma.empresa.findMany({
    where: {
      nif: { in: nifs },
      email: { not: null },
    },
    select: {
      nif: true,
      nome: true,
      email: true,
      instalacoes: { select: { mesTermino: true } },
      kanbanCard: { select: { id: true } },
    },
    orderBy: { nome: "asc" },
  });

  const elegiveis: EmpresaResumo[] = [];
  const excluidasTermino: EmpresaResumo[] = [];
  const jaNoKanban: EmpresaResumo[] = [];

  for (const e of empresas) {
    const resumo = { nif: e.nif, nome: e.nome, email: e.email! };
    const temTermino = e.instalacoes.some((i) => i.mesTermino);
    if (temTermino) {
      excluidasTermino.push(resumo);
    } else if (e.kanbanCard) {
      jaNoKanban.push(resumo);
    } else {
      elegiveis.push(resumo);
    }
  }

  return { elegiveis, excluidasTermino, jaNoKanban };
}
