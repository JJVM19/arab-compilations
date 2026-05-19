export interface Video {
  id: string;
  title: string;
  description: string;
  published_at: string;
  duration: string;
  duration_sec: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  url: string;
  tags: string[];
}

export interface Catalog {
  cutoff: string;
  count: number;
  videos: Video[];
}

export interface TranscriptChunk {
  start: number;
  end: number;
  text: string;
}

export interface ChunkedVideo {
  id: string;
  chunks: TranscriptChunk[];
}

export interface VideoIdeaResult {
  video_id: string;
  reason: string;
  suggested_segments?: {
    start: number;
    end: number;
    why: string;
  }[];
}

export interface CompilationIdea {
  title: string;
  alt_titles?: string[];
  pitch: string;
  target_length_min: number;
  videos: VideoIdeaResult[];
}

export interface SavedCompilation {
  id: string;
  title: string;
  pitch: string;
  target_length_min: number;
  created_at: string;
  updated_at: string;
  clips: SavedClip[];
}

export interface SavedClip {
  video_id: string;
  video_title: string;
  video_url: string;
  start: number;
  end: number;
  note: string;
}

export interface SavedTitle {
  id: string;
  title: string;
  alt_titles: string[];
  pitch: string;
  target_length_min: number;
  video_ids: string[];
  /** Map of video_id -> 1-sentence "why this video fits" reason from idea-gen */
  reasons: Record<string, string>;
  saved_at: string;
}
