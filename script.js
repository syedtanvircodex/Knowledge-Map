'use strict';


const SYNC_INTERVAL = 5 * 60 * 1000;
const MAX_HISTORY = 24;
const GEOJSON_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
const REDDIT_WORLDNEWS = 'https://www.reddit.com/r/worldnews/hot.json?limit=100';
const REDDIT_POPULAR = 'https://www.reddit.com/r/popular/hot.json?limit=50';
const REDDIT_NEWS = 'https://www.reddit.com/r/news/hot.json?limit=50';
const REDDIT_TECHNOLOGY = 'https://www.reddit.com/r/technology/hot.json?limit=50';
const REDDIT_SCIENCE = 'https://www.reddit.com/r/science/hot.json?limit=50';
const WIKI_MOSTREAD = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${(() => { const d = new Date(Date.now() - 864e5); return `${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}`; })()}`;

const HEAT_COLORS = ['#e8eaed','#4caf7a','#e8a735','#d65454','#b01c1c'];
const HEAT_THRESHOLDS = [0, 0.15, 0.4, 0.7, 0.9];


const state = {
  map: null, geoLayer: null, markersLayer: null,
  activeCountry: null, activeCategory: 'all',
  lastSync: null, syncTimer: null, freshnessTimer: null,
  panelOpen: false,
  snapshot: {},
  searchHighlight: -1,
  countryLayers: {},
  animFrameId: null,
  currentColors: {},
  targetColors: {},
};


const COUNTRIES = {
  "Afghanistan":{"code":"AF","aliases":["afghan"],"demonyms":["afghani","afghan"],"lat":33,"lng":65},
  "Albania":{"code":"AL","aliases":[],"demonyms":["albanian"],"lat":41,"lng":20},
  "Algeria":{"code":"DZ","aliases":[],"demonyms":["algerian"],"lat":28,"lng":3},
  "Argentina":{"code":"AR","aliases":[],"demonyms":["argentinian","argentine"],"lat":-34,"lng":-64},
  "Armenia":{"code":"AM","aliases":[],"demonyms":["armenian"],"lat":40,"lng":45},
  "Australia":{"code":"AU","aliases":["aussie"],"demonyms":["australian"],"lat":-25,"lng":134},
  "Austria":{"code":"AT","aliases":[],"demonyms":["austrian"],"lat":47.3,"lng":13.3},
  "Azerbaijan":{"code":"AZ","aliases":[],"demonyms":["azerbaijani","azeri"],"lat":40.5,"lng":47.5},
  "Bahrain":{"code":"BH","aliases":[],"demonyms":["bahraini"],"lat":26,"lng":50.5},
  "Bangladesh":{"code":"BD","aliases":[],"demonyms":["bangladeshi"],"lat":24,"lng":90},
  "Belarus":{"code":"BY","aliases":[],"demonyms":["belarusian"],"lat":53,"lng":28},
  "Belgium":{"code":"BE","aliases":[],"demonyms":["belgian"],"lat":50.8,"lng":4},
  "Bolivia":{"code":"BO","aliases":[],"demonyms":["bolivian"],"lat":-17,"lng":-65},
  "Bosnia and Herzegovina":{"code":"BA","aliases":["bosnia"],"demonyms":["bosnian"],"lat":44,"lng":18},
  "Brazil":{"code":"BR","aliases":[],"demonyms":["brazilian"],"lat":-10,"lng":-55},
  "Bulgaria":{"code":"BG","aliases":[],"demonyms":["bulgarian"],"lat":43,"lng":25},
  "Cambodia":{"code":"KH","aliases":[],"demonyms":["cambodian","khmer"],"lat":13,"lng":105},
  "Cameroon":{"code":"CM","aliases":[],"demonyms":["cameroonian"],"lat":6,"lng":12},
  "Canada":{"code":"CA","aliases":[],"demonyms":["canadian"],"lat":56,"lng":-106},
  "Chile":{"code":"CL","aliases":[],"demonyms":["chilean"],"lat":-35,"lng":-71},
  "China":{"code":"CN","aliases":["beijing","shanghai","prc"],"demonyms":["chinese"],"lat":35,"lng":105},
  "Colombia":{"code":"CO","aliases":[],"demonyms":["colombian"],"lat":4,"lng":-72},
  "Congo":{"code":"CD","aliases":["democratic republic of the congo","drc","congo-kinshasa"],"demonyms":["congolese"],"lat":-4,"lng":22},
  "Costa Rica":{"code":"CR","aliases":[],"demonyms":["costa rican"],"lat":10,"lng":-84},
  "Croatia":{"code":"HR","aliases":[],"demonyms":["croatian","croat"],"lat":45.2,"lng":15.5},
  "Cuba":{"code":"CU","aliases":["havana"],"demonyms":["cuban"],"lat":22,"lng":-80},
  "Cyprus":{"code":"CY","aliases":[],"demonyms":["cypriot"],"lat":35,"lng":33},
  "Czech Republic":{"code":"CZ","aliases":["czechia","czech"],"demonyms":["czech"],"lat":49.8,"lng":15.5},
  "Denmark":{"code":"DK","aliases":[],"demonyms":["danish","dane"],"lat":56,"lng":10},
  "Dominican Republic":{"code":"DO","aliases":[],"demonyms":["dominican"],"lat":19,"lng":-70},
  "Ecuador":{"code":"EC","aliases":[],"demonyms":["ecuadorian"],"lat":-2,"lng":-77.5},
  "Egypt":{"code":"EG","aliases":["cairo"],"demonyms":["egyptian"],"lat":27,"lng":30},
  "El Salvador":{"code":"SV","aliases":[],"demonyms":["salvadoran"],"lat":13.8,"lng":-88.9},
  "Estonia":{"code":"EE","aliases":[],"demonyms":["estonian"],"lat":59,"lng":26},
  "Ethiopia":{"code":"ET","aliases":[],"demonyms":["ethiopian"],"lat":8,"lng":38},
  "Finland":{"code":"FI","aliases":[],"demonyms":["finnish","finn"],"lat":64,"lng":26},
  "France":{"code":"FR","aliases":["paris"],"demonyms":["french"],"lat":46,"lng":2},
  "Georgia":{"code":"GE","aliases":[],"demonyms":["georgian"],"lat":42,"lng":43.5},
  "Germany":{"code":"DE","aliases":["berlin"],"demonyms":["german"],"lat":51,"lng":9},
  "Ghana":{"code":"GH","aliases":[],"demonyms":["ghanaian"],"lat":8,"lng":-2},
  "Greece":{"code":"GR","aliases":["athens"],"demonyms":["greek"],"lat":39,"lng":22},
  "Guatemala":{"code":"GT","aliases":[],"demonyms":["guatemalan"],"lat":15.5,"lng":-90},
  "Honduras":{"code":"HN","aliases":[],"demonyms":["honduran"],"lat":15,"lng":-86.5},
  "Hungary":{"code":"HU","aliases":["budapest"],"demonyms":["hungarian"],"lat":47,"lng":20},
  "Iceland":{"code":"IS","aliases":[],"demonyms":["icelandic","icelander"],"lat":65,"lng":-18},
  "India":{"code":"IN","aliases":["delhi","mumbai","new delhi"],"demonyms":["indian"],"lat":21,"lng":78},
  "Indonesia":{"code":"ID","aliases":["jakarta"],"demonyms":["indonesian"],"lat":-5,"lng":120},
  "Iran":{"code":"IR","aliases":["tehran","persia"],"demonyms":["iranian","persian"],"lat":32,"lng":53},
  "Iraq":{"code":"IQ","aliases":["baghdad"],"demonyms":["iraqi"],"lat":33,"lng":44},
  "Ireland":{"code":"IE","aliases":["dublin"],"demonyms":["irish"],"lat":53,"lng":-8},
  "Israel":{"code":"IL","aliases":["tel aviv","jerusalem"],"demonyms":["israeli"],"lat":31,"lng":35},
  "Italy":{"code":"IT","aliases":["rome","milan"],"demonyms":["italian"],"lat":43,"lng":12},
  "Ivory Coast":{"code":"CI","aliases":["cote d'ivoire","côte d'ivoire"],"demonyms":["ivorian"],"lat":7.5,"lng":-5.5},
  "Jamaica":{"code":"JM","aliases":[],"demonyms":["jamaican"],"lat":18.1,"lng":-77.3},
  "Japan":{"code":"JP","aliases":["tokyo"],"demonyms":["japanese"],"lat":36,"lng":138},
  "Jordan":{"code":"JO","aliases":["amman"],"demonyms":["jordanian"],"lat":31,"lng":36},
  "Kazakhstan":{"code":"KZ","aliases":[],"demonyms":["kazakh","kazakhstani"],"lat":48,"lng":68},
  "Kenya":{"code":"KE","aliases":["nairobi"],"demonyms":["kenyan"],"lat":1,"lng":38},
  "Kuwait":{"code":"KW","aliases":[],"demonyms":["kuwaiti"],"lat":29.5,"lng":47.8},
  "Latvia":{"code":"LV","aliases":[],"demonyms":["latvian"],"lat":57,"lng":25},
  "Lebanon":{"code":"LB","aliases":["beirut"],"demonyms":["lebanese"],"lat":33.9,"lng":35.8},
  "Libya":{"code":"LY","aliases":["tripoli"],"demonyms":["libyan"],"lat":27,"lng":17},
  "Lithuania":{"code":"LT","aliases":[],"demonyms":["lithuanian"],"lat":56,"lng":24},
  "Malaysia":{"code":"MY","aliases":["kuala lumpur"],"demonyms":["malaysian","malay"],"lat":4,"lng":109},
  "Mexico":{"code":"MX","aliases":["mexico city"],"demonyms":["mexican"],"lat":23,"lng":-102},
  "Moldova":{"code":"MD","aliases":[],"demonyms":["moldovan","moldavian"],"lat":47,"lng":29},
  "Mongolia":{"code":"MN","aliases":[],"demonyms":["mongolian","mongol"],"lat":46,"lng":105},
  "Morocco":{"code":"MA","aliases":[],"demonyms":["moroccan"],"lat":32,"lng":-5},
  "Mozambique":{"code":"MZ","aliases":[],"demonyms":["mozambican"],"lat":-18,"lng":35},
  "Myanmar":{"code":"MM","aliases":["burma"],"demonyms":["burmese","myanmar"],"lat":22,"lng":98},
  "Nepal":{"code":"NP","aliases":["kathmandu"],"demonyms":["nepali","nepalese"],"lat":28,"lng":84},
  "Netherlands":{"code":"NL","aliases":["holland","dutch","amsterdam"],"demonyms":["dutch"],"lat":52.5,"lng":5.75},
  "New Zealand":{"code":"NZ","aliases":[],"demonyms":["new zealander","kiwi"],"lat":-42,"lng":174},
  "Nicaragua":{"code":"NI","aliases":[],"demonyms":["nicaraguan"],"lat":13,"lng":-85},
  "Nigeria":{"code":"NG","aliases":["lagos","abuja"],"demonyms":["nigerian"],"lat":10,"lng":8},
  "North Korea":{"code":"KP","aliases":["dprk","pyongyang"],"demonyms":["north korean"],"lat":40,"lng":127},
  "North Macedonia":{"code":"MK","aliases":["macedonia"],"demonyms":["macedonian"],"lat":41.5,"lng":22},
  "Norway":{"code":"NO","aliases":["oslo"],"demonyms":["norwegian"],"lat":62,"lng":10},
  "Oman":{"code":"OM","aliases":[],"demonyms":["omani"],"lat":21,"lng":57},
  "Pakistan":{"code":"PK","aliases":["islamabad","karachi"],"demonyms":["pakistani"],"lat":30,"lng":70},
  "Palestine":{"code":"PS","aliases":["gaza","west bank","palestinian territories"],"demonyms":["palestinian"],"lat":31.9,"lng":35.2},
  "Panama":{"code":"PA","aliases":[],"demonyms":["panamanian"],"lat":9,"lng":-80},
  "Paraguay":{"code":"PY","aliases":[],"demonyms":["paraguayan"],"lat":-23,"lng":-58},
  "Peru":{"code":"PE","aliases":["lima"],"demonyms":["peruvian"],"lat":-10,"lng":-76},
  "Philippines":{"code":"PH","aliases":["manila"],"demonyms":["filipino","philippine"],"lat":13,"lng":122},
  "Poland":{"code":"PL","aliases":["warsaw"],"demonyms":["polish","pole"],"lat":52,"lng":20},
  "Portugal":{"code":"PT","aliases":["lisbon"],"demonyms":["portuguese"],"lat":39.5,"lng":-8},
  "Qatar":{"code":"QA","aliases":["doha"],"demonyms":["qatari"],"lat":25.5,"lng":51.2},
  "Romania":{"code":"RO","aliases":["bucharest"],"demonyms":["romanian"],"lat":46,"lng":25},
  "Russia":{"code":"RU","aliases":["moscow","kremlin","russian federation"],"demonyms":["russian"],"lat":60,"lng":100},
  "Rwanda":{"code":"RW","aliases":["kigali"],"demonyms":["rwandan"],"lat":-2,"lng":30},
  "Saudi Arabia":{"code":"SA","aliases":["riyadh","saudi"],"demonyms":["saudi"],"lat":24,"lng":45},
  "Senegal":{"code":"SN","aliases":["dakar"],"demonyms":["senegalese"],"lat":14,"lng":-14},
  "Serbia":{"code":"RS","aliases":["belgrade"],"demonyms":["serbian","serb"],"lat":44,"lng":21},
  "Singapore":{"code":"SG","aliases":[],"demonyms":["singaporean"],"lat":1.35,"lng":104},
  "Slovakia":{"code":"SK","aliases":[],"demonyms":["slovak","slovakian"],"lat":48.7,"lng":19.7},
  "Slovenia":{"code":"SI","aliases":[],"demonyms":["slovenian","slovene"],"lat":46.1,"lng":14.8},
  "Somalia":{"code":"SO","aliases":["mogadishu"],"demonyms":["somali","somalian"],"lat":6,"lng":46},
  "South Africa":{"code":"ZA","aliases":[],"demonyms":["south african"],"lat":-30,"lng":25},
  "South Korea":{"code":"KR","aliases":["seoul","korea"],"demonyms":["south korean","korean"],"lat":36,"lng":128},
  "Spain":{"code":"ES","aliases":["madrid","barcelona"],"demonyms":["spanish","spaniard"],"lat":40,"lng":-4},
  "Sri Lanka":{"code":"LK","aliases":["ceylon"],"demonyms":["sri lankan"],"lat":7,"lng":81},
  "Sudan":{"code":"SD","aliases":["khartoum"],"demonyms":["sudanese"],"lat":15,"lng":30},
  "Sweden":{"code":"SE","aliases":["stockholm"],"demonyms":["swedish","swede"],"lat":62,"lng":15},
  "Switzerland":{"code":"CH","aliases":["swiss","zurich","geneva"],"demonyms":["swiss"],"lat":47,"lng":8},
  "Syria":{"code":"SY","aliases":["damascus"],"demonyms":["syrian"],"lat":35,"lng":38},
  "Taiwan":{"code":"TW","aliases":["taipei"],"demonyms":["taiwanese"],"lat":23.5,"lng":121},
  "Tanzania":{"code":"TZ","aliases":[],"demonyms":["tanzanian"],"lat":-6,"lng":35},
  "Thailand":{"code":"TH","aliases":["bangkok"],"demonyms":["thai"],"lat":15,"lng":100},
  "Tunisia":{"code":"TN","aliases":["tunis"],"demonyms":["tunisian"],"lat":34,"lng":9},
  "Turkey":{"code":"TR","aliases":["ankara","istanbul","türkiye"],"demonyms":["turkish","turk"],"lat":39,"lng":35},
  "Uganda":{"code":"UG","aliases":["kampala"],"demonyms":["ugandan"],"lat":2,"lng":32},
  "Ukraine":{"code":"UA","aliases":["kyiv","kiev"],"demonyms":["ukrainian"],"lat":49,"lng":32},
  "United Arab Emirates":{"code":"AE","aliases":["uae","dubai","abu dhabi"],"demonyms":["emirati"],"lat":24,"lng":54},
  "United Kingdom":{"code":"GB","aliases":["uk","britain","england","london","scotland","wales","british"],"demonyms":["british","briton"],"lat":54,"lng":-2},
  "United States":{"code":"US","aliases":["usa","u.s.","u.s.a.","america","washington","american"],"demonyms":["american"],"lat":38,"lng":-97},
  "Uruguay":{"code":"UY","aliases":["montevideo"],"demonyms":["uruguayan"],"lat":-33,"lng":-56},
  "Uzbekistan":{"code":"UZ","aliases":["tashkent"],"demonyms":["uzbek","uzbekistani"],"lat":41,"lng":65},
  "Venezuela":{"code":"VE","aliases":["caracas"],"demonyms":["venezuelan"],"lat":8,"lng":-66},
  "Vietnam":{"code":"VN","aliases":["hanoi","ho chi minh"],"demonyms":["vietnamese"],"lat":16,"lng":108},
  "Yemen":{"code":"YE","aliases":["sanaa"],"demonyms":["yemeni"],"lat":15.5,"lng":48},
  "Zimbabwe":{"code":"ZW","aliases":["harare"],"demonyms":["zimbabwean"],"lat":-20,"lng":30},
  "Zambia":{"code":"ZM","aliases":["lusaka"],"demonyms":["zambian"],"lat":-15,"lng":28},
};


const countryLookup = new Map();
for (const [name, info] of Object.entries(COUNTRIES)) {
  const lower = name.toLowerCase();
  countryLookup.set(lower, name);
  for (const alias of info.aliases) countryLookup.set(alias.toLowerCase(), name);
  for (const dem of info.demonyms) countryLookup.set(dem.toLowerCase(), name);
}

const lookupKeys = [...countryLookup.keys()].sort((a, b) => b.length - a.length);


const DENY_LIST = [
  'french toast','french fries','french press','french kiss','french bulldog','french door',
  'turkish coffee','turkish bath','turkish delight','turkish towel','turkish van',
  'korean bbq','korean barbecue','korean skincare','korean drama',
  'indian summer','indian ink','indian corn','indian giver',
  'greek yogurt','greek salad','greek life','greek tragedy',
  'russian roulette','russian doll','russian twist','russian blue',
  'swiss cheese','swiss army','swiss roll','swiss steak','swiss chard',
  'dutch oven','dutch courage','dutch uncle','dutch treat',
  'polish sausage','polish remover','nail polish',
  'china cabinet','china set','bone china','fine china',
  'jordan shoes','jordan almonds','michael jordan',
  'american cheese','american dream','american pie','american girl',
  'canadian bacon','canadian tuxedo',
  'thai massage','thai tea','pad thai',
  'persian cat','persian rug','persian carpet',
  'brazil nut','brazilian wax','brazilian blowout',
  'chile pepper','chile sauce',
  'cuban sandwich','cuban cigar','cuban link',
  'irish coffee','irish goodbye','irish cream','irish setter',
  'japanese maple','japanese beetle',
  'mexican wave','mexican standoff',
  'mongolian beef','mongolian grill',
  'singaporean sling','singapore sling',
  'spanish flu','spanish moss','spanish omelette','spanish rice',
  'swedish meatball','swedish massage','swedish fish',
];
const denySet = new Set(DENY_LIST);


const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','it','its','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','shall','should','can','could','may','might','must',
  'not','no','nor','so','if','then','than','that','this','these','those','what',
  'which','who','whom','when','where','why','how','all','each','every','both',
  'few','more','most','other','some','such','only','own','same','too','very',
  'just','about','above','after','again','against','also','am','among','any',
  'because','been','before','below','between','during','into','over','under',
  'until','up','down','out','off','here','there','once','further',
  'says','said','new','now','first','last','also','one','two','three',
  'people','year','years','day','days','time','way','many','much',
  'news','report','reports','according','amid','since','still',
  'get','gets','got','make','makes','made','take','takes','took',
  'come','comes','came','go','goes','went','see','seen','say',
  'know','think','back','even','well','want','give','use','find',
  'tell','ask','work','seem','feel','try','leave','call','old',
  'long','great','little','right','world','life','hand','part',
  'man','men','woman','women','child','children','mr','mrs','ms',
  'could','would','may','after','over','like',
]);


const CATEGORIES = {
  conflict: ['war','military','army','attack','bomb','missile','soldier','troops','killed','weapon','conflict','battle','invasion','nato','airstrike','strike','cease','ceasefire','hostage','terrorist','terrorism','sanctions','coup','protest','riot','assassination','nuclear','defense','defence','drone','artillery','navy','forces','front','siege','occupation','rebel','militia','election','vote','politics','political','president','minister','prime','government','opposition','parliament','congress','senate','law','bill','legislation','diplomat','diplomacy','embassy','summit','treaty','alliance','policy','referendum','democracy','authoritarian','dictator','regime'],
  science: ['science','scientist','research','study','technology','tech','ai','artificial','intelligence','space','nasa','satellite','climate','quantum','robot','medical','medicine','vaccine','gene','genome','dna','discovery','experiment','lab','laboratory','physics','chemistry','biology','data','digital','software','hardware','computer','internet','cyber','hack','app','startup','innovation','patent','mars','moon','rocket','launch','telescope','renewable','energy','solar','battery','ev','electric'],
  economy: ['economy','economic','gdp','inflation','market','stock','trade','tariff','bank','banking','debt','deficit','budget','tax','currency','dollar','euro','yen','yuan','recession','growth','unemployment','jobs','export','import','oil','price','commodity','investment','investor','crypto','bitcoin','finance','financial','rate','interest','fed','reserve','imf','central','supply','demand','profit','revenue','earnings','nasdaq','dow'],
  culture: ['sport','sports','football','soccer','basketball','tennis','cricket','olympics','olympic','athlete','championship','league','cup','win','match','game','tournament','goal','player','coach','team','culture','cultural','art','music','film','movie','festival','concert','museum','book','award','prize','nobel','oscar','grammy','celebrity','star','fashion','entertainment','tv','series','show','actor','actress','singer','album','tour'],
};

function classifyArticle(title) {
  const lower = title.toLowerCase();
  const scores = {};
  for (const [cat, words] of Object.entries(CATEGORIES)) {
    scores[cat] = words.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
  }
  const best = Object.entries(scores).sort((a,b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'all';
}



async function fetchReddit(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  const json = await res.json();
  return (json?.data?.children || []).map(c => ({
    title: c.data.title || '',
    score: c.data.ups || 0,
    url: c.data.url || `https://reddit.com${c.data.permalink}`,
    source: 'reddit',
    created: c.data.created_utc ? c.data.created_utc * 1000 : Date.now(),
  }));
}

