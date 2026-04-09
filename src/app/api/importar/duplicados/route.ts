import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ParsedRecord } from "@/lib/importar/types";
import { cleanNipc, cleanCpe } from "@/lib/importar/parser";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { records }: { records: ParsedRecord[] } = await req.json();

  const nifs = [...new Set(records.map(r => cleanNipc(r.nipc)).filter(Boolean))] as string[];
  const cpes = [...new Set(records.map(r => cleanCpe(r.cpe)).filter(Boolean))]   as string[];

  const [existingEmpresas, existingInstalacoes] = await Promise.all([
    prisma.empresa.findMany({ where: { nif: { in: nifs } }, select: { nif: true } }),
    prisma.instalacao.findMany({ where: { cpe: { in: cpes } }, select: { cpe: true } }),
  ]);

  const existingNifs = new Set(existingEmpresas.map(e => e.nif));
  const existingCpes = new Set(existingInstalacoes.map(i => i.cpe));

  return NextResponse.json({
    existingNifs: [...existingNifs],
    existingCpes: [...existingCpes],
    totalEmpresas: nifs.length,
    totalInstalacoes: cpes.length,
    duplicateEmpresas: existingNifs.size,
    duplicateInstalacoes: existingCpes.size,
  });
}
