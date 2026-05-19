import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/data";
import { complete, extractJson } from "@/lib/anthropic";

export const maxDuration = 60;

const SYSTEM = `You are a YouTube packaging strategist for a NEW channel that repackages long-form videos by @Arab (a journalist who travels to dangerous places: cartels, favelas, gangs, war zones, smugglers, scams, religion, food, etc.) into themed compilations.

# Title style — THE MOST IMPORTANT PART

Titles must SUBTLY signal that the video covers multiple moments / multiple stories, without screaming "compilation" or "Top 10."

A viewer should read the title and think "oh interesting, this looks like a video where they go through several wild things on this topic" — not "this is one specific event," and not "this is a listicle."

REQUIRED phrasings (use these constructions):
- "Times [X]..." → "Times Arab Almost Died Abroad"
- "Every Time..." → "Every Time Brazil Got Out of Control"
- "When [X]..." → "When Things Went Wrong in Haiti"
- "Why You [Don't / Should Never]..." → "Why You Don't Mess With Brazilian Favelas"
- "What Happens When..." → "What Happens When You Trust the Wrong People"
- "[X] Isn't What You Think" / "[X] Isn't Always Like That"
- "The Truth About..."
- "Life Inside..."
- Counts that imply multiple: "5 Times...", "Moments Where..."
  (use plurals sparingly — once or twice per batch, not for every title)

DISCOURAGED — these copy Arab's own single-event vlog titles too closely:
- "I Was..." / "I Survived..." / "I Spent X Days With..." (these are single-event vlog hooks; Arab uses these for his ORIGINAL videos — using them for compilations makes them feel like rip-offs)
- "I Lived With..." / "I Met..." (same — these are too singular)
- Any first-person "I [verb]ed in [place]" pattern that names one specific event

BANNED — never use these:
- "Top 10..." / "Best moments..." / "Craziest moments..."
- The word "compilation" itself
- "Worst/Wildest/Scariest moments" (too listicle-y)
- Listicle / numbered framings (unless using "5 Times..." style above, sparingly)

Titles should be 40–70 chars, plural-ish (suggesting multi-story), and ambiguous enough that a viewer can't immediately tell whether it's one big story or several stitched together.

For each idea, return TWO alt_titles that vary the construction.

# Compilation rules
- Pull from 3–10 source videos so there's enough multi-story material
- Target length 15–90 minutes

Return strict JSON only, no commentary.`;

interface Body { theme?: string; count?: number }

export async function POST(req: Request) {
  const { theme = "", count = 8 } = await req.json() as Body;
  const cat = getCatalog();
  const videoIndex = cat.videos.map(v => ({
    id: v.id, title: v.title,
    desc: (v.description || "").slice(0, 200).replace(/\n+/g, " "),
    duration_min: Math.round(v.duration_sec / 60),
    views: v.view_count,
  }));

  const themeBlock = theme.trim()
    ? `User's seed theme/angle (use as starting point, but you can pivot):
"""${theme}"""\n`
    : `No specific theme — propose your best ideas based on catalog strengths (cartels, kidnapping, Haiti, Brazil, Taliban, Iran, smuggling, scams, religion, etc.).\n`;

  const user = `${themeBlock}
Catalog (${cat.videos.length} videos, JSON):
${JSON.stringify(videoIndex)}

Generate ${count} compilation ideas. For each:
- title: primary title (subtly compilation-ish, 40-70 chars, follows the "Times..."/"Every Time..."/"When..."/"Why You..." style — NOT "I Was..."/"I Spent..." vlog-style)
- alt_titles: 2 alternative titles using different constructions
- pitch: 1-2 sentences (what's the through-line)
- target_length_min: 15-90
- videos: array of { video_id, reason } — 3-10 videos. reason = 1 sentence why.

Return JSON: { "ideas": [...] }`;

  const text = await complete({ system: SYSTEM, user, maxTokens: 8000, temperature: 0.9 });
  const parsed = extractJson<{ ideas: any[] }>(text);
  if (!parsed) return NextResponse.json({ error: "Could not parse JSON", raw: text }, { status: 500 });
  return NextResponse.json(parsed);
}
