import { NextResponse } from "next/server";
import { getCompilations, deleteCompilation, upsertCompilation } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const c = getCompilations().find(x => x.id === id);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const all = getCompilations();
  const existing = all.find(x => x.id === id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  const updated = { ...existing, ...body, id, updated_at: new Date().toISOString() };
  upsertCompilation(updated);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  deleteCompilation(id);
  return NextResponse.json({ ok: true });
}