async function fetchWikipedia() {
  const res = await fetch(WIKI_MOSTREAD);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const json = await res.json();
  const articles = json?.items?.[0]?.articles || [];
  return articles.slice(0, 80).map(a => ({
    title: a.article?.replace(/_/g, ' ') || '',
    score: a.views || 0,
    url: `https://en.wikipedia.org/wiki/${a.article}`,
    source: 'wikipedia',
    created: Date.now(),
  }));
}

async function fetchAllSources() {
  const results = await Promise.allSettled([
    fetchReddit(REDDIT_WORLDNEWS),
    fetchReddit(REDDIT_POPULAR),
    fetchReddit(REDDIT_NEWS),
    fetchReddit(REDDIT_TECHNOLOGY),
    fetchReddit(REDDIT_SCIENCE),
    fetchWikipedia(),
  ]);
  const sourceNames = ['Reddit World News', 'Reddit Popular', 'Reddit News', 'Reddit Technology', 'Reddit Science', 'Wikipedia'];
  let articles = [];
  let failCount = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      articles = articles.concat(r.value);
    } else {
      failCount++;
      console.warn(`Failed: ${sourceNames[i]}`, r.reason);
    }
  });
  if (failCount > 0 && failCount < 6) {
    showToast(`${failCount} source(s) unavailable, using remaining data`, 'warning');
  }
  if (failCount === 6) {
    showToast('All sources unreachable — showing cached data', 'error');
    return null;
  }
  return articles;
}



