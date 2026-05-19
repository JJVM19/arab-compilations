import { NextResponse } from "next/server";
import { appendClip, getCompilation, upsertCompilation } from "@/lib/data";
import { SavedClip } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const clip = await req.json() as SavedClip;
  const updated = await appendClip(params.id, clip);
  return NextResponse.json(updated);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  // Replace all clips (used for reorder / bulk edit)
  const existing = await getCompilation(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { clips } = await req.json() as { clips: SavedClip[] };
  const updated = await upsertCompilation({ ...existing, clips });
  return NextResponse.json(updated);
}
