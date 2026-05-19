import { NextResponse } from "next/server";
import { getCatalog, getChunks } from "@/lib/data";
import { complete, extractJson } from "@/lib/anthropic";
import type { TranscriptChunk } from "@/lib/types";

export const maxDuration = 180;

const STAGE1_SYS = `Pick the most relevant videos from a YouTube catalog that match a compilation theme. Return strict JSON.`;

const STAGE2_SYS = `You are a video editor scanning a YouTube transcript to find clips for a compilation. You return TWO kinds of clips per video:

# 1. CONTEXT clips ("kind": "context")
Short clips (20-60 seconds) that set up the scenario so a stranger could understand what's happening when the moment hits. Good context clips:
- Establish where Arab is and what he's doing
- Introduce key people, places, or stakes
- Quietly land the premise without giving away the punchline

In the final compilation, context clips will play FIRST, then the moment.

# 2. MOMENT clips ("kind": "moment")
The actual peak/payoff — the shocking line, the action, the reveal, the wild reaction. The clip a viewer would screenshot. Typical length 30-180 seconds. Stop right after the payoff lands.

# Per video, aim for:
- 1-2 context clips
- 2-3 moment clips
(skip context if the video opens with the moment cold)

# Choosing precise start/end times — CRUCIAL
Each transcript has line-level data (s = start sec, t = text). Pick start/end times that MATCH a line's start time so clips begin at natural word boundaries, never mid-sentence.

- start = start time of the line that opens the clip
- end = end time of the LAST line, +1-2 sec breathing room

# What to avoid
- Generic intros ("Hey YouTube, welcome back")
- Sponsor reads / "Subscribe" plugs
- Long meandering setup with no payoff (context should be SHORT)
- Multiple unrelated moments stitched into one segment

Return strict JSON.`;

interface Body { theme: string; max_videos?: number }

interface CompactLine { s: number; t: string }
interface CompactChunk { i: number; s: number; e: number; lines: CompactLine[] }

export async function POST(req: Request) {
  const { theme, max_videos = 8 } = await req.json() as Body;
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

Transcript chunks (s = chunk start sec, e = chunk end sec, lines = [{s = line start sec, t = text}]).

${JSON.stringify(compact)}

Return both CONTEXT and MOMENT clips (1-2 context + 2-3 moments per video). The context clips will play FIRST in the final compilation to set up the scenario, then the moments deliver the payoff.

For each segment:
- kind: "context" or "moment"
- start: start time of the LINE that begins the clip
- end: end time of the LAST line + 1-2 sec
- why: 1 sentence on what this clip delivers
- quote: the key line(s), ≤140 chars, in quotes

Order segments chronologically (by start time) in the array. If nothing fits, return { "segments": [] }.

Return JSON: { "segments": [{ "kind": "context|moment", "start": <sec>, "end": <sec>, "why": "...", "quote": "..." }] }`,
      maxTokens: 3000,
      temperature: 0.2,
    });
    const parsed = extractJson<{ segments: any[] }>(out) || { segments: [] };
    return { video_id: id, title: video.title, url: video.url, reason, segments: parsed.segments };
  }));

  const filtered = results.filter(Boolean);
  return NextResponse.json({ theme, results: filtered });
}
