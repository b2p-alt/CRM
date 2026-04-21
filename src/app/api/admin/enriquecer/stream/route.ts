import { NextRequest } from "next/server";
import { jobStore } from "@/lib/enriquecimento/job-store";

export async function GET(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      let ticks = 0;
      const interval = setInterval(() => {
        const job = jobStore.get(jobId);
        if (!job) { send({ error: "job não encontrado" }); controller.close(); clearInterval(interval); return; }

        send({ done: job.done, total: job.total, status: job.status, currentNome: job.currentNome });

        if (job.status !== "running" || ++ticks > 1200) {
          clearInterval(interval);
          controller.close();
        }
      }, 500);

      req.signal.addEventListener("abort", () => { clearInterval(interval); controller.close(); });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
