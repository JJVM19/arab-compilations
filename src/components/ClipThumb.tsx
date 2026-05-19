"use client";
import { Play } from "lucide-react";
import { fmtTimestamp } from "@/lib/utils";

interface Props {
  videoId: string;
  start?: number;
  end?: number;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}

/** Clickable thumbnail with play-overlay; used for clip preview affordances. */
export function ClipThumb({ videoId, start, end, onClick, className, active }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block overflow-hidden rounded transition-all ${className ?? ""}`}
      style={{ aspectRatio: "16/9", outline: active ? "2px solid var(--accent)" : "none", outlineOffset: -1 }}
    >
      <img
        src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors group">
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <Play size={14} fill="white" color="white" style={{ marginLeft: 2 }} />
          </div>
        </div>
      </div>
      {start !== undefined && end !== undefined && (
        <div
          className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
          style={{ background: "rgba(0,0,0,0.85)", color: "white" }}
        >
          {fmtTimestamp(start)}–{fmtTimestamp(end)}
        </div>
      )}
    </button>
  );
}
