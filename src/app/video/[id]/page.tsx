"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, Calendar, Clock, Search, Loader2, Sparkles, Play, X } from "lucide-react";
import type { ChunkedVideo, Video } from "@/lib/types";
import { fmtDate, fmtDuration, fmtTimestamp, fmtViews, watchUrl } from "@/lib/utils";
import { ClipPlayer, ClipPlayerHandle } from "@/components/ClipPlayer";

interface AiSegment { start: number; end: number; why: string; quote?: string; kind?: "context" | "moment" }

const QUICK_THEMES = ["Craziest moments", "Most dangerous moments", "Funniest moments", "Most shocking quotes"];

export default function VideoPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [video, setVideo] = useState<Video | null>(null);
  const [chunks, setChunks] = useState<ChunkedVideo | null>(null);
  const [activeChunk, setActiveChunk] = useState<number | null>(null);

  // AI moment-finder state
  const [theme, setTheme] = useState("");
  const [aiSegments, setAiSegments] = useState<AiSegment[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiActiveIdx, setAiActiveIdx] = useState<number | null>(null);
  const [aiTheme, setAiTheme] = useState<string>("");
  const fetchSeq = useRef(0);
  const cacheRef = useRef<Record<string, AiSegment[]>>({});

  const playerRef = useRef<ClipPlayerHandle | null>(null);

  useEffect(() => {
    fetch(`/api/video/${id}`).then(r => r.json()).then(d => {
      setVideo(d.video);
      setChunks(d.chunks);
    });
  }, [id]);

  function seekTo(sec: number, idx?: number, aiIdx?: number) {
    if (idx !== undefined) setActiveChunk(idx);
    if (aiIdx !== undefined) setAiActiveIdx(aiIdx);
    playerRef.current?.seekTo(sec, true);
  }

  async function runAi() {
    const q = theme.trim();
    if (!q) return;
    const cacheKey = `${id}::${q}`;
    if (cacheRef.current[cacheKey]) {
      setAiSegments(cacheRef.current[cacheKey]);
      setAiTheme(q);
      setAiActiveIdx(null);
      return;
    }
    const seq = ++fetchSeq.current;
    setAiLoading(true);
    setAiSegments(null);
    setAiActiveIdx(null);
    setAiTheme(q);
    try {
      const r = await fetch("/api/video-clips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: id, theme: q, max_segments: 6 }),
      });
      const d = await r.json();
      if (seq !== fetchSeq.current) return;
      const segs = d.segments || [];
      cacheRef.current[cacheKey] = segs;
      setAiSegments(segs);
    } finally {
      if (seq === fetchSeq.current) setAiLoading(false);
    }
  }

  if (!video) return <div className="text-[13px]" style={{ color: "var(--muted)" }}>Loading...</div>;

  return (
    <div className="space-y-5">
      <Link href="/" className="text-[12px] flex items-center gap-1 link" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={12} /> Library
      </Link>

      <div className="grid lg:grid-cols-[1fr_420px] gap-5">
        {/* Left: player + meta */}
        <div className="space-y-3">
          <div className="card overflow-hidden">
            <div className="aspect-video bg-black">
              <ClipPlayer ref={playerRef} videoId={video.id} initialStart={0} />
            </div>
          </div>
          <h1 className="text-[22px] font-bold leading-tight">{video.title}</h1>
          <div className="flex gap-3 text-[12px] flex-wrap" style={{ color: "var(--muted)" }}>
            <span className="flex items-center gap-1"><Eye size={12} /> {fmtViews(video.view_count)} views</span>
            <span className="flex items-center gap-1"><Calendar size={12} /> {fmtDate(video.published_at)}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {fmtDuration(video.duration_sec)}</span>
            <a href={watchUrl(video.id)} target="_blank" rel="noreferrer" className="link flex items-center gap-1">
              <ExternalLink size={12} /> Open on YouTube
            </a>
          </div>
          {video.description && (
            <div className="card p-4 text-[12.5px] whitespace-pre-wrap leading-relaxed" style={{ color: "var(--muted)" }}>
              {video.description.slice(0, 800)}{video.description.length > 800 ? "..." : ""}
            </div>
          )}
        </div>

        {/* Right: AI moment-finder + transcript */}
        <aside className="card p-3 max-h-[80vh] overflow-y-auto sticky top-[68px] self-start flex flex-col">
          {/* AI moment finder */}
          <div className="space-y-2 px-0.5">
            <div className="eyebrow flex items-center gap-1.5">
              <Sparkles size={11} /> Find moments in this video
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search size={13} className="absolute top-1/2 -translate-y-1/2 left-2.5 pointer-events-none" style={{ color: "var(--muted)" }} />
                <input
                  type="text"
                  placeholder='e.g. "craziest moments"'
                  className="input pl-8 text-[12.5px] py-2"
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") runAi(); }}
                />
              </div>
              <button onClick={runAi} disabled={aiLoading || !theme.trim()} className="btn btn-primary btn-sm">
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Find
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {QUICK_THEMES.map(q => (
                <button key={q} className="chip chip-clickable" onClick={() => { setTheme(q); }}>
                  {q}
                </button>
              ))}
            </div>

            {/* AI results */}
            {aiLoading && (
              <div className="space-y-1.5 pt-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-2 rounded animate-pulse" style={{ background: "var(--bg-elev)" }}>
                    <div className="h-2.5 rounded w-1/3" style={{ background: "var(--bg-elev-2)" }} />
                    <div className="h-2 rounded w-full mt-1.5" style={{ background: "var(--bg-elev-2)" }} />
                  </div>
                ))}
              </div>
            )}
            {aiSegments && (
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5 text-[10.5px]" style={{ color: "var(--muted)" }}>
                  <span>{aiSegments.length} moment{aiSegments.length === 1 ? "" : "s"} for <span style={{ color: "var(--text-2)" }}>&ldquo;{aiTheme}&rdquo;</span></span>
                  <button onClick={() => { setAiSegments(null); setAiTheme(""); }} className="hover:text-white"><X size={11} /></button>
                </div>
                {aiSegments.length === 0 ? (
                  <p className="text-[11px] italic px-1" style={{ color: "var(--muted-2)" }}>
                    No matches found. Try a broader theme.
                  </p>
                ) : (
                  <ol className="space-y-1">
                    {aiSegments.map((s, i) => {
                      const isActive = aiActiveIdx === i;
                      return (
                        <li
                          key={i}
                          onClick={() => seekTo(s.start, undefined, i)}
                          className="p-2 rounded cursor-pointer transition-colors group"
                          style={{
                            background: isActive ? "var(--accent-tint)" : "var(--bg-elev)",
                            border: `1px solid ${isActive ? "rgba(239,43,43,0.3)" : "transparent"}`,
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-elev-2)"; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-elev)"; }}
                        >
                          <div className="flex items-start gap-1.5">
                            <div className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 mt-0.5"
                              style={{ background: isActive ? "var(--accent)" : "var(--bg-elev-2)" }}>
                              <Play size={9} fill="currentColor" color={isActive ? "white" : "var(--muted)"} style={{ marginLeft: 1 }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {s.kind && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider"
                                    style={s.kind === "moment"
                                      ? { background: "var(--accent)", color: "white" }
                                      : { background: "var(--bg-elev-2)", color: "var(--muted)", border: "1px solid var(--border)" }}
                                  >
                                    {s.kind}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono" style={{ color: isActive ? "white" : "var(--accent-hover)" }}>
                                  {fmtTimestamp(s.start)}–{fmtTimestamp(s.end)} · {Math.round(s.end - s.start)}s
                                </span>
                              </div>
                              <p className="text-[11.5px] mt-0.5 leading-snug">{s.why}</p>
                              {s.quote && (
                                <p className="text-[10.5px] mt-0.5 italic clamp-2" style={{ color: "var(--muted)" }}>
                                  &ldquo;{s.quote}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="divider my-3" />

          {/* Raw transcript */}
          <div className="flex items-center justify-between mb-2 px-0.5">
            <div className="eyebrow">Full transcript</div>
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              {chunks ? `${chunks.chunks.length} chunks · click to seek` : "—"}
            </span>
          </div>
          {!chunks ? (
            <p className="text-[12px] px-1" style={{ color: "var(--muted)" }}>
              No transcript available for this video.
            </p>
          ) : (
            <div className="space-y-1 flex-1 min-h-0">
              {chunks.chunks.map((c, i) => (
                <div
                  key={i}
                  className="text-[12.5px] p-2 rounded cursor-pointer transition-colors"
                  style={{ background: activeChunk === i ? "var(--accent-tint)" : "transparent" }}
                  onMouseEnter={e => { if (activeChunk !== i) e.currentTarget.style.background = "var(--bg-elev)"; }}
                  onMouseLeave={e => { if (activeChunk !== i) e.currentTarget.style.background = "transparent"; }}
                  onClick={() => seekTo(c.start, i)}
                >
                  <code className="text-[10.5px] font-mono block mb-0.5" style={{ color: "var(--accent-hover)" }}>
                    {fmtTimestamp(c.start)} – {fmtTimestamp(c.end)}
                  </code>
                  <div className="leading-snug">{c.text}</div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
