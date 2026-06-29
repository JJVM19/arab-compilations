import { NextResponse } from "next/server";
import { findCatalogVideo, upsertCatalogVideo, upsertCatalogChunks } from "@/lib/data";
import { fetchTranscriptChunks } from "@/lib/transcript";
import type { Video } from "@/lib/types";

// Adds persist to Supabase (not the ephemeral filesystem) so they survive
// redeploys and are shared across instances.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const API_KEY = process.env.YOUTUBE_API_KEY!;
const ARAB_CHANNEL_ID = process.env.ARAB_CHANNEL_ID || "UC8H9Zmx8CslalkliFegKXhQ";
const YT_BASE = "https://www.googleapis.com/youtube/v3";

interface Body { input: string; source?: "arab" | "extended" }

function extractVideoId(input: string): string | null {
  const cleaned = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) return cleaned;
  const short = cleaned.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const long = cleaned.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (long) return long[1];
  const sh = cleaned.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (sh) return sh[1];
  const live = cleaned.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (live) return live[1];
  return null;
}

function parseDuration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

export async function POST(req: Request) {
  try {
    const { input, source } = await req.json() as Body;
    const id = extractVideoId(input);
    if (!id) {
      return NextResponse.json({ error: "Could not read a YouTube video ID from that input. Paste a full watch URL or the 11-character ID." }, { status: 400 });
    }

    // Already in the library (static baseline OR previously added)?
    const existing = await findCatalogVideo(id);
    if (existing) {
      return NextResponse.json({ error: "This video is already in the library.", video: existing }, { status: 409 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "Server is missing YOUTUBE_API_KEY — can't fetch video metadata. Add it to the deployment's environment variables." }, { status: 500 });
    }

    // 1. Fetch metadata (works for unlisted videos too, as long as they're not Private).
    const metaRes = await fetch(
      `${YT_BASE}/videos?part=snippet,contentDetails,statistics&id=${id}&key=${API_KEY}`,
    );
    const metaJson = await metaRes.json();
    if (!metaJson.items?.length) {
      return NextResponse.json({
        error: "Video not found on YouTube. If this is an extended cut, make sure it's uploaded as Unlisted (not Private) and the link is correct.",
      }, { status: 404 });
    }
    const v = metaJson.items[0];

    // 2. Resolve source. Arab's own channel → "arab"; anything else (e.g. an
    //    unlisted extended-cut upload on Pav's channel) → "extended". An explicit
    //    source from the client wins.
    const isArabChannel = v.snippet.channelId === ARAB_CHANNEL_ID;
    const resolvedSource: "arab" | "extended" = source ?? (isArabChannel ? "arab" : "extended");

    const durationSec = parseDuration(v.contentDetails.duration);
    const flat: Video = {
      id,
      title: v.snippet.title,
      description: v.snippet.description ?? "",
      published_at: v.snippet.publishedAt,
      duration: v.contentDetails.duration,
      duration_sec: durationSec,
      view_count: Number(v.statistics?.viewCount ?? 0),
      like_count: Number(v.statistics?.likeCount ?? 0),
      comment_count: Number(v.statistics?.commentCount ?? 0),
      url: `https://www.youtube.com/watch?v=${id}`,
      tags: v.snippet.tags ?? [],
    };

    // 3. Persist metadata to Supabase (survives redeploys).
    await upsertCatalogVideo({ ...flat, source: resolvedSource });

    // 4. Fetch transcript (timedtext → yt-dlp). "pending" is not a failure —
    //    the video is added either way and can be retried later.
    const t = await fetchTranscriptChunks(id);
    await upsertCatalogChunks(id, t.chunks, t.status, t.detail);

    return NextResponse.json({
      ok: true,
      video: flat,
      source: resolvedSource,
      channel: v.snippet.channelTitle,
      transcript: t.status,          // "ok" | "pending" | "error"
      chunks_added: t.chunks.length,
      detail: t.detail,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
