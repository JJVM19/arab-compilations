import fs from "node:fs";
import path from "node:path";
import { Catalog, ChunkedVideo, SavedCompilation, SavedTitle, Video } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const CHUNKS_PATH = path.join(DATA_DIR, "chunks.json");
const COMPS_PATH = path.join(DATA_DIR, "compilations.json");
const TITLES_PATH = path.join(DATA_DIR, "titles.json");

/**
 * Mtime-keyed cache. JSON is re-read whenever the underlying file changes
 * (e.g., after /api/library/add appends a new video).
 */
let _catalogCache: { mtime: number; data: Catalog } | null = null;
let _chunksCache: { mtime: number; data: Record<string, ChunkedVideo> } | null = null;

export function getCatalog(): Catalog {
  const stat = fs.statSync(CATALOG_PATH);
  const mtime = stat.mtimeMs;
  if (_catalogCache && _catalogCache.mtime === mtime) return _catalogCache.data;
  const data = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8")) as Catalog;
  _catalogCache = { mtime, data };
  return data;
}

export function getVideo(id: string): Video | null {
  return getCatalog().videos.find(v => v.id === id) || null;
}

export function getChunks(): Record<string, ChunkedVideo> {
  if (!fs.existsSync(CHUNKS_PATH)) return {};
  const stat = fs.statSync(CHUNKS_PATH);
  const mtime = stat.mtimeMs;
  if (_chunksCache && _chunksCache.mtime === mtime) return _chunksCache.data;
  const data = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf-8"));
  _chunksCache = { mtime, data };
  return data;
}

export function getVideoChunks(videoId: string): ChunkedVideo | null {
  return getChunks()[videoId] || null;
}

export function getCompilations(): SavedCompilation[] {
  if (!fs.existsSync(COMPS_PATH)) return [];
  const raw = fs.readFileSync(COMPS_PATH, "utf-8");
  return JSON.parse(raw).compilations || [];
}

export function saveCompilations(comps: SavedCompilation[]) {
  fs.writeFileSync(COMPS_PATH, JSON.stringify({ compilations: comps }, null, 2));
}

export function upsertCompilation(c: SavedCompilation): SavedCompilation {
  const all = getCompilations();
  const idx = all.findIndex(x => x.id === c.id);
  c.updated_at = new Date().toISOString();
  if (idx >= 0) all[idx] = c;
  else all.unshift(c);
  saveCompilations(all);
  return c;
}

export function deleteCompilation(id: string) {
  saveCompilations(getCompilations().filter(c => c.id !== id));
}

/* -----------------------------------------------------------
 * Saved titles (pitches you want to come back to, but haven't built)
 * --------------------------------------------------------- */

export function getTitles(): SavedTitle[] {
  if (!fs.existsSync(TITLES_PATH)) return [];
  const raw = fs.readFileSync(TITLES_PATH, "utf-8");
  return JSON.parse(raw).titles || [];
}

export function saveTitles(titles: SavedTitle[]) {
  fs.writeFileSync(TITLES_PATH, JSON.stringify({ titles }, null, 2));
}

export function upsertTitle(t: SavedTitle): SavedTitle {
  const all = getTitles();
  const idx = all.findIndex(x => x.id === t.id);
  if (idx >= 0) all[idx] = t;
  else all.unshift(t);
  saveTitles(all);
  return t;
}

export function deleteTitle(id: string) {
  saveTitles(getTitles().filter(t => t.id !== id));
}
