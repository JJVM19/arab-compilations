"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileDown, Trash2, Hammer, Plus, Save, Play } from "lucide-react";
import type { SavedCompilation } from "@/lib/types";
import { fmtDate, fmtTimestamp } from "@/lib/utils";
import { ClipPlayer, ClipPlayerHandle } from "@/components/ClipPlayer";
import { ConfirmButton } from "@/components/ConfirmButton";

export default function SavedPage() {
  const [comps, setComps] = useState<SavedCompilation[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ compId: string; clipIdx: number; videoId: string; start: number; end: number } | null>(null);
  const playerRef = useRef<ClipPlayerHandle | null>(null);

  function reload() {
    setLoading(true);
    fetch("/api/compilations").then(r => r.json()).then(d => {
      setComps(d.compilations || []);
      setLoading(false);
    });
  }
  useEffect(reload, []);

  async function del(id: string) {
    await fetch(`/api/compilations/${id}`, { method: "DELETE" });
    if (preview?.compId === id) setPreview(null);
    reload();
  }

  async function newComp() {
    const title = prompt("Compilation title");
    if (!title) return;
    const r = await fetch("/api/compilations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, pitch: "", target_length_min: 30, clips: [] }),
    });
    const c = await r.json();
    window.location.href = `/workspace?id=${c.id}`;
  }

  function openPreview(compId: string, clipIdx: number, videoId: string, start: number, end: number) {
    if (preview?.compId === compId && preview.videoId === videoId) {
      // Same video, seek
      setPreview({ compId, clipIdx, videoId, start, end });
      setTimeout(() => playerRef.current?.seekTo(start, true), 50);
    } else {
      setPreview({ compId, clipIdx, videoId, start, end });
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Saved compilations</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {comps.length} saved · click any thumbnail to preview · resume in workspace
          </p>
        </div>
        <button onClick={newComp} className="btn btn-primary">
          <Plus size={13} /> New compilation
        </button>
      </header>

      {loading ? (
        <div className="text-[13px]" style={{ color: "var(--muted)" }}>Loading…</div>
      ) : comps.length === 0 ? (
        <div className="card p-12 text-center">
          <Save className="mx-auto mb-2" size={20} style={{ color: "var(--muted-2)" }} />
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            No saved compilations yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3 anim-stagger">
          {comps.map(c => {
            const totalSec = c.clips.reduce((s, x) => s + (x.end - x.start), 0);
            const m = Math.floor(totalSec / 60);
            const sr = Math.floor(totalSec) % 60;
            const compPreview = preview?.compId === c.id ? preview : null;
            return (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/workspace?id=${c.id}`} className="block">
                      <h3 className="text-[16px] font-semibold leading-tight hover:opacity-90" style={{ color: "var(--accent-hover)" }}>{c.title}</h3>
                    </Link>
                    {c.pitch && <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>{c.pitch}</p>}
                    <div className="mt-1.5 flex gap-1 flex-wrap">
                      <span className="chip">{c.clips.length} clip{c.clips.length === 1 ? "" : "s"}</span>
                      <span className="chip"><span className="font-mono">{m}:{sr.toString().padStart(2, "0")}</span></span>
                      <span className="chip">target ~{c.target_length_min}min</span>
                      <span className="chip">updated {fmtDate(c.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 min-w-[140px]">
                    <Link
                      href={`/workspace?id=${c.id}`}
                      className="btn btn-primary btn-lg justify-start"
                      style={{ paddingTop: 11, paddingBottom: 11 }}
                    >
                      <Hammer size={15} /> Resume
                    </Link>
                    <a
                      href={`/api/export/${c.id}`}
                      className="btn btn-lg justify-start"
                      style={{ paddingTop: 11, paddingBottom: 11 }}
                    >
                      <FileDown size={15} /> Export CSV
                    </a>
                    <ConfirmButton
                      label={<><Trash2 size={15} /> Delete</>}
                      title="Delete compilation?"
                      message={`This will permanently delete "${c.title}" and all ${c.clips.length} clip${c.clips.length === 1 ? "" : "s"}. This cannot be undone.`}
                      confirmLabel="Delete forever"
                      onConfirm={() => del(c.id)}
                      className="btn-lg justify-start"
                    />
                  </div>
                </div>

                {c.clips.length > 0 && (
                  <>
                    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1.5">
                      {c.clips.map((clip, i) => {
                        const active = compPreview?.clipIdx === i;
                        return (
                          <button
                            key={i}
                            onClick={() => openPreview(c.id, i, clip.video_id, clip.start, clip.end)}
                            className="flex-shrink-0 w-28 group relative"
                          >
                            <div className="relative aspect-video rounded overflow-hidden"
                              style={{ outline: active ? "2px solid var(--accent)" : "none", outlineOffset: -1 }}>
                              <img
                                src={`https://i.ytimg.com/vi/${clip.video_id}/mqdefault.jpg`}
                                className="w-full h-full object-cover"
                                alt=""
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ background: "var(--accent)" }}
                                >
                                  <Play size={11} fill="white" color="white" style={{ marginLeft: 1 }} />
                                </div>
                              </div>
                              <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded text-[9.5px] font-mono"
                                style={{ background: "rgba(0,0,0,0.85)", color: "white" }}>
                                {fmtTimestamp(clip.start)}
                              </div>
                            </div>
                            <div className="mt-1 text-[9.5px] clamp-1 text-left" style={{ color: "var(--muted)" }}>
                              {clip.video_title}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {compPreview && (
                      <div className="mt-3 surface overflow-hidden">
                        <div className="px-3 py-1.5 border-b flex items-center justify-between text-[11px]"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                          <span className="font-mono">
                            Clip {compPreview.clipIdx + 1}/{c.clips.length} · {fmtTimestamp(compPreview.start)}–{fmtTimestamp(compPreview.end)} · {Math.round(compPreview.end - compPreview.start)}s
                          </span>
                          <button onClick={() => setPreview(null)} className="btn btn-ghost btn-sm">
                            Close
                          </button>
                        </div>
                        <div className="aspect-video bg-black max-w-2xl">
                          <ClipPlayer
                            ref={playerRef}
                            videoId={compPreview.videoId}
                            initialStart={compPreview.start}
                            autoplay
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
