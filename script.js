const CONFIG = {
    updateInterval: 300000,
    geoJsonUrl: 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json',
    get redditWorldNews() { return 'https://www.reddit.com/r/worldnews.json?limit=100'; },
    get redditPopular() { return 'https://www.reddit.com/r/popular.json?limit=50'; },
    get wikipediaFeatured() {
        const d = new Date();
        return `https://en.wikipedia.org/api/rest_v1/feed/featured/${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    }
};

const COUNTRY_KEYWORDS = {
    "USA": "United States of America", "United States": "United States of America",
    "US": "United States of America", "America": "United States of America",
    "UK": "United Kingdom", "Britain": "United Kingdom",
    "British": "United Kingdom", "England": "United Kingdom",
    "Russia": "Russia", "Russian": "Russia",
    "Ukraine": "Ukraine", "Ukrainian": "Ukraine",
    "China": "China", "Chinese": "China",
    "India": "India", "Indian": "India",
    "France": "France", "French": "France",
    "Germany": "Germany", "German": "Germany",
    "Japan": "Japan", "Japanese": "Japan",
    "Brazil": "Brazil", "Brazilian": "Brazil",
    "Canada": "Canada", "Canadian": "Canada",
    "Australia": "Australia", "Australian": "Australia",
    "Israel": "Israel", "Israeli": "Israel",
    "Palestine": "Palestine", "Palestinian": "Palestine",
    "Iran": "Iran", "Iranian": "Iran",
    "Iraq": "Iraq", "Iraqi": "Iraq",
    "Syria": "Syria", "Syrian": "Syria",
    "Mexico": "Mexico", "Mexican": "Mexico",
    "Italy": "Italy", "Italian": "Italy",
    "Spain": "Spain", "Spanish": "Spain",
    "Korea": "South Korea", "South Korea": "South Korea",
    "North Korea": "North Korea",
    "Turkey": "Turkey", "Turkish": "Turkey",
    "Egypt": "Egypt", "Egyptian": "Egypt",
    "Saudi Arabia": "Saudi Arabia", "Saudi": "Saudi Arabia",
    "Pakistan": "Pakistan", "Pakistani": "Pakistan",
    "Afghanistan": "Afghanistan",
    "Nigeria": "Nigeria", "Nigerian": "Nigeria",
    "South Africa": "South Africa",
    "Argentina": "Argentina",
    "Colombia": "Colombia",
    "Indonesia": "Indonesia", "Indonesian": "Indonesia",
    "Philippines": "Philippines", "Filipino": "Philippines",
    "Thailand": "Thailand", "Thai": "Thailand",
    "Vietnam": "Vietnam", "Vietnamese": "Vietnam",
    "Poland": "Poland", "Polish": "Poland",
    "Netherlands": "Netherlands", "Dutch": "Netherlands",
    "Sweden": "Sweden", "Swedish": "Sweden",
    "Norway": "Norway", "Norwegian": "Norway",
    "Denmark": "Denmark", "Danish": "Denmark",
    "Finland": "Finland", "Finnish": "Finland",
    "Greece": "Greece", "Greek": "Greece",
    "Portugal": "Portugal", "Portuguese": "Portugal",
    "Switzerland": "Switzerland", "Swiss": "Switzerland",
    "Belgium": "Belgium", "Belgian": "Belgium",
    "Austria": "Austria", "Austrian": "Austria",
    "Taiwan": "Taiwan",
    "Myanmar": "Myanmar",
    "Ethiopia": "Ethiopia",
    "Kenya": "Kenya",
    "Morocco": "Morocco",
    "Algeria": "Algeria",
    "Venezuela": "Venezuela",
    "Chile": "Chile",
    "Peru": "Peru"
};

const STOP_WORDS = new Set([
    "the","is","in","at","of","on","and","a","to","for","with","from","by","an",
    "as","it","that","are","was","were","be","has","have","this","will","or","but",
    "not","he","she","they","their","his","her","its","who","which","about","after",
    "up","out","new","more","when","year","years","time","two","can","no","all",
    "just","how","what","now","says","said","over","into","one","first","other",
    "some","could","top","video","photos","news","report","police","man","woman",
    "people","found","dead","killed","injured","shot","died","world","being","been",
    "than","would","like","many","most","also","back","still","last","only","where",
    "before","between","each","here","much","very","does","make","made","amid","says",
    "after","tells","amid","since","while","amid","three","four","five","six","seven",
    "eight","nine","ten","day","days","week","weeks","month","months"
]);

let map;
let geoJsonLayer;
let topicLayerGroup;
let countryData = {};
let liveCountryData = {};
let isPanelOpen = false;
let activePanelCountry = null;
let lastFetchTime = null;
let freshnessInterval = null;
let fetchTimeoutId = null;
let searchHighlightIndex = -1;
let historySnapshots = [];
let isPlayingHistory = false;
let statTopics = 0;
let statRegions = 0;
let panelTouchStartY = 0;
let panelTouchStartHeight = 0;

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
    initKeyboardShortcuts();
    initTimeSlider();
    initMobilePanelDrag();
    fetchDataLoop();
    startFreshnessTracker();
});

function initMap() {
    map = L.map('map', {
        center: [20, 0],
        zoom: 3,
        minZoom: 2,
        maxZoom: 8,
        zoomControl: false,
        attributionControl: false,
        maxBounds: [[-85, -200], [85, 200]],
        maxBoundsViscosity: 0.8
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    topicLayerGroup = L.layerGroup().addTo(map);
    loadGeoJSON();
}

async function loadGeoJSON() {
    try {
        const response = await fetch(CONFIG.geoJsonUrl);
        if (!response.ok) throw new Error('GeoJSON load failed');
        const data = await response.json();
        geoJsonLayer = L.geoJson(data, {
            style: styleFeature,
            onEachFeature: onEachFeature
        }).addTo(map);
    } catch {
        showToast('Could not load map geometry. Check your connection.', 'error');
    }
}

function initUI() {
    document.getElementById('toggle-header-btn').addEventListener('click', toggleHeader);
    document.getElementById('toggle-header-mobile-btn').addEventListener('click', toggleHeader);
    document.getElementById('toggle-legend-btn').addEventListener('click', toggleLegend);
    document.getElementById('close-panel-btn').addEventListener('click', closePanel);
    document.getElementById('expand-panel-btn').addEventListener('click', toggleMobilePanelExpand);
    document.getElementById('share-panel-btn').addEventListener('click', shareCurrentRegion);

    document.getElementById('refresh-btn').addEventListener('click', () => {
        const btn = document.getElementById('refresh-btn');
        if (btn.classList.contains('is-syncing')) return;
        btn.classList.add('is-syncing');
        showToast('Syncing latest global data…', 'success');
        fetchDataLoop().finally(() => {
            setTimeout(() => btn.classList.remove('is-syncing'), 800);
        });
    });

    document.getElementById('reset-view-btn').addEventListener('click', () => {
        map.flyTo([20, 0], window.innerWidth > 768 ? 3 : 2, { duration: 1.5 });
        closePanel();
    });

    if (window.innerWidth <= 768) {
        document.getElementById('header-overlay').classList.add('collapsed');
        document.getElementById('map-legend').classList.add('collapsed');
        const tl = document.getElementById('time-lapse-controls');
        if (tl) tl.classList.add('collapsed');
    }

    initSearch();
}

function initSearch() {
    const searchInput = document.getElementById('country-search');
    const clearBtn = document.getElementById('clear-search');
    const resultsList = document.getElementById('search-results');
    let searchDebounce = null;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        const val = e.target.value.trim().toLowerCase();
        searchHighlightIndex = -1;

        if (val.length > 0) {
            clearBtn.classList.remove('is-hidden');
            searchDebounce = setTimeout(() => {
                resultsList.classList.remove('is-hidden');
                handleSearch(val);
            }, 120);
        } else {
            clearBtn.classList.add('is-hidden');
            resultsList.classList.add('is-hidden');
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        const items = resultsList.querySelectorAll('.search-result-item:not(.no-results)');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            searchHighlightIndex = Math.min(searchHighlightIndex + 1, items.length - 1);
            updateSearchHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            searchHighlightIndex = Math.max(searchHighlightIndex - 1, 0);
            updateSearchHighlight(items);
        } else if (e.key === 'Enter' && searchHighlightIndex >= 0) {
            e.preventDefault();
            items[searchHighlightIndex].click();
        } else if (e.key === 'Escape') {
            searchInput.blur();
            resultsList.classList.add('is-hidden');
        }
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('is-hidden');
        resultsList.classList.add('is-hidden');
        resultsList.innerHTML = '';
        searchHighlightIndex = -1;
        searchInput.focus();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#search-overlay')) {
            resultsList.classList.add('is-hidden');
        }
    });

    searchInput.addEventListener('focus', () => {
        const hint = document.querySelector('.search-shortcut');
        if (hint) hint.style.opacity = '0';
        if (searchInput.value.trim().length > 0) {
            resultsList.classList.remove('is-hidden');
        }
    });

    searchInput.addEventListener('blur', () => {
        const hint = document.querySelector('.search-shortcut');
        if (hint && searchInput.value.trim().length === 0) {
            hint.style.opacity = '';
        }
    });
}

function updateSearchHighlight(items) {
    items.forEach((item, i) => {
        item.classList.toggle('active', i === searchHighlightIndex);
        item.setAttribute('aria-selected', i === searchHighlightIndex ? 'true' : 'false');
    });
    if (items[searchHighlightIndex]) {
        items[searchHighlightIndex].scrollIntoView({ block: 'nearest' });
    }
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.key === 'Escape') e.target.blur();
            return;
        }
        switch (e.key) {
            case '/':
                e.preventDefault();
                document.getElementById('country-search').focus();
                break;
            case 'Escape':
                if (isPanelOpen) closePanel();
                break;
            case 'r':
            case 'R':
                if (!e.ctrlKey && !e.metaKey) document.getElementById('refresh-btn').click();
                break;
        }
    });
}

function toggleHeader() {
    const header = document.getElementById('header-overlay');
    const isCollapsed = header.classList.toggle('collapsed');
    document.getElementById('toggle-header-btn').setAttribute('aria-expanded', String(!isCollapsed));
    document.getElementById('toggle-header-mobile-btn').setAttribute('aria-expanded', String(!isCollapsed));
}

function toggleLegend() {
    const legend = document.getElementById('map-legend');
    const isCollapsed = legend.classList.toggle('collapsed');
    document.getElementById('toggle-legend-btn').setAttribute('aria-expanded', String(!isCollapsed));
}

function toggleMobilePanelExpand() {
    const panel = document.getElementById('side-panel');
    const btn = document.getElementById('expand-panel-btn');
    const icon = btn.querySelector('i');
    const isExpanded = panel.classList.toggle('expanded-mobile');

    if (isExpanded) {
        icon.className = 'fas fa-compress-alt';
        btn.setAttribute('aria-label', 'Collapse panel');
    } else {
        icon.className = 'fas fa-expand-alt';
        btn.setAttribute('aria-label', 'Expand panel');
    }
}

function initMobilePanelDrag() {
    const handle = document.querySelector('.panel-drag-handle');
    const panel = document.getElementById('side-panel');
    if (!handle || !panel) return;

    handle.addEventListener('touchstart', (e) => {
        panelTouchStartY = e.touches[0].clientY;
        panelTouchStartHeight = panel.getBoundingClientRect().height;
        panel.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
        const dy = panelTouchStartY - e.touches[0].clientY;
        const newHeight = Math.min(Math.max(panelTouchStartHeight + dy, window.innerHeight * 0.3), window.innerHeight * 0.92);
        panel.style.height = `${newHeight}px`;
    }, { passive: true });

    handle.addEventListener('touchend', () => {
        panel.style.transition = '';
        const currentHeight = panel.getBoundingClientRect().height;
        const threshold = window.innerHeight * 0.6;
        if (currentHeight > threshold) {
            panel.style.height = '';
            panel.classList.add('expanded-mobile');
            document.getElementById('expand-panel-btn').querySelector('i').className = 'fas fa-compress-alt';
        } else {
            panel.style.height = '';
            panel.classList.remove('expanded-mobile');
            document.getElementById('expand-panel-btn').querySelector('i').className = 'fas fa-expand-alt';
        }
    });
}

function handleSearch(query) {
    const resultsList = document.getElementById('search-results');
    resultsList.innerHTML = '';
    searchHighlightIndex = -1;

    if (!geoJsonLayer) return;

    const layers = [];
    geoJsonLayer.eachLayer(layer => {
        const name = layer.feature?.properties?.name;
        if (name) {
            layers.push({
                name,
                layer,
                score: countryData[name]?.score || 0
            });
        }
    });

    const q = query.toLowerCase();
    const matches = layers
        .filter(k => k.name.toLowerCase().includes(q))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    if (matches.length === 0) {
        resultsList.innerHTML = '<li class="search-result-item no-results">No regions found</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(match => {
        const li = document.createElement('li');
        li.className = 'search-result-item';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');

        const scoreHtml = match.score > 0
            ? `<span class="item-score"><i class="fas fa-fire-alt" aria-hidden="true"></i> ${match.score.toLocaleString()}</span>`
            : '';

        li.innerHTML = `<span>${match.name}</span>${scoreHtml}`;
        li.addEventListener('click', () => {
            document.getElementById('country-search').value = match.name;
            resultsList.classList.add('is-hidden');
            document.getElementById('clear-search').classList.remove('is-hidden');
            map.flyToBounds(match.layer.getBounds(), { padding: [50, 50], duration: 1.5 });
            openPanel(match.name);
            highlightFeature({ target: match.layer });
        });
        fragment.appendChild(li);
    });
    resultsList.appendChild(fragment);
}

function shareCurrentRegion() {
    if (!activePanelCountry) return;
    const data = countryData[activePanelCountry];
    const scoreText = data ? ` | Score: ${data.score.toLocaleString()}` : '';
    const text = `🌍 ${activePanelCountry}${scoreText} — Knowledge Map`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Region info copied to clipboard!', 'success'))
            .catch(() => showToast('Copy failed — try again.', 'error'));
    } else {
        showToast('Clipboard not available in this browser.', 'error');
    }
}

async function fetchDataLoop() {
    if (fetchTimeoutId) {
        clearTimeout(fetchTimeoutId);
        fetchTimeoutId = null;
    }

    showLoading(true);
    const previousCount = Object.keys(countryData).length;
    liveCountryData = {};

    try {
        const results = await Promise.allSettled([
            fetchReddit(CONFIG.redditWorldNews),
            fetchReddit(CONFIG.redditPopular),
            fetchWikipedia()
        ]);

        const allFailed = results.every(r => r.status === 'rejected');
        if (allFailed) throw new Error('All data sources failed');

        if (historySnapshots.length === 0) {
            buildSimulatedHistory(liveCountryData);
        }

        historySnapshots.push({
            timestamp: Date.now(),
            data: JSON.parse(JSON.stringify(liveCountryData))
        });

        if (historySnapshots.length > 24) historySnapshots.shift();

        updateTimeSliderRange();

        if (!isPlayingHistory) {
            countryData = liveCountryData;
            updateMapVisuals();
            updateTopicMarkers();
            updateStats();
            updateTrendingTicker();

            if (isPanelOpen && activePanelCountry) {
                updatePanelContent(activePanelCountry);
            }

            const newCount = Object.keys(countryData).length;
            if (newCount > previousCount && previousCount > 0) {
                showToast('New trends detected globally', 'success');
            }
        }

        lastFetchTime = Date.now();
        updateFreshnessDisplay();

    } catch (err) {
        console.warn('Data fetch error:', err);
        showToast('Could not reach data sources. Retrying soon.', 'error');
    } finally {
        showLoading(false);
        fetchTimeoutId = setTimeout(fetchDataLoop, CONFIG.updateInterval);
    }
}

async function fetchReddit(url) {
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    if (!json?.data?.children) return;

    json.data.children.forEach(post => {
        const { title, score, permalink } = post.data || {};
        if (!title) return;
        processArticle(title, score || 0, `https://reddit.com${permalink}`, 'Reddit');
    });
}

