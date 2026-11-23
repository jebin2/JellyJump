# Releasing, rolling back, hotfixes

Two things ship: the **site**, deployed from `main` on every merge, and the
**desktop app**, built and published when a `v*` tag is pushed.

## The site

Nothing to do: a merge to `main` runs the tests (`test.yml`), and when they
pass on that commit, `build-deploy.yml` builds it, pushes it to the
`release` branch, waits for GitHub Pages to publish it, and fails loudly if
Pages does not. An older commit never replaces a newer one.

Then it waits for the live `version.json` to name the new build and opens
the live site in a browser: the player boots, is cross-origin isolated,
loads the sample video and seeks, with no page errors
(`scripts/live-smoke-test.mjs`). A red "Check the live site" step means the
site that is live now is broken or stale: roll back (below).

Pull request previews live on the same branch under `previews/<number>/`;
the deploy keeps them, and each is removed when its pull request closes.

Open tabs find out within a few minutes of being brought back to the front
(`version.json`) and offer a reload.

The site's version is the newest release tag it is built on (Info →
Diagnostics shows it, with the build id, which is the commit).

## A desktop release

1. **Prepare**, on a branch from an up-to-date `main`:

   ```bash
   node scripts/release.mjs prepare 0.6.0
   ```

   This sets the version in both `package.json` files (and their lockfiles)
   and adds a `## 0.6.0` section to `CHANGELOG.md` from the commit subjects
   since the last tag. Edit the section into something a user can read:
   drop internal changes, merge related lines. Open a pull request
   "Release 0.6.0" and merge it when CI is green.

2. **Tag** the merge commit on `main`:

   ```bash
   git checkout main && git pull
   git tag v0.6.0 && git push origin v0.6.0
   ```

   A pre-release is tagged `v0.6.0-beta.1`.

3. **Wait for "Desktop Release"** (`desktop-release.yml`). It runs every test
   suite, then builds Linux, Windows and macOS (stamping the tag's version
   into each), launches the Linux build once, and creates a **draft**
   release with the installers, `SHA256SUMS.txt`, and the changelog section
   as its notes.

4. **Check the draft**: the installers are all there, the notes read well,
   and one installer, downloaded, starts and shows the new version in
   Info → Diagnostics. For a pre-release, tick "Set as a pre-release".
   **Publish.**

If a step fails, fix it on `main` and tag again with the next patch
number; never move a published tag.

## Rolling back

**The site.** Revert the pull request that broke it (GitHub: the PR →
Revert, or `git revert -m 1 <merge commit>`), open the revert as a PR and
merge it once CI is green. The deploy is the normal one, so it is tested
like any other; expect 5–10 minutes from merge to live. Do not push to the
`release` branch by hand: the next deploy overwrites it, and a hand push
skips the tests.

If the tests themselves are what is broken and the site must go back now,
run "Build and Deploy" by hand (Actions → Build and Deploy → Run workflow)
on `main` after the revert has merged.

**A desktop release.** Edit the bad release on GitHub: untick "Set as the
latest release" (or delete the release, keeping the tag), and mark the
previous good one as latest. The app does not update itself, so nothing
else is needed. Then fix forward with a patch release.

## A hotfix

When `main` holds changes that should not ship yet:

```bash
git checkout -b hotfix/0.6.1 v0.6.0
git cherry-pick <the fix's commit>
node scripts/release.mjs prepare 0.6.1   # then edit CHANGELOG.md
git commit -am "Release 0.6.1"
git tag v0.6.1 && git push origin hotfix/0.6.1 v0.6.1
```

The tag runs the full tests before building, so a hotfix is tested too.
Afterwards, bring the fix and the changelog section to `main` in a pull
request. The site always deploys from `main`, so a site hotfix is an
ordinary pull request.

When `main` is fine to ship, a hotfix is an ordinary release: merge the fix,
then follow "A desktop release".

## Verifying a download

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

On Windows: `Get-FileHash .\<the installer>.exe` and compare with its line
in `SHA256SUMS.txt`.
