import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { enviarEmail, montarCorpoEmail } from "@/lib/email";

const JANELA_24H_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ nif: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nif } = await params;
  const { destinatarios, modeloEmailId, assunto, corpoHtml } = await req.json();

  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return NextResponse.json({ error: "Selecione pelo menos um destinatário" }, { status: 400 });
  }
  if (!assunto?.trim() || !corpoHtml?.trim()) {
    return NextResponse.json({ error: "Assunto e corpo são obrigatórios" }, { status: 400 });
  }

  const empresa = await prisma.empresa.findUnique({
    where: { nif },
    include: { kanbanCard: true },
  });
  if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  if (!empresa.kanbanCard) {
    return NextResponse.json({ error: "Esta empresa não está no Kanban" }, { status: 403 });
  }
  if (session.user.role !== "MASTER" && empresa.kanbanCard.userId !== session.user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const [conta, modelo] = await Promise.all([
    prisma.contaEmailSMTP.findUnique({ where: { userId: session.user.id } }),
    modeloEmailId
      ? prisma.modeloEmail.findUnique({ where: { id: modeloEmailId }, select: { nome: true } })
      : Promise.resolve(null),
  ]);

  if (!conta || !conta.ativo) {
    return NextResponse.json(
      { error: "Não tens uma conta de email configurada. Fala com o Master para a associar em Email > Contas." },
      { status: 400 }
    );
  }

  const desde = new Date(Date.now() - JANELA_24H_MS);
  const enviadosUltimas24h = await prisma.envioEmail.count({
    where: {
      status: "ENVIADO",
      enviadoEm: { gte: desde },
      OR: [{ contaEmailId: conta.id }, { campanha: { contaEmailId: conta.id } }],
    },
  });
  if (enviadosUltimas24h >= conta.limiteDiario) {
    return NextResponse.json({ error: "Limite diário de envios da tua conta de email foi atingido." }, { status: 429 });
  }

  const envio = await prisma.envioEmail.create({
    data: {
      origem: "MANUAL",
      status: "ENVIANDO",
      contaEmailId: conta.id,
      modeloEmailId: modeloEmailId || null,
      enviadoPorId: session.user.id,
      empresaNif: nif,
      assuntoEnviado: assunto.trim(),
      corpoEnviadoHtml: corpoHtml,
      destinatarios: destinatarios.join(";"),
      dsnSolicitado: true,
    },
  });

  const html = montarCorpoEmail({
    corpoHtml,
    assinaturaHtml: conta.assinaturaHtml,
    trackingToken: envio.trackingToken,
  });

  try {
    const { messageId } = await enviarEmail({
      conta,
      destinatario: destinatarios.join(","),
      assunto: assunto.trim(),
      html,
      solicitarAvisoEntrega: true,
    });

    await prisma.envioEmail.update({
      where: { id: envio.id },
      data: { status: "ENVIADO", enviadoEm: new Date(), messageId },
    });
  } catch (err) {
    await prisma.envioEmail.update({
      where: { id: envio.id },
      data: { status: "FALHOU", erro: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { error: `Falha ao enviar o email: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  const nota = await prisma.nota.create({
    data: {
      texto: `Email enviado${modelo ? ` — Modelo: ${modelo.nome}` : ""} — para ${destinatarios.join(", ")}`,
      empresaNif: nif,
      userId: session.user.id,
    },
    include: { user: { select: { nome: true } } },
  });

  return NextResponse.json({ ok: true, nota }, { status: 201 });
}
