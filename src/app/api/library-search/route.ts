import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/data";
import { complete, extractJson } from "@/lib/anthropic";

export const maxDuration = 60;

const SYSTEM = `Score how relevant each YouTube video is to a free-form search query.

A score is 0-100:
- 90-100: exact match (theme is the dominant subject of the video)
- 70-89: strong match (theme appears prominently)
- 40-69: moderate match (touched on, but not the focus)
- 1-39: weak match (tangentially related)
- 0: no match

Use the title + description to judge.

Return strict JSON: only videos with score >= 25, sorted descending by score.`;

interface Body { query: string; limit?: number }

export async function POST(req: Request) {
  const { query, limit = 50 } = await req.json() as Body;
  if (!query?.trim()) return NextResponse.json({ results: [] });

  const cat = getCatalog();
  const index = cat.videos.map(v => ({
    id: v.id,
    title: v.title,
    desc: (v.description || "").slice(0, 200).replace(/\n+/g, " "),
  }));

  const text = await complete({
    system: SYSTEM,
    user: `Query: """${query}"""

Score each video for relevance. Return JSON:
{ "results": [{ "id": "abc", "score": 0-100, "why": "1-short-phrase" }] }

Only return videos with score >= 25.

Catalog: ${JSON.stringify(index)}`,
    maxTokens: 4000,
    temperature: 0.1,
  });

  const parsed = extractJson<{ results: { id: string; score: number; why: string }[] }>(text);
  if (!parsed) return NextResponse.json({ error: "parse fail", raw: text }, { status: 500 });

  const sorted = parsed.results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({ query, results: sorted });
}