function detectCountries(title) {
  const lower = title.toLowerCase();
  // Build a cleaned version that masks deny-listed phrases
  let cleaned = lower;
  for (const phrase of denySet) {
    if (cleaned.includes(phrase)) {
      cleaned = cleaned.replace(phrase, ' '.repeat(phrase.length));
    }
  }
  const found = new Set();
  let remaining = cleaned;
  for (const key of lookupKeys) {
    // Word-boundary match
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(remaining)) {
      found.add(countryLookup.get(key));
      remaining = remaining.replace(regex, ' ');
    }
  }
  return [...found];
}

function extractTopics(title, detectedCountries) {
  
  let clean = title.toLowerCase();
  for (const c of detectedCountries) {
    const info = COUNTRIES[c];
    if (!info) continue;
    const allTerms = [c.toLowerCase(), ...info.aliases, ...info.demonyms];
    for (const t of allTerms) {
      clean = clean.replace(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ');
    }
  }
  
  return clean
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 10);
}



function processArticles(articles) {
  
  const redditArticles = articles.filter(a => a.source === 'reddit');
  const wikiArticles = articles.filter(a => a.source === 'wikipedia');

  
  for (const a of redditArticles) {
    a.normScore = Math.log10(Math.max(a.score, 1) + 1) * 10;
  }
  
  if (wikiArticles.length > 0) {
    const views = wikiArticles.map(a => a.score).sort((a,b) => a - b);
    const median = views[Math.floor(views.length / 2)] || 1;
    for (const a of wikiArticles) {
      a.normScore = (a.score / median) * 15;
    }
  }

  
  const countryData = {};
  const globalTopicCounts = {};
  const allNormed = [...redditArticles, ...wikiArticles];

  for (const article of allNormed) {
    const countries = detectCountries(article.title);
    const topics = extractTopics(article.title, countries);
    const category = classifyArticle(article.title);
    article.detectedCountries = countries;
    article.topics = topics;
    article.category = category;

    for (const topic of topics) {
      globalTopicCounts[topic] = (globalTopicCounts[topic] || 0) + 1;
    }

    for (const country of countries) {
      if (!countryData[country]) {
        countryData[country] = { score: 0, topics: {}, articles: [], categories: {} };
      }
      countryData[country].score += article.normScore || 0;
      countryData[country].articles.push(article);
      countryData[country].categories[category] = (countryData[country].categories[category] || 0) + 1;
      for (const topic of topics) {
        countryData[country].topics[topic] = (countryData[country].topics[topic] || 0) + 1;
      }
    }
  }

  
  const totalCountries = Object.keys(countryData).length || 1;
  for (const [country, data] of Object.entries(countryData)) {
    for (const [topic, count] of Object.entries(data.topics)) {
      const globalCount = globalTopicCounts[topic] || 1;
      const icf = Math.log2(totalCountries / globalCount + 1);
      data.topics[topic] = count * icf;
    }
  }

  
  const scores = Object.values(countryData).map(d => d.score);
  if (scores.length > 0) {
    const mean = scores.reduce((a,b) => a + b, 0) / scores.length;
    const std = Math.sqrt(scores.reduce((a,b) => a + (b - mean) ** 2, 0) / scores.length) || 1;
    for (const data of Object.values(countryData)) {
      data.zScore = (data.score - mean) / std;
      data.intensity = Math.max(0, Math.min(1, (data.zScore + 1) / 4)); // maps ~-1..3 to 0..1
    }
  }

  return { countryData, globalTopicCounts };
}