async function fetchWikipedia() {
    const res = await fetch(CONFIG.wikipediaFeatured);
    if (!res.ok) return;
    const json = await res.json();
    const articles = json?.mostread?.articles;
    if (!articles) return;

    articles.forEach(page => {
        if (!page.title) return;
        const title = page.title.replace(/_/g, ' ');
        const views = page.views || 0;
        const score = Math.floor(views / 150);
        const url = page.content_urls?.desktop?.page || '#';
        processArticle(title, score, url, 'Wikipedia');
    });
}

function processArticle(text, score, url, source) {
    const countries = identifyCountries(text);
    if (countries.length === 0) return;

    const topics = extractKeywords(text);

    countries.forEach(name => {
        if (!liveCountryData[name]) {
            liveCountryData[name] = { score: 0, topics: {}, articles: [] };
        }
        const entry = liveCountryData[name];
        entry.score += score;

        topics.forEach(topic => {
            entry.topics[topic] = (entry.topics[topic] || 0) + 1;
        });

        if (!entry.articles.some(a => a.url === url)) {
            entry.articles.push({ title: text, url, source, score });
        }
    });
}

function identifyCountries(text) {
    const found = new Set();
    for (const [key, canonical] of Object.entries(COUNTRY_KEYWORDS)) {
        if (new RegExp(`\\b${key}\\b`, 'i').test(text)) {
            found.add(canonical);
        }
    }
    return [...found];
}

