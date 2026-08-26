import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const schema = z.object({
  nifs: z.array(z.string()).min(1),
  publica: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { nifs, publica } = parsed.data;

  const result = await prisma.empresa.updateMany({
    where: { nif: { in: nifs } },
    data: { empresaPublica: publica },
  });

  return NextResponse.json({ atualizadas: result.count });
}
