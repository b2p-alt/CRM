import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const updateSchema = z.object({
  cpe: z.string().min(1).optional(),
  morada: z.string().optional(),
  tipoInstalacao: z.enum(["MAT", "AT", "MT", "BTE", "BTN"]).optional(),
  cicloTarifario: z.enum(["SIMPLES", "BI_HORARIO", "TRI_HORARIO", "DIARIO", "SEMANAL", "SEMANAL_OPCIONAL"]).optional(),
  dataInicioContrato: z.string().optional(),
  mesTermino: z.string().optional(),
  fornecedor: z.string().optional(),
  consumoPonta: z.number().optional(),
  consumoCheia: z.number().optional(),
  consumoVazio: z.number().optional(),
  consumoSVazio: z.number().optional(),
  consumoAnual: z.number().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = {
    ...parsed.data,
    dataInicioContrato: parsed.data.dataInicioContrato
      ? new Date(parsed.data.dataInicioContrato)
      : undefined,
    updatedAt: new Date(),
  };

  const instalacao = await prisma.instalacao.update({ where: { id }, data });
  return NextResponse.json(instalacao);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  await prisma.instalacao.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
