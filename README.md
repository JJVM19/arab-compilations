# Arab Compilations Studio

A local-first studio for assembling YouTube compilation videos from [@Arab](https://www.youtube.com/@Arab)'s catalog. Brainstorms titles with Claude, pulls sentence-aligned clips from transcripts, and exports a shotlist your editor can work from.

## What it does

- **Library** — 106 longform Arab videos (all 10+ min, post Sept 2022 Turkey Replica) with AI-powered semantic search
- **Workspace** — describe a theme → Claude scans every transcript and returns the best moments with start/end timestamps anchored to sentence boundaries
- **Titles** — brainstorm viral compilation titles (e.g. *"Times Arab Almost Died Abroad"*, *"Every Time Brazil Got Out of Control"*) — save the ones you like for later
- **Saved** — manage in-progress compilations, preview clips inline, export CSV for your editor
- **Add video** — paste any new @Arab upload URL, the server auto-fetches metadata and transcript

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Claude Sonnet 4.5 for ideas / clip extraction / library ranking
- `yt-dlp` for caption downloads (server-side)
- Local JSON storage (`data/catalog.json`, `data/chunks.json`, `data/compilations.json`, `data/titles.json`)

## Run locally

```bash
npm install
npm run build
npm start          # port 3000 by default, or PORT=4000 npm start
```

Open http://localhost:3000.

You need a `.env.local` (gitignored) with:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
YOUTUBE_API_KEY=AIza...               # only needed for /api/library/add
ARAB_CHANNEL_ID=UC8H9Zmx8CslalkliFegKXhQ
```

You also need [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) on your PATH for the **Add video** feature:

```bash
pip3 install -U yt-dlp
```

## Deploy

This is a Node.js app with API routes that touch the filesystem and shell out to `yt-dlp`. **Not edge-compatible.** Easiest options:

### Option A — Self-host on a VPS

1. SSH into your server (DigitalOcean, Hetzner, etc.)
2. Install Node 20+ and yt-dlp
3. Clone the repo and copy your `.env.local`
4. `npm install && npm run build`
5. Use `pm2` or `systemd` to keep it running:
   ```bash
   npm install -g pm2
   pm2 start npm --name arab -- start
   pm2 save && pm2 startup
   ```
6. Put Caddy or nginx in front for TLS

**DNS for `arab.visionclipping.com`** (A record, points at your server):

```
Type:  A
Name:  arab
Value: <your-server-IP>
TTL:   3600
```

### Option B — Railway

1. Push this repo to GitHub
2. Create a new Railway service → connect the repo
3. Set the env vars in Railway settings
4. Add a custom domain `arab.visionclipping.com` in Railway → it'll give you a CNAME target

**DNS**:
```
Type:  CNAME
Name:  arab
Value: <your-app>.up.railway.app
TTL:   3600
```

### Option C — Render

Similar to Railway. Create a Web Service from this repo, set env vars, add custom domain, point CNAME to the `*.onrender.com` value Render gives you.

## Data model

```
data/
  catalog.json        # 106 videos: id, title, duration, views, description, etc.
  chunks.json         # transcripts chunked to ~45s, with line-level timestamps
  compilations.json   # user-saved compilations + clips (gitignored)
  titles.json         # user-saved title pitches (gitignored)
```

Catalog + chunks are checked into git (so the app works out of the box).
`compilations.json` and `titles.json` start empty and are gitignored.

## Re-scrape catalog (only needed if @Arab uploads many new videos)

```bash
cd ../arab_channel_scrape
python3 fetch_videos.py            # writes videos.json
python3 filter_catalog.py          # applies cutoff + exclusions
./download_transcripts.sh          # downloads VTT files
python3 process_transcripts.py     # writes chunks.json
```

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/catalog` | GET | Returns full video catalog |
| `/api/library-search` | POST | AI-rank videos by query (returns 0-100 scores) |
| `/api/library/add` | POST | Add a new @Arab video URL/ID to the catalog |
| `/api/ideas` | POST | Generate compilation title ideas |
| `/api/search` | POST | 2-stage: rank videos + extract clips for a theme |
| `/api/video-clips` | POST | Per-video sentence-aligned clip extraction |
| `/api/video/[id]` | GET | One video + its transcript chunks |
| `/api/compilations` | GET/POST | List or upsert compilations |
| `/api/compilations/[id]` | GET/PUT/DELETE | Single compilation CRUD |
| `/api/titles` | GET/POST | List or save title pitches |
| `/api/titles/[id]` | DELETE | Remove a saved title |
| `/api/export/[id]` | GET | Download a compilation as CSV |