function filterByCategory(snapshot, category) {
  if (category === 'all') return snapshot;
  const filtered = {};
  for (const [country, data] of Object.entries(snapshot)) {
    const matchingArticles = data.articles.filter(a => a.category === category);
    if (matchingArticles.length > 0) {
      const score = matchingArticles.reduce((s, a) => s + (a.normScore || 0), 0);
      filtered[country] = { ...data, score, articles: matchingArticles };
    }
  }
  // Re-normalise
  const scores = Object.values(filtered).map(d => d.score);
  if (scores.length > 0) {
    const mean = scores.reduce((a,b) => a + b, 0) / scores.length;
    const std = Math.sqrt(scores.reduce((a,b) => a + (b - mean) ** 2, 0) / scores.length) || 1;
    for (const data of Object.values(filtered)) {
      data.zScore = (data.score - mean) / std;
      data.intensity = Math.max(0, Math.min(1, (data.zScore + 1) / 4));
    }
  }
  return filtered;
}



function setSnapshot(countryData) {
  state.snapshot = countryData;
}




function getCurrentSnapshot() {
  return filterByCategory(state.snapshot, state.activeCategory);
}



function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} toast-icon"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('exit'); setTimeout(() => toast.remove(), 300); }, 4000);
}



function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  return [r, g, b];
}
function rgbToHex([r, g, b]) {
  return '#' + [r,g,b].map(c => Math.round(c).toString(16).padStart(2,'0')).join('');
}
function lerpColor(hex1, hex2, t) {
  const [r1,g1,b1] = hexToRgb(hex1), [r2,g2,b2] = hexToRgb(hex2);
  return rgbToHex([r1+(r2-r1)*t, g1+(g2-g1)*t, b1+(b2-b1)*t]);
}

