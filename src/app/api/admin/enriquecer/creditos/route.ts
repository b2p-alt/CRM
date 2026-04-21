import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

async function nifPtFetch(params: Record<string, string>) {
  const key = process.env.NIF_PT_API_KEY;
  if (!key) throw new Error("NIF_PT_API_KEY não configurada");
  const qs = new URLSearchParams({ json: "1", key, ...params });
  const res = await fetch(`https://www.nif.pt/?${qs}`, {
    headers: { "User-Agent": "B2P-CRM/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// GET /api/admin/enriquecer/creditos → saldo atual
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  try {
    const data = await nifPtFetch({ credits: "1" });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/enriquecer/creditos → comprar créditos
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { amount, invoiceName, invoiceNif } = await req.json();
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const params: Record<string, string> = { buy: String(amount) };
  if (invoiceName?.trim()) params.invoice_name = invoiceName.trim();
  if (invoiceNif?.trim())  params.invoice_nif  = invoiceNif.trim();

  try {
    const data = await nifPtFetch(params);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
