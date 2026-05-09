# claudebeat landing page — Deploy Guide

Last verified against GitHub UI: 2026-05-09

---

## First-time setup

These steps create the `gh-pages` branch and enable GitHub Pages for the first time. If the branch already exists and Pages is enabled, skip to **Redeploy flow**.

### 1. Create the orphan branch locally (already done if you're reading this on gh-pages)

```bash
git checkout master
git checkout --orphan gh-pages
git rm -rf .                          # clear master's files from the index
# author index.html, styles.css, sounds/, test.mjs
git add -A
git commit -m "feat: add static landing page with sound previews"
```

### 2. Push to origin

```bash
git push -u origin gh-pages
```

Or via GitHub CLI:

```bash
gh api -X PUT repos/ivanmaierg/claudebeat/git/refs \
  -f ref="refs/heads/gh-pages" \
  -f sha="$(git rev-parse gh-pages)"
```

### 3. Enable GitHub Pages

**GitHub UI path**:  
Settings → Pages → Source → "Deploy from a branch" → Branch: `gh-pages` / `(root)` → Save.

**GitHub CLI path** (alternative):

```bash
gh api -X POST repos/ivanmaierg/claudebeat/pages \
  -F source[branch]=gh-pages \
  -F "source[path]=/"
```

### 4. Wait for build and verify

- Build typically takes 1–2 minutes.
- DNS propagation can take up to 10 minutes on first enable.
- Open `https://ivanmaierg.github.io/claudebeat/` to confirm the page loads.

---

## Redeploy flow

Use this when you need to update the landing page content.

```bash
git checkout gh-pages

# Make changes to index.html, styles.css, etc.

# Run the smoke test before committing
node test.mjs

# Commit and push
git add -A
git commit -m "feat: <describe your change>"
git push origin gh-pages
```

GitHub Pages rebuilds automatically after the push. Expect ~1 minute for the live site to update.

---

## Sync new sounds

When new WAV files are added to `master:sounds/chiptune/`, sync them to the landing page:

```bash
# 1. Copy the new WAV(s) from master to a temp location
git checkout master
cp sounds/chiptune/<id>.wav /tmp/<id>.wav

# 2. Switch to gh-pages and place the file
git checkout gh-pages
mkdir -p sounds
cp /tmp/<id>.wav sounds/<id>.wav

# 3. Add the new button in index.html (inside .sound-grid):
#    <button data-sound="<id>" type="button">&#9654; <Name></button>

# 4. Run the smoke test (update expected count if you changed the assertion)
node test.mjs

# 5. Commit
git add sounds/<id>.wav index.html
git commit -m "feat: add <id> sound to landing page"
git push origin gh-pages
```

Note: `test.mjs` checks for exactly 5 `data-sound` attributes. If you add a 6th sound, update the count assertion in `test.mjs` (`rawMatches.length !== 5` → `!== 6`).

---

## Troubleshooting

### 404 on WAV files

GitHub Pages is case-sensitive. Make sure the filenames on `gh-pages` match exactly:

```
sounds/blip.wav
sounds/halo.wav
sounds/pixel.wav
sounds/ring.wav
sounds/thock.wav
```

Run `git ls-files sounds/` to verify casing in the index.

### Pages not updating after push

1. Go to Settings → Pages.
2. Confirm Source is still set to "Deploy from a branch" → `gh-pages` / `(root)`.
3. Check the Actions tab for a "pages-build-deployment" workflow run. If it failed, the error message is shown there.
4. If Pages was accidentally disabled, re-enable it and save.

### Smoke test passes locally but page is wrong live

The smoke test only validates HTML structure and file presence. Verify:
- `git ls-files` on `gh-pages` shows all expected files committed.
- `git push origin gh-pages` completed without errors.
- You are viewing the correct URL (no trailing content path that might resolve to a 404 fallback).

### Audio does not play on first click (mobile Safari)

This is a known browser policy: audio requires a user gesture to unlock the audio context. The first click may be silently rejected; the second click within the same session will play. The `.catch()` handler in the inline script swallows the error — no visible crash.

---

## File manifest (gh-pages branch root)

```
index.html        — landing page HTML
styles.css        — all styles (no external deps)
sounds/
  blip.wav
  halo.wav
  pixel.wav
  ring.wav
  thock.wav
test.mjs          — smoke test (node test.mjs)
DEPLOY.md         — this file
```