function intensityToColor(intensity) {
  if (intensity <= 0) return HEAT_COLORS[0];
  for (let i = HEAT_THRESHOLDS.length - 1; i >= 1; i--) {
    if (intensity >= HEAT_THRESHOLDS[i]) {
      if (i === HEAT_THRESHOLDS.length - 1) return HEAT_COLORS[i];
      const t = (intensity - HEAT_THRESHOLDS[i]) / (HEAT_THRESHOLDS[i+1] - HEAT_THRESHOLDS[i]);
      return lerpColor(HEAT_COLORS[i], HEAT_COLORS[Math.min(i+1, HEAT_COLORS.length-1)], Math.min(t, 1));
    }
  }
  const t = intensity / HEAT_THRESHOLDS[1];
  return lerpColor(HEAT_COLORS[0], HEAT_COLORS[1], t);
}



function initMap() {
  const isMobile = window.innerWidth <= 768;
  state.map = L.map('map', {
    center: [20, 0], zoom: isMobile ? 2 : 3,
    minZoom: 2, maxZoom: 7,
    zoomControl: false, attributionControl: false,
    worldCopyJump: true,
    maxBounds: [[-85, -200], [85, 200]],
    maxBoundsViscosity: 0.8,
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);
  loadGeoJSON();
}

async function loadGeoJSON() {
  try {
    const res = await fetch(GEOJSON_URL);
    const geojson = await res.json();
    state.geoLayer = L.geoJSON(geojson, {
      style: () => ({
        fillColor: HEAT_COLORS[0], fillOpacity: 0.5,
        color: 'rgba(0,0,0,0.08)', weight: 0.8,
      }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties.name;
        state.countryLayers[name] = layer;
        
        layer.bindTooltip('', { sticky: true, className: 'country-tooltip', direction: 'top', offset: [0, -10] });
        layer.on('mouseover', () => {
          layer.setStyle({ weight: 2, color: 'rgba(0,122,204,0.6)' });
          const snap = getCurrentSnapshot();
          const data = snap[name];
          const topKeyword = data ? getTopKeyword(data) : '';
          layer.setTooltipContent(
            `<span class="tooltip-name">${name}</span>` +
            (data ? `<span class="tooltip-score">${Math.round(data.score)}</span>` : '') +
            (topKeyword ? `<span class="tooltip-keyword">#${topKeyword}</span>` : '')
          );
        });
        layer.on('mouseout', () => {
          const snap = getCurrentSnapshot();
          const data = snap[name];
          const intensity = data?.intensity || 0;
          layer.setStyle({
            weight: 0.8, color: 'rgba(0,0,0,0.08)',
          });
        });
        layer.on('click', () => openPanel(name));
      },
    }).addTo(state.map);
  } catch (e) {
    console.error('GeoJSON load failed', e);
    showToast('Failed to load map boundaries', 'error');
  }
}

function getTopKeyword(data) {
  if (!data?.topics) return '';
  const entries = Object.entries(data.topics).sort((a,b) => b[1] - a[1]);
  return entries[0]?.[0] || '';
}



function renderMap() {
  const snapshot = getCurrentSnapshot();
  
  if (state.geoLayer) {
    state.geoLayer.eachLayer(layer => {
      const name = layer.feature?.properties?.name;
      if (!name) return;
      const data = snapshot[name];
      const intensity = data?.intensity || 0;
      const color = intensityToColor(intensity);
      const opacity = 0.4 + intensity * 0.45;
      state.targetColors[name] = { color, opacity };
      if (!state.currentColors[name]) {
        state.currentColors[name] = { color: HEAT_COLORS[0], opacity: 0.5 };
      }
    });
  }
  
  state.colorProgress = 0;
  animateColors();
  
  updateMarkers(snapshot);
  
  updateTicker(snapshot);
  
  updateStats(snapshot);
  
  if (state.panelOpen && state.activeCountry) {
    updatePanelContent(state.activeCountry);
  }
}

function animateColors() {
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  const duration = 600;
  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    if (state.geoLayer) {
      state.geoLayer.eachLayer(layer => {
        const name = layer.feature?.properties?.name;
        if (!name || !state.targetColors[name]) return;
        const from = state.currentColors[name] || { color: HEAT_COLORS[0], opacity: 0.5 };
        const to = state.targetColors[name];
        const blended = lerpColor(from.color, to.color, eased);
        const blendedOpacity = from.opacity + (to.opacity - from.opacity) * eased;
        layer.setStyle({ fillColor: blended, fillOpacity: blendedOpacity });
      });
    }
    if (t < 1) {
      state.animFrameId = requestAnimationFrame(frame);
    } else {
      
      for (const [name, val] of Object.entries(state.targetColors)) {
        state.currentColors[name] = { ...val };
      }
    }
  }
  state.animFrameId = requestAnimationFrame(frame);
}



