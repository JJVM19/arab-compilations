import { NextResponse } from "next/server";
import { getCompilations, upsertCompilation } from "@/lib/data";
import { SavedClip } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const c = getCompilations().find(x => x.id === id);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const clip = await req.json() as SavedClip;
  c.clips.push(clip);
  upsertCompilation(c);
  return NextResponse.json(c);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // replace all clips (used for reorder / bulk edit)
  const { id } = await params;
  const c = getCompilations().find(x => x.id === id);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { clips } = await req.json() as { clips: SavedClip[] };
  c.clips = clips;
  upsertCompilation(c);
  return NextResponse.json(c);
}