function extractKeywords(text) {
    return text
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w))
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function getIntensity(score) {
    return Math.min(Math.log10(score + 1) / 4.5, 1);
}

function intensityToColor(intensity) {
    if (intensity > 0.85) return '#ef4444';
    if (intensity > 0.65) return '#f97316';
    if (intensity > 0.45) return '#eab308';
    if (intensity > 0.20) return '#3b82f6';
    return '#1e293b';
}

function styleFeature(feature) {
    const data = countryData[feature.properties.name];
    if (!data) {
        return {
            fillColor: '#0f172a',
            weight: 0.5,
            opacity: 1,
            color: 'rgba(255,255,255,0.05)',
            fillOpacity: 0.85
        };
    }
    const intensity = getIntensity(data.score);
    return {
        fillColor: intensityToColor(intensity),
        weight: 1,
        opacity: 1,
        color: 'rgba(255,255,255,0.15)',
        fillOpacity: 0.5 + intensity * 0.45
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
    if (!layer.feature) return;

    const name = layer.feature.properties.name;
    const data = countryData[name];
    const topTopic = data ? getTopTopics(data.topics, 1)[0] : null;

    layer.setStyle({ weight: 2, color: '#ffffff', fillOpacity: 1 });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    layer.unbindTooltip();
    layer.bindTooltip(`
        <div class="tooltip-name">${name}</div>
        ${data
            ? `<div class="tooltip-score">Activity: ${data.score.toLocaleString()}</div>`
            : '<div class="tooltip-no-data">No current activity</div>'
        }
        ${topTopic ? `<div class="tooltip-topic"><i class="fas fa-hashtag"></i> ${topTopic[0]}</div>` : ''}
    `, { direction: 'top', sticky: true, className: 'country-tooltip' }).openTooltip();
}

function resetHighlight(e) {
    if (geoJsonLayer && e.target) {
        geoJsonLayer.resetStyle(e.target);
        e.target.unbindTooltip();
    }
}

function zoomToFeature(e) {
    map.flyToBounds(e.target.getBounds(), { padding: [40, 40], duration: 1.2 });
}

function updateMapVisuals() {
    if (geoJsonLayer) geoJsonLayer.setStyle(styleFeature);
}

function updateTopicMarkers() {
    if (!topicLayerGroup || !geoJsonLayer) return;
    topicLayerGroup.clearLayers();

    geoJsonLayer.eachLayer(layer => {
        const name = layer.feature?.properties?.name;
        const data = countryData[name];
        if (!data || data.score <= 200) return;

        const topTopic = getTopTopics(data.topics, 1)[0];
        if (!topTopic) return;

        const center = layer.getBounds().getCenter();
        const isHot = getIntensity(data.score) > 0.65;

        const icon = L.divIcon({
            className: 'topic-marker',
            html: `${isHot ? '<div class="marker-pulse"></div>' : ''}<span class="marker-label">#${topTopic[0]}</span>`,
            iconSize: [20, 20],
            iconAnchor: [0, 0]
        });

        L.marker(center, { icon, interactive: false }).addTo(topicLayerGroup);
    });
}

function openPanel(countryName) {
    if (!countryName) return;

    activePanelCountry = countryName;
    document.getElementById('panel-country-name').textContent = countryName;

    showPanelSkeleton();

    const panel = document.getElementById('side-panel');
    panel.classList.remove('panel-hidden');
    panel.setAttribute('aria-hidden', 'false');
    isPanelOpen = true;

    if (window.innerWidth <= 768) {
        document.getElementById('map-legend').classList.add('collapsed');
        panel.classList.remove('expanded-mobile');
        panel.style.height = '';
        const icon = document.querySelector('#expand-panel-btn i');
        if (icon) icon.className = 'fas fa-expand-alt';
    }

    setTimeout(() => updatePanelContent(countryName), 200);
}

function closePanel() {
    const panel = document.getElementById('side-panel');
    panel.classList.add('panel-hidden');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('expanded-mobile');
    panel.style.height = '';
    isPanelOpen = false;
    activePanelCountry = null;
}

function showPanelSkeleton() {
    const topicsList = document.getElementById('top-topics-list');
    const articlesList = document.getElementById('related-articles-list');

    topicsList.innerHTML = Array(4).fill(0).map(() =>
        `<li class="skeleton" style="height:48px;border-radius:12px;margin-bottom:8px;"></li>`
    ).join('');

    articlesList.innerHTML = Array(3).fill(0).map(() =>
        `<li class="skeleton" style="height:72px;border-radius:12px;margin-bottom:8px;"></li>`
    ).join('');
}

function updatePanelContent(countryName) {
    if (!countryName) return;

    const data = countryData[countryName];
    const scoreBar = document.getElementById('popularity-score-bar');
    const scoreValue = document.getElementById('popularity-score-value');
    const topicsList = document.getElementById('top-topics-list');
    const articlesList = document.getElementById('related-articles-list');
    const topicsCount = document.getElementById('topics-count');
    const articlesCount = document.getElementById('articles-count');
    const scoreBarContainer = document.querySelector('.score-bar-container');

    topicsList.innerHTML = '';
    articlesList.innerHTML = '';

    if (!data) {
        scoreBar.style.width = '0%';
        scoreValue.textContent = '0';
        topicsCount.textContent = '0';
        articlesCount.textContent = '0';
        if (scoreBarContainer) scoreBarContainer.setAttribute('aria-valuenow', '0');
        topicsList.innerHTML = `<li class="empty-state"><i class="fas fa-signal" aria-hidden="true"></i>No real-time trends for this region.<br>Data refreshes every 5 minutes.</li>`;
        articlesList.innerHTML = `<li class="empty-state"><i class="fas fa-newspaper" aria-hidden="true"></i>No related articles found.</li>`;
        return;
    }

    const intensity = getIntensity(data.score);
    const pctInt = Math.round(intensity * 100);
    scoreBar.style.width = `${pctInt}%`;
    scoreValue.textContent = data.score.toLocaleString();
    if (scoreBarContainer) scoreBarContainer.setAttribute('aria-valuenow', String(pctInt));

    const topTopics = getTopTopics(data.topics, 8);
    const maxCount = topTopics[0]?.[1] || 1;
    topicsCount.textContent = String(topTopics.length);

    const topicsFragment = document.createDocumentFragment();
    topTopics.forEach(([topic, count], i) => {
        const pct = Math.round((count / maxCount) * 100);
        const li = document.createElement('li');
        li.className = 'topic-item';
        li.style.animationDelay = `${i * 40}ms`;
        li.innerHTML = `
            <span class="topic-rank" aria-hidden="true">#${i + 1}</span>
            <span class="topic-name">${topic}</span>
            <div class="topic-bar-wrap" aria-label="${count} mentions">
                <div class="topic-mini-bar" aria-hidden="true">
                    <div class="topic-mini-bar-fill" style="width:${pct}%"></div>
                </div>
                <span class="topic-count">${count}</span>
            </div>
        `;
        topicsFragment.appendChild(li);
    });
    topicsList.appendChild(topicsFragment);

    const topArticles = [...data.articles].sort((a, b) => b.score - a.score).slice(0, 10);
    articlesCount.textContent = String(topArticles.length);

    const articlesFragment = document.createDocumentFragment();
    topArticles.forEach((article, i) => {
        const li = document.createElement('li');
        li.className = 'article-item';
        li.style.animationDelay = `${i * 40}ms`;

        const iconMap = { Reddit: 'fa-reddit-alien', Wikipedia: 'fa-wikipedia-w' };
        const iconClass = iconMap[article.source] || 'fa-globe';

        li.innerHTML = `
            <a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>
            <div class="article-meta">
                <span class="article-source-badge"><i class="fab ${iconClass}" aria-hidden="true"></i> ${article.source}</span>
                <span class="article-score"><i class="fas fa-arrow-trend-up" aria-hidden="true"></i> ${article.score.toLocaleString()}</span>
            </div>
        `;
        articlesFragment.appendChild(li);
    });
    articlesList.appendChild(articlesFragment);
}

function updateTrendingTicker() {
    const tickerContent = document.getElementById('ticker-content');
    const tickerBar = document.getElementById('trending-ticker');

    const globalTopics = {};
    Object.values(countryData).forEach(cd => {
        Object.entries(cd.topics).forEach(([topic, count]) => {
            globalTopics[topic] = (globalTopics[topic] || 0) + count;
        });
    });

    const sorted = Object.entries(globalTopics)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);

    if (sorted.length === 0) {
        tickerBar.classList.add('is-hidden');
        return;
    }

    tickerBar.classList.remove('is-hidden');

    const singleSet = sorted.map(([topic]) =>
        `<span>#${topic}</span><span class="ticker-sep">·</span>`
    ).join('');

    tickerContent.innerHTML = singleSet + singleSet;

    const duration = Math.max(25, sorted.length * 2.8);
    tickerContent.style.animationDuration = `${duration}s`;

    void tickerContent.offsetWidth;
    tickerContent.style.animationPlayState = 'running';
}

