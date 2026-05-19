"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Search, Loader2, X, FileDown, Plus, Check, ExternalLink } from "lucide-react";
import type { Catalog, SavedClip, SavedCompilation, Video } from "@/lib/types";
import type { SearchResultGroup } from "@/lib/workspace";
import { fmtTimestamp, fmtViews, fmtDuration } from "@/lib/utils";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ClipPlayer } from "@/components/ClipPlayer";
import { ClipThumb } from "@/components/ClipThumb";

const QUICK_PROMPTS = [
  "Times Arab almost died",
  "When street food turned dark",
  "Why you don't go to Haiti",
  "Cartel encounters that escalated",
  "Moments locals turned on him",
  "Weirdest religious rituals",
  "Inside the world's worst slums",
];

function WorkspaceInner() {
  const { state, update } = useWorkspace();
  const sp = useSearchParams();
  const router = useRouter();
  const queryParamId = sp.get("id");

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [comp, setComp] = useState<SavedCompilation | null>(null);
  const [recentComps, setRecentComps] = useState<SavedCompilation[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIdx, setAddedIdx] = useState<string | null>(null); // "videoId-startTime" of last-added clip

  useEffect(() => { fetch("/api/catalog").then(r => r.json()).then(setCatalog); }, []);
  useEffect(() => { fetch("/api/compilations").then(r => r.json()).then(d => setRecentComps(d.compilations || [])); }, []);

  // Sync URL ?id= into workspace state
  useEffect(() => {
    if (queryParamId && queryParamId !== state.activeCompId) {
      update({ activeCompId: queryParamId });
    }
  }, [queryParamId, state.activeCompId, update]);

  // Fetch active comp whenever id changes
  useEffect(() => {
    if (!state.activeCompId) { setComp(null); return; }
    fetch(`/api/compilations/${state.activeCompId}`).then(r => {
      if (!r.ok) { update({ activeCompId: null }); return null; }
      return r.json();
    }).then(c => { if (c) setComp(c); });
  }, [state.activeCompId, update]);

  const videoMap: Record<string, Video> = {};
  if (catalog) for (const v of catalog.videos) videoMap[v.id] = v;

  async function findMoments(themeOverride?: string) {
    const theme = (themeOverride ?? state.theme).trim();
    if (!theme) return;
    setLoadingSearch(true); setError(null);
    update({ results: [], resultsFor: theme, theme });
    try {
      const r = await fetch("/api/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, max_videos: 8, max_segments_per_video: 3 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      update({ results: d.results || [], resultsFor: theme });
    } catch (e: any) { setError(e.message); }
    finally { setLoadingSearch(false); }
  }

  async function addClip(group: SearchResultGroup, seg: { start: number; end: number; why: string; quote?: string; kind?: "context" | "moment" }) {
    // Ensure there's an active comp
    let target = comp;
    if (!target) {
      const title = state.resultsFor || state.theme || "Untitled compilation";
      const r = await fetch("/api/compilations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, pitch: state.theme, target_length_min: 30, clips: [] }),
      });
      target = await r.json();
      setRecentComps(p => [target!, ...p]);
      update({ activeCompId: target!.id });
      router.replace(`/workspace?id=${target!.id}`);
    }
    const clip: SavedClip = {
      video_id: group.video_id,
      video_title: group.title,
      video_url: group.url,
      start: seg.start, end: seg.end,
      note: seg.quote || seg.why,
      kind: seg.kind,
    };
    const resp = await fetch(`/api/compilations/${target!.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clips: [...target!.clips, clip] }),
    });
    const updated = await resp.json();
    setComp(updated);
    setRecentComps(p => p.map(x => x.id === updated.id ? updated : x));
    const key = `${group.video_id}-${seg.start}`;
    setAddedIdx(key);
    setTimeout(() => setAddedIdx(k => k === key ? null : k), 1400);
  }

  async function removeClip(i: number) {
    if (!comp) return;
    const r = await fetch(`/api/compilations/${comp.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clips: comp.clips.filter((_, idx) => idx !== i) }),
    });
    const updated = await r.json();
    setComp(updated);
    setRecentComps(p => p.map(x => x.id === updated.id ? updated : x));
  }

  async function moveClip(i: number, dir: -1 | 1) {
    if (!comp) return;
    const next = [...comp.clips];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    const r = await fetch(`/api/compilations/${comp.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clips: next }),
    });
    const updated = await r.json();
    setComp(updated);
  }

  async function renameComp(title: string) {
    if (!comp) return;
    const r = await fetch(`/api/compilations/${comp.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const updated = await r.json();
    setComp(updated);
    setRecentComps(p => p.map(x => x.id === updated.id ? updated : x));
  }

  function closeComp() {
    update({ activeCompId: null });
    setComp(null);
    router.replace("/workspace");
  }

  const totalSec = comp?.clips.reduce((s, c) => s + (c.end - c.start), 0) || 0;
  const totalMin = Math.floor(totalSec / 60);
  const totalSecRest = Math.floor(totalSec) % 60;

  return (
    <div className="space-y-5">
      {/* Active compilation banner */}
      {comp && (
        <div className="card px-4 py-3 flex items-center gap-3">
          <div
            className="w-1 h-8 rounded-sm flex-shrink-0"
            style={{ background: "var(--accent)" }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] eyebrow mb-0.5">Working on</div>
            <input
              defaultValue={comp.title}
              onBlur={e => renameComp(e.target.value)}
              className="bg-transparent outline-none font-semibold text-[15px] w-full hover:bg-white/[0.03] focus:bg-white/[0.05] rounded px-1 -mx-1"
            />
          </div>
          <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
            <span className="chip">{comp.clips.length} clip{comp.clips.length === 1 ? "" : "s"}</span>
            <span className="chip font-mono">{totalMin}:{totalSecRest.toString().padStart(2, "0")}</span>
          </div>
          <a href={`/api/export/${comp.id}`} className="btn btn-sm">
            <FileDown size={11} /> Export
          </a>
          <button onClick={closeComp} className="btn btn-ghost btn-sm" title="Close compilation">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search + actions */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 left-3 pointer-events-none" style={{ color: "var(--muted)" }} />
            <input
              type="text"
              autoFocus
              placeholder={comp ? "Find more moments for this compilation..." : "What's the theme? e.g. \"Times Arab almost died\""}
              className="input input-lg pl-10"
              value={state.theme}
              onChange={e => update({ theme: e.target.value })}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) findMoments();
              }}
            />
          </div>
          <button
            onClick={() => findMoments()}
            disabled={loadingSearch || !state.theme.trim()}
            className="btn btn-primary btn-lg"
            title="Search transcripts for clips matching the theme"
          >
            {loadingSearch ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Find moments
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
      </div>

      {/* Two-column body */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* LEFT: results */}
        <div className="space-y-4 min-w-0">
          {/* Search results */}
          {(loadingSearch || state.results.length > 0) && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="eyebrow flex items-center gap-1.5">
                  <Search size={11} />
                  Moments {state.resultsFor && <>· <span style={{ color: "var(--text-2)" }}>{state.resultsFor}</span></>}
                </div>
                {state.results.length > 0 && (
                  <button onClick={() => update({ results: [], resultsFor: "" })} className="text-[11px] link">
                    Clear
                  </button>
                )}
              </div>
              {loadingSearch ? (
                <ResultsSkeleton />
              ) : (
                <div className="space-y-2 anim-stagger">
                  {state.results.map(group => (
                    <ResultGroup
                      key={group.video_id}
                      group={group}
                      meta={videoMap[group.video_id]}
                      addedKey={addedIdx}
                      onAdd={addClip}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Empty state */}
          {!loadingSearch && state.results.length === 0 && !comp && (
            <EmptyState recentComps={recentComps} />
          )}
        </div>

        {/* RIGHT: player + compilation list */}
        <aside className="space-y-3 lg:sticky lg:top-[68px]">
          <PlayerPanel />
          {comp ? (
            <CompPanel comp={comp} onRemove={removeClip} onMove={moveClip} />
          ) : (
            <RecentsPanel recents={recentComps} />
          )}
        </aside>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------
 * Subcomponents
 * --------------------------------------------------------- */

function KindBadge({ kind }: { kind?: "context" | "moment" }) {
  if (!kind) return null;
  const isMoment = kind === "moment";
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
      style={isMoment
        ? { background: "var(--accent)", color: "white" }
        : { background: "var(--bg-elev-2)", color: "var(--muted)", border: "1px solid var(--border)" }
      }
      title={isMoment ? "The peak/payoff moment" : "Setup / scenario context"}
    >
      {kind}
    </span>
  );
}


function ResultGroup({ group, meta, addedKey, onAdd }: {
  group: SearchResultGroup;
  meta?: Video;
  addedKey: string | null;
  onAdd: (group: SearchResultGroup, seg: any) => void;
}) {
  const { preview, state } = useWorkspace();
  return (
    <div className="card p-3">
      <div className="flex gap-2.5 items-start">
        <Link href={`/video/${group.video_id}`} className="flex-shrink-0 w-32">
          <img
            src={`https://i.ytimg.com/vi/${group.video_id}/mqdefault.jpg`}
            className="w-full aspect-video object-cover rounded"
            alt=""
            loading="lazy"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[14px] font-semibold leading-snug clamp-2">{group.title}</h3>
            <Link href={`/video/${group.video_id}`} className="link text-[10.5px] flex items-center gap-1 flex-shrink-0">
              Open <ExternalLink size={9} />
            </Link>
          </div>
          {meta && (
            <div className="mt-1 text-[10.5px] flex gap-2" style={{ color: "var(--muted)" }}>
              <span>{fmtViews(meta.view_count)} views</span>
              <span>·</span>
              <span>{fmtDuration(meta.duration_sec)}</span>
            </div>
          )}
          <p className="mt-1.5 text-[12px] italic clamp-2" style={{ color: "var(--accent-hover)" }}>{group.reason}</p>
        </div>
      </div>
      {group.segments.length === 0 ? (
        <p className="mt-2 text-[11.5px] italic" style={{ color: "var(--muted-2)" }}>
          No clean transcript match — open the video to scan manually.
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {group.segments.map((s, i) => {
            const key = `${group.video_id}-${s.start}`;
            const added = addedKey === key;
            const active = state.player?.videoId === group.video_id && state.player?.start === s.start;
            return (
              <div key={i} className="flex items-stretch gap-2 p-1.5 rounded surface group">
                <ClipThumb
                  videoId={group.video_id}
                  start={s.start}
                  end={s.end}
                  active={active}
                  onClick={() => preview(group.video_id, s.start, s.end)}
                  className="w-28 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <KindBadge kind={s.kind} />
                    <span className="text-[10.5px] font-mono" style={{ color: "var(--accent-hover)" }}>
                      {fmtTimestamp(s.start)}–{fmtTimestamp(s.end)} · {Math.round(s.end - s.start)}s
                    </span>
                  </div>
                  <p className="text-[12px] leading-snug clamp-2">{s.why}</p>
                  {s.quote && (
                    <p className="mt-0.5 text-[11px] italic clamp-2" style={{ color: "var(--muted)" }}>
                      &ldquo;{s.quote}&rdquo;
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onAdd(group, s)}
                  className={added ? "btn btn-sm" : "btn btn-primary btn-sm"}
                  style={added ? { background: "rgba(34,197,94,0.15)", color: "#86efac", borderColor: "rgba(34,197,94,0.3)" } : undefined}
                >
                  {added ? <><Check size={11} /> Added</> : <><Plus size={11} /> Add</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerPanel() {
  const { state, playerRef } = useWorkspace();
  if (!state.player) {
    return (
      <div className="card overflow-hidden">
        <div className="aspect-video flex items-center justify-center" style={{ background: "var(--bg-elev)" }}>
          <div className="text-center px-4">
            <div className="text-[11px] eyebrow mb-1">Inline preview</div>
            <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              Click any clip thumbnail to play it here.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="aspect-video bg-black">
        <ClipPlayer
          ref={playerRef}
          videoId={state.player.videoId}
          initialStart={state.player.start}
          autoplay
        />
      </div>
      {state.player.end !== undefined && (
        <div className="px-3 py-1.5 text-[10.5px] font-mono border-t flex items-center justify-between" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
          <span>Preview · {fmtTimestamp(state.player.start)}–{fmtTimestamp(state.player.end)}</span>
          <span>{Math.round(state.player.end - state.player.start)}s</span>
        </div>
      )}
    </div>
  );
}

function CompPanel({ comp, onRemove, onMove }: {
  comp: SavedCompilation;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
}) {
  const { preview, state } = useWorkspace();
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="eyebrow">Compilation</div>
        <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>
          {comp.clips.length} clip{comp.clips.length === 1 ? "" : "s"}
        </span>
      </div>
      {comp.clips.length === 0 ? (
        <p className="text-[11.5px] italic px-1 py-3" style={{ color: "var(--muted-2)" }}>
          Click Add on any moment in the results to start.
        </p>
      ) : (
        <ol className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-0.5">
          {comp.clips.map((c, i) => {
            const playing = state.player?.videoId === c.video_id && Math.abs((state.player?.start || 0) - c.start) < 1;
            return (
              <li key={i} className="flex gap-1.5 p-1.5 rounded surface group">
                <div className="flex flex-col justify-between text-[9px] py-0.5" style={{ color: "var(--muted-2)" }}>
                  <button onClick={() => onMove(i, -1)} className="hover:text-white">▲</button>
                  <button onClick={() => onMove(i, 1)} className="hover:text-white">▼</button>
                </div>
                <ClipThumb
                  videoId={c.video_id}
                  start={c.start}
                  end={c.end}
                  active={playing}
                  onClick={() => preview(c.video_id, c.start, c.end)}
                  className="w-20 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <KindBadge kind={c.kind} />
                  </div>
                  <div className="text-[11px] font-medium clamp-2 leading-snug">{c.video_title}</div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--accent-hover)" }}>
                    {fmtTimestamp(c.start)}–{fmtTimestamp(c.end)}
                  </div>
                  {c.note && <div className="mt-0.5 text-[10.5px] italic clamp-1" style={{ color: "var(--muted)" }}>{c.note}</div>}
                </div>
                <button
                  onClick={() => onRemove(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity self-start"
                  title="Remove"
                >
                  <X size={11} style={{ color: "var(--muted)" }} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function RecentsPanel({ recents }: { recents: SavedCompilation[] }) {
  if (recents.length === 0) {
    return (
      <div className="card p-4 text-[11.5px]" style={{ color: "var(--muted)" }}>
        <div className="eyebrow mb-1.5">No saved compilations yet</div>
        Type a theme above and hit <span className="kbd">Find moments</span> or <span className="kbd">Ideas</span>.
      </div>
    );
  }
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="eyebrow">Recent</div>
        <Link href="/saved" className="text-[10.5px] link">All →</Link>
      </div>
      <ul className="space-y-1.5">
        {recents.slice(0, 6).map(c => {
          const dur = c.clips.reduce((s, x) => s + (x.end - x.start), 0);
          const m = Math.floor(dur / 60);
          return (
            <li key={c.id}>
              <Link href={`/workspace?id=${c.id}`} className="block p-2 rounded surface hover:bg-white/[0.04] transition-colors text-[12px]">
                <div className="font-medium clamp-1 leading-snug">{c.title}</div>
                <div className="text-[10px] mt-0.5 flex gap-1.5" style={{ color: "var(--muted)" }}>
                  <span>{c.clips.length} clips</span>
                  <span>·</span>
                  <span className="font-mono">{m}m</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState({ recentComps }: { recentComps: SavedCompilation[] }) {
  return (
    <div className="card p-8 text-center space-y-2">
      <div className="eyebrow mx-auto">Find your moments</div>
      <p className="text-[13px] max-w-md mx-auto" style={{ color: "var(--muted)" }}>
        Type a theme above and hit <span className="kbd">Find moments</span>. Claude scans transcripts and pulls clips with sentence-aligned cuts.
      </p>
      <p className="text-[11.5px] pt-2" style={{ color: "var(--muted-2)" }}>
        Want to brainstorm titles first? Head to <a href="/titles" className="link">Titles</a>.
      </p>
      {recentComps.length > 0 && (
        <p className="text-[11.5px]" style={{ color: "var(--muted-2)" }}>
          Or continue a recent compilation →
        </p>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-3 animate-pulse">
          <div className="flex gap-2.5">
            <div className="w-32 aspect-video rounded" style={{ background: "var(--bg-elev)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 rounded w-3/4" style={{ background: "var(--bg-elev)" }} />
              <div className="h-3 rounded w-1/3" style={{ background: "var(--bg-elev)" }} />
              <div className="h-3 rounded w-full" style={{ background: "var(--bg-elev)" }} />
            </div>
          </div>
        </div>
      ))}
      <div className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
        <Loader2 className="animate-spin inline mr-1" size={11} /> Ranking videos, then scanning transcripts in parallel...
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="text-[13px]" style={{ color: "var(--muted)" }}>Loading...</div>}>
      <WorkspaceInner />
    </Suspense>
  );
}
