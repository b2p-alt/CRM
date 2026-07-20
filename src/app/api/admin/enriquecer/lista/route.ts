import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildWhere, getNifsComMesInicio } from "@/lib/enriquecimento/where";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const distrito             = searchParams.get("distrito") || undefined;
  const filtro               = searchParams.get("filtro") || "ambos";
  const mesInicio             = searchParams.get("mesInicio") || undefined;
  const incluirJaPesquisados = searchParams.get("incluirJaPesquisados") === "1";

  const nifsComMesInicio = await getNifsComMesInicio(mesInicio);
  const empresas = await prisma.empresa.findMany({
    where: buildWhere(distrito, filtro, incluirJaPesquisados, nifsComMesInicio),
    select: { nif: true, nome: true, telefone: true, email: true, morada: true, localidade: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(empresas);
}
