import { NextResponse } from "next/server";
import { getCatalog, getVideoChunks } from "@/lib/data";
import { complete, extractJson } from "@/lib/anthropic";

export const maxDuration = 60;

const SYSTEM = `You are a video editor scanning a YouTube transcript to find the moments most relevant to a compilation theme.

Find the actual peak/payoff moments — concrete events, action, reveals, shocking lines — NOT the build-up.

Choose precise start/end times that match the start times of specific lines so cuts begin at natural word boundaries (never mid-sentence). Clip length should serve the moment (1-5 min typical, but can be shorter for a sharp moment or longer for a story).

Return strict JSON.`;

interface Body { video_id: string; theme: string; max_segments?: number }

export async function POST(req: Request) {
  const { video_id, theme, max_segments = 4 } = await req.json() as Body;
  if (!video_id || !theme?.trim()) {
    return NextResponse.json({ error: "video_id and theme required" }, { status: 400 });
  }
  const cat = getCatalog();
  const video = cat.videos.find(v => v.id === video_id);
  if (!video) return NextResponse.json({ error: "video not found" }, { status: 404 });

  const vc = getVideoChunks(video_id);
  if (!vc) return NextResponse.json({ video_id, segments: [], note: "no transcript" });

  const compact = vc.chunks.map((c: any, i: number) => ({
    i,
    s: Math.round(c.start),
    e: Math.round(c.end),
    lines: (c.lines ?? []).map((l: any) => ({ s: Math.round(l.s * 10) / 10, t: l.t })),
  }));

  const out = await complete({
    system: SYSTEM,
    user: `Theme: """${theme}"""
Video title: "${video.title}"
Video duration: ${Math.round(video.duration_sec / 60)} minutes

Transcript chunks (s = start sec, e = end sec, lines = [{s = line start sec, t = text}]):
${JSON.stringify(compact)}

Find up to ${max_segments} non-overlapping moments that best match the theme.

For each moment:
- start: the start time of the LINE that begins the clip
- end: the end time of the LAST line in the clip (give +1-2 sec breathing room)
- why: 1 sentence on what makes this moment work
- quote: the actual peak line(s), shortened to ≤140 chars

Return JSON: { "segments": [{ "start": <sec>, "end": <sec>, "why": "...", "quote": "..." }] }
If nothing fits, return { "segments": [] }.`,
    maxTokens: 2000,
    temperature: 0.2,
  });

  const parsed = extractJson<{ segments: any[] }>(out) || { segments: [] };
  return NextResponse.json({ video_id, segments: parsed.segments });
}
