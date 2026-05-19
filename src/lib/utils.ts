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
