import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { lookupNif } from "@/lib/enriquecimento/nifpt";
import { enrichNif } from "@/lib/importar/einforma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const nif    = params.get("nif") ?? "";
  const fonte  = params.get("fonte") ?? "nifpt"; // "nifpt" | "einforma"

  const nif9 = nif.replace(/^PT/, "");
  if (!/^\d{9}$/.test(nif9)) {
    return NextResponse.json({ found: false, error: "NIF inválido" });
  }

  if (fonte === "einforma") {
    const r = await enrichNif(nif9);
    return NextResponse.json({
      found:       r.found,
      telefone:    r.telefone,
      email:       r.email,
      website:     r.website,
      nome:        null,
      morada:      null,
      localidade:  null,
      raw:         null,
    });
  }

  const result = await lookupNif(nif9);
  return NextResponse.json(result);
}
