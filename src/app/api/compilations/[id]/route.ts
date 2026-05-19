import { NextResponse } from "next/server";
import { getCompilation, upsertCompilation, deleteCompilation } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const c = await getCompilation(params.id);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const existing = await getCompilation(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  const merged = { ...existing, ...body, id: params.id };
  const updated = await upsertCompilation(merged);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await deleteCompilation(params.id);
  return NextResponse.json({ ok: true });
}
