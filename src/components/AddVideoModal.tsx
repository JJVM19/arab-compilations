"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, CheckCircle2, AlertCircle, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddVideoModal({ open, onClose, onAdded }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; video?: any; chunks_added?: number; transcript?: string } | null>(null);

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
    setResult(null);
    setBusy(false);
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
        body: JSON.stringify({ input }),
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
            <h3 className="font-semibold text-[15px]">Add a new Arab video</h3>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
              Paste a YouTube URL or video ID. Must be from @Arab&apos;s channel.
            </p>
          </div>
          <button onClick={close} disabled={busy} className="btn btn-ghost btn-sm flex-shrink-0">
            <X size={12} />
          </button>
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

        {/* Status */}
        {busy && (
          <div className="mt-4 p-3 rounded surface flex items-center gap-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
            <Loader2 size={13} className="animate-spin" />
            Fetching metadata + downloading transcript... (~15 seconds)
          </div>
        )}
        {result?.error && (
          <div className="mt-4 p-3 rounded flex items-start gap-2 text-[12.5px]"
            style={{ background: "rgba(239,43,43,0.08)", border: "1px solid rgba(239,43,43,0.3)", color: "#fda4a4" }}>
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{result.error}</span>
          </div>
        )}
        {result?.ok && result.video && (
          <div className="mt-4 p-3 rounded flex items-start gap-2 text-[12.5px]"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}>
            <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium clamp-2">Added: {result.video.title}</div>
              <div className="text-[11px] mt-0.5 opacity-80">
                Transcript: {result.transcript === "ok" ? `${result.chunks_added} chunks indexed` : result.transcript === "missing" ? "no captions available" : "download failed"}
              </div>
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
