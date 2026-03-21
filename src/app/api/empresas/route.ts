import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const empresaSchema = z.object({
  nif: z.string().regex(/^PT\d{9}$/, "NIF deve ter formato PT + 9 dígitos"),
  nome: z.string().min(1),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  morada: z.string().optional(),
  distrito: z.string().optional(),
  localidade: z.string().optional(),
  quemAtende: z.string().optional(),
  responsavel: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const distrito = searchParams.get("distrito");
  const localidade = searchParams.get("localidade");
  const nif = searchParams.get("nif");
  const nome = searchParams.get("nome");
  const tipoInstalacao = searchParams.get("tipoInstalacao");
  const mesInicio = searchParams.get("mesInicio"); // 1-12

  // If mesInicio filter is active, get matching NIFs via raw SQL
  let nifsComMesInicio: string[] | null = null;
  if (mesInicio && /^([1-9]|1[0-2])$/.test(mesInicio)) {
    const rows = await prisma.$queryRaw<{ empresaNif: string }[]>`
      SELECT DISTINCT "empresaNif"
      FROM "Instalacao"
      WHERE EXTRACT(MONTH FROM "dataInicioContrato") = ${parseInt(mesInicio)}
    `;
    nifsComMesInicio = rows.map((r) => r.empresaNif);
  }

  const empresas = await prisma.empresa.findMany({
    where: {
      ...(distrito && { distrito }),
      ...(localidade && { localidade }),
      ...(nif && { nif: { contains: nif, mode: "insensitive" } }),
      ...(nome && { nome: { contains: nome, mode: "insensitive" } }),
      ...(tipoInstalacao && {
        instalacoes: { some: { tipoInstalacao: tipoInstalacao as never } },
      }),
      ...(nifsComMesInicio !== null && { nif: { in: nifsComMesInicio } }),
      kanbanCard: null,
    },
    include: {
      _count: { select: { instalacoes: true } },
    },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(empresas);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = empresaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.empresa.findUnique({ where: { nif: parsed.data.nif } });
  if (existing) {
    return NextResponse.json({ error: "NIF já existe" }, { status: 409 });
  }

  const empresa = await prisma.empresa.create({ data: parsed.data });
  return NextResponse.json(empresa, { status: 201 });
}
