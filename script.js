/**
 * Global Real-Time Knowledge Map
 * Pure JS Implementation
 */

// --- Configuration ---
const CONFIG = {
    updateInterval: 300000,
    geoJsonUrl: 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json',
    apis: {
        redditWorldNews: 'https://www.reddit.com/r/worldnews.json?limit=100',
        redditPopular: 'https://www.reddit.com/r/popular.json?limit=50',
        wikipediaFeatured: `https://en.wikipedia.org/api/rest_v1/feed/featured/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}`
    }
};

// --- State ---
let map;
let geoJsonLayer;
let topicLayerGroup;
let countryData = {};
let isPanelOpen = false;

// --- Country Name Mapping ---
const COUNTRY_KEYWORDS = {
    "USA": "United States of America",
    "United States": "United States of America",
    "US": "United States of America",
    "America": "United States of America",
    "UK": "United Kingdom",
    "Britain": "United Kingdom",
    "British": "United Kingdom",
    "England": "United Kingdom",
    "Russia": "Russia",
    "Russian": "Russia",
    "Ukraine": "Ukraine",
    "Ukrainian": "Ukraine",
    "China": "China",
    "Chinese": "China",
    "India": "India",
    "Indian": "India",
    "France": "France",
    "French": "France",
    "Germany": "Germany",
    "German": "Germany",
    "Japan": "Japan",
    "Japanese": "Japan",
    "Brazil": "Brazil",
    "Brazilian": "Brazil",
    "Canada": "Canada",
    "Canadian": "Canada",
    "Australia": "Australia",
    "Australian": "Australia",
    "Israel": "Israel",
    "Israeli": "Israel",
    "Palestine": "Palestine",
    "Palestinian": "Palestine",
    "Iran": "Iran",
    "Iranian": "Iran",
    "Iraq": "Iraq",
    "Iraqi": "Iraq",
    "Syria": "Syria",
    "Syrian": "Syria",
    "Mexico": "Mexico",
    "Mexican": "Mexico",
    "Italy": "Italy",
    "Italian": "Italy",
    "Spain": "Spain",
    "Spanish": "Spain",
    "Korea": "South Korea",
    "South Korea": "South Korea",
    "North Korea": "North Korea",
    "Turkey": "Turkey",
    "Turkish": "Turkey",
    "Egypt": "Egypt",
    "Egyptian": "Egypt"
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
    fetchDataLoop();
});

function initMap() {
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 8,
        zoomControl: false,
        attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    loadGeoJSON();
    topicLayerGroup = L.layerGroup().addTo(map);
}

async function loadGeoJSON() {
    try {
        const response = await fetch(CONFIG.geoJsonUrl);
        const data = await response.json();

        geoJsonLayer = L.geoJson(data, {
            style: styleFeature,
            onEachFeature: onEachFeature
        }).addTo(map);
    } catch (error) {
        console.error("Error loading GeoJSON:", error);
    }
}

function initUI() {
    document.getElementById('close-panel-btn').addEventListener('click', closePanel);
}

// --- Data Fetching ---

