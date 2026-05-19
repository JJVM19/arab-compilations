/**
 * Minimal WebVTT parser tailored for YouTube auto-generated captions.
 * Matches the Python implementation in process_transcripts.py.
 */

const TIME_RE = /(\d+):(\d+):(\d+)\.(\d+)\s+-->\s+(\d+):(\d+):(\d+)\.(\d+)/;

function tsToSec(h: string, m: string, s: string, ms: string) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

export interface VttLine { s: number; e: number; t: string }

/**
 * Parse a VTT file with YouTube auto-sub rolling-caption deduplication.
 * Each cue's last "new" line (not seen before) is kept.
 */
export function parseVtt(vtt: string): VttLine[] {
  const blocks = vtt.split("\n\n");
  const out: VttLine[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const m = block.match(TIME_RE);
    if (!m) continue;
    const start = tsToSec(m[1], m[2], m[3], m[4]);
    const end = tsToSec(m[5], m[6], m[7], m[8]);
    const newLines: string[] = [];
    for (const raw of block.split("\n")) {
      if (TIME_RE.test(raw)) continue;
      if (/^(WEBVTT|Kind:|Language:|NOTE)/.test(raw)) continue;
      if (!raw.trim()) continue;
      // Strip tags + decode minimal HTML entities
      const t = raw.replace(/<[^>]+>/g, "")
                   .replace(/&amp;/g, "&")
                   .replace(/&lt;/g, "<")
                   .replace(/&gt;/g, ">")
                   .replace(/&quot;/g, "\"")
                   .replace(/&#39;/g, "'")
                   .trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      newLines.push(t);
    }
    if (newLines.length) out.push({ s: start, e: end, t: newLines.join(" ") });
  }
  return out;
}

export interface Chunk {
  start: number;
  end: number;
  text: string;
  lines: { s: number; e: number; t: string }[];
}

/** Bundle micro-lines into ~targetSec chunks for indexing. */
export function chunkLines(lines: VttLine[], targetSec = 45): Chunk[] {
  if (!lines.length) return [];
  const chunks: Chunk[] = [];
  let curStart = lines[0].s;
  let curLines: { s: number; e: number; t: string }[] = [];
  let curEnd = lines[0].e;
  for (const { s, e, t } of lines) {
    if (e - curStart >= targetSec && curLines.length > 0) {
      chunks.push({
        start: round2(curStart),
        end: round2(curEnd),
        text: curLines.map(l => l.t).join(" "),
        lines: curLines,
      });
      curStart = s;
      curLines = [{ s: round2(s), e: round2(e), t }];
      curEnd = e;
    } else {
      curLines.push({ s: round2(s), e: round2(e), t });
      curEnd = e;
    }
  }
  if (curLines.length) {
    chunks.push({
      start: round2(curStart),
      end: round2(curEnd),
      text: curLines.map(l => l.t).join(" "),
      lines: curLines,
    });
  }
  return chunks;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