function startFreshnessTracker() {
    if (freshnessInterval) clearInterval(freshnessInterval);
    freshnessInterval = setInterval(updateFreshnessDisplay, 15000);
}

function updateFreshnessDisplay() {
    const el = document.getElementById('data-freshness');
    if (!lastFetchTime) {
        el.textContent = '—';
        el.className = 'stat-value freshness-text';
        return;
    }

    const mins = Math.floor((Date.now() - lastFetchTime) / 60000);
    let text, cls;

    if (mins < 1) { text = 'Just now'; cls = 'freshness-fresh'; }
    else if (mins < 4) { text = `${mins}m ago`; cls = 'freshness-fresh'; }
    else if (mins < 7) { text = `${mins}m ago`; cls = 'freshness-stale'; }
    else { text = `${mins}m ago`; cls = 'freshness-old'; }

    el.textContent = text;
    el.className = `stat-value freshness-text ${cls}`;
}

function getTopTopics(topicsObj, limit) {
    return Object.entries(topicsObj)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit);
}

function updateStats() {
    const now = new Date();
    document.getElementById('last-updated').textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

    const totalTopics = Object.values(countryData).reduce((acc, cd) => acc + Object.keys(cd.topics).length, 0);
    const totalRegions = Object.keys(countryData).length;

    animateValue('active-topics', statTopics, totalTopics, 900);
    animateValue('active-countries', statRegions, totalRegions, 900);

    statTopics = totalTopics;
    statRegions = totalRegions;
}