async function fetchDataLoop() {
    showLoading(true);
    countryData = {};

    try {
        await Promise.all([
            fetchReddit(CONFIG.apis.redditWorldNews),
            fetchReddit(CONFIG.apis.redditPopular),
            fetchWikipedia()
        ]);

        updateMapVisuals();
        updateTopicMarkers();
        updateStats();

        const panelTitle = document.getElementById('panel-country-name').innerText;
        if (isPanelOpen && countryData[panelTitle]) {
            updatePanelContent(panelTitle);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    } finally {
        showLoading(false);
        setTimeout(fetchDataLoop, CONFIG.updateInterval);
    }
}

async function fetchReddit(url) {
    try {
        const response = await fetch(url);
        const json = await response.json();
        if (!json?.data?.children) return;

        json.data.children.forEach(post => {
            const title = post.data.title;
            const score = post.data.score;
            const permalink = `https://reddit.com${post.data.permalink}`;
            processArticle(title, score, permalink, 'Reddit');
        });
    } catch (e) {
        console.error("Reddit fetch failed", e);
    }
}

async function fetchWikipedia() {
    try {
        const response = await fetch(CONFIG.apis.wikipediaFeatured);
        if (!response.ok) return;

        const json = await response.json();

        if (json.most_read) {
            json.most_read.forEach(page => {
                const title = page.title.replace(/_/g, ' ');
                const views = page.views;
                const url = page.content_urls.desktop.page;
                processArticle(title, Math.floor(views / 100), url, 'Wikipedia');
            });
        }
    } catch (e) {
        console.error("Wikipedia fetch failed", e);
    }
}

function processArticle(text, score, url, source) {
    const identifiedCountries = identifyCountries(text);
    const topics = extractKeywords(text);

    identifiedCountries.forEach(countryName => {
        if (!countryData[countryName]) {
            countryData[countryName] = { score: 0, topics: {}, articles: [] };
        }

        countryData[countryName].score += score;

        topics.forEach(topic => {
            if (!countryData[countryName].topics[topic]) {
                countryData[countryName].topics[topic] = 0;
            }
            countryData[countryName].topics[topic] += 1;
        });

        if (!countryData[countryName].articles.find(a => a.url === url)) {
            countryData[countryName].articles.push({ title: text, url, source, score });
        }
    });
}

function identifyCountries(text) {
    const found = [];
    for (const [key, canonicalName] of Object.entries(COUNTRY_KEYWORDS)) {
        const regex = new RegExp(`\\b${key.toLowerCase()}\\b`, 'i');
        if (regex.test(text)) {
            if (!found.includes(canonicalName)) found.push(canonicalName);
        }
    }
    return found;
}

function extractKeywords(text) {
    const stopWords = new Set(["the", "is", "in", "at", "of", "on", "and", "a", "to", "for", "with", "from", "by", "an", "as", "it", "that", "are", "was", "were", "be", "has", "have", "this", "will", "or", "but", "not", "he", "she", "they", "their", "his", "her", "its", "who", "which", "about", "after", "up", "out", "new", "more", "when", "year", "years", "time", "two", "can", "no", "all", "just", "how", "what", "now", "says", "said", "over", "into", "one", "first", "other", "some", "could", "top", "video", "photos", "news", "report", "police", "man", "woman", "people", "found", "dead", "killed", "injured", "shot", "died"]);
    const words = text.replace(/[^\w\s]/gi, '').split(/\s+/);
    return words
        .filter(w => w.length > 3)
        .map(w => w.toLowerCase())
        .filter(w => !stopWords.has(w))
        .map(w => w.charAt(0).toUpperCase() + w.slice(1));
}

// --- Map Styling ---

function getIntensity(score) {
    return Math.min(Math.log10(score + 1) / 5, 1);
}

function intensityToColor(intensity) {
    if (intensity > 0.80) return '#e05050';  // Critical — red
    if (intensity > 0.60) return '#e07c30';  // High — orange
    if (intensity > 0.40) return '#f0a500';  // Moderate — amber
    if (intensity > 0.20) return '#3a7abf';  // Low — blue
    return '#2a4a72';                         // Trace
}

function styleFeature(feature) {
    const data = countryData[feature.properties.name];

    if (!data) {
        return {
            fillColor: '#1e2330',
            weight: 0.5,
            opacity: 1,
            color: 'rgba(255,255,255,0.06)',
            dashArray: '',
            fillOpacity: 1
        };
    }

    const intensity = getIntensity(data.score);
    return {
        fillColor: intensityToColor(intensity),
        weight: 0.5,
        opacity: 1,
        color: 'rgba(255,255,255,0.1)',
        dashArray: '',
        fillOpacity: 0.75 + (intensity * 0.25)
    };
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: (e) => {
            zoomToFeature(e);
            openPanel(feature.properties.name);
        }
    });
}

