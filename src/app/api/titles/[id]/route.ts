import { NextResponse } from "next/server";
import { deleteTitle, getTitles } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = (await getTitles()).find(x => x.id === params.id);
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(t);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await deleteTitle(params.id);
  return NextResponse.json({ ok: true });
}
