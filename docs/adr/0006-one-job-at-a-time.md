# 0006. Processing jobs run one at a time

Status: Accepted

## Context

Conversions, exports and edits decode and encode whole videos. Two at once
on a phone runs out of memory or makes both crawl; on any device they compete
with playback.

## Decision

All processing goes through one `JobQueue` that runs a job at a time, in
order, in the background, shown in the job tray with progress, Cancel and
its results. A job's results are the playlist items its `done()` adds while
it runs (`PROCESSED_ITEM_EVENT`). Tools hand their work to it through
`runMenuJob`.

## Consequences

- Predictable memory use and progress; a long job delays the next.
- Results are attributed to their job without the tools knowing the queue.
- Tools that ran their work outside the queue (Scenes, Motion, Optimize) are
  being moved into it (plan phase F).
