import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const updateSchema = z.object({
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

  const empresa = await prisma.empresa.update({
    where: { nif },
    data: { ...parsed.data, updatedAt: new Date() },
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
  await prisma.empresa.delete({ where: { nif } });
  return NextResponse.json({ ok: true });
}
