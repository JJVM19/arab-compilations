"use client";
import { useState } from "react";
import { ChevronDown, Bookmark, BookmarkCheck, Hammer } from "lucide-react";
import type { CompilationIdea, Video } from "@/lib/types";
import { IdeaVideoStrip } from "./IdeaVideoStrip";

interface Props {
  idea: CompilationIdea;
  onBuild: () => void;
  videoMap: Record<string, Video>;
  /** Initial saved state (e.g. if already in saved titles). */
  initialSavedId?: string | null;
}

export function IdeaCard({ idea, onBuild, videoMap, initialSavedId }: Props) {
  const [expandAlts, setExpandAlts] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(initialSavedId ?? null);
  const saved = savedId !== null;

  async function saveTitle() {
    const reasons: Record<string, string> = {};
    for (const v of idea.videos as any[]) reasons[v.video_id] = v.reason;
    const body = {
      title: idea.title,
      alt_titles: idea.alt_titles ?? [],
      pitch: idea.pitch,
      target_length_min: idea.target_length_min,
      video_ids: (idea.videos as any[]).map(v => v.video_id),
      reasons,
    };
    const r = await fetch("/api/titles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const t = await r.json();
      setSavedId(t.id);
    }
  }

  async function unsaveTitle() {
    if (!savedId) return;
    const r = await fetch(`/api/titles/${savedId}`, { method: "DELETE" });
    if (r.ok) setSavedId(null);
  }

  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold leading-snug">{idea.title}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={saved ? unsaveTitle : saveTitle}
            className="btn btn-sm"
            title={saved ? "Saved to Titles — click to remove" : "Save title for later"}
            style={saved ? { background: "var(--accent-tint)", borderColor: "rgba(239,43,43,0.3)", color: "#fda4a4" } : undefined}
          >
            {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
            {saved ? "Saved" : "Save"}
          </button>
          <button onClick={onBuild} className="btn btn-primary btn-sm">
            <Hammer size={11} /> Build
          </button>
        </div>
      </div>
      {idea.alt_titles && idea.alt_titles.length > 0 && (
        <div>
          <button
            className="text-[10.5px] flex items-center gap-0.5 hover:text-white transition-colors"
            style={{ color: "var(--muted)" }}
            onClick={() => setExpandAlts(p => !p)}
          >
            <ChevronDown size={10} className={`transition-transform ${expandAlts ? "rotate-180" : ""}`} />
            {idea.alt_titles.length} alt titles
          </button>
          {expandAlts && (
            <ul className="mt-1 space-y-0.5 text-[12px]">
              {idea.alt_titles.map((t, i) => (
                <li key={i} style={{ color: "var(--muted)" }}>· {t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>{idea.pitch}</p>
      <div className="flex gap-1">
        <span className="chip">~{idea.target_length_min}min</span>
        <span className="chip">{idea.videos.length} videos</span>
      </div>
      <IdeaVideoStrip
        videoIds={(idea.videos as any[]).map(v => v.video_id)}
        videoMap={videoMap}
        reasons={Object.fromEntries((idea.videos as any[]).map(v => [v.video_id, v.reason]))}
        layout="strip"
        maxThumbs={8}
      />
    </div>
  );
}
