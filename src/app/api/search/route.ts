import { NextResponse } from "next/server";
import { getCatalog, getChunks } from "@/lib/data";
import { complete, extractJson } from "@/lib/anthropic";
import type { TranscriptChunk } from "@/lib/types";

export const maxDuration = 180;

const STAGE1_SYS = `Pick the most relevant videos from a YouTube catalog that match a compilation theme. Return strict JSON.`;

const STAGE2_SYS = `You are a video editor scanning a YouTube transcript to find the BEST MOMENTS that match a compilation theme.

# What is a "moment"
A moment is the peak/payoff itself — the shocking line, the actual event, the wild reaction, the specific scene. NOT the 5 minutes of context leading up to it.

Find the moments themselves. Include just enough setup to make the moment land (usually 5-30 seconds of context), then end right after the payoff. Don't drag.

If a theme is "scary moments" and the whole video is about a scary trip, that doesn't mean the whole video is the clip. Find the SPECIFIC moments where something scary actually happens or is revealed — gunfire, a threat, a chase, a revelation that someone is a killer, etc.

# Choosing precise start/end times — CRUCIAL
The transcript has line-level data. Each line has a start time. **Always pick start/end times that match the start of a specific line** so the cut begins at a natural word boundary, never mid-sentence.

- start: pick the start time of the line that begins the moment (or the line that begins the brief setup before it)
- end: pick the END time of the last line that delivers the payoff. After that, cut.

If a video has lines like:
  [120.5s] we walked into the room and saw
  [122.3s] three guys with masks pointing guns at me
  [125.1s] one of them said get on the ground
Then a good clip starting at the threat would be start=120.5, end=127+ (extending past the last line a bit).

# Clip length
Target 1-5 minutes per clip, but length should serve the moment. A 90s clip is fine if that's the moment. A 4-minute clip is fine if the story needs that. Don't artificially extend or compress.

# What to avoid
- Generic intros ("Hey YouTube, welcome back")
- Sponsor reads
- "Subscribe" plugs
- Long meandering setup with no payoff
- Multiple unrelated moments stitched together (pick them as separate segments)

Return strict JSON.`;

interface Body { theme: string; max_videos?: number; max_segments_per_video?: number }

interface CompactLine { s: number; t: string }
interface CompactChunk { i: number; s: number; e: number; lines: CompactLine[] }

export async function POST(req: Request) {
  const { theme, max_videos = 8, max_segments_per_video = 3 } = await req.json() as Body;
  if (!theme?.trim()) {
    return NextResponse.json({ error: "theme required" }, { status: 400 });
  }
  const cat = getCatalog();
  const chunks = getChunks();

  // STAGE 1: rank videos by relevance using titles + descriptions
  const videoIndex = cat.videos.map(v => ({
    id: v.id, title: v.title,
    desc: (v.description || "").slice(0, 250).replace(/\n+/g, " "),
    duration_min: Math.round(v.duration_sec / 60),
    views: v.view_count,
  }));

  const stage1 = await complete({
    system: STAGE1_SYS,
    user: `Theme: """${theme}"""

Pick the ${max_videos} most relevant videos for this compilation. Prefer high view counts when several are equally relevant. Skip videos that don't contain the theme.

Catalog: ${JSON.stringify(videoIndex)}

Return JSON: { "videos": [{ "id": "...", "reason": "1-sentence why" }] }`,
    maxTokens: 3000,
    temperature: 0.3,
  });

  const ranked = extractJson<{ videos: { id: string; reason: string }[] }>(stage1);
  if (!ranked) return NextResponse.json({ error: "stage1 parse fail", raw: stage1 }, { status: 500 });

  // STAGE 2: for each picked video, find timestamps in its transcript
  const results = await Promise.all(ranked.videos.slice(0, max_videos).map(async ({ id, reason }) => {
    const video = cat.videos.find(v => v.id === id);
    if (!video) return null;
    const vc = chunks[id];
    if (!vc) {
      return { video_id: id, title: video.title, url: video.url, reason,
               segments: [], note: "no transcript available" };
    }

    // Pass line-level data so model can pick precise sentence-start cuts.
    const compact: CompactChunk[] = vc.chunks.map((c: TranscriptChunk & { lines?: { s: number; e: number; t: string }[] }, i: number) => ({
      i,
      s: Math.round(c.start),
      e: Math.round(c.end),
      lines: (c.lines ?? []).map(l => ({ s: Math.round(l.s * 10) / 10, t: l.t })),
    }));

    const out = await complete({
      system: STAGE2_SYS,
      user: `Theme: """${theme}"""
Video title: "${video.title}"
Video duration: ${Math.round(video.duration_sec / 60)} minutes

Transcript chunks. Each chunk has line-level data (s = line start time in seconds, t = line text). Use the line start times to choose precise cut points at word boundaries.

${JSON.stringify(compact)}

Find up to ${max_segments_per_video} non-overlapping moments that best match the theme.

For each moment:
- start: the start time of the LINE that begins the clip (or just before)
- end: the end time of the LAST line in the clip (give it +1-2 sec breathing room)
- why: 1 sentence on what makes this moment work
- quote: the actual peak line(s) from the transcript, shortened to ≤150 chars, in quotes

If no moments fit, return { "segments": [] }.

Return JSON: { "segments": [{ "start": <sec>, "end": <sec>, "why": "...", "quote": "..." }] }`,
      maxTokens: 2500,
      temperature: 0.2,
    });
    const parsed = extractJson<{ segments: any[] }>(out) || { segments: [] };
    return { video_id: id, title: video.title, url: video.url, reason, segments: parsed.segments };
  }));

  const filtered = results.filter(Boolean);
  return NextResponse.json({ theme, results: filtered });
}
