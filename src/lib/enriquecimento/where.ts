import { prisma } from "@/lib/prisma";

const JA_PESQUISADOS_SEM_DADOS = ["sem_dados", "nif_invalido"];

// Mesmo padrão de /empresas: filtra pelo mês (1-12) de dataInicioContrato, independente do ano
export async function getNifsComMesInicio(mesInicio: string | undefined): Promise<string[] | null> {
  if (!mesInicio || !/^([1-9]|1[0-2])$/.test(mesInicio)) return null;
  const rows = await prisma.$queryRaw<{ empresaNif: string }[]>`
    SELECT DISTINCT "empresaNif"
    FROM "Instalacao"
    WHERE EXTRACT(MONTH FROM "dataInicioContrato") = ${parseInt(mesInicio)}
  `;
  return rows.map((r) => r.empresaNif);
}

export function buildWhere(
  distrito: string | undefined,
  filtro: string,
  incluirJaPesquisados = false,
  nifsComMesInicio: string[] | null = null,
) {
  const semTelefone = { OR: [{ telefone: null }, { telefone: "" }] };
  const semEmail    = { OR: [{ email: null }, { email: "" }] };

  const contactFilter =
    filtro === "sem_telefone" ? semTelefone :
    filtro === "sem_email"    ? semEmail :
    { AND: [semTelefone, semEmail] };

  const notConditions: object[] = [{ nif: { startsWith: "RASCUNHO_" } }];
  if (!incluirJaPesquisados) {
    notConditions.push({ enriquecimentoStatus: { in: JA_PESQUISADOS_SEM_DADOS } });
  }

  return {
    rascunho: false,
    NOT: notConditions,
    ...(distrito ? { distrito } : {}),
    ...(nifsComMesInicio !== null ? { nif: { in: nifsComMesInicio } } : {}),
    ...contactFilter,
  };
}
