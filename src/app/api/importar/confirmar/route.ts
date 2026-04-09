import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ParsedRecord } from "@/lib/importar/types";
import { importRecords } from "@/lib/importar/db-insert";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { records, distrito }: { records: ParsedRecord[]; distrito: string } = await req.json();

  if (!records?.length || !distrito) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const result = await importRecords(records, distrito);
  return NextResponse.json(result);
}
