import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ParsedRecord } from "@/lib/importar/types";
import { EnrichData } from "@/lib/importar/racius";
import { importRecords } from "@/lib/importar/db-insert";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { records, distrito, enrichResults }: {
    records: ParsedRecord[];
    distrito: string;
    enrichResults?: Record<string, EnrichData>;
  } = await req.json();

  if (!records?.length || !distrito) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const result = await importRecords(records, distrito, enrichResults ?? {});
  return NextResponse.json(result);
}
