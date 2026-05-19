import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

export async function complete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("\n");
}

export function extractJson<T = unknown>(text: string): T | null {
  // Try fenced code block first
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  // Try to find first { or [
  const firstBrace = text.search(/[{[]/);
  if (firstBrace >= 0) {
    const lastBrace = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (lastBrace > firstBrace) {
      try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch {}
    }
  }
  return null;
}
