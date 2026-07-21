import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filename = req.nextUrl.searchParams.get("filename");
  if (!filename || !req.body) {
    return NextResponse.json({ error: "filename obrigatório" }, { status: 400 });
  }

  const blob = await put(`email-outreach/${Date.now()}-${filename}`, req.body, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
