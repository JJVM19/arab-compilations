import fs from "node:fs";
import path from "node:path";
import { Catalog, ChunkedVideo, SavedClip, SavedCompilation, SavedTitle, Video } from "./types";
import { supabase } from "./supabase";

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const CHUNKS_PATH = path.join(DATA_DIR, "chunks.json");

/* -----------------------------------------------------------
 * Catalog + chunks — local JSON (static, committed to repo)
 * --------------------------------------------------------- */

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

/* -----------------------------------------------------------
 * Compilations + clips — Supabase
 * --------------------------------------------------------- */

interface ClipRow {
  id: string;
  compilation_id: string;
  position: number;
  video_id: string;
  video_title: string;
  video_url: string;
  start_sec: number;
  end_sec: number;
  note: string;
  kind: "context" | "moment" | null;
}

interface CompRow {
  id: string;
  title: string;
  pitch: string;
  target_length_min: number;
  created_at: string;
  updated_at: string;
}

function clipFromRow(r: ClipRow): SavedClip {
  return {
    video_id: r.video_id,
    video_title: r.video_title,
    video_url: r.video_url,
    start: r.start_sec,
    end: r.end_sec,
    note: r.note ?? "",
    kind: r.kind ?? undefined,
  };
}

async function compWithClips(row: CompRow): Promise<SavedCompilation> {
  const { data: clipRows, error } = await supabase
    .from("arab_clips")
    .select("*")
    .eq("compilation_id", row.id)
    .order("position", { ascending: true });
  if (error) throw error;
  return {
    id: row.id,
    title: row.title,
    pitch: row.pitch,
    target_length_min: row.target_length_min,
    created_at: row.created_at,
    updated_at: row.updated_at,
    clips: (clipRows as ClipRow[]).map(clipFromRow),
  };
}

export async function getCompilations(): Promise<SavedCompilation[]> {
  const { data, error } = await supabase
    .from("arab_compilations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data as CompRow[]).map(compWithClips));
}

export async function getCompilation(id: string): Promise<SavedCompilation | null> {
  const { data, error } = await supabase
    .from("arab_compilations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return compWithClips(data as CompRow);
}

async function replaceClips(compilationId: string, clips: SavedClip[]) {
  // Wipe + reinsert. Simpler than diffing and good enough for our scale.
  const { error: delErr } = await supabase
    .from("arab_clips")
    .delete()
    .eq("compilation_id", compilationId);
  if (delErr) throw delErr;
  if (clips.length === 0) return;
  const rows = clips.map((c, i) => ({
    compilation_id: compilationId,
    position: i,
    video_id: c.video_id,
    video_title: c.video_title,
    video_url: c.video_url,
    start_sec: c.start,
    end_sec: c.end,
    note: c.note ?? "",
    kind: c.kind ?? null,
  }));
  const { error: insErr } = await supabase.from("arab_clips").insert(rows);
  if (insErr) throw insErr;
}

export async function upsertCompilation(c: Partial<SavedCompilation> & { id?: string }): Promise<SavedCompilation> {
  const id = c.id ?? crypto.randomUUID();
  const payload: any = {
    id,
    title: c.title ?? "Untitled",
    pitch: c.pitch ?? "",
    target_length_min: c.target_length_min ?? 30,
  };
  const { error } = await supabase
    .from("arab_compilations")
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
  if (c.clips !== undefined) await replaceClips(id, c.clips);
  const result = await getCompilation(id);
  if (!result) throw new Error("Failed to load upserted compilation");
  return result;
}

export async function deleteCompilation(id: string): Promise<void> {
  const { error } = await supabase.from("arab_compilations").delete().eq("id", id);
  if (error) throw error;
}

export async function appendClip(compilationId: string, clip: SavedClip): Promise<SavedCompilation> {
  // Get current max position, append after
  const { data: existing, error: e1 } = await supabase
    .from("arab_clips")
    .select("position")
    .eq("compilation_id", compilationId)
    .order("position", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const nextPos = (existing as { position: number }[])[0]?.position + 1 || 0;
  const { error } = await supabase.from("arab_clips").insert({
    compilation_id: compilationId,
    position: nextPos,
    video_id: clip.video_id,
    video_title: clip.video_title,
    video_url: clip.video_url,
    start_sec: clip.start,
    end_sec: clip.end,
    note: clip.note ?? "",
    kind: clip.kind ?? null,
  });
  if (error) throw error;
  // Bump updated_at on the parent
  await supabase.from("arab_compilations").update({ updated_at: new Date().toISOString() }).eq("id", compilationId);
  const result = await getCompilation(compilationId);
  if (!result) throw new Error("Compilation not found after clip append");
  return result;
}

/* -----------------------------------------------------------
 * Saved titles — Supabase
 * --------------------------------------------------------- */

interface TitleRow {
  id: string;
  title: string;
  alt_titles: string[];
  pitch: string;
  target_length_min: number;
  video_ids: string[];
  reasons: Record<string, string>;
  saved_at: string;
}

function titleFromRow(r: TitleRow): SavedTitle {
  return {
    id: r.id,
    title: r.title,
    alt_titles: r.alt_titles ?? [],
    pitch: r.pitch ?? "",
    target_length_min: r.target_length_min ?? 30,
    video_ids: r.video_ids ?? [],
    reasons: r.reasons ?? {},
    saved_at: r.saved_at,
  };
}

export async function getTitles(): Promise<SavedTitle[]> {
  const { data, error } = await supabase
    .from("arab_titles")
    .select("*")
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data as TitleRow[]).map(titleFromRow);
}

export async function upsertTitle(t: Partial<SavedTitle> & { id?: string }): Promise<SavedTitle> {
  const id = t.id ?? crypto.randomUUID();
  const payload = {
    id,
    title: t.title ?? "Untitled",
    alt_titles: t.alt_titles ?? [],
    pitch: t.pitch ?? "",
    target_length_min: t.target_length_min ?? 30,
    video_ids: t.video_ids ?? [],
    reasons: t.reasons ?? {},
  };
  const { error } = await supabase.from("arab_titles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  const { data, error: e2 } = await supabase.from("arab_titles").select("*").eq("id", id).single();
  if (e2) throw e2;
  return titleFromRow(data as TitleRow);
}

export async function deleteTitle(id: string): Promise<void> {
  const { error } = await supabase.from("arab_titles").delete().eq("id", id);
  if (error) throw error;
}
