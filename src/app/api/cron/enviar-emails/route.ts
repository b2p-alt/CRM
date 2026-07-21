import { prisma } from "@/lib/prisma";
import { enviarEmail, montarCorpoEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";
import type { Campanha, ContaEmailSMTP } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOTE_POR_TICK = 6;
const INTERVALO_MS = 10_000;
const JANELA_24H_MS = 24 * 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processarCampanha(campanha: Campanha & { contaEmail: ContaEmailSMTP }) {
  const desde = new Date(Date.now() - JANELA_24H_MS);

  const enviadosUltimas24h = await prisma.envioEmail.count({
    where: {
      campanha: { contaEmailId: campanha.contaEmailId },
      status: "ENVIADO",
      enviadoEm: { gte: desde },
    },
  });

  if (enviadosUltimas24h >= campanha.contaEmail.limiteDiario) {
    await prisma.campanha.update({ where: { id: campanha.id }, data: { status: "PAUSADA_LIMITE" } });
    return;
  }

  const lote = Math.min(LOTE_POR_TICK, campanha.contaEmail.limiteDiario - enviadosUltimas24h);
  if (lote <= 0) return;

  const claimedIds = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "EnvioEmail"
      WHERE "campanhaId" = ${campanha.id} AND status = 'PENDENTE'
      ORDER BY "createdAt" ASC
      LIMIT ${lote}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await tx.envioEmail.updateMany({ where: { id: { in: ids } }, data: { status: "ENVIANDO" } });
    return ids;
  });

  if (claimedIds.length === 0) {
    const restantes = await prisma.envioEmail.count({
      where: { campanhaId: campanha.id, status: { in: ["PENDENTE", "ENVIANDO"] } },
    });
    if (restantes === 0) {
      await prisma.campanha.update({ where: { id: campanha.id }, data: { status: "CONCLUIDA" } });
    }
    return;
  }

  const [envios, modelo] = await Promise.all([
    prisma.envioEmail.findMany({
      where: { id: { in: claimedIds } },
      include: { empresa: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.modeloEmail.findUniqueOrThrow({ where: { id: campanha.modeloEmailId } }),
  ]);

  for (let i = 0; i < envios.length; i++) {
    if (i > 0) await sleep(INTERVALO_MS);
    const envio = envios[i];

    try {
      const html = montarCorpoEmail({
        corpoHtml: modelo.corpoHtml,
        assinaturaHtml: campanha.contaEmail.assinaturaHtml,
        trackingToken: envio.trackingToken,
      });
      await enviarEmail({
        conta: campanha.contaEmail,
        destinatario: envio.empresa?.email ?? envio.emailAvulso!,
        assunto: modelo.assunto,
        html,
      });
      await prisma.envioEmail.update({
        where: { id: envio.id },
        data: { status: "ENVIADO", enviadoEm: new Date() },
      });
    } catch (err) {
      await prisma.envioEmail.update({
        where: { id: envio.id },
        data: { status: "FALHOU", erro: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campanhasAtivas = await prisma.campanha.findMany({
    where: { status: "A_ENVIAR" },
    include: { contaEmail: true },
  });

  for (const campanha of campanhasAtivas) {
    await processarCampanha(campanha);
  }

  return NextResponse.json({ ok: true, campanhasProcessadas: campanhasAtivas.length });
}
