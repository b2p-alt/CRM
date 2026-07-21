import { auth } from "@/auth";
import { calcularListasCampanha } from "@/lib/campanha";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mesParam = req.nextUrl.searchParams.get("mes");
  if (!mesParam || !/^([1-9]|1[0-2])$/.test(mesParam)) {
    return NextResponse.json({ error: "Parâmetro 'mes' inválido (esperado 1-12)" }, { status: 400 });
  }

  const listas = await calcularListasCampanha(parseInt(mesParam));
  return NextResponse.json(listas);
}
