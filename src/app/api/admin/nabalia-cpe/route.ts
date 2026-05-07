import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchCpe, normalizeNipc } from "@/lib/nabalia";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { codPostal, codPostalAte, voltageCode } = await req.json();

  if (!codPostal && !voltageCode)
    return NextResponse.json({ error: "Indique pelo menos um filtro" }, { status: 400 });

  try {
    const records = await searchCpe(codPostal ?? "", voltageCode ?? "", codPostalAte ?? "");

    // Verificar quais NICs já existem no CRM
    const nics = [...new Set(records.map((r) => normalizeNipc(r.VAT_No ?? r.NIPC ?? "")))].filter(Boolean);
    const existing = await prisma.empresa.findMany({
      where: { nif: { in: nics } },
      select: { nif: true },
    });
    const existingSet = new Set(existing.map((e: { nif: string }) => e.nif));

    // Verificar quais CPEs já existem
    const cpes = records.map((r) => r.No ?? r.CPE ?? "").filter(Boolean);
    const existingCpes = await prisma.instalacao.findMany({
      where: { cpe: { in: cpes } },
      select: { cpe: true },
    });
    const existingCpeSet = new Set(existingCpes.map((i: { cpe: string }) => i.cpe));

    const result = records.map((r) => {
      const nipc = normalizeNipc(r.VAT_No ?? r.NIPC ?? "");
      const cpe  = r.No ?? r.CPE ?? "";
      return {
        ...r,
        _nipc:          nipc,
        _cpe:           cpe,
        _empresaExiste: existingSet.has(nipc),
        _cpeExiste:     existingCpeSet.has(cpe),
      };
    });

    // Devolve os nomes reais dos campos do primeiro registo para diagnóstico
    const _fieldNames = records[0] ? Object.keys(records[0]) : [];

    return NextResponse.json({ records: result, total: result.length, _fieldNames });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