function animateValue(id, start, end, duration) {
    if (start === end) return;
    const el = document.getElementById(id);
    if (!el) return;

    let startTs = null;
    const step = (ts) => {
        if (!startTs) startTs = ts;
        const progress = Math.min((ts - startTs) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * (end - start) + start).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = end.toLocaleString();
    };
    requestAnimationFrame(step);
}

function showLoading(show) {
    document.getElementById('loading-indicator').classList.toggle('loading-hidden', !show);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const icon = type === 'success'
        ? '<i class="fas fa-check-circle" aria-hidden="true"></i>'
        : '<i class="fas fa-exclamation-circle" aria-hidden="true"></i>';

    toast.innerHTML = `${icon} ${message}`;
    container.appendChild(toast);

    const dismiss = () => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    };

    const timeout = setTimeout(dismiss, 4000);
    toast.addEventListener('click', () => { clearTimeout(timeout); dismiss(); });
}

function buildSimulatedHistory(baseData) {
    const now = Date.now();
    for (let i = 12; i > 0; i--) {
        const snapshot = JSON.parse(JSON.stringify(baseData));
        const factor = i / 12;
        Object.keys(snapshot).forEach(country => {
            const item = snapshot[country];
            item.score = Math.max(0, Math.floor(item.score * (0.35 + Math.random() * 0.45) * (1 - factor * 0.55)));
            if (item.score < 10) delete snapshot[country];
        });
        historySnapshots.push({ timestamp: now - i * 1800000, data: snapshot });
    }
}

function initTimeSlider() {
    const slider = document.getElementById('time-slider');
    const toggleBtn = document.getElementById('toggle-time-btn');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const panel = document.getElementById('time-lapse-controls');
            const isCollapsed = panel.classList.toggle('collapsed');
            toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
        });
    }

    if (!slider) return;

    slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const isLive = val === historySnapshots.length - 1;

        if (isLive) {
            isPlayingHistory = false;
            document.getElementById('time-lapse-time').textContent = 'Live';
            countryData = liveCountryData;
        } else {
            isPlayingHistory = true;
            const snap = historySnapshots[val];
            if (!snap) return;
            document.getElementById('time-lapse-time').textContent =
                new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            countryData = snap.data;
        }

        updateMapVisuals();
        updateTopicMarkers();
        updateTrendingTicker();

        if (isPanelOpen && activePanelCountry) {
            updatePanelContent(activePanelCountry);
        }
    });
}

function updateTimeSliderRange() {
    const slider = document.getElementById('time-slider');
    if (!slider) return;
    const newMax = Math.max(0, historySnapshots.length - 1);
    slider.max = String(newMax);
    if (!isPlayingHistory) {
        slider.value = String(newMax);
        document.getElementById('time-lapse-time').textContent = 'Live';
    }
}