# Contributing

## Setup

Node 22 and npm. The browser test suites need Chromium.

```bash
npm ci
npx playwright-core install chromium   # once; or set CHROMIUM_PATH
npm run dev                            # http://localhost:8080/player.html
```

The desktop app installs its own dependencies: `cd desktop && npm ci`.

## Before a pull request

```bash
npm test
```

runs the quality and architecture checks, the type check, the vendored
library hashes, a build, the size report, every test suite and the coverage
report. CI runs the same on every pull request, and `main` accepts only pull
requests whose `test` check passed. One suite, or a few:

```bash
node scripts/run-tests.mjs smoke-test edit-panel-test
node scripts/edit-panel-test.mjs
```

If `desktop/` changed, also `npm run test:desktop`.

The checks that can stop a pull request:

- **Layers** (`scripts/architecture-check.mjs`): imports go
  pages → ui → core, processing → shared → lib, never back. The counts in
  `scripts/architecture-baseline.json` (wrong-way imports, `player._*` calls
  from outside the player, `localStorage` outside Settings, …) may only go
  down. When a change brings one down, lower the baseline in the same PR.
- **Size** (`scripts/size-report.mjs`): first-load bytes per page and the
  duplicated vendored files, against `scripts/size-baseline.json`.
- **Coverage** (`scripts/coverage-report.mjs`): may not drop by more than one
  point against `scripts/coverage-baseline.json`.

## Pull requests

- A pull request from a branch of this repository gets a **preview**: a
  comment links to its build at `previews/<number>/player.html` on the
  site, to try on a phone. It keeps its own playlist and settings.
- Small and about one thing. A plan step (`docs/ARCHITECTURE_PLAN.md`) is
  usually one PR; say which in the description.
- A bug fix comes with a test that fails without it.
- Fill in the template. Its **device check** is required for changes to
  playback, audio, `PlaylistPlayback` or storage: those break on phones in
  ways no headless browser shows.
- A change to how the code is laid out updates `assets/js/STRUCTURE.md` or
  the relevant decision record in `docs/adr/` in the same PR.

## Commits

A subject line in the imperative that says what changes for the user or the
code ("Delete a removed item's stored file"), under about 72 characters; the
plan step in brackets at the end when there is one ("… (plan G1)"). The body
says why.

## Releases

`docs/runbooks/release.md`: `node scripts/release.mjs prepare <version>` in a
pull request, then a `v<version>` tag builds and drafts the release.

## Flaky tests

A browser suite that fails is run once more by `run-tests.mjs`. If it then
passes, the run passes but the suite is reported as **flaky**: a warning on
the CI run and a line in the job summary. A flaky suite is fixed, or the
flake understood and written down, before new work goes on top of it. A
suite flaky twice in a week is fixed first. `JJ_NO_RETRY=1` turns the retry
off, to reproduce a flake.

## Code

- Vanilla ES modules, no framework (`docs/adr/0001`). `// @ts-check` and
  JSDoc on new files.
- Code outside the player uses its public API (§4.1 of the plan), not
  `player._*`.
- Preferences go through `shared/settings/Settings.js`; a value a tool needs
  for a while goes through `player.override()`.
- Network calls go through `shared/net/fetchWithPolicy.js`; errors are
  `AppError`s with a code (`shared/errors/`).
- Coding standards: `.agent/rules/code-of-conduct.md`.

## Security

Report a vulnerability as described in [`SECURITY.md`](SECURITY.md), not in a
public issue. It also lists the threat model and the data the app keeps.