function highlightFeature(e) {
    const layer = e.target;
    const countryName = layer.feature.properties.name;
    const data = countryData[countryName];

    layer.setStyle({
        weight: 2,
        color: 'rgba(255,255,255,0.35)',
        fillOpacity: 1
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    const topTopic = data ? getTopTopics(data.topics, 1)[0] : null;

    const tooltipHtml = `
        <div class="tooltip-name">${countryName}</div>
        ${data ? `<div class="tooltip-score">Score: ${data.score.toLocaleString()}</div>` : '<div style="color:#3d4455;font-size:0.68rem;">No data</div>'}
        ${topTopic ? `<div class="tooltip-topic"># ${topTopic[0]}</div>` : ''}
    `;

    layer.bindTooltip(tooltipHtml, {
        direction: 'top',
        sticky: true,
        className: 'country-tooltip'
    }).openTooltip();
}

function resetHighlight(e) {
    geoJsonLayer.resetStyle(e.target);
    e.target.closeTooltip();
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
}

function updateMapVisuals() {
    if (geoJsonLayer) geoJsonLayer.setStyle(styleFeature);
}

function updateTopicMarkers() {
    if (!topicLayerGroup || !geoJsonLayer) return;
    topicLayerGroup.clearLayers();

    geoJsonLayer.eachLayer(layer => {
        const countryName = layer.feature.properties.name;
        const data = countryData[countryName];

        if (data && data.score > 50) {
            const topTopic = getTopTopics(data.topics, 1)[0];
            if (topTopic) {
                const center = layer.getBounds().getCenter();
                const icon = L.divIcon({
                    className: 'topic-marker',
                    html: `<span class="marker-label">${topTopic[0]}</span>`,
                    iconSize: [100, 20],
                    iconAnchor: [50, 10]
                });
                L.marker(center, { icon }).addTo(topicLayerGroup);
            }
        }
    });
}

// --- Side Panel ---

function openPanel(countryName) {
    document.getElementById('panel-country-name').innerText = countryName;
    updatePanelContent(countryName);
    document.getElementById('side-panel').classList.remove('hidden');
    isPanelOpen = true;
}

function closePanel() {
    document.getElementById('side-panel').classList.add('hidden');
    isPanelOpen = false;
    map.setView([20, 0], 2, { animate: true });
}

function updatePanelContent(countryName) {
    const data = countryData[countryName];
    const scoreBar    = document.getElementById('popularity-score-bar');
    const scoreValue  = document.getElementById('popularity-score-value');
    const topicsList  = document.getElementById('top-topics-list');
    const articlesList = document.getElementById('related-articles-list');
    const topicsCount  = document.getElementById('topics-count');
    const articlesCount = document.getElementById('articles-count');

    topicsList.innerHTML = '';
    articlesList.innerHTML = '';

    if (!data) {
        scoreBar.style.width = '0%';
        scoreValue.innerText = '0';
        topicsCount.innerText = '0';
        articlesCount.innerText = '0';
        topicsList.innerHTML = '<li class="empty-state">No trending data right now.</li>';
        return;
    }

    // Score
    const intensity = getIntensity(data.score);
    scoreBar.style.width = `${intensity * 100}%`;
    scoreValue.innerText = data.score.toLocaleString();

    // Topics
    const topTopics = getTopTopics(data.topics, 8);
    const maxCount = topTopics[0] ? topTopics[0][1] : 1;
    topicsCount.innerText = topTopics.length;

    topTopics.forEach(([topic, count], i) => {
        const pct = Math.round((count / maxCount) * 100);
        const li = document.createElement('li');
        li.className = 'topic-item';
        li.innerHTML = `
            <span class="topic-rank">${String(i + 1).padStart(2, '0')}</span>
            <span class="topic-name">${topic}</span>
            <div class="topic-bar-wrap">
                <div class="topic-mini-bar">
                    <div class="topic-mini-bar-fill" style="width:${pct}%"></div>
                </div>
                <span class="topic-count">${count}</span>
            </div>
        `;
        topicsList.appendChild(li);
    });

    // Articles
    const topArticles = data.articles.sort((a, b) => b.score - a.score).slice(0, 5);
    articlesCount.innerText = topArticles.length;

    topArticles.forEach(article => {
        const li = document.createElement('li');
        li.className = 'article-item';
        li.innerHTML = `
            <a href="${article.url}" target="_blank" rel="noopener">${article.title}</a>
            <div class="article-meta">
                <span class="article-source-badge">${article.source}</span>
                <span class="article-score"><i class="fas fa-arrow-up"></i>${article.score.toLocaleString()}</span>
            </div>
        `;
        articlesList.appendChild(li);
    });
}

// --- Helpers ---

function getTopTopics(topicsObj, limit) {
    return Object.entries(topicsObj)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit);
}

function updateStats() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('last-updated').innerText = `Updated ${timeStr}`;

    const totalTopics = Object.values(countryData).reduce((acc, curr) => acc + Object.keys(curr.topics).length, 0);
    document.getElementById('active-topics').innerText = totalTopics.toLocaleString();

    const activeCountries = Object.keys(countryData).length;
    document.getElementById('active-countries').innerText = activeCountries;
}

function showLoading(show) {
    const indicator = document.getElementById('loading-indicator');
    if (show) indicator.classList.remove('hidden');
    else indicator.classList.add('hidden');
}
