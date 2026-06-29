"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, CheckCircle2, AlertCircle, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type AddResult = {
  ok?: boolean;
  error?: string;
  video?: any;
  chunks_added?: number;
  transcript?: "ok" | "pending" | "error";
  source?: "arab" | "extended";
  detail?: string;
};

export function AddVideoModal({ open, onClose, onAdded }: Props) {
  const [input, setInput] = useState("");
  const [source, setSource] = useState<"arab" | "extended">("arab");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  function close() {
    setInput("");
    setSource("arab");
    setResult(null);
    setBusy(false);
    setRetrying(false);
    onClose();
  }

  async function submit() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/library/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, source }),
      });
      const data = await r.json();
      if (!r.ok) {
        setResult({ error: data.error || `HTTP ${r.status}` });
      } else {
        setResult(data);
        onAdded();
      }
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function retryTranscript() {
    if (!result?.video?.id || retrying) return;
    setRetrying(true);
    try {
      const r = await fetch("/api/library/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: result.video.id }),
      });
      const data = await r.json();
      setResult(p => p ? { ...p, transcript: data.transcript, chunks_added: data.chunks_added, detail: data.detail } : p);
      if (data.transcript === "ok") onAdded();
    } catch {
      /* keep prior result */
    } finally {
      setRetrying(false);
    }
  }

  if (!open || typeof window === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !busy && close()}
      className="fixed inset-0 z-50 flex items-center justify-center anim-fade"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card p-5 mx-4 w-full max-w-[480px]"
        style={{ animation: "fadeInUp 0.18s cubic-bezier(0.16, 1, 0.3, 1) both", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent-tint-strong)", color: "var(--accent-hover)" }}
          >
            <Plus size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px]">Add a video</h3>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
              Paste a YouTube URL or 11-char video ID.
            </p>
          </div>
          <button onClick={close} disabled={busy} className="btn btn-ghost btn-sm flex-shrink-0">
            <X size={12} />
          </button>
        </div>

        {/* Source toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-md mb-2.5 w-full" style={{ background: "var(--bg-elev)" }}>
          {([["arab", "Arab upload"], ["extended", "Extended cut"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSource(val)}
              disabled={busy}
              className="flex-1 px-2.5 py-1.5 rounded text-[11.5px] font-medium transition-colors"
              style={{
                background: source === val ? "var(--accent)" : "transparent",
                color: source === val ? "white" : "var(--muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          autoFocus
          placeholder="https://www.youtube.com/watch?v=..."
          className="input text-[13px]"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          disabled={busy}
        />

        {source === "extended" && (
          <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            For raw/extended footage: upload the MP4 to YouTube as <strong>Unlisted</strong>, then paste the link here so we can pull its transcript.
          </p>
        )}

        {/* Status */}
        {busy && (
          <div className="mt-4 p-3 rounded surface flex items-center gap-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
            <Loader2 size={13} className="animate-spin" />
            Fetching metadata + transcript… (up to a minute for new uploads)
          </div>
        )}
        {result?.error && (
          <div className="mt-4 p-3 rounded flex items-start gap-2 text-[12.5px]"
            style={{ background: "rgba(239,43,43,0.08)", border: "1px solid rgba(239,43,43,0.3)", color: "#fda4a4" }}>
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{result.error}</span>
          </div>
        )}
        {result?.ok && result.video && result.transcript === "ok" && (
          <div className="mt-4 p-3 rounded flex items-start gap-2 text-[12.5px]"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}>
            <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium clamp-2">Added: {result.video.title}</div>
              <div className="text-[11px] mt-0.5 opacity-80">
                {result.chunks_added} transcript chunks indexed{result.source === "extended" ? " · extended cut" : ""}
              </div>
            </div>
          </div>
        )}
        {result?.ok && result.video && result.transcript !== "ok" && (
          <div className="mt-4 p-3 rounded flex items-start gap-2 text-[12.5px]"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", color: "#fde68a" }}>
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium clamp-2">Added: {result.video.title}</div>
              <div className="text-[11px] mt-0.5 opacity-90">
                {result.detail || "Transcript not available yet."} It&apos;s in your library and searchable by title — clip search needs the transcript.
              </div>
              <button
                onClick={retryTranscript}
                disabled={retrying}
                className="btn btn-sm mt-2"
                style={{ background: "rgba(234,179,8,0.15)", color: "#fde68a", borderColor: "rgba(234,179,8,0.3)" }}
              >
                {retrying ? <Loader2 size={11} className="animate-spin" /> : null}
                Retry transcript
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {result?.ok ? (
            <button onClick={close} className="btn">Done</button>
          ) : (
            <>
              <button onClick={close} disabled={busy} className="btn">Cancel</button>
              <button onClick={submit} disabled={busy || !input.trim()} className="btn btn-primary">
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add to library
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
