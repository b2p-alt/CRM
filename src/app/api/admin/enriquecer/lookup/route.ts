import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { lookupNif } from "@/lib/enriquecimento/nifpt";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const nif = new URL(req.url).searchParams.get("nif") ?? "";
  // Strip PT prefix — NIF.pt expects 9 digits
  const nif9 = nif.replace(/^PT/, "");
  if (!/^\d{9}$/.test(nif9)) {
    return NextResponse.json({ found: false, error: "NIF inválido" });
  }

  const result = await lookupNif(nif9);
  return NextResponse.json(result);
}
