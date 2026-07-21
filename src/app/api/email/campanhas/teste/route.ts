import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enviarEmail, montarCorpoEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contaEmailId, modeloEmailId, destinatarios } = await req.json();

  const lista: string[] = Array.isArray(destinatarios)
    ? destinatarios.map((d: string) => d.trim()).filter(Boolean)
    : [];

  if (!contaEmailId || !modeloEmailId || lista.length === 0) {
    return NextResponse.json({ error: "Conta, modelo e pelo menos um destinatário são obrigatórios" }, { status: 400 });
  }

  const [conta, modelo] = await Promise.all([
    prisma.contaEmailSMTP.findUnique({ where: { id: contaEmailId } }),
    prisma.modeloEmail.findUnique({ where: { id: modeloEmailId } }),
  ]);

  if (!conta) return NextResponse.json({ error: "Conta de envio não encontrada" }, { status: 404 });
  if (!modelo) return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });

  const html = montarCorpoEmail({
    corpoHtml: modelo.corpoHtml,
    assinaturaHtml: conta.assinaturaHtml,
    trackingToken: randomUUID(),
  });

  const resultados = [];
  for (const destinatario of lista) {
    try {
      await enviarEmail({ conta, destinatario, assunto: `[TESTE] ${modelo.assunto}`, html });
      resultados.push({ destinatario, ok: true });
    } catch (err) {
      resultados.push({ destinatario, ok: false, erro: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ resultados });
}
