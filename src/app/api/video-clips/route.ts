import { NextResponse } from "next/server";
import { getCatalog, getVideoChunks } from "@/lib/data";
import { complete, extractJson } from "@/lib/anthropic";

export const maxDuration = 60;

const SYSTEM = `You are a video editor scanning a YouTube transcript to find clips for a compilation. Return both CONTEXT and MOMENT clips:

- "context" — short setup clip (20-60s) that establishes the scenario
- "moment" — the peak/payoff itself (30-180s), the wild line or action

Per request: 1-2 context + 2-3 moments (or whatever the video supports).

Always pick start/end times that match line start times so cuts begin at sentence boundaries, never mid-word.

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

Transcript chunks (s = chunk start, e = chunk end, lines = [{s = line start, t = text}]):
${JSON.stringify(compact)}

Find up to ${max_segments} non-overlapping segments — mix of context + moment.

For each:
- kind: "context" or "moment"
- start: start time of the line that begins the clip
- end: end time of the LAST line + 1-2 sec
- why: 1 sentence on what the clip delivers
- quote: the key line(s), ≤140 chars

Order by start time (chronological).

Return JSON: { "segments": [{ "kind": "context|moment", "start": <sec>, "end": <sec>, "why": "...", "quote": "..." }] }`,
    maxTokens: 2500,
    temperature: 0.2,
  });

  const parsed = extractJson<{ segments: any[] }>(out) || { segments: [] };
  return NextResponse.json({ video_id, segments: parsed.segments });
}
