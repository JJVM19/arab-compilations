"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  /** The trigger button label/icon content. */
  label: React.ReactNode;
  /** Modal title (default: "Delete?"). */
  title?: string;
  /** Modal body text. */
  message?: string;
  /** Modal confirm button label (default: "Delete"). */
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}

/**
 * Trigger button + centered confirmation modal.
 * Backdrop is dimmed + blurred. ESC + backdrop click cancel.
 */
export function ConfirmButton({ label, title = "Are you sure?", message, confirmLabel = "Delete", onConfirm, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`btn btn-danger ${className ?? ""}`}
        style={{ paddingTop: 11, paddingBottom: 11 }}
      >
        {label}
      </button>
      {open && (
        <ConfirmDialog
          title={title}
          message={message}
          confirmLabel={confirmLabel}
          onCancel={() => setOpen(false)}
          onConfirm={async () => {
            await onConfirm();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

interface DialogProps {
  title: string;
  message?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }: DialogProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") doConfirm();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doConfirm() {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); }
    finally { setBusy(false); }
  }

  if (typeof window === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center anim-fade"
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card p-5 mx-4 w-full max-w-[420px]"
        style={{
          animation: "fadeInUp 0.18s cubic-bezier(0.16, 1, 0.3, 1) both",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent-tint-strong)", color: "#fda4a4" }}
          >
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px]">{title}</h3>
            {message && (
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                {message}
              </p>
            )}
          </div>
          <button onClick={onCancel} className="btn btn-ghost btn-sm flex-shrink-0">
            <X size={12} />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="btn" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={doConfirm}
            disabled={busy}
            className="btn"
            style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "white" }}
            autoFocus
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
        <div className="mt-3 text-[10.5px] text-center" style={{ color: "var(--muted-2)" }}>
          Press <span className="kbd">Esc</span> to cancel · <span className="kbd">Enter</span> to confirm
        </div>
      </div>
    </div>,
    document.body,
  );
}
