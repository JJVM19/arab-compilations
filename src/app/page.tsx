"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Sparkles, Loader2, X, Plus } from "lucide-react";
import type { Catalog, Video } from "@/lib/types";
import { fmtViews, fmtDuration, fmtDate } from "@/lib/utils";
import { AddVideoModal } from "@/components/AddVideoModal";

type SortKey = "views" | "recent" | "longest" | "oldest";

const SORT_LABELS: Record<SortKey, string> = {
  views: "Most viewed",
  recent: "Recent",
  longest: "Longest",
  oldest: "Oldest",
};

interface AiResult { id: string; score: number; why: string }

export default function LibraryPage() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("views");
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AiResult[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function reloadCatalog() { fetch("/api/catalog").then(r => r.json()).then(setCat); }
  useEffect(() => { reloadCatalog(); }, []);

  const videos = useMemo<(Video & { _score?: number; _why?: string })[]>(() => {
    if (!cat) return [];

    // AI mode: show ranked results
    if (aiMode && aiResults) {
      const map: Record<string, Video> = {};
      for (const v of cat.videos) map[v.id] = v;
      return aiResults
        .map(r => ({ ...map[r.id], _score: r.score, _why: r.why }))
        .filter(v => v.id);
    }

    // Plain text + sort mode
    const q = query.trim().toLowerCase();
    let v = cat.videos;
    if (q) {
      v = v.filter(x =>
        x.title.toLowerCase().includes(q) ||
        x.description.toLowerCase().includes(q) ||
        x.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    const s = [...v];
    switch (sort) {
      case "views":   s.sort((a, b) => b.view_count - a.view_count); break;
      case "recent":  s.sort((a, b) => b.published_at.localeCompare(a.published_at)); break;
      case "oldest":  s.sort((a, b) => a.published_at.localeCompare(b.published_at)); break;
      case "longest": s.sort((a, b) => b.duration_sec - a.duration_sec); break;
    }
    return s;
  }, [cat, query, sort, aiMode, aiResults]);

  async function runAi() {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiMode(true);
    setAiResults(null);
    try {
      const r = await fetch("/api/library-search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      setAiResults(d.results || []);
    } finally {
      setAiLoading(false);
    }
  }

  function clearAi() {
    setAiMode(false);
    setAiResults(null);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Library</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {cat ? `${cat.count} longform videos` : "Loading…"} · cutoff Sept 2022 (post Turkey Replica)
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn">
          <Plus size={13} /> Add video
        </button>
      </header>
      <AddVideoModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={reloadCatalog} />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 left-3 pointer-events-none" style={{ color: "var(--muted)" }} />
          <input
            type="search"
            placeholder='Title text search, or "eating in dangerous countries" for AI search...'
            className="input pl-10 pr-9"
            value={query}
            onChange={e => { setQuery(e.target.value); if (aiMode) clearAi(); }}
            onKeyDown={e => { if (e.key === "Enter") runAi(); }}
          />
          {(query || aiMode) && (
            <button
              onClick={() => { setQuery(""); clearAi(); }}
              className="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded hover:bg-white/10"
              style={{ color: "var(--muted)" }}
              title="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={runAi}
          disabled={aiLoading || !query.trim()}
          className="btn"
          title="Semantically rank all videos by relevance to your query"
        >
          {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          AI search
        </button>

        {!aiMode && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: "var(--bg-elev)" }}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="px-2.5 py-1 rounded text-[11.5px] font-medium transition-colors"
                style={{
                  background: sort === s ? "var(--accent)" : "transparent",
                  color: sort === s ? "white" : "var(--muted)",
                }}
              >
                {SORT_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
        {aiMode && !aiLoading && aiResults && (
          <>AI relevance ranking for <span style={{ color: "var(--text-2)" }}>&ldquo;{query}&rdquo;</span> · {videos.length} matches</>
        )}
        {aiMode && aiLoading && <>Scoring {cat?.count} videos against your query…</>}
        {!aiMode && <>Showing {videos.length} video{videos.length === 1 ? "" : "s"}</>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 anim-stagger">
        {videos.map(v => (
          <Link key={v.id} href={`/video/${v.id}`} className="card hoverable overflow-hidden block">
            <div className="relative aspect-video">
              <img
                src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                alt={v.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div
                className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium"
                style={{ background: "rgba(0,0,0,0.85)", color: "white" }}
              >
                {fmtDuration(v.duration_sec)}
              </div>
              {v._score !== undefined && (
                <div
                  className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                  style={{
                    background: v._score >= 80 ? "var(--accent)" : "rgba(0,0,0,0.85)",
                    color: "white",
                  }}
                  title={v._why}
                >
                  {v._score}
                </div>
              )}
            </div>
            <div className="p-2.5">
              <h3 className="text-[12.5px] font-medium clamp-2 leading-snug">{v.title}</h3>
              <div className="mt-1 text-[10.5px] flex gap-1.5" style={{ color: "var(--muted)" }}>
                <span>{fmtViews(v.view_count)}</span>
                <span>·</span>
                <span>{fmtDate(v.published_at)}</span>
              </div>
              {v._why && (
                <div className="mt-1 text-[10.5px] italic clamp-2" style={{ color: "var(--accent-hover)" }}>
                  {v._why}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {aiMode && aiLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="aspect-video" style={{ background: "var(--bg-elev)" }} />
              <div className="p-2.5 space-y-1.5">
                <div className="h-3 rounded w-3/4" style={{ background: "var(--bg-elev)" }} />
                <div className="h-2.5 rounded w-1/3" style={{ background: "var(--bg-elev)" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
