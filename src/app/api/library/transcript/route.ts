import { NextResponse } from "next/server";
import { findCatalogVideo, upsertCatalogChunks } from "@/lib/data";
import { fetchTranscriptChunks } from "@/lib/transcript";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body { video_id: string }

// Re-attempt transcript fetch for an already-added video. Useful when YouTube
// hadn't generated auto-captions yet at add time (common for fresh uploads).
export async function POST(req: Request) {
  const { video_id } = await req.json() as Body;
  if (!video_id) {
    return NextResponse.json({ error: "video_id required" }, { status: 400 });
  }
  const existing = await findCatalogVideo(video_id);
  if (!existing) {
    return NextResponse.json({ error: "Video isn't in the library — add it first." }, { status: 404 });
  }
  const t = await fetchTranscriptChunks(video_id);
  await upsertCatalogChunks(video_id, t.chunks, t.status, t.detail);
  return NextResponse.json({
    ok: t.status === "ok",
    transcript: t.status,
    chunks_added: t.chunks.length,
    detail: t.detail,
  });
}
