/**
 * Workspace state — what the user is currently working on.
 *
 * Persisted to localStorage so navigation between tabs and page reloads
 * never lose your ideas, search results, or active compilation.
 */
import type { CompilationIdea } from "./types";

export interface SearchSegment {
  start: number;
  end: number;
  why: string;
  quote?: string;
}

export interface SearchResultGroup {
  video_id: string;
  title: string;
  url: string;
  reason: string;
  segments: SearchSegment[];
}

export interface WorkspaceState {
  /** Last value typed into the theme/search input */
  theme: string;
  /** Ideas Claude generated (latest run) */
  ideas: CompilationIdea[];
  /** Theme that produced the ideas */
  ideasFor: string;
  /** Clip search results (latest run) */
  results: SearchResultGroup[];
  /** Theme that produced the results */
  resultsFor: string;
  /** Currently-active compilation ID (if any) */
  activeCompId: string | null;
  /** Last clip the user previewed — restored on reload */
  player: { videoId: string; start: number; end?: number } | null;
}

export const EMPTY_WORKSPACE: WorkspaceState = {
  theme: "",
  ideas: [],
  ideasFor: "",
  results: [],
  resultsFor: "",
  activeCompId: null,
  player: null,
};

const KEY = "compilations.workspace.v1";

export function loadWorkspace(): WorkspaceState {
  if (typeof window === "undefined") return EMPTY_WORKSPACE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_WORKSPACE;
    const parsed = JSON.parse(raw);
    return { ...EMPTY_WORKSPACE, ...parsed };
  } catch {
    return EMPTY_WORKSPACE;
  }
}

export function saveWorkspace(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // quota / serialization — ignore, this is a best-effort cache
  }
}
