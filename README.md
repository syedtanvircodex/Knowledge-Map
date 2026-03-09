# Knowledge Map

![Knowledge Map — Live Global Trends Dashboard](https://i.ibb.co.com/ynbJZ2cT/knowmap.png)

A real-time world map that shows which countries are being talked about right now, and what topics are trending in each of them. It pulls live data from Reddit and Wikipedia every five minutes, processes it entirely in the browser, and paints each country on the map with a color that reflects how much activity it currently has.

No server required. No account needed. Open the files in a browser and it works.

---

## What It Does

When you open Knowledge Map, it fetches the top posts from Reddit's world news and popular feeds, as well as today's most-read Wikipedia articles. It scans the titles of those posts and articles looking for country names and keywords. Every time it finds a country mentioned, that country's activity score goes up. The higher the score, the warmer the color on the map, ranging from dark blue for low activity all the way to red for regions that are dominating global conversation at that moment.

Click any country on the map and a side panel opens showing that region's activity score, its top trending topics ranked by how often they appear, and the actual articles and posts that put it on the map, each linking back to the original source.

The data refreshes automatically every five minutes without you doing anything. You can also force a refresh manually using the Sync button, or press `r` on your keyboard as a shortcut.

---

## Features

**Live data, no backend**
All data fetching happens directly from your browser to Reddit's public JSON API and Wikipedia's REST API. There is no server in the middle, no database, and no API keys to configure.

**Interactive world map**
Built on Leaflet with a dark CartoDB tile layer. Every country is clickable. Hovering over a country shows a tooltip with its name, current activity score, and top trending topic. Clicking zooms the map to that country and opens the detail panel.

**Activity scoring and color coding**
Each country's score is calculated by summing the Reddit upvote counts and normalized Wikipedia view counts from every article that mentions it. The score is then run through a logarithmic scale so that a country with moderate coverage still shows clearly on the map without being completely overshadowed by high-traffic countries like the United States.

The color scale works as follows:

| Color  | Label    | What it means                                     |
|--------|----------|---------------------------------------------------|
| Red    | Critical | Extremely high mention volume right now           |
| Orange | High     | Significantly above average activity              |
| Yellow | Moderate | Noticeable but not dominant in current coverage   |
| Blue   | Low      | Present in the data but not a major focus         |
| Dark   | No data  | No mentions found in the current fetch cycle      |

**Topic markers**
For countries with enough activity, a floating hashtag label appears directly on the map showing that country's single most-mentioned topic at the moment.

**Region detail panel**
Clicking a country opens a slide-in panel on desktop or a bottom drawer on mobile. It shows the country's activity score as both a number and a progress bar, up to eight trending topics with their relative frequency shown as a mini bar chart, and up to ten source articles sorted by their score, each linking to the original Reddit post or Wikipedia page.

**Time history slider**
Every time the data refreshes, a snapshot is saved. The history panel in the bottom left contains a slider that lets you scrub back through up to the last 24 snapshots (roughly 12 hours of history) and see how country activity looked at earlier points in time. Dragging back to the rightmost position returns you to live data.

**Trending ticker**
A scrolling bar along the bottom of the screen shows the top 20 trending topics globally across all countries at the current moment.

**Search**
The search bar at the top lets you find any country by name. Results are sorted so countries with higher current activity appear first. You can navigate the results with the arrow keys and press Enter to select. Pressing `/` on your keyboard focuses the search bar from anywhere on the page.

**Data freshness indicator**
A small indicator in the header shows how long ago the data was last fetched, updating its color from green to yellow to orange as the data ages toward the five-minute refresh threshold.

**Share**
Each open region panel has a share button that copies a short summary of that region's name and current score to your clipboard, ready to paste anywhere.

---

## How to Run It

This project has no build step and no dependencies to install. It is three files.

1. Download or clone the repository.
2. Open `index.html` in any modern web browser.

That is all. The browser loads Leaflet from a CDN, loads the world map geometry from a public GitHub-hosted file, and then fetches live data from Reddit and Wikipedia.

If you open it as a local file directly from your file system using a `file://` URL, some browsers will block the external fetch requests due to security restrictions. In that case, serve the files through any simple local web server. For example, if you have Python installed:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

---

## File Structure

```
knowledge-map/
  index.html   — The page structure and all UI elements
  style.css    — All visual styling, layout, animations, and responsive design
  script.js    — All application logic, data fetching, map rendering, and UI behavior
```

There are no build tools, no package managers, no compiled assets, and no configuration files. Everything the application needs is either in these three files or loaded from public CDNs at runtime.

---

## How the Data Processing Works

This section explains what happens under the hood when the app fetches data, written so that anyone can follow along.

**Step 1: Fetch**
The app simultaneously requests three URLs: the top 100 posts from r/worldnews, the top 50 posts from r/popular, and today's most-read Wikipedia articles. These requests run in parallel. If one or two of them fail, the app continues with whatever succeeded.

**Step 2: Identify countries**
Each post title and article title is scanned against a lookup table of around 70 countries and their common variants. For example, "British", "Britain", and "England" all map to "United Kingdom". The matching uses whole-word boundaries so a word like "Iranian" correctly maps to "Iran" without false-positives from partial matches.

**Step 3: Score**
For Reddit posts, the score is the raw upvote count from the API. For Wikipedia articles, the page view count is divided by 150 to bring it into a roughly comparable range with Reddit scores. Every country mentioned in a post receives that post's score added to its running total.

**Step 4: Extract topics**
Keywords are pulled from each title by removing punctuation, splitting on whitespace, discarding words shorter than four characters, and filtering out a list of about 80 common English stop words (the, is, in, report, police, and so on). What remains becomes that article's topics, each associated with the countries the article mentioned.

**Step 5: Render**
Each country's final score is mapped to a color using a base-10 logarithm. This is intentional: a country with a score of 10,000 should look noticeably more active than one with 1,000, but not ten times more intense. The logarithm compresses the range so the map stays readable across a wide spread of values.

---

## Data Sources and Limitations

**Reddit**
Uses the public JSON API available at `reddit.com/r/subreddit.json`. No authentication is needed. Rate limits on this endpoint are generous for personal use but could become a factor if the app were served to a large number of simultaneous users, since each user's browser makes its own requests.

**Wikipedia**
Uses the Wikimedia REST API endpoint for featured content, specifically the `mostread` articles feed for the current calendar date. This reflects the articles with the highest view counts for today so far.

**What this means for accuracy**
The map shows what is being talked about in English-language media, not necessarily what is most important globally. A country experiencing a major event that is not being covered in English on Reddit or Wikipedia will not appear on the map. The scoring reflects volume of online discussion, which is heavily influenced by English-speaking internet demographics. This is a tool for exploring online conversation patterns, not a neutral measure of geopolitical significance.

**Country recognition**
The country identification is based on a fixed keyword list. It will miss references to countries that use unusual phrasings, and it has no understanding of context, so an article mentioning "French cuisine" will register as activity for France even if the article has nothing to do with French politics or current events.

---

## Browser Support

The application uses standard modern web platform features: `fetch`, `async/await`, `Promise.allSettled`, CSS custom properties, CSS Grid, `backdrop-filter`, and the Clipboard API. It works without issues in current versions of Chrome, Firefox, Safari, and Edge.

Internet Explorer is not supported.

---

## External Dependencies

All dependencies are loaded from public CDNs and require an internet connection.

| Library       | Version | Purpose                                      |
|---------------|---------|----------------------------------------------|
| Leaflet       | 1.9.4   | Interactive map rendering and GeoJSON layers |
| Font Awesome  | 6.4.0   | Icons throughout the interface               |
| Plus Jakarta Sans | —   | Typography, loaded from Google Fonts         |

The world map geometry (country borders) is loaded from a GeoJSON file hosted on GitHub at `github.com/johan/world.geo.json`.

---

## Configuration

A small configuration object at the top of `script.js` contains the only values you might want to change:

```js
const CONFIG = {
    updateInterval: 300000,   // How often to refresh data, in milliseconds. 300000 = 5 minutes.
    geoJsonUrl: '...',        // URL to the world map geometry file.
    redditWorldNews,          // Reddit endpoint for world news posts.
    redditPopular,            // Reddit endpoint for popular posts.
    wikipediaFeatured         // Wikipedia endpoint for today's most-read articles.
};
```

To refresh data more frequently, lower the `updateInterval` value. Be mindful that Reddit's public API has rate limits and making requests too frequently may result in temporary blocks.

---

## Known Limitations

- The history slider is populated with real snapshots only after the app has been running long enough to accumulate them. On the first load, the earlier positions on the slider are filled with simulated data derived from the first real fetch, scaled down to approximate what earlier time periods might have looked like. This is clearly imperfect and is intended only to give the slider something to show immediately.

- Because all fetching happens from the user's browser, there is no shared data between different people using the app. Two people opening the app at the same time will each run their own independent fetch cycles and may see slightly different results depending on timing.

- The Reddit public API occasionally returns errors or rate-limit responses, especially during high-traffic periods. The app handles this gracefully by continuing with whatever data it has and showing an error toast notification.

- Wikipedia's `mostread` feed only becomes meaningful partway through the day, since it is based on views accumulated since midnight UTC. Early in the day it may show fewer results or less accurate trending data than later in the day.

---