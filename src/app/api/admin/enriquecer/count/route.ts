import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const distrito              = searchParams.get("distrito") || undefined;
  const filtro                = searchParams.get("filtro") || "ambos";
  const incluirJaPesquisados  = searchParams.get("incluirJaPesquisados") === "1";

  const where = buildWhere(distrito, filtro, incluirJaPesquisados);
  const count = await prisma.empresa.count({ where });
  return NextResponse.json({ count });
}

const JA_PESQUISADOS_SEM_DADOS = ["sem_dados", "nif_invalido"];

export function buildWhere(
  distrito: string | undefined,
  filtro: string,
  incluirJaPesquisados = false,
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
    ...contactFilter,
  };
}
