import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const instalacaoSchema = z.object({
  cpe: z.string().min(1),
  morada: z.string().optional(),
  tipoInstalacao: z.enum(["MAT", "AT", "MT", "BTE", "BTN"]),
  cicloTarifario: z.enum(["SIMPLES", "BI_HORARIO", "TRI_HORARIO", "DIARIO", "SEMANAL", "SEMANAL_OPCIONAL"]),
  dataInicioContrato: z.string().optional(),
  mesTermino: z.string().optional(),
  fornecedor: z.string().optional(),
  consumoPonta: z.number().optional(),
  consumoCheia: z.number().optional(),
  consumoVazio: z.number().optional(),
  consumoSVazio: z.number().optional(),
  consumoAnual: z.number().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nif } = await params;
  const instalacoes = await prisma.instalacao.findMany({
    where: { empresaNif: nif },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(instalacoes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nif } = await params;
  const body = await req.json();
  const parsed = instalacaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = {
    ...parsed.data,
    empresaNif: nif,
    dataInicioContrato: parsed.data.dataInicioContrato
      ? new Date(parsed.data.dataInicioContrato)
      : undefined,
  };

  const instalacao = await prisma.instalacao.create({ data });
  return NextResponse.json(instalacao, { status: 201 });
}
