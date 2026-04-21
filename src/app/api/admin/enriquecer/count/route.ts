import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const distrito = searchParams.get("distrito") || undefined;
  const filtro   = searchParams.get("filtro") || "ambos"; // sem_telefone | sem_email | ambos

  const where = buildWhere(distrito, filtro);
  const count = await prisma.empresa.count({ where });
  return NextResponse.json({ count });
}

export function buildWhere(distrito: string | undefined, filtro: string) {
  const base = { rascunho: false, NOT: { nif: { startsWith: "RASCUNHO_" } } };
  const semTelefone = { OR: [{ telefone: null }, { telefone: "" }] };
  const semEmail    = { OR: [{ email: null }, { email: "" }] };

  const contactFilter =
    filtro === "sem_telefone" ? semTelefone :
    filtro === "sem_email"    ? semEmail :
    { AND: [semTelefone, semEmail] }; // ambos = faltam os dois

  return {
    ...base,
    ...(distrito ? { distrito } : {}),
    ...contactFilter,
  };
}
