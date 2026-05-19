import { NextResponse } from "next/server";
import { getCompilations, upsertCompilation } from "@/lib/data";
import { SavedCompilation } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ compilations: getCompilations() });
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<SavedCompilation>;
  const now = new Date().toISOString();
  const c: SavedCompilation = {
    id: body.id ?? crypto.randomUUID(),
    title: body.title ?? "Untitled compilation",
    pitch: body.pitch ?? "",
    target_length_min: body.target_length_min ?? 30,
    created_at: body.created_at ?? now,
    updated_at: now,
    clips: body.clips ?? [],
  };
  upsertCompilation(c);
  return NextResponse.json(c);
}
