# 0010. No error telemetry; bug reports are copied by the user

Status: Accepted

## Context

The app promises that media stays on the device. Error reports could name
files, folders and servers. Without any record, though, a user's bug report
had nothing behind it: production dropped every log line.

## Decision

Nothing about errors is sent automatically. The app keeps the last 3,000 log
entries in memory, with trace ids for the playback load and the job in
progress; uncaught errors are recorded and shown once with "Copy details",
which builds a report with addresses replaced, for the user to send if they
choose. Opt-in anonymous error counts may be revisited later (owner decision
6). The existing page-visit counter (`public/js/analytics-embed.js`, one event
naming the project) is unaffected.

## Consequences

- Problems users do not report stay unseen.
- The diagnostics view (plan P4) is the way to see more on a device.