function updateMarkers(snapshot) {
  state.markersLayer.clearLayers();
  if (state.map.getZoom() < 3) return;
  const scores = Object.values(snapshot).map(d => d.score);
  const avg = scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : 0;
  const highThreshold = avg * 2;

  for (const [country, data] of Object.entries(snapshot)) {
    if (data.score < avg) continue;
    const info = COUNTRIES[country];
    if (!info) continue;
    const keyword = getTopKeyword(data);
    if (!keyword) continue;
    const isHigh = data.score >= highThreshold;
    const html = `<div class="topic-marker">${isHigh ? '<span class="pulse-dot"></span>' : ''}#${keyword}</div>`;
    const marker = L.marker([info.lat, info.lng], {
      icon: L.divIcon({ html, className: '', iconSize: null }),
      interactive: false,
    });
    state.markersLayer.addLayer(marker);
  }
}



function updateTicker(snapshot) {
  const globalTopics = {};
  for (const data of Object.values(snapshot)) {
    for (const [topic, weight] of Object.entries(data.topics || {})) {
      globalTopics[topic] = (globalTopics[topic] || 0) + weight;
    }
  }
  const top20 = Object.entries(globalTopics).sort((a,b) => b[1] - a[1]).slice(0, 20);
  const container = document.getElementById('ticker-content');
  
  const items = top20.map(([t]) => `<span class="ticker-item" data-topic="${t}"><span class="ticker-hash">#</span>${t}</span>`).join('');
  container.innerHTML = items + items;
}



