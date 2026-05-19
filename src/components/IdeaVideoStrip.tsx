"use client";
import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Video } from "@/lib/types";
import { ClipPlayer } from "./ClipPlayer";
import { fmtViews, fmtDuration } from "@/lib/utils";

interface Props {
  videoIds: string[];
  videoMap: Record<string, Video>;
  reasons?: Record<string, string>;
  maxThumbs?: number;
  layout?: "strip" | "grid";
}

/**
 * Idea/title video thumbnail row with click-to-expand inline preview.
 * On expand: shows inline player. Click again or X to collapse. Click another to swap.
 */
export function IdeaVideoStrip({ videoIds, videoMap, reasons, maxThumbs = 6, layout = "grid" }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = videoIds.slice(0, maxThumbs);
  const extra = videoIds.length - visible.length;
  const expandedMeta = expanded ? videoMap[expanded] : null;

  return (
    <div>
      {layout === "grid" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {visible.map(vid => (
            <ThumbButton
              key={vid}
              vid={vid}
              meta={videoMap[vid]}
              reason={reasons?.[vid]}
              active={expanded === vid}
              onClick={() => setExpanded(p => p === vid ? null : vid)}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
          {visible.map(vid => (
            <ThumbButton
              key={vid}
              vid={vid}
              meta={videoMap[vid]}
              reason={reasons?.[vid]}
              active={expanded === vid}
              onClick={() => setExpanded(p => p === vid ? null : vid)}
              compact
            />
          ))}
        </div>
      )}
      {extra > 0 && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--muted-2)" }}>
          +{extra} more video{extra === 1 ? "" : "s"}
        </div>
      )}

      {/* Smooth-collapse via grid-template-rows trick */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          marginTop: expanded ? 10 : 0,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          {expanded && expandedMeta && (
            <div className="card-soft overflow-hidden anim-fade-up">
              <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold clamp-1 leading-snug">{expandedMeta.title}</div>
                  <div className="text-[10.5px] mt-0.5 flex gap-1.5" style={{ color: "var(--muted)" }}>
                    <span>{fmtViews(expandedMeta.view_count)} views</span>
                    <span>·</span>
                    <span>{fmtDuration(expandedMeta.duration_sec)}</span>
                    {reasons?.[expanded] && (
                      <>
                        <span>·</span>
                        <span className="italic clamp-1" style={{ color: "var(--accent-hover)" }}>{reasons[expanded]}</span>
                      </>
                    )}
                  </div>
                </div>
                <Link href={`/video/${expanded}`} className="btn btn-sm flex-shrink-0" title="Open full video page">
                  <ExternalLink size={11} /> Open
                </Link>
                <button onClick={() => setExpanded(null)} className="btn btn-ghost btn-sm flex-shrink-0" title="Close preview">
                  <X size={12} />
                </button>
              </div>
              <div className="aspect-video bg-black">
                <ClipPlayer videoId={expanded} initialStart={0} autoplay />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThumbButton({ vid, meta, reason, active, onClick, compact }: {
  vid: string; meta?: Video; reason?: string; active: boolean; onClick: () => void; compact?: boolean;
}) {
  if (!meta) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={reason || meta.title}
      className={`flex gap-1.5 p-1.5 rounded surface hover:bg-white/[0.04] transition-all text-left hover:-translate-y-px ${compact ? "flex-shrink-0 w-32" : ""}`}
      style={{ outline: active ? "2px solid var(--accent)" : "none", outlineOffset: -1 }}
    >
      <img
        src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`}
        className={`aspect-video object-cover rounded flex-shrink-0 ${compact ? "w-full" : "w-16"}`}
        alt=""
        loading="lazy"
      />
      {!compact && (
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium clamp-2 leading-snug">{meta.title}</div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
            {fmtViews(meta.view_count)}
          </div>
        </div>
      )}
    </button>
  );
}
