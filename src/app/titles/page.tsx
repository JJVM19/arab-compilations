"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hammer, BookmarkCheck, ChevronDown, Trash2, Sparkles, Loader2, X, Search } from "lucide-react";
import type { Catalog, SavedTitle, Video, CompilationIdea } from "@/lib/types";
import { ConfirmButton } from "@/components/ConfirmButton";
import { IdeaVideoStrip } from "@/components/IdeaVideoStrip";
import { IdeaCard } from "@/components/IdeaCard";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { fmtDate } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Times Arab almost died",
  "When street food turned dark",
  "Why you don't go to Haiti",
  "Cartel encounters that escalated",
  "Moments locals turned on him",
  "Weirdest religious rituals",
  "Inside the world's worst slums",
];

export default function TitlesPage() {
  const { state, update } = useWorkspace();
  const router = useRouter();
  const [titles, setTitles] = useState<SavedTitle[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandAlts, setExpandAlts] = useState<Record<string, boolean>>({});

  function reload() {
    setLoadingSaved(true);
    fetch("/api/titles").then(r => r.json()).then(d => {
      setTitles(d.titles || []);
      setLoadingSaved(false);
    });
  }
  useEffect(reload, []);
  useEffect(() => { fetch("/api/catalog").then(r => r.json()).then(setCatalog); }, []);

  const videoMap: Record<string, Video> = {};
  if (catalog) for (const v of catalog.videos) videoMap[v.id] = v;

  // Map of "title + first videoId" to savedId, to mark already-saved generated ideas
  const savedKeyMap = new Map<string, string>();
  for (const t of titles) savedKeyMap.set(t.title, t.id);

  async function generateIdeas() {
    const theme = state.theme.trim();
    setLoadingIdeas(true); setError(null);
    update({ ideas: [], ideasFor: theme });
    try {
      const r = await fetch("/api/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, count: 8 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      update({ ideas: d.ideas || [], ideasFor: theme });
    } catch (e: any) { setError(e.message); }
    finally { setLoadingIdeas(false); }
  }

  async function buildFromIdea(idea: CompilationIdea) {
    const r = await fetch("/api/compilations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: idea.title,
        pitch: idea.pitch,
        target_length_min: idea.target_length_min,
        clips: [],
      }),
    });
    const c = await r.json();
    update({ activeCompId: c.id, theme: idea.title });
    router.push(`/workspace?id=${c.id}`);
  }

  async function buildFromTitle(t: SavedTitle) {
    const r = await fetch("/api/compilations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t.title,
        pitch: t.pitch,
        target_length_min: t.target_length_min,
        clips: [],
      }),
    });
    const c = await r.json();
    update({ activeCompId: c.id, theme: t.title });
    router.push(`/workspace?id=${c.id}`);
  }

  async function delTitle(id: string) {
    await fetch(`/api/titles/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-bold tracking-tight">Titles</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
          Brainstorm viral compilation titles · save your favorites · build them in the workspace.
        </p>
      </header>

      {/* Idea generator */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles size={15} className="absolute top-1/2 -translate-y-1/2 left-3 pointer-events-none" style={{ color: "var(--muted)" }} />
            <input
              type="text"
              placeholder='Seed theme — e.g. "Times Arab almost died" or leave blank for open brainstorm'
              className="input input-lg pl-10"
              value={state.theme}
              onChange={e => update({ theme: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter" && !loadingIdeas) generateIdeas(); }}
            />
          </div>
          <button
            onClick={generateIdeas}
            disabled={loadingIdeas}
            className="btn btn-primary btn-lg"
          >
            {loadingIdeas ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate ideas
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
          <span style={{ color: "var(--muted-2)" }}>Try</span>
          {QUICK_PROMPTS.map(p => (
            <button key={p} className="chip chip-clickable" onClick={() => update({ theme: p })}>
              {p}
            </button>
          ))}
        </div>
        {error && <div className="text-[12px]" style={{ color: "#fca5a5" }}>{error}</div>}
      </section>

      {/* Generated ideas */}
      {(loadingIdeas || state.ideas.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="eyebrow flex items-center gap-1.5">
              <Sparkles size={11} />
              Generated ideas {state.ideasFor && <>· <span style={{ color: "var(--text-2)" }}>{state.ideasFor}</span></>}
            </div>
            {state.ideas.length > 0 && (
              <button onClick={() => update({ ideas: [], ideasFor: "" })} className="text-[11px] link">
                Clear
              </button>
            )}
          </div>
          {loadingIdeas ? (
            <div className="grid xl:grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse space-y-2">
                  <div className="h-4 rounded w-3/4" style={{ background: "var(--bg-elev)" }} />
                  <div className="h-3 rounded w-full" style={{ background: "var(--bg-elev)" }} />
                  <div className="h-3 rounded w-2/3" style={{ background: "var(--bg-elev)" }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid xl:grid-cols-2 gap-2 anim-stagger">
              {state.ideas.map((idea, i) => (
                <IdeaCard
                  key={i}
                  idea={idea}
                  videoMap={videoMap}
                  onBuild={() => buildFromIdea(idea)}
                  initialSavedId={savedKeyMap.get(idea.title) ?? null}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Saved titles */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="eyebrow flex items-center gap-1.5">
            <BookmarkCheck size={11} />
            Saved titles · {titles.length}
          </div>
        </div>
        {loadingSaved ? (
          <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>Loading…</div>
        ) : titles.length === 0 ? (
          <div className="card p-8 text-center">
            <BookmarkCheck className="mx-auto mb-2" size={18} style={{ color: "var(--muted-2)" }} />
            <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              Generate some ideas above and click <span className="kbd">Save</span> on the ones you like.
            </p>
          </div>
        ) : (
          <div className="grid xl:grid-cols-2 gap-3 anim-stagger">
            {titles.map(t => (
              <div key={t.id} className="card p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[16px] font-bold leading-snug">{t.title}</h3>
                    {t.alt_titles.length > 0 && (
                      <div className="mt-1">
                        <button
                          className="text-[10.5px] flex items-center gap-0.5 hover:text-white transition-colors"
                          style={{ color: "var(--muted)" }}
                          onClick={() => setExpandAlts(p => ({ ...p, [t.id]: !p[t.id] }))}
                        >
                          <ChevronDown size={10} className={`transition-transform ${expandAlts[t.id] ? "rotate-180" : ""}`} />
                          {t.alt_titles.length} alt titles
                        </button>
                        {expandAlts[t.id] && (
                          <ul className="mt-1 space-y-0.5 text-[12px]">
                            {t.alt_titles.map((alt, i) => (
                              <li key={i} style={{ color: "var(--muted)" }}>· {alt}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => buildFromTitle(t)} className="btn btn-primary">
                      <Hammer size={12} /> Build
                    </button>
                    <ConfirmButton
                      label={<Trash2 size={12} />}
                      title="Delete saved title?"
                      message={`This will permanently remove "${t.title}" from your saved titles.`}
                      confirmLabel="Delete"
                      onConfirm={() => delTitle(t.id)}
                    />
                  </div>
                </div>
                {t.pitch && (
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>{t.pitch}</p>
                )}
                <div className="flex gap-1 flex-wrap">
                  <span className="chip">~{t.target_length_min}min target</span>
                  <span className="chip">{t.video_ids.length} videos</span>
                  <span className="chip">saved {fmtDate(t.saved_at)}</span>
                </div>
                <div className="divider pt-2.5">
                  <IdeaVideoStrip
                    videoIds={t.video_ids}
                    videoMap={videoMap}
                    reasons={t.reasons}
                    layout="grid"
                    maxThumbs={6}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
