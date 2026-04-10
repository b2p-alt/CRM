import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getJob } from "@/lib/importar/job-store";

// No maxDuration needed — job is already done when client opens this stream.

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

      // Poll until done or error
      let ticks = 0;
      const maxTicks = 3600 * 2; // 2 hrs max at 500ms interval

      const interval = setInterval(() => {
        ticks++;
        const job = getJob(jobId);

        if (!job) {
          send({ status: "error", error: "Job não encontrado" });
          clearInterval(interval);
          controller.close();
          return;
        }

        send({
          status: job.status,
          progress: job.progress,
          currentPage: job.currentPage,
          totalPages: job.totalPages,
          error: job.error,
        });

        if (job.status === "done" || job.status === "error" || ticks >= maxTicks) {
          clearInterval(interval);
          controller.close();
        }
      }, 500);

      // Cleanup if client disconnects
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
