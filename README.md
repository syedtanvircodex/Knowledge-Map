# Knowledge Map

Real-time global intelligence dashboard. Aggregates live signals from Reddit and Wikipedia, maps them to countries, and renders the result as an interactive choropleth — entirely client-side, zero infrastructure.

![Knowledge Map — Live Global Trends Dashboard](https://i.ibb.co.com/YFdbhc02/Screenshot-185.png)

## Overview

Knowledge Map fetches trending content from five Reddit feeds and Wikipedia's most-read articles, performs entity recognition against a curated dictionary of ~120 countries (including aliases and demonyms), scores each country by weighted mention volume, and paints a Leaflet-powered world map in real time.

**No backend. No API keys. No build step.** Three files, open in a browser, done.

## Quick Start

```bash
# Option A — any static file server
npx -y http-server . -p 8080

# Option B — Python
python3 -m http.server 8080
```

Open `http://localhost:8080`. Data loads automatically on first paint.

> **Note:** Opening `index.html` directly via `file://` will fail in most browsers due to CORS restrictions on the fetch calls to Reddit and Wikipedia.

## Architecture

```
index.html    Semantic markup, ARIA roles, responsive meta
style.css     Design tokens (CSS custom properties), layout, responsive breakpoints
script.js     All runtime logic — fetch, NLP pipeline, Leaflet bindings, UI state
```

No frameworks. No transpilation. No package.json.

### Data Pipeline

```
Reddit JSON API ──┐
                   ├──▶ normalize scores ──▶ detect countries ──▶ extract topics ──▶ classify category
Wikipedia REST ───┘                              │                      │                    │
                                                 ▼                      ▼                    ▼
                                          country scores          TF-ICF ranking        filter by tab
                                                 │
                                                 ▼
                                        z-score normalization ──▶ intensity ──▶ color interpolation ──▶ render
```

**Entity recognition** uses a pre-built lookup map of country names, ISO aliases, capital cities, and demonyms — sorted by key length (longest-first) to avoid partial matches. A deny list filters out false positives like "Swiss cheese", "French toast", and "Korean BBQ".

**Scoring** applies `log10` normalization to Reddit upvotes and median-relative scaling to Wikipedia views before combining them. The final per-country intensity is derived from z-score normalization across all active countries, mapped to `[0, 1]`.

**Topic ranking** uses TF-ICF (Term Frequency × Inverse Country Frequency) — a variant of TF-IDF adapted for the country dimension instead of documents. Topics that appear in many countries are down-weighted; topics concentrated in a single region are surfaced.

## Features

| Feature | Description |
|---|---|
| **Live choropleth** | Animated color transitions via `requestAnimationFrame` lerping between hex values |
| **Detail panel** | Score, trending topics (bar chart), sources with metadata, topical neighbours via cosine similarity |
| **Category filters** | Conflict & Politics · Science & Tech · Economy · Culture & Sports |
| **Trending ticker** | Top 20 global topics, click to flash-highlight related countries |
| **Search** | Fuzzy country lookup sorted by current activity score, keyboard-navigable |
| **Freshness indicator** | Green / amber / red dot reflecting data age |
| **Mobile drawer** | Bottom-sheet with drag-to-dismiss on touch devices |
| **Keyboard shortcuts** | `/` search · `R` refresh · `F` toggle filters · `Esc` close panel |

## Data Sources

| Source | Endpoint | Auth | Rate Limits |
|---|---|---|---|
| Reddit | `/r/{subreddit}/hot.json` | None | ~60 req/min per IP |
| Wikipedia | Wikimedia REST `/metrics/pageviews/top` | None | Generous for single-user |

**Subreddits polled:** `worldnews` (100), `popular` (50), `news` (50), `technology` (50), `science` (50).

Data refreshes every 5 minutes (`SYNC_INTERVAL`). Each user's browser fetches independently — there is no shared state.

## Limitations

- **English-language bias.** The pipeline only processes English-language Reddit and Wikipedia. Events not covered in English media will not appear.
- **No contextual disambiguation.** "French cuisine" registers as France activity. The deny list mitigates common false positives but is not exhaustive.
- **Client-side only.** No persistence across sessions, no shared view between users, no historical data beyond the current session.
- **Wikipedia daily lag.** The `mostread` endpoint reflects views accumulated since midnight UTC. Results improve throughout the day.
- **Reddit rate limits.** During high-traffic periods, Reddit's public API may return 429s. The app degrades gracefully — it continues with whatever sources responded and notifies the user.

## Browser Support

Requires: `fetch`, `async/await`, `Promise.allSettled`, CSS custom properties, `backdrop-filter`, Clipboard API.

Tested: Chrome, Firefox, Safari, Edge (current stable). No IE support.

## External Dependencies

All loaded from CDN at runtime — no install step.

| Library | Version | CDN |
|---|---|---|
| Leaflet | 1.9.4 | unpkg |
| Font Awesome | 6.5.1 | cdnjs |
| Inter (font) | Variable | Google Fonts |
| GeoJSON boundaries | — | [johan/world.geo.json](https://github.com/johan/world.geo.json) |

## Configuration

Constants at the top of `script.js`:

```js
const SYNC_INTERVAL = 5 * 60 * 1000;  // refresh cadence (ms)
const GEOJSON_URL   = '...';           // country boundaries source
```

Lower `SYNC_INTERVAL` for faster updates. Stay above 60s to avoid Reddit rate limits.

## License

MIT