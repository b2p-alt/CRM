import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
);

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    await prisma.envioEmail.updateMany({
      where: { trackingToken: token, abertoEm: null },
      data: { abertoEm: new Date() },
    });
  } catch {
    // pixel deve responder sempre, mesmo que o registo falhe
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
