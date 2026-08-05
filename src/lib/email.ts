import nodemailer from "nodemailer";
import { decrypt } from "@/lib/crypto";
import type { ContaEmailSMTP } from "@prisma/client";

export function getBaseUrl(): string {
  return process.env.APP_URL ?? `https://${process.env.VERCEL_URL}`;
}

export function trackingPixelHtml(trackingToken: string): string {
  const url = `${getBaseUrl()}/api/email/track/${trackingToken}`;
  return `<img src="${url}" width="1" height="1" alt="" style="display:none" />`;
}

export function montarCorpoEmail(params: {
  corpoHtml: string;
  assinaturaHtml?: string | null;
  trackingToken: string;
}): string {
  const assinatura = params.assinaturaHtml ? `<div>${params.assinaturaHtml}</div>` : "";
  return `${params.corpoHtml}${assinatura}${trackingPixelHtml(params.trackingToken)}`;
}

export async function enviarEmail(params: {
  conta: ContaEmailSMTP;
  destinatario: string;
  assunto: string;
  html: string;
  // Pede ao servidor SMTP do destinatário uma notificação de ENTREGA (DSN, RFC 3461),
  // não de leitura. Só funciona se o servidor de destino suportar a extensão DSN —
  // muitos ignoram o pedido silenciosamente, por isso é "best effort", não garantido.
  // A confirmação de leitura continua a ser feita à parte, pelo pixel de tracking.
  solicitarAvisoEntrega?: boolean;
}): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport({
    host: params.conta.host,
    port: params.conta.porta,
    secure: params.conta.porta === 465,
    auth: {
      user: params.conta.usuario,
      pass: decrypt(params.conta.passwordCifrada),
    },
  });

  const info = await transporter.sendMail({
    from: params.conta.usuario,
    to: params.destinatario,
    subject: params.assunto,
    html: params.html,
    ...(params.solicitarAvisoEntrega && {
      dsn: {
        return: "headers",
        notify: ["success", "failure", "delay"],
        recipient: params.conta.usuario,
      },
    }),
  });

  return { messageId: info.messageId };
}