function animateValue(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const diff = target - current;
  const steps = 30;
  let step = 0;
  const timer = setInterval(() => {
    step++;
    const progress = 1 - Math.pow(1 - step / steps, 3);
    el.textContent = Math.round(current + diff * progress);
    if (step >= steps) { el.textContent = target; clearInterval(timer); }
  }, 20);
}

function updateStats(snapshot) {
  const topicSet = new Set();
  for (const data of Object.values(snapshot)) {
    for (const t of Object.keys(data.topics || {})) topicSet.add(t);
  }
  animateValue(document.getElementById('stat-topics-value'), topicSet.size);
  animateValue(document.getElementById('stat-regions-value'), Object.keys(snapshot).length);
  if (state.lastSync) {
    const ago = Math.round((Date.now() - state.lastSync) / 1000);
    document.getElementById('stat-sync-value').textContent = ago < 60 ? `${ago}s` : `${Math.round(ago/60)}m`;
  }
}

function updateFreshness() {
  if (!state.lastSync) return;
  const age = Date.now() - state.lastSync;
  const dot = document.getElementById('freshness-dot');
  const label = document.getElementById('freshness-label');
  dot.className = 'freshness-dot';
  if (age < 60000) { dot.classList.add('green'); label.textContent = 'Live'; }
  else if (age < 240000) { dot.classList.add('amber'); label.textContent = 'Recent'; }
  else { dot.classList.add('red'); label.textContent = 'Stale'; }
}



function openPanel(countryName) {
  state.activeCountry = countryName;
  state.panelOpen = true;
  const panel = document.getElementById('detail-panel');
  panel.classList.add('open');
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  document.getElementById('panel-country-name').textContent = countryName;

  const info = COUNTRIES[countryName];
  if (info) state.map.flyTo([info.lat, info.lng], Math.max(state.map.getZoom(), 4), { duration: 0.8 });
  updatePanelContent(countryName);
}

function closePanel() {
  state.panelOpen = false;
  state.activeCountry = null;
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('open');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  if (document.activeElement && panel.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

function updatePanelContent(countryName) {
  const snapshot = getCurrentSnapshot();
  const data = snapshot[countryName];
  
  const score = data ? Math.round(data.score) : 0;
  document.getElementById('overview-score').textContent = score;
  document.getElementById('overview-bar').style.width = data ? `${Math.min(data.intensity * 100, 100)}%` : '0%';
  
  const deltaEl = document.getElementById('overview-delta');
  deltaEl.className = 'overview-delta neutral';
  deltaEl.querySelector('.delta-text').textContent = 'Live snapshot';
  
  if (state.lastSync) {
    const d = new Date(state.lastSync);
    document.getElementById('overview-updated').innerHTML = `<i class="fa-regular fa-clock"></i> ${d.toLocaleTimeString()}`;
  }
  
  renderTopicsTab(data);
  
  renderSourcesTab(data);
  
  renderNeighboursTab(countryName, snapshot);
}

function renderTopicsTab(data) {
  const container = document.getElementById('topics-chart');
  if (!data || !data.topics || Object.keys(data.topics).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-mountain-sun"></i>
        <p>No major topics detected for this region yet.</p>
      </div>`;
    return;
  }
  const sorted = Object.entries(data.topics).sort((a,b) => b[1] - a[1]).slice(0, 10);
  const maxVal = sorted[0][1];
  container.innerHTML = sorted.map(([topic, val], i) => `
    <div class="topic-row" style="animation-delay:${i * 40}ms">
      <span class="topic-label" title="${topic}">${topic}</span>
      <div class="topic-bar-track">
        <div class="topic-bar-fill" style="width:${(val/maxVal)*100}%"></div>
      </div>
      <span class="topic-score">${val.toFixed(1)}</span>
    </div>
  `).join('');
}

function renderSourcesTab(data) {
  const list = document.getElementById('sources-list');
  if (!data || !data.articles || data.articles.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-newspaper"></i>
        <p>No recent news sources found.</p>
      </div>`;
    return;
  }
  const sorted = [...data.articles].sort((a,b) => (b.normScore||0) - (a.normScore||0)).slice(0, 15);
  list.innerHTML = sorted.map((a, i) => {
    const ago = Math.round((Date.now() - a.created) / 60000);
    const agoText = ago < 60 ? `${ago}m ago` : `${Math.round(ago/60)}h ago`;
    return `
    <li class="source-item" style="animation-delay:${i * 40}ms">
      <span class="source-badge ${a.source}">${a.source === 'reddit' ? 'R' : 'W'}</span>
      <div class="source-info">
        <div class="source-title"><a href="${a.url}" target="_blank" rel="noopener">${a.title}</a></div>
        <div class="source-meta">
          <span>${a.source === 'reddit' ? '▲ ' + a.score.toLocaleString() : a.score.toLocaleString() + ' views'}</span>
          <span>${agoText}</span>
        </div>
      </div>
    </li>`;
  }).join('');
}

function cosineSimilarity(vecA, vecB) {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const a = vecA[k] || 0, b = vecB[k] || 0;
    dot += a * b; magA += a * a; magB += b * b;
  }
  return (magA && magB) ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

function renderNeighboursTab(countryName, snapshot) {
  const list = document.getElementById('neighbours-list');
  const data = snapshot[countryName];
  if (!data || !data.topics) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-handshake-angle"></i>
        <p>Insufficient data to determine neighbours.</p>
      </div>`;
    return;
  }
  const similarities = [];
  for (const [other, otherData] of Object.entries(snapshot)) {
    if (other === countryName) continue;
    const sim = cosineSimilarity(data.topics, otherData.topics || {});
    if (sim > 0) similarities.push({ name: other, sim });
  }
  similarities.sort((a,b) => b.sim - a.sim);
  const top5 = similarities.slice(0, 5);
  if (top5.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-earth-americas"></i>
        <p>No similar countries found in current snapshot.</p>
      </div>`;
    return;
  }
  list.innerHTML = top5.map((s, i) => `
    <li class="neighbour-item" data-country="${s.name}" style="animation-delay:${i * 50}ms">
      <span class="neighbour-rank">${i + 1}</span>
      <span class="neighbour-name">${s.name}</span>
      <span class="neighbour-sim">${(s.sim * 100).toFixed(0)}% match</span>
    </li>
  `).join('');
}



function initSearch() {
  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');
  let results = [];

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) { dropdown.classList.remove('open'); results = []; return; }
    const snapshot = getCurrentSnapshot();
    results = Object.keys(COUNTRIES)
      .filter(c => c.toLowerCase().includes(q))
      .sort((a,b) => (snapshot[b]?.score || 0) - (snapshot[a]?.score || 0))
      .slice(0, 8);
    state.searchHighlight = -1;
    if (results.length === 0) { dropdown.classList.remove('open'); return; }
    dropdown.innerHTML = results.map((c, i) => {
      const score = snapshot[c] ? Math.round(snapshot[c].score) : 0;
      return `<li role="option" data-index="${i}" data-country="${c}">
        <span>${c}</span>
        <span class="search-score">${score > 0 ? score : '—'}</span>
      </li>`;
    }).join('');
    dropdown.classList.add('open');
  });

  input.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('open')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.searchHighlight = Math.min(state.searchHighlight + 1, results.length - 1);
      highlightSearchItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.searchHighlight = Math.max(state.searchHighlight - 1, 0);
      highlightSearchItem();
    } else if (e.key === 'Enter' && state.searchHighlight >= 0) {
      e.preventDefault();
      selectSearchResult(results[state.searchHighlight]);
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      input.blur();
    }
  });

  dropdown.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) selectSearchResult(li.dataset.country);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-container')) dropdown.classList.remove('open');
  });

  function highlightSearchItem() {
    dropdown.querySelectorAll('li').forEach((li, i) => {
      li.classList.toggle('highlighted', i === state.searchHighlight);
    });
  }

  function selectSearchResult(country) {
    dropdown.classList.remove('open');
    input.value = '';
    input.blur();
    openPanel(country);
  }
}



