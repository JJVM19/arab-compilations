export function fmtViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return n.toString();
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parse a human-typed timestamp into seconds.
 * Accepts "83", "1:23", "1:23.5", "1:02:03" (h:m:s), or "1:02:03.4".
 * Returns null if it can't be parsed so callers can keep the old value.
 */
export function parseTimestamp(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  // Plain seconds (possibly decimal)
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  for (const p of parts) {
    if (!/^\d+(\.\d+)?$/.test(p.trim())) return null;
  }
  const nums = parts.map(p => Number(p));
  let sec = 0;
  if (nums.length === 3) sec = nums[0] * 3600 + nums[1] * 60 + nums[2];
  else sec = nums[0] * 60 + nums[1];
  return Number.isFinite(sec) ? sec : null;
}

export function thumbnailUrl(videoId: string, quality: "default" | "mq" | "hq" | "max" = "mq"): string {
  const map = { default: "default", mq: "mqdefault", hq: "hqdefault", max: "maxresdefault" };
  return `https://i.ytimg.com/vi/${videoId}/${map[quality]}.jpg`;
}

export function watchUrl(videoId: string, startSec?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return startSec ? `${base}&t=${Math.floor(startSec)}s` : base;
}

export function embedUrl(videoId: string, startSec?: number, opts?: { autoplay?: boolean }): string {
  const params = new URLSearchParams();
  if (startSec && startSec > 0) params.set("start", String(Math.floor(startSec)));
  if (opts?.autoplay) params.set("autoplay", "1");
  const qs = params.toString();
  return `https://www.youtube.com/embed/${videoId}${qs ? `?${qs}` : ""}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function classNames(...xs: (string | false | undefined | null)[]): string {
  return xs.filter(Boolean).join(" ");
}
