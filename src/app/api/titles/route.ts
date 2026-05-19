import { NextResponse } from "next/server";
import { getTitles, upsertTitle } from "@/lib/data";
import type { SavedTitle } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ titles: getTitles() });
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<SavedTitle>;
  const t: SavedTitle = {
    id: body.id ?? crypto.randomUUID(),
    title: body.title ?? "Untitled",
    alt_titles: body.alt_titles ?? [],
    pitch: body.pitch ?? "",
    target_length_min: body.target_length_min ?? 30,
    video_ids: body.video_ids ?? [],
    reasons: body.reasons ?? {},
    saved_at: body.saved_at ?? new Date().toISOString(),
  };
  upsertTitle(t);
  return NextResponse.json(t);
}
