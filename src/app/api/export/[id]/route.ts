import { getCompilations } from "@/lib/data";

function fmtTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const c = getCompilations().find(x => x.id === id);
  if (!c) return new Response("not found", { status: 404 });
  const header = ["#", "video_title", "video_url", "youtube_url_with_start", "in_tc", "out_tc", "duration_sec", "note"];
  const rows = c.clips.map((clip, i) => [
    (i + 1).toString(),
    clip.video_title,
    clip.video_url,
    `${clip.video_url}&t=${Math.floor(clip.start)}s`,
    fmtTimecode(clip.start),
    fmtTimecode(clip.end),
    Math.round(clip.end - clip.start).toString(),
    clip.note,
  ]);
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  const safe = c.title.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe || "compilation"}.csv"`,
    },
  });
}
