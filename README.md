# AniScope — Phase 1 PWA

AniScope is an installable Progressive Web App, not a single preview-only HTML file.

## Why the old preview was not clickable
ChatGPT/iOS file previews commonly render downloaded HTML as a static document and may block its JavaScript. The app must be served from a web server for interactions, data loading, offline caching, and installation to work.

## Quick local test
From this folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Put it on your iPhone
Deploy the entire folder over HTTPS using a static host such as GitHub Pages, Netlify, Cloudflare Pages, or Vercel.

Then in Safari:
1. Open the hosted AniScope URL.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Launch AniScope from its icon.

## Included in Phase 1
- Top 25 watchlist
- Search
- Mood/status filters
- Clickable anime profiles
- Release period, episode count, time commitment, and status
- Personalized scores and recommendation notes
- Completed section
- Mark completed / move back to watchlist
- Persistent completion state
- PWA manifest and app icons
- Offline cache after first hosted load

## Phase 2
- Anton's ratings
- Progress by episode
- Prediction versus actual rating
- Reviews and completed-anime profiles
