import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getEnrichJob } from "@/lib/importar/enrich-store";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return new Response("Forbidden", { status: 403 });
  }

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      let ticks = 0;
      const interval = setInterval(() => {
        ticks++;
        const job = getEnrichJob(jobId);

        if (!job) {
          send({ status: "error", error: "Job não encontrado" });
          clearInterval(interval);
          controller.close();
          return;
        }

        send({
          status: job.status,
          total: job.total,
          processed: job.processed,
          found: job.found,
          // Send full results only when done to avoid large payloads
          results: (job.status === "done" || job.status === "paused") ? job.results : undefined,
        });

        if (job.status === "done" || job.status === "error" || job.status === "paused" || ticks > 7200) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