function initEvents() {

  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(`content-${tab.dataset.tab}`).classList.add('active');
    });
  });


  document.getElementById('btn-close-panel').addEventListener('click', closePanel);


  document.getElementById('btn-share').addEventListener('click', () => {
    if (!state.activeCountry) return;
    const snapshot = getCurrentSnapshot();
    const data = snapshot[state.activeCountry];
    const score = data ? Math.round(data.score) : 0;
    const text = `🌍 ${state.activeCountry} — Activity Score: ${score} | Knowledge Map`;
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied to clipboard!', 'success'),
      () => showToast('Failed to copy', 'error')
    );
  });


  document.getElementById('btn-sync').addEventListener('click', () => syncData());



  // Filter bar
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeCategory = chip.dataset.category;
      renderMap();
    });
  });


  document.getElementById('btn-filter-mobile').addEventListener('click', () => {
    const bar = document.getElementById('filter-bar');
    bar.classList.toggle('show-mobile');
  });








  document.getElementById('ticker-track').addEventListener('click', (e) => {
    const item = e.target.closest('.ticker-item');
    if (!item) return;
    const topic = item.dataset.topic;
    showToast(`Highlighting countries with "${topic}"`, 'info');
  
    const snapshot = getCurrentSnapshot();
    for (const [country, data] of Object.entries(snapshot)) {
      if (data.topics && data.topics[topic]) {
        const layer = state.countryLayers[country];
        if (layer) {
          layer.setStyle({ color: 'rgba(0,122,204,0.7)', weight: 2.5 });
          setTimeout(() => layer.setStyle({ color: 'rgba(0,0,0,0.08)', weight: 0.8 }), 2000);
        }
      }
    }
  });


  document.getElementById('neighbours-list').addEventListener('click', (e) => {
    const item = e.target.closest('.neighbour-item');
    if (item) openPanel(item.dataset.country);
  });


  initDrawerDrag();


  document.addEventListener('keydown', (e) => {

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur();
        document.getElementById('search-dropdown').classList.remove('open');
      }
      return;
    }
    switch (e.key) {
      case '/':
        e.preventDefault();
        document.getElementById('search-input').focus();
        break;
      case 'Escape':
        if (state.panelOpen) closePanel();
        break;
      case 'r':
      case 'R':
        syncData();
        break;
      case 'f':
      case 'F':
        document.getElementById('filter-bar').classList.toggle('hidden');
        break;
    }
  });


  state.map.on('zoomend', () => {
    const snapshot = getCurrentSnapshot();
    updateMarkers(snapshot);
  });
}



function initDrawerDrag() {
  const handle = document.getElementById('panel-drag-handle');
  const panel = document.getElementById('detail-panel');
  let startY = 0, startH = 0, dragging = false;

  handle.addEventListener('touchstart', (e) => {
    dragging = true;
    startY = e.touches[0].clientY;
    startH = panel.offsetHeight;
    panel.style.transition = 'none';
  });

  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dy = startY - e.touches[0].clientY;
    const newH = Math.max(100, Math.min(window.innerHeight * 0.9, startH + dy));
    panel.style.maxHeight = newH + 'px';
  });

  document.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    if (panel.offsetHeight < 150) closePanel();
  });
}



async function syncData() {
  const btn = document.getElementById('btn-sync');
  btn.classList.add('syncing');

  try {
    const articles = await fetchAllSources();
    if (!articles) {
      btn.classList.remove('syncing');
      return;
    }
    const { countryData } = processArticles(articles);
    setSnapshot(countryData);
    state.lastSync = Date.now();
    renderMap();
    updateFreshness();



    showToast('Data synced successfully', 'success');
  } catch (e) {
    console.error('Sync error', e);
    showToast('Sync failed — retrying in 30s', 'error');
    setTimeout(syncData, 30000);
  } finally {
    btn.classList.remove('syncing');
  }
}



document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initSearch();

  setTimeout(() => {
    initEvents();
    syncData();
    state.syncTimer = setInterval(syncData, SYNC_INTERVAL);
    state.freshnessTimer = setInterval(() => {
      updateFreshness();
      updateStats(getCurrentSnapshot());
    }, 15000);
  }, 500);
});
