"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { EMPTY_WORKSPACE, WorkspaceState, loadWorkspace, saveWorkspace } from "@/lib/workspace";
import type { ClipPlayerHandle } from "./ClipPlayer";

interface Ctx {
  state: WorkspaceState;
  update: (patch: Partial<WorkspaceState>) => void;
  reset: () => void;
  /** Imperative ref to the currently mounted inline player (used by clip thumbs to seek). */
  playerRef: React.MutableRefObject<ClipPlayerHandle | null>;
  /** Switch the inline player to a different video (or seek if same). */
  preview: (videoId: string, start: number, end?: number) => void;
}

const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);
  const playerRef = useRef<ClipPlayerHandle | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setState(loadWorkspace());
    setHydrated(true);
  }, []);

  // Persist on every change
  useEffect(() => {
    if (!hydrated) return;
    saveWorkspace(state);
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<WorkspaceState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY_WORKSPACE);
  }, []);

  const preview = useCallback((videoId: string, start: number, end?: number) => {
    setState(prev => {
      // Same video: just seek via player ref (no remount)
      if (prev.player?.videoId === videoId && playerRef.current) {
        playerRef.current.seekTo(start, true);
        return { ...prev, player: { videoId, start, end } };
      }
      // Different video: change state, the player component will remount
      return { ...prev, player: { videoId, start, end } };
    });
  }, []);

  return (
    <WorkspaceCtx.Provider value={{ state, update, reset, playerRef, preview }}>
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
