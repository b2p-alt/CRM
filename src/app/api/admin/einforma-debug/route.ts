import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const idSess = process.env.EINFORMA_ID_SESS?.trim();
  if (!idSess) return NextResponse.json({ error: "EINFORMA_ID_SESS em falta" }, { status: 500 });

  const nif = new URL(req.url).searchParams.get("nif") ?? "502079215";
  const url = `https://www.einforma.pt/servlet/app/portal/ENTP/id_sess/${idSess}/prod/ETIQUETA_EMPRESA/nif/${nif}/source/search/campaign/fichaemp/`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pt-PT,pt;q=0.9",
    },
    cache: "no-store",
    redirect: "follow",
  });

  const buf  = await res.arrayBuffer();
  const html = new TextDecoder("iso-8859-1").decode(buf);

  // Procura padrões relevantes no HTML
  const phoneMatch  = html.match(/[2-9][0-9]{8}/g);
  const emailMatch  = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  const hrefMatch   = html.match(/href="(https?:\/\/[^"]{4,80})"/g)?.slice(0, 20);

  // Encontra onde está o primeiro email no HTML e mostra contexto
  const emailAddr   = emailMatch?.[0];
  const emailIdx    = emailAddr ? html.indexOf(emailAddr) : -1;
  const emailCtx    = emailIdx >= 0 ? html.slice(Math.max(0, emailIdx - 300), emailIdx + 300) : null;

  // Encontra onde está o primeiro número de telefone
  const phoneNum    = phoneMatch?.find(n => n.startsWith("2") || n.startsWith("9"));
  const phoneIdx    = phoneNum ? html.indexOf(phoneNum) : -1;
  const phoneCtx    = phoneIdx >= 0 ? html.slice(Math.max(0, phoneIdx - 300), phoneIdx + 300) : null;

  return NextResponse.json({
    status: res.status,
    finalUrl: res.url,
    htmlLength: html.length,
    phonesFound: phoneMatch?.slice(0, 10),
    emailsFound: emailMatch?.slice(0, 10),
    hrefs: hrefMatch,
    emailContext: emailCtx,
    phoneContext: phoneCtx,
    first500: html.slice(0, 500),
  });
}
