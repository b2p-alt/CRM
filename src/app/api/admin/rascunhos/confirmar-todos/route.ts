import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Only confirm empresas with valid NIF (not placeholder)
  const result = await prisma.empresa.updateMany({
    where: { rascunho: true, NOT: { nif: { startsWith: "RASCUNHO_" } } },
    data: { rascunho: false, importProblemas: null },
  });

  return NextResponse.json({ confirmadas: result.count });
}
