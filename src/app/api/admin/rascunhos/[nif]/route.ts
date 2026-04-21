import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  nif: z.string().min(1).optional(),
  telefone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  responsavel: z.string().optional().nullable(),
  quemAtende: z.string().optional().nullable(),
  distrito: z.string().optional().nullable(),
  localidade: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { nif } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { nif: newNif, ...rest } = parsed.data;

  // If NIF is changing, we need to recreate (it's the PK)
  if (newNif && newNif !== nif) {
    const existing = await prisma.empresa.findUnique({ where: { nif } });
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    if (await prisma.empresa.findUnique({ where: { nif: newNif } })) {
      return NextResponse.json({ error: "NIF já existe" }, { status: 409 });
    }

    // Recreate with new NIF inside a transaction
    await prisma.$transaction(async (tx) => {
      await tx.empresa.create({
        data: { ...existing, ...rest, nif: newNif, updatedAt: new Date() },
      });
      await tx.instalacao.updateMany({ where: { empresaNif: nif }, data: { empresaNif: newNif } });
      await tx.nota.updateMany({ where: { empresaNif: nif }, data: { empresaNif: newNif } });
      await tx.empresa.delete({ where: { nif } });
    });

    const updated = await prisma.empresa.findUnique({ where: { nif: newNif } });
    return NextResponse.json(updated);
  }

  const updated = await prisma.empresa.update({
    where: { nif },
    data: { ...rest, updatedAt: new Date() },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { nif } = await params;
  await prisma.$transaction([
    prisma.nota.deleteMany({ where: { empresaNif: nif } }),
    prisma.instalacao.deleteMany({ where: { empresaNif: nif } }),
    prisma.empresa.delete({ where: { nif } }),
  ]);

  return NextResponse.json({ ok: true });
}
