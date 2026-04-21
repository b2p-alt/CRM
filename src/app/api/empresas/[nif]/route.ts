import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const updateSchema = z.object({
  nif: z.string().regex(/^PT\d{9}$/, "NIF inválido. Formato: PT + 9 dígitos").optional(),
  nome: z.string().min(1).optional(),
  telefone: z.string().optional(),
  email: z.string().optional().refine(
    (v) => !v || v.split(";").map(s => s.trim()).filter(Boolean).every(s => z.string().email().safeParse(s).success),
    { message: "Email inválido. Para múltiplos emails use ponto-e-vírgula (ex: a@b.com; c@d.com)" }
  ),
  morada: z.string().optional(),
  distrito: z.string().optional(),
  localidade: z.string().optional(),
  quemAtende: z.string().optional(),
  responsavel: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nif } = await params;
  const empresa = await prisma.empresa.findUnique({
    where: { nif },
    include: {
      instalacoes: { orderBy: { createdAt: "desc" } },
      notas: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { nome: true } } },
      },
      kanbanCard: { include: { user: { select: { nome: true } } } },
    },
  });

  if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  return NextResponse.json(empresa);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nif } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const newNif = parsed.data.nif;
  const { nif: _nif, ...otherFields } = parsed.data;

  // NIF change: requires MASTER + full migration transaction
  if (newNif && newNif !== nif) {
    if (session.user.role !== "MASTER") {
      return NextResponse.json({ error: "Sem permissão para alterar NIF" }, { status: 403 });
    }
    const current = await prisma.empresa.findUnique({ where: { nif } });
    if (!current) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.empresa.create({ data: { ...current, nif: newNif, ...otherFields, updatedAt: new Date() } });
      await tx.instalacao.updateMany({ where: { empresaNif: nif }, data: { empresaNif: newNif } });
      await tx.nota.updateMany({ where: { empresaNif: nif }, data: { empresaNif: newNif } });
      await tx.kanbanCard.updateMany({ where: { empresaNif: nif }, data: { empresaNif: newNif } });
      await tx.empresa.delete({ where: { nif } });
    });

    const updated = await prisma.empresa.findUnique({ where: { nif: newNif } });
    return NextResponse.json(updated);
  }

  const empresa = await prisma.empresa.update({
    where: { nif },
    data: { ...otherFields, updatedAt: new Date() },
  });

  return NextResponse.json(empresa);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { nif } = await params;

  await prisma.$transaction([
    prisma.kanbanCard.deleteMany({ where: { empresaNif: nif } }),
    prisma.nota.deleteMany({ where: { empresaNif: nif } }),
    prisma.instalacao.deleteMany({ where: { empresaNif: nif } }),
    prisma.empresa.delete({ where: { nif } }),
  ]);

  return NextResponse.json({ ok: true });
}
