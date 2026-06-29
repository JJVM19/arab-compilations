import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/data";
import { complete, extractJson } from "@/lib/anthropic";

export const maxDuration = 60;

const SYSTEM = `You are a YouTube packaging strategist for a NEW channel that repackages long-form videos by @Arab into themed compilations.

# Who Arab is — and the FULL range of his content
Arab is an immersion journalist who embeds in places and subcultures most people never see. His catalog is NOT only danger. It spans the whole spectrum, and compilations can be built around ANY part of it:
- High-tension: cartels, gangs, favelas, war zones, smugglers, scams, prisons, kidnapping.
- Culture & people: religion & rituals, traditions, ethnic groups, daily life, hospitality, acts of kindness, friendships he makes.
- Food: street food, weird/extreme food, the best meals, eating with locals.
- Lifestyle & lighter: haircuts & barbers around the world, markets, money/wealth, transport, hotels & places he stays, fashion, sport, animals, nature, beautiful places.
- Funny / wholesome: heartwarming moments, comedic mishaps, culture-shock, generous strangers.

CRITICAL: Honor the user's theme even when it is calm, positive, funny, or everyday. If they ask for "best haircuts", "best food", "most beautiful places", or "kindest people", lean fully into that — do NOT redirect every idea back to danger/tension. Tension is one lane, not the whole road.

# Title style — THE MOST IMPORTANT PART

Titles must SUBTLY signal that the video covers multiple moments / multiple stories, without screaming "compilation" or "Top 10."

A viewer should read the title and think "oh interesting, this looks like a video where they go through several wild things on this topic" — not "this is one specific event," and not "this is a listicle."

REQUIRED phrasings (use these constructions). Examples span tense AND calm topics on purpose — match the tone to the theme:
- "Times [X]..." → "Times Arab Almost Died Abroad" · "Times Strangers Showed Arab Real Kindness"
- "Every Time..." → "Every Time Brazil Got Out of Control" · "Every Time Arab Found Incredible Street Food"
- "When [X]..." → "When Things Went Wrong in Haiti" · "When Arab Sat Down to Eat With Locals"
- "Why You [Don't / Should Never]..." → "Why You Don't Mess With Brazilian Favelas" · "Why You Should Never Skip the Local Market"
- "What Happens When..." → "What Happens When You Trust the Wrong People"
- "[X] Isn't What You Think" / "[X] Isn't Always Like That" → "Street Food Isn't What You Think"
- "The Truth About..." → "The Truth About Barbers Around the World"
- "Life Inside..." → "Life Inside the World's Busiest Markets"
- "The Best..." / "The Most..." (great for calm/positive themes) → "The Best Haircuts Arab Got Abroad", "The Most Beautiful Places Arab Has Filmed"
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
  const cat = await getCatalog();
  const videoIndex = cat.videos.map(v => ({
    id: v.id, title: v.title,
    desc: (v.description || "").slice(0, 200).replace(/\n+/g, " "),
    duration_min: Math.round(v.duration_sec / 60),
    views: v.view_count,
  }));

  const themeBlock = theme.trim()
    ? `User's seed theme/angle (use as starting point, but you can pivot):
"""${theme}"""\n`
    : `No specific theme — propose a VARIED batch that shows the channel's full range. Mix high-tension angles (cartels, kidnapping, Haiti, Brazil, smuggling, scams) with culture, food, and lighter ones (street food, haircuts/barbers, markets, religion & rituals, kindness of strangers, most beautiful places, funniest culture-shock moments). Don't make every idea about danger.\n`;

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
