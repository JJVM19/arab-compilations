import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { parseVtt, chunkLines } from "@/lib/vtt";

const execp = promisify(exec);

const API_KEY = process.env.YOUTUBE_API_KEY!;
const ARAB_CHANNEL_ID = process.env.ARAB_CHANNEL_ID || "UC8H9Zmx8CslalkliFegKXhQ";
const YT_BASE = "https://www.googleapis.com/youtube/v3";

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const CHUNKS_PATH = path.join(DATA_DIR, "chunks.json");

interface Body { input: string }

function extractVideoId(input: string): string | null {
  const cleaned = input.trim();
  // Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) return cleaned;
  // youtu.be/ID
  const short = cleaned.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=ID
  const long = cleaned.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (long) return long[1];
  // youtube.com/shorts/ID (shouldn't happen for longform but anyway)
  const sh = cleaned.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (sh) return sh[1];
  return null;
}

function parseDuration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

export async function POST(req: Request) {
  try {
    const { input } = await req.json() as Body;
    const id = extractVideoId(input);
    if (!id) {
      return NextResponse.json({ error: "Could not parse a YouTube video ID from input." }, { status: 400 });
    }

    // 1. Fetch metadata
    const metaRes = await fetch(
      `${YT_BASE}/videos?part=snippet,contentDetails,statistics&id=${id}&key=${API_KEY}`,
    );
    const metaJson = await metaRes.json();
    if (!metaJson.items?.length) {
      return NextResponse.json({ error: "Video not found on YouTube." }, { status: 404 });
    }
    const v = metaJson.items[0];

    // 2. Validate channel
    if (v.snippet.channelId !== ARAB_CHANNEL_ID) {
      return NextResponse.json({
        error: `Video belongs to channel "${v.snippet.channelTitle}". Only videos from @Arab (${ARAB_CHANNEL_ID}) are allowed.`,
      }, { status: 400 });
    }

    const durationSec = parseDuration(v.contentDetails.duration);
    const flat = {
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

    // 3. Append to catalog (if not already present)
    const catalogRaw = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
    const exists = catalogRaw.videos.find((x: { id: string }) => x.id === id);
    if (exists) {
      return NextResponse.json({ error: "This video is already in the library.", video: exists }, { status: 409 });
    }
    catalogRaw.videos.unshift(flat);
    catalogRaw.count = catalogRaw.videos.length;
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalogRaw, null, 2));

    // 4. Download transcript via yt-dlp into a temp dir
    let chunksAdded = 0;
    let transcriptStatus: "ok" | "missing" | "error" = "missing";
    let chunksAll: Record<string, any> = {};
    if (fs.existsSync(CHUNKS_PATH)) {
      chunksAll = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf-8"));
    }
    try {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yt-add-"));
      const outBase = path.join(tmp, id);
      await execp(
        `yt-dlp --quiet --no-warnings --skip-download --write-auto-subs --sub-lang en --sub-format vtt --output "${outBase}" "https://www.youtube.com/watch?v=${id}"`,
        { timeout: 60_000 },
      );
      const vttPath = `${outBase}.en.vtt`;
      if (fs.existsSync(vttPath)) {
        const vtt = fs.readFileSync(vttPath, "utf-8");
        const lines = parseVtt(vtt);
        const chunks = chunkLines(lines, 45);
        if (chunks.length) {
          chunksAll[id] = { id, chunks };
          fs.writeFileSync(CHUNKS_PATH, JSON.stringify(chunksAll));
          chunksAdded = chunks.length;
          transcriptStatus = "ok";
        }
      }
      // Cleanup temp
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    } catch (err: any) {
      transcriptStatus = "error";
    }

    return NextResponse.json({
      ok: true,
      video: flat,
      transcript: transcriptStatus,
      chunks_added: chunksAdded,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
