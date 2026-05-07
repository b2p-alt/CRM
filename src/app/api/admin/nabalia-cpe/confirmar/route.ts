import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { ParsedRecord } from "@/lib/importar/types";
import { EnrichData } from "@/lib/importar/racius";
import { importRecords } from "@/lib/importar/db-insert";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER")
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const { records, distrito, enrichResults }: {
    records: ParsedRecord[];
    distrito: string;
    enrichResults?: Record<string, EnrichData>;
  } = await req.json();

  if (!records?.length || !distrito)
    return new Response(JSON.stringify({ error: "Dados inválidos" }), { status: 400 });

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  function send(data: object) {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  (async () => {
    try {
      const result = await importRecords(
        records, distrito, enrichResults ?? {}, false,
        (done, total) => send({ done, total }),
      );
      send({ result });
    } catch (err) {
      send({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
