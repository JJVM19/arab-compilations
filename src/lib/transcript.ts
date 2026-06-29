/**
 * Transcript fetching for the live "Add video" flow.
 *
 * Two strategies, tried in order:
 *  A. yt-dlp — does the full YouTube player handshake, so it actually returns
 *     captions. Reliable locally and wherever the binary + IP are unblocked.
 *  B. timedtext — best-effort no-binary fallback (scrape the caption track URL
 *     off the watch page). YouTube increasingly returns empty bodies here
 *     without a player token, so it's a bonus, not the primary path.
 *
 * If neither yields captions we return "pending" (not an error) — the video is
 * still added with metadata and stays searchable by title/description; the user
 * can retry once YouTube has generated auto-captions.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { parseVtt, chunkLines, type VttLine, type Chunk } from "./vtt";

const execp = promisify(exec);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface TranscriptResult {
  status: "ok" | "pending" | "error";
  chunks: Chunk[];
  detail: string;
}

/** Strategy A: pull captionTracks from the watch page, fetch json3 captions. */
async function viaTimedText(videoId: string): Promise<VttLine[] | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en&bpctr=9999999999`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"captionTracks":(\[.*?\])/);
    if (!m) return null;
    let tracks: { baseUrl: string; languageCode?: string; kind?: string; vssId?: string }[];
    try { tracks = JSON.parse(m[1]); } catch { return null; }
    if (!tracks?.length) return null;
    // Prefer manual English, then English auto (asr), then any English, then first.
    const pick =
      tracks.find(t => t.languageCode === "en" && t.kind !== "asr") ||
      tracks.find(t => t.languageCode === "en") ||
      tracks.find(t => (t.vssId || "").includes(".en")) ||
      tracks[0];
    if (!pick?.baseUrl) return null;
    const baseUrl = pick.baseUrl.replace(/&fmt=\w+/, "") + "&fmt=json3";
    const capRes = await fetch(baseUrl, { headers: { "User-Agent": UA } });
    if (!capRes.ok) return null;
    const data = await capRes.json() as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] };
    const lines: VttLine[] = [];
    for (const ev of data.events ?? []) {
      if (!ev.segs) continue;
      const text = ev.segs.map(s => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const s = (ev.tStartMs ?? 0) / 1000;
      const e = s + (ev.dDurationMs ?? 0) / 1000;
      lines.push({ s, e, t: text });
    }
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}

/** Strategy B: yt-dlp (best locally; may be IP-blocked on cloud hosts). */
async function viaYtDlp(videoId: string): Promise<VttLine[] | null> {
  let tmp: string | null = null;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yt-add-"));
    const outBase = path.join(tmp, videoId);
    await execp(
      `yt-dlp --quiet --no-warnings --skip-download --write-auto-subs --write-subs --sub-lang en --sub-format vtt --output "${outBase}" "https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 90_000 },
    );
    const candidates = [`${outBase}.en.vtt`, `${outBase}.en-US.vtt`, `${outBase}.en-orig.vtt`];
    const vttPath = candidates.find(p => fs.existsSync(p));
    if (!vttPath) return null;
    const vtt = fs.readFileSync(vttPath, "utf-8");
    const lines = parseVtt(vtt);
    return lines.length ? lines : null;
  } catch {
    return null;
  } finally {
    if (tmp) {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

export async function fetchTranscriptChunks(videoId: string): Promise<TranscriptResult> {
  // yt-dlp first (actually returns captions), timedtext as a no-binary bonus.
  let lines = await viaYtDlp(videoId);
  let method = "yt-dlp";
  if (!lines) {
    lines = await viaTimedText(videoId);
    method = "timedtext";
  }
  if (!lines || !lines.length) {
    return {
      status: "pending",
      chunks: [],
      detail: "No captions available yet — YouTube may still be generating them. Add it anyway and retry in a few minutes.",
    };
  }
  const chunks = chunkLines(lines, 45);
  if (!chunks.length) {
    return { status: "pending", chunks: [], detail: "Captions found but produced no usable text." };
  }
  return { status: "ok", chunks, detail: `Transcript indexed via ${method}` };
}
