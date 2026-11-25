# 0013. A buffer for remote playback, kept on disk in pieces

Status: Accepted

## Context

A file from a shared library or a URL was read by MediaBunny's `UrlSource`:
open-ended range requests, 8–16 MB read ahead, held in memory. On a link
slower than the video (measured after #104: 0.3–0.55 MB/s against the
0.84 MB/s a 1080p film needs) nothing was kept. A pause downloaded nothing,
a seek back fetched again, and the read at the old position ran on after a
seek, because it could not be aborted without rebuilding the reader. Plain
URL items were also downloaded a second time, whole and into memory, by
`MediaMetadata.cacheInBackground`, over the same link. ARCHITECTURE_PLAN.md
phase U.

## Decision

- **Pieces.** A remote file is cut into pieces (4 MB for a large file, a
  64th of a small one, never under 64 KB), each fetched with range requests
  of our own (so they can be aborted) and kept whole or not at all. A reader
  gets its bytes as they arrive. One that needs bytes inside a piece not
  there yet starts a request where it needs them; the piece's start is
  filled in after, so a seek never waits for a piece's beginning. The player
  reads exactly what the demuxer asks for (MediaBunny's own read-ahead off):
  the downloader reads ahead instead.
- **On disk, in the origin private file system.** One folder per file
  (`jj-buffer/<id>/`, namespaced for previews), a `meta.json` and one file
  per piece. A small worker writes, with a synchronous access handle (the
  one write path every current browser has, Safari included). The page
  reads directly, since a finished piece is never written again. Browser
  quotas allow far more than this needs (Chromium up to about 60% of the
  disk), and the buffer takes the smaller of 2 GB and 10% of what is free.
- **Memory when disk is not usable.** In a private window, when OPFS or
  workers are refused, or with under 200 MB free, the same store runs on a
  memory backend (256 MB). It is one code path with two backends.
- **Ahead of the reads, within a share of the budget.** The downloader
  follows the player's reads (any container; a seek moves it by itself once
  reads settle, 300 ms) and fetches ahead, 20 minutes of video by default
  (setting `buffer`), playing or paused. The reads made while the file opens
  (its header and index) are pinned. One file may keep up to 80% of the
  budget; over it, the pieces furthest from where it plays go, the ones
  behind first, never the 5 minutes behind. A file that fits is kept whole.
  Across files, the least recently played is let go first, never the one
  playing.
- **Known by identity, checked against the server.** A file's key is its
  server and id (library) or its URL without `sig`/`token`. Its size and
  validator (ETag, else Last-Modified; the library server sends an ETag
  from size and mtime) are checked on open and on every piece. A change
  drops the pieces (`SOURCE_CHANGED` mid-play). A file without a validator
  is kept for the session only.
- **Offline.** A file with pieces kept opens without the network, and what
  was kept plays.
- **Two tabs.** A Web Lock per file. The holder keeps the pieces; another
  tab reads them and keeps what it fetches itself in memory.
- **Where it does not apply.** HLS, live, YouTube, local files and blobs,
  and a server that will not answer ranges (`NO_RANGES`) keep the path
  they had.

## Consequences

- A pause, a seek back, a reload and a second viewing are served from disk,
  and a seek aborts the fetch it left behind.
- The disk holds up to the budget of other people's media; Settings will
  show it and clear it (U3), and removing an item drops its pieces.
- `piece-store-test` (Node, memory backend, a fake server) and
  `piece-store-opfs-test` (browser) check the store; `stream-buffer-test`
  the player on it (a seek closes the fetch it left behind, a seek back asks
  nothing, a reload plays with the server gone, the fallbacks).
