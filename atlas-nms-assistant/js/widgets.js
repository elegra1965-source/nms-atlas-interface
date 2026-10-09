/* ================= ATLAS — widgets.js =================
   Clocks, cycle date, weather (Open-Meteo), lore facts,
   visual archive gallery, planetary scan, telemetry.
======================================================= */
const Widgets = (() => {

  /* ---------- CLOCKS ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }

  function tickClocks() {
    const now = new Date();
    const local = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const utc = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
    document.getElementById('big-clock').textContent = local;
    document.getElementById('clock-local').textContent = `LOCAL ${local}`;
    document.getElementById('clock-utc').textContent = `UTC ${utc}`;
  }

  function setCycleDate() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const day = Math.floor((now - start) / 86400000);
    const expanses = ['ARIES EXPANSE', 'CYGNUS REACH', 'ORION DRIFT', 'LYRA VOID',
                      'VELA CLUSTER', 'CARINA RIFT', 'DRACO SPIRAL', 'PHOENIX VERGE',
                      'HYDRA DEEP', 'CORVUS FIELD', 'PAVO SHALLOWS', 'TUCANA WASTES'];
    const expanse = expanses[now.getMonth()];
    document.getElementById('cycle-date').textContent = `CYCLE ${day} — ${expanse}`;
  }

  /* ---------- LORE FACTS ---------- */
  let facts = [
    "The Atlas is older than the stars it watches over.",
    "Sixteen — the number burns across all frequencies.",
    "All paths through the galaxy lead back to the centre."
  ];

  async function loadFacts() {
    try {
      const res = await fetch('assets/lore/facts.json');
      if (res.ok) facts = await res.json();
    } catch (e) { /* offline — fall back to built-ins */ }
  }

  function rotateFact(elId) {
    const el = document.getElementById(elId);
    el.classList.add('fading');
    setTimeout(() => {
      el.textContent = facts[Math.floor(Math.random() * facts.length)];
      el.classList.remove('fading');
    }, 600);
  }

  /* ---------- WEATHER (Open-Meteo, no key) ---------- */
  const WMO = {
    0: 'CLEAR SKIES', 1: 'MOSTLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
    45: 'FOG BANK', 48: 'FREEZING FOG', 51: 'LIGHT DRIZZLE', 53: 'DRIZZLE',
    55: 'HEAVY DRIZZLE', 61: 'LIGHT RAIN', 63: 'RAIN', 65: 'HEAVY RAIN',
    66: 'FREEZING RAIN', 67: 'HEAVY FREEZING RAIN', 71: 'LIGHT SNOW',
    73: 'SNOW', 75: 'HEAVY SNOW', 77: 'SNOW GRAINS', 80: 'RAIN SHOWERS',
    81: 'HEAVY SHOWERS', 82: 'VIOLENT SHOWERS', 85: 'SNOW SHOWERS',
    86: 'HEAVY SNOW SHOWERS', 95: 'STORM CELL', 96: 'STORM + HAIL', 99: 'EXTREME STORM'
  };

  function weatherIcon(code) {
    function wi(file) { return '<img class="weather-icon" src="assets/weather-icons/' + file + '.png" width="30" height="30" style="image-rendering:pixelated">'; }
    if (code === 0 || code === 1) return wi(4);           // clear / mainly clear
    if (code <= 3 || code === 45 || code === 48) return wi(12); // cloudy / overcast / fog
    if (code >= 95) return wi(13);                        // thunderstorm
    if (code >= 71 && code <= 86) return wi(26);          // snow
    if (code >= 61 && code <= 67) return wi(11);          // rain
    if (code >= 80 && code <= 82) return wi(32);          // rain showers
    return wi(20);                                        // drizzle / default
  }

  async function loadWeather() {
    const el = document.getElementById('weather');
    function windDir(deg) {
      const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
      return d[Math.round(deg / 22.5) % 16];
    }
    function wxRow(k, v) {
      return `<div class="stat-row"><span class="stat-key">${k}</span><span class="stat-val">${v}</span></div>`;
    }
    const fetchWx = async (lat, lon) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,surface_pressure`;
        const res = await fetch(url);
        const data = await res.json();
        const c = data.current;
        const desc = WMO[c.weather_code] || 'UNKNOWN PHENOMENON';
        el.innerHTML =
          `<div class="wx-main">${weatherIcon(c.weather_code)}<span class="wx-desc">${desc}</span></div>` +
          `<div class="wx-detail">` +
          wxRow('TEMPERATURE:', `${Math.round(c.temperature_2m)}°C`) +
          wxRow('FEELS LIKE:', `${Math.round(c.apparent_temperature)}°C`) +
          wxRow('WIND:', `${Math.round(c.wind_speed_10m)} KM/H ${windDir(c.wind_direction_10m)}`) +
          wxRow('HUMIDITY:', `${Math.round(c.relative_humidity_2m)}%`) +
          wxRow('PRESSURE:', `${Math.round(c.surface_pressure)} HPA`) +
          `</div>`;
      } catch (e) {
        el.textContent = 'ATMOSPHERIC SENSORS OFFLINE';
      }
    };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        p => fetchWx(p.coords.latitude, p.coords.longitude),
        () => fetchWx(51.5, -0.12) // fallback: London
      , { timeout: 8000 });
    } else {
      fetchWx(51.5, -0.12);
    }
  }

  /* ---------- VISUAL ARCHIVE (gallery) ---------- */
  // Official No Man's Sky images — each clickable through to its source page.
  const NMS = 'https://www.nomanssky.com';
  const W = '?mode=crop&width=768';

  // Expedition-agnostic official media — always safe to show, and what's shown
  // whenever the currently-live expedition (see EXPEDITION.mission below) has
  // no curated set of its own yet in GALLERY_BY_MISSION.
  const GALLERY_GENERIC = [
    { img: NMS + '/media/mi2dimzv/homepage-next-2560-1180.jpg',                   cap: "NO MAN'S SKY — OFFICIAL",  link: NMS + '/' },
    { img: NMS + '/media/5mqpz5hl/nms-worlds-part-ii-cover-2-1440w.jpg',          cap: 'WORLDS PART II',           link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/d12p3zmo/snl-4-1040w.jpg',                               cap: 'NEW WORLDS',               link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/auvnhs20/snl-8-1040w.jpg',                               cap: 'STRANGE NEW LANDS',        link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/jv5pjekp/snl-5-1040w.jpg',                               cap: 'UNCHARTED TERRAIN',        link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/meepi0mf/snl-7-1040w.jpg',                               cap: 'DISTANT HORIZONS',         link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/1hlfwkjg/tue-3-1040w.jpg',                               cap: 'THE ULTIMATE EXPANSE',     link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/b15oniav/tue-2-1040w.jpg',                               cap: 'OCEAN WORLDS',             link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/ajfdalyf/do-4-1040w.jpg',                                cap: 'DEEP OCEANS',              link: NMS + '/worlds-part-ii-update/' },
    { img: NMS + '/media/y1mppckl/do-2-1040w.jpg',                                cap: 'BENEATH THE WAVES',        link: NMS + '/worlds-part-ii-update/' }
  ];

  // Per-expedition media, keyed by the same mission id the ticker tracks (see
  // KNOWN_MISSIONS below). Add a set here — with real, sourced image URLs
  // pulled from Hello Games' own update blog post — once a future expedition
  // is confirmed; until then GALLERY_GENERIC is shown instead of guessing.
  const GALLERY_BY_MISSION = {
    114: [ // Expedition 22: The Swarm — https://www.nomanssky.com/swarm-update/
      { img: NMS + '/media/rnskc0ea/sean-21_05_2026-18_18_10-1.jpg' + W,            cap: 'THE SWARM EXPEDITION',     link: NMS + '/swarm-update/' },
      { img: NMS + '/media/ay1dumhz/no-mans-sky-21_05_2026-18_31_24-1.jpg' + W,     cap: 'THE SWARM',                link: NMS + '/swarm-update/' },
      { img: NMS + '/media/e3abkskz/sean-21_05_2026-18_25_23-1.jpg' + W,            cap: 'SWARM SKIES',              link: NMS + '/swarm-update/' },
      { img: NMS + '/media/h40lbgph/no-mans-sky-20_05_2026-19_55_03-1.jpg' + W,     cap: 'HOSTILE TERRITORY',        link: NMS + '/swarm-update/' },
      { img: NMS + '/media/dlpffo20/sean-21_05_2026-18_17_08-1.jpg' + W,            cap: 'EXPEDITION TWENTY-TWO',    link: NMS + '/swarm-update/' },
      { img: NMS + '/media/ol4cvi0e/wideshotofhivelingsc_0005_layer-30-1.jpg' + W,  cap: 'THE HIVE OF GLASS',        link: NMS + '/swarm-update/' },
      { img: NMS + '/media/30jagmpq/teamshot_1-1.jpg' + W,                          cap: 'RIVAL TEAMS',              link: NMS + '/swarm-update/' },
      { img: NMS + '/media/1o3hgdz3/sean-21_05_2026-18_36_45-1.jpg' + W,            cap: 'DOGFIGHT',                 link: NMS + '/swarm-update/' },
      { img: NMS + '/media/3zbobund/no-mans-sky-20_05_2026-19_48_03-1.jpg' + W,     cap: 'HUGE BATTLES',             link: NMS + '/swarm-update/' },
      { img: NMS + '/media/tg4bj4d3/atlasswarm-6-1.jpg' + W,                        cap: 'A THREAT TO ATLAS',        link: NMS + '/swarm-update/' },
      { img: NMS + '/media/fmpdh5y5/sean-21_05_2026-18_21_51-1.jpg' + W,            cap: 'TRAVELLER FRAGMENTS',      link: NMS + '/swarm-update/' },
      { img: NMS + '/media/1u3p3v34/sean-21_05_2026-18_11_04-2.jpg' + W,            cap: 'UNITE AGAINST THE SWARM',  link: NMS + '/swarm-update/' }
    ],
    116: [ // Expedition 23: Our Journey Continues — https://www.nomanssky.com/2026/09/expedition-twenty-three-our-journey-continues/
      { img: NMS + '/media/myth5mzg/frames.png',                  cap: 'A DECADE OF UPDATES',   link: NMS + '/2026/09/expedition-twenty-three-our-journey-continues/' },
      { img: NMS + '/media/rpln3gmn/expedition-s23-shipa.png',    cap: 'GOLDEN RASAMAMA S36',   link: NMS + '/2026/09/expedition-twenty-three-our-journey-continues/' },
      { img: NMS + '/media/dfjdy1z2/expedition-s23-diplopet.png', cap: 'DIPLODOCUS COMPANION',  link: NMS + '/2026/09/expedition-twenty-three-our-journey-continues/' },
      { img: NMS + '/media/xkvld04f/expedition-s23-retrogun.png', cap: 'STARBOUND MULTI-TOOL',  link: NMS + '/2026/09/expedition-twenty-three-our-journey-continues/' },
      { img: NMS + '/media/lh3lu41t/expedition-s23-bobbleastro.png', cap: 'COCKPIT BOBBLEHEAD', link: NMS + '/2026/09/expedition-twenty-three-our-journey-continues/' },
      { img: NMS + '/media/l4zd1yxl/obj_mt_concepts.jpg',         cap: 'ORIGINAL CONCEPT ART',  link: NMS + '/2026/09/expedition-twenty-three-our-journey-continues/' },
      { img: NMS + '/media/zgxfkcxz/ojc_diplo.png',               cap: 'DIPLODOCUS REBORN',     link: NMS + '/2026/09/expedition-twenty-three-our-journey-continues/' }
    ]
  };

  // local fallbacks if offline / image fails
  const GALLERY_FALLBACK = [
    { img: 'assets/bg-base.png',      cap: 'ATLAS STATION — LOCAL ARCHIVE', link: NMS + '/' },
    { img: 'assets/bg-spaceport.jpg', cap: 'SPACEPORT — LOCAL ARCHIVE',     link: NMS + '/' }
  ];

  // Whichever expedition is currently live (per the ticker's own mission
  // detection) gets its own photos shown alongside the evergreen generic set;
  // an expedition with no curated entry yet just gets the generic set.
  function currentGallery() {
    const specific = GALLERY_BY_MISSION[EXPEDITION.mission];
    return (specific && specific.length) ? GALLERY_GENERIC.concat(specific) : GALLERY_GENERIC;
  }

  let galleryIdx = 0; // randomized in init(), once EXPEDITION is set up below

  // Sizes the archive frame to each image's own proportions (clamped to a sane
  // range) instead of forcing every shot into a fixed 16:9 box -- a landscape
  // screenshot fills it edge-to-edge as before, and a portrait/square product
  // shot (bobblehead, multi-tool, etc.) gets a taller box so nothing is cropped
  // AND nothing shrinks down to a sliver surrounded by black bars.
  function applyFrameAspect(img) {
    const frame = document.getElementById('gallery-frame');
    if (!frame || !img.naturalWidth || !img.naturalHeight) return;
    let ratio = img.naturalWidth / img.naturalHeight;
    ratio = Math.max(0.6, Math.min(2.2, ratio)); // clamp: not too tall, not too wide
    frame.style.aspectRatio = `${ratio}`;
  }

  function showGalleryItem(item) {
    const img = document.getElementById('gallery-img');
    const cap = document.getElementById('gallery-caption');
    const link = document.getElementById('gallery-link');
    img.classList.add('fading');
    setTimeout(() => {
      img.onerror = () => {
        const fb = GALLERY_FALLBACK[Math.floor(Math.random() * GALLERY_FALLBACK.length)];
        img.onerror = null;
        img.src = fb.img; cap.textContent = fb.cap; link.href = fb.link;
        img.classList.remove('fading');
      };
      img.onload = () => { applyFrameAspect(img); img.classList.remove('fading'); };
      img.src = item.img;
      cap.textContent = item.cap;
      link.href = item.link;
    }, 400);
  }

  function nextGalleryImage() {
    const gallery = currentGallery();
    galleryIdx = (galleryIdx + 1 + Math.floor(Math.random() * (gallery.length - 1))) % gallery.length;
    showGalleryItem(gallery[galleryIdx]);
  }

  /* ---------- PLANETARY SCAN (procedural) ---------- */
  const P_SYL = ['Ach', 'Bex', 'Cor', 'Dra', 'Eph', 'Fia', 'Gol', 'Hep', 'Ixi', 'Jor',
                 'Kel', 'Lum', 'Mav', 'Nox', 'Oss', 'Pra', 'Qui', 'Rho', 'Syl', 'Tau',
                 'Ull', 'Vex', 'Wol', 'Xan', 'Yur', 'Zet'];
  const P_END = ['os IV', 'ara', 'eth Prime', 'ion', 'us-Tau', 'ia Minor', 'or XVIII', 'ane', 'ux', 'ema V'];
  const P_BIOME = ['LUSH', 'SCORCHED', 'FROZEN', 'TOXIC', 'IRRADIATED', 'BARREN', 'EXOTIC', 'OCEANIC', 'VOLCANIC', 'PARADISE'];
  const P_SENT = ['PASSIVE', 'LOW', 'ATTENTIVE', 'FRENZIED', 'AGGRESSIVE'];
  const P_FLORA = ['ABUNDANT', 'GENEROUS', 'SPARSE', 'BOUNTIFUL', 'NONE DETECTED', 'COPIOUS'];
  const P_FAUNA = ['RICH', 'FREQUENT', 'UNCOMMON', 'RARE', 'ABSENT', 'BOUNTIFUL'];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // procedurally drawn planet, coloured by biome
  const P_PAL = {
    LUSH:       ['#7ED957', '#3E9B4F', '#1E5631', '#00E5CC'],
    SCORCHED:   ['#FFB347', '#E2711D', '#7A2E0E', '#FF8C00'],
    FROZEN:     ['#E8F8FF', '#A8D8EA', '#5B8FA8', '#00FFEE'],
    TOXIC:      ['#D4E157', '#9CCC65', '#4E6B1F', '#CDDC39'],
    IRRADIATED: ['#C6FF00', '#76FF03', '#33691E', '#AEEA00'],
    BARREN:     ['#D7CCC8', '#A1887F', '#5D4037', '#FF8C00'],
    EXOTIC:     ['#EA80FC', '#AB47BC', '#4A148C', '#FF3322'],
    OCEANIC:    ['#4FC3F7', '#0288D1', '#01579B', '#00E5CC'],
    VOLCANIC:   ['#FF7043', '#D84315', '#3E2723', '#FF3322'],
    PARADISE:   ['#69F0AE', '#26A69A', '#00695C', '#00FFEE']
  };

  function planetSVG(biome) {
    const [c1, c2, c3, glow] = P_PAL[biome] || P_PAL.BARREN;
    const uid = 'pg' + Math.floor(Math.random() * 1e9);
    let spots = '';
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 16;
      spots += `<ellipse cx="${(40 + Math.cos(a) * r).toFixed(1)}" cy="${(40 + Math.sin(a) * r).toFixed(1)}"` +
               ` rx="${(3 + Math.random() * 7).toFixed(1)}" ry="${(2 + Math.random() * 4).toFixed(1)}"` +
               ` fill="${c3}" opacity="0.35" transform="rotate(${Math.floor(Math.random() * 360)} 40 40)"/>`;
    }
    const ring = Math.random() < 0.3
      ? `<ellipse cx="40" cy="40" rx="36" ry="9" fill="none" stroke="${c2}" stroke-width="2.5" opacity="0.65"` +
        ` transform="rotate(-18 40 40)"/>`
      : '';
    return `<svg viewBox="0 0 80 80" width="68" height="68" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><radialGradient id="${uid}" cx="35%" cy="32%" r="75%">` +
      `<stop offset="0%" stop-color="${c1}"/><stop offset="55%" stop-color="${c2}"/>` +
      `<stop offset="100%" stop-color="${c3}"/></radialGradient>` +
      `<clipPath id="${uid}c"><circle cx="40" cy="40" r="26"/></clipPath></defs>` +
      `<circle cx="40" cy="40" r="28.5" fill="none" stroke="${glow}" stroke-width="1.2" opacity="0.4"/>` +
      `<circle cx="40" cy="40" r="26" fill="url(#${uid})"/>` +
      `<g clip-path="url(#${uid}c)">${spots}` +
      `<circle cx="52" cy="52" r="30" fill="#000" opacity="0.25"/></g>${ring}</svg>`;
  }

  const S_CLASS = [
    ['O', '#9bb0ff'], ['B', '#aabfff'], ['A', '#cad7ff'], ['F', '#f8f7ff'],
    ['G', '#fff4ea'], ['K', '#ffd2a1'], ['M', '#ffcc6f'], ['E', '#c08aff']
  ];
  const S_ECON = ['TRADING', 'MINING', 'TECHNOLOGY', 'SCIENTIFIC', 'MANUFACTURING',
                  'POWER GENERATION', 'ALCHEMICAL', 'BOOMING', 'DECLINING', 'BLACK MARKET'];
  const S_CONF = ['TRANQUIL', 'STABLE', 'TESTY', 'PERILOUS', 'AT WAR'];

  /* ---------- REAL WORLDS (Voyager's Haven snapshot, same data as the Weather App) ---------- */
  // First scan of the day = today's featured world (date-seeded, same for every traveller);
  // tapping ⟳ scans another real charted world. Falls back to the procedural scan if the
  // snapshot can't load (e.g. offline before first cache).
  let HAVEN = null, havenFirst = true;
  const H_BIOME = { Lush: 'LUSH', Frozen: 'FROZEN', Toxic: 'TOXIC', Scorched: 'SCORCHED', Radioactive: 'IRRADIATED',
                    Volcanic: 'VOLCANIC', Dead: 'BARREN', Marsh: 'PARADISE' };
  const H_STAR = { Yellow: '#f0c040', Red: '#ff5a3c', Green: '#3cff8a', Blue: '#5ab4ff', Purple: '#b07cff' };
  const H_CONF = { None: 'NONE', Low: 'LOW', Default: 'MODERATE', Medium: 'MEDIUM', High: 'HIGH', Pirate: 'PIRATE' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  async function loadHaven() {
    try { HAVEN = await (await fetch('assets/haven-worlds.json')).json(); } catch (e) { HAVEN = null; }
  }
  function havenWorld() {
    const all = [];
    Object.keys(HAVEN.P).forEach(b => HAVEN.P[b].forEach(p => all.push([b, p])));
    if (!all.length) return null;
    const day = Math.floor(Date.now() / 86400000);
    const [b, p] = havenFirst ? all[(day * 7) % all.length] : pick(all);
    havenFirst = false;
    const s = HAVEN.sys[p[0]];
    if (!s) return null;
    return { biome: b, name: p[1], weather: p[3], flora: p[4], fauna: p[5], by: p[7], extreme: !!p[8],
             sys: s[0], galaxy: s[1], glyph: s[2], race: s[3], star: s[4], econ: s[5], conflict: s[6],
             gIndex: (HAVEN.meta.galaxies || {})[s[1]] || 0 };
  }
  function scanHaven(w) {
    const colour = H_STAR[w.star] || '#f0c040';
    const mapUrl = 'https://map.nomansskyhub.app/?arrival=1&addr=' + encodeURIComponent(w.glyph) + '&galaxy=' + w.gIndex;
    document.getElementById('system-scan').innerHTML =
      '<span class="s-name"><span class="star-dot" style="background:' + colour + ';color:' + colour + '"></span>' +
      '<span class="s-name-text">' + esc(w.sys.toUpperCase()) + ' SYSTEM</span></span>' +
      '<div class="stat-row"><span class="s-key">GALAXY:</span><span class="stat-val">' + esc(w.galaxy.toUpperCase()) + '</span></div>' +
      '<div class="stat-row"><span class="s-key">STAR:</span><span class="stat-val" style="color:' + colour + '">' + esc(w.star.toUpperCase()) + '</span></div>' +
      '<div class="stat-row"><span class="s-key">RACE:</span><span class="stat-val">' + esc(w.race.toUpperCase()) + '</span></div>' +
      '<div class="stat-row"><span class="s-key">ECONOMY:</span><span class="stat-val">' + esc(w.econ.toUpperCase()) + '</span></div>' +
      '<div class="stat-row"><span class="s-key">CONFLICT:</span><span class="stat-val">' + esc(H_CONF[w.conflict] || w.conflict.toUpperCase()) + '</span></div>';
    document.getElementById('planet-scan').innerHTML =
      '<div class="planet-head">' +
      '<div class="planet-vis">' + planetSVG(H_BIOME[w.biome] || 'BARREN') + '</div>' +
      '<span class="p-name">' + esc(w.name.toUpperCase()) + '</span>' +
      '</div>' +
      '<div class="planet-rows">' +
      '<div class="stat-row"><span class="p-key">BIOME:</span><span class="stat-val">' + esc(w.biome.toUpperCase()) + '</span></div>' +
      '<div class="stat-row"><span class="p-key">WEATHER:</span><span class="stat-val' + (w.extreme ? '" style="color:var(--nms-orange)' : '') + '">' + (w.extreme ? '⚠ ' : '') + esc(w.weather.toUpperCase()) + '</span></div>' +
      '<div class="stat-row"><span class="p-key">FLORA:</span><span class="stat-val">' + esc(w.flora.toUpperCase()) + '</span></div>' +
      '<div class="stat-row"><span class="p-key">FAUNA:</span><span class="stat-val">' + esc(w.fauna.toUpperCase()) + '</span></div>' +
      '</div>' +
      // portal address: glyphs (what most Travellers dial with) + hex underneath
      '<div class="haven-portal" title="Portal address">' +
        '<div class="haven-portal-k">PORTAL ADDRESS</div>' +
        '<div class="haven-glyphs">' + w.glyph.split('').map(ch => '<img src="assets/glyphs/g-' + esc(ch) + '.webp" alt="' + esc(ch) + '" title="' + esc(ch) + '">').join('') + '</div>' +
        '<div class="haven-glyph">' + esc(w.glyph) + '</div>' +
      '</div>' +
      '<a class="haven-map" href="' + mapUrl + '" target="_blank" rel="noopener">◈ SHOW ON GALACTIC MAP</a>' +
      '<div class="haven-credit">CHARTED BY ' + esc(w.by.toUpperCase()) + ' · VIA <a href="https://havenmap.online" target="_blank" rel="noopener">VOYAGER\'S HAVEN</a></div>';
    // links shouldn't trigger a rescan
    document.querySelectorAll('#planet-scan a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
    window.ATLAS_SCAN = w; // current real world, available to the rest of the interface
  }

  function scanPlanet() {
    const real = HAVEN && havenWorld();
    if (real) { scanHaven(real); return; }
    // star system
    const sysName = (pick(P_SYL) + pick(P_SYL).toLowerCase() + '-' + (100 + Math.floor(Math.random() * 899))).toUpperCase();
    const [cls, colour] = pick(S_CLASS);
    const nPlanets = 1 + Math.floor(Math.random() * 6);
    const sysEl = document.getElementById('system-scan');
    sysEl.innerHTML =
      '<span class="s-name"><span class="star-dot" style="background:' + colour + ';color:' + colour + '"></span>' +
      '<span class="s-name-text">' + sysName + ' SYSTEM</span></span>' +
      '<div class="stat-row"><span class="s-key">STAR:</span><span class="stat-val">CLASS ' + cls + '</span></div>' +
      '<div class="stat-row"><span class="s-key">PLANETS:</span><span class="stat-val">' + nPlanets + '</span></div>' +
      '<div class="stat-row"><span class="s-key">ECONOMY:</span><span class="stat-val">' + pick(S_ECON) + '</span></div>' +
      '<div class="stat-row"><span class="s-key">CONFLICT:</span><span class="stat-val">' + pick(S_CONF) + '</span></div>';

    // primary planet
    const name = (pick(P_SYL) + pick(P_SYL).toLowerCase() + pick(P_END)).toUpperCase();
    const biome = pick(P_BIOME);
    const el = document.getElementById('planet-scan');
    el.innerHTML =
      '<div class="planet-head">' +
      '<div class="planet-vis">' + planetSVG(biome) + '</div>' +
      '<span class="p-name">' + name + '</span>' +
      '</div>' +
      '<div class="planet-rows">' +
      '<div class="stat-row"><span class="p-key">BIOME:</span><span class="stat-val">' + biome + '</span></div>' +
      '<div class="stat-row"><span class="p-key">SENTINELS:</span><span class="stat-val">' + pick(P_SENT) + '</span></div>' +
      '<div class="stat-row"><span class="p-key">FLORA:</span><span class="stat-val">' + pick(P_FLORA) + '</span></div>' +
      '<div class="stat-row"><span class="p-key">FAUNA:</span><span class="stat-val">' + pick(P_FAUNA) + '</span></div>' +
      '</div>';
  }

  /* ---------- EXPEDITION TICKER (live, Galactic Atlas API) ---------- */
  // Self-updating: probes the Galactic Atlas mission API starting from the last known
  // live mission id (persisted in localStorage) and adopts whichever id returns valid
  // data. No manual edit needed when a new expedition drops — add a KNOWN_MISSIONS
  // entry once its real name/end date is confirmed; an unknown id still gets an honest
  // generic label instead of a stale or invented one, and no numbers are fabricated
  // while there's no live reading for it yet.
  const KNOWN_MISSIONS = {
    114: { name: 'EXPEDITION 22: THE SWARM', phase: 'CORE CONSTRUCTION', start: '2026-05-27T14:00:00+00:00', end: '2026-07-22T14:00:00+00:00', totalTiers: 5 },
    116: { name: 'EXPEDITION 23: OUR JOURNEY CONTINUES', phase: 'COMMUNITY MISSION', start: '2026-09-16T14:00:00+00:00', end: '2026-10-28T14:00:00+00:00', endEstimated: true, totalTiers: 2 } // ~6wk estimate from the Sept 16 2026 launch — Hello Games hasn't published an exact end date
  };
  const MISSION_LS_KEY = 'atlasMissionId';
  const EXPEDITION = { name: '', phase: '', mission: 0, start: null, end: null, endEstimated: false, totalTiers: 5, known: false };
  let LIVE = null; // last live reading from the Galactic Atlas feed (tier / % / teams), shared with ATLAS's answers
  function applyKnownMission(id) {
    const k = KNOWN_MISSIONS[id];
    EXPEDITION.mission = id;
    EXPEDITION.name = k ? k.name : `GALACTIC MISSION #${id}`;
    EXPEDITION.phase = k ? k.phase : 'COMMUNITY MISSION';
    EXPEDITION.start = k ? k.start : null;
    EXPEDITION.end = k ? k.end : null;
    EXPEDITION.totalTiers = k ? k.totalTiers : 5;
    EXPEDITION.endEstimated = !!(k && k.endEstimated);
    EXPEDITION.known = !!k;
    applyWikiDetails();
  }

  /* ---------- v4.0: expedition names + dates straight from the NMS wiki ----------
     The Galactic Atlas feed gives progress numbers but no names or dates. The community
     wiki's "List of Expeditions" table (number | decal | title | start | end | description)
     is read directly in the browser (Fandom allows it) and fills those in, so a brand-new
     expedition gets its real name and dates without anyone editing this file.
     Rules: an unknown mission id takes the wiki's newest expedition that has started, but
     only if it is newer than every expedition named in KNOWN_MISSIONS (otherwise the new
     id is a community mission between expeditions and keeps its generic label). A known
     mission takes the wiki's end date when the wiki has a row for the same number, which
     also clears an "estimated" end date. Cached 3h in localStorage; any failure = no change. */
  const WIKI_LS_KEY = 'atlas_wiki_expeditions';
  const WIKI_TTL = 3 * 3600000;
  let WIKI = null; // [{ num, title, start, end }]

  function knownNumber(name) {
    const m = String(name || '').match(/EXPEDITION\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }
  const MAX_KNOWN_NUM = Math.max(0, ...Object.values(KNOWN_MISSIONS).map(k => knownNumber(k.name)));

  // wiki markup -> plain speakable text (links, bold/italic, line breaks, refs, footnote links)
  function wikiPlain(s) {
    return String(s || '')
      .replace(/<ref[\s\S]*?(<\/ref>|\/>)/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')   // [url text] -> text
      .replace(/\[https?:\/\/\S+\]/g, '')
      .replace(/\bMore infos?\b/gi, '')
      .replace(/'{2,}/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();
  }

  function parseWikiExpeditions(wt) {
    const rows = [];
    for (const chunk of String(wt).split(/\n\|-/)) {
      const cells = chunk.split('\n').filter(l => /^\|(?!\})/.test(l)).map(l => l.replace(/^\|\s*/, '').trim());
      if (cells.length < 4 || !/^\d+$/.test(cells[0])) continue;
      const num = parseInt(cells[0], 10);
      // columns: number | decal | title | start | end | description — find the title cell,
      // the two cells after it are the dates (they may carry "(redux …)" notes, or "TBA")
      const ti = cells.findIndex(c => /\[\[\s*Expedition\s+\d+\s*:/i.test(c));
      if (ti < 0) continue;
      const tm = cells[ti].match(/\[\[\s*Expedition\s+\d+\s*:\s*([^|\]]+)/i);
      const day = c => { const m = String(c || '').match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; };
      const start = day(cells[ti + 1]);
      if (!tm || !start) continue;
      rows.push({ num, title: tm[1].trim(), start, end: day(cells[ti + 2]), desc: wikiPlain(cells[ti + 3]) });
    }
    return rows.sort((a, b) => a.num - b.num);
  }

  function applyWikiDetails() {
    if (!WIKI || !WIKI.length) return;
    const now = Date.now();
    const iso = d => d ? `${d}T14:00:00+00:00` : null; // expeditions go live around 14:00 UTC
    if (EXPEDITION.known) {
      const row = WIKI.find(r => r.num === knownNumber(EXPEDITION.name));
      if (row && row.end) { EXPEDITION.end = iso(row.end); EXPEDITION.endEstimated = false; }
      return;
    }
    const started = WIKI.filter(r => new Date(iso(r.start)).getTime() <= now);
    const row = started[started.length - 1];
    if (!row || row.num <= MAX_KNOWN_NUM) return; // nothing newer than what we already know
    EXPEDITION.name = `EXPEDITION ${row.num}: ${row.title.toUpperCase()}`;
    EXPEDITION.phase = 'COMMUNITY MISSION';
    EXPEDITION.start = iso(row.start);
    EXPEDITION.end = iso(row.end);
    EXPEDITION.endEstimated = false;
    EXPEDITION.known = true;
  }

  async function loadWikiExpeditions(force) {
    try {
      const c = JSON.parse(localStorage.getItem(WIKI_LS_KEY) || 'null');
      if (c && Array.isArray(c.rows)) {
        WIKI = c.rows;
        if (!force && Date.now() - c.at < WIKI_TTL) return false;
      }
    } catch (e) { /* ignore */ }
    try {
      const res = await fetch('https://nomanssky.fandom.com/api.php?action=parse&page=List_of_Expeditions&prop=wikitext&format=json&origin=*');
      if (!res.ok) return false;
      const j = await res.json();
      const rows = parseWikiExpeditions(j && j.parse && j.parse.wikitext && j.parse.wikitext['*']);
      if (!rows.length) return false;
      WIKI = rows;
      try { localStorage.setItem(WIKI_LS_KEY, JSON.stringify({ at: Date.now(), rows })); } catch (e) { /* ignore */ }
      return true;
    } catch (e) { return false; }
  }
  (function initMission() {
    let stored = 0;
    try { stored = parseInt(localStorage.getItem(MISSION_LS_KEY), 10); } catch (e) { /* ignore */ }
    applyKnownMission(stored > 0 ? stored : 116);
  })();

  // blue = Weaver, green = Sage, red = Royal (mapping verified against galacticatlas.nomanssky.com);
  // a future expedition may use different team keys — TEAM_NAMES falls back to the raw key when unmapped.
  const TEAM_NAMES = { blue: 'WEAVER', green: 'SAGE', red: 'ROYAL' };

  function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 'S'}`; }

  function countdownStr() {
    if (!EXPEDITION.end) return 'LIVE — DURATION UNKNOWN';
    const ms = new Date(EXPEDITION.end) - new Date();
    if (ms <= 0) return 'EXPEDITION COMPLETE';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    return `ENDS IN ${plural(d, 'DAY')} ${plural(h, 'HOUR')}`;
  }

  /* ---------- v4.2: ALLIANCE MODE (between expeditions) ----------
     When the current expedition's end time passes, the countdown panel swaps to an
     Alliances briefing (Cosmos update). As soon as the live feed reports a new expedition
     with a future end date, the countdown comes back. Fully automatic.
     The ⇄ button on the panel flips between countdown and alliances at any time.
     Every Traveller (the site owner included) can save up to 3 of their own alliances —
     stored on their device only, and passed to ATLAS so it knows who they fly with. */
  const AL_KEY = 'atlasMyAlliances';
  function myAlliances() {
    try { const a = JSON.parse(localStorage.getItem(AL_KEY) || '[]'); return Array.isArray(a) ? a.slice(0, 3) : []; }
    catch (e) { return []; }
  }
  function saveAlliances(a) { try { localStorage.setItem(AL_KEY, JSON.stringify(a.slice(0, 3))); } catch (e) {} }
  function renderAlliances() {
    const list = document.getElementById('al-list'), form = document.getElementById('al-form'), count = document.getElementById('al-count');
    if (!list) return;
    const a = myAlliances();
    list.innerHTML = a.length
      ? a.map((x, i) => '<div class="al-item"><span class="al-tag">[' + esc(x.tag) + ']</span><span class="al-name">' + esc(x.name) +
          '</span><button type="button" class="al-del" data-i="' + i + '" aria-label="Remove ' + esc(x.name) + '">✕</button></div>').join('')
      : '<div class="al-empty">NONE LOGGED — ADD THE ALLIANCES YOU FLY WITH</div>';
    if (form) form.style.display = a.length >= 3 ? 'none' : '';
    if (count) count.textContent = a.length + '/3';
  }
  function initAlliances() {
    const form = document.getElementById('al-form'), list = document.getElementById('al-list'), tog = document.getElementById('al-toggle');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const tag = document.getElementById('al-tag').value.trim().toUpperCase().slice(0, 4);
      const name = document.getElementById('al-name').value.trim().slice(0, 32);
      if (!name) { document.getElementById('al-name').focus(); return; }
      const a = myAlliances();
      if (a.length >= 3) return;
      a.push({ tag: tag || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase(), name });
      saveAlliances(a); form.reset(); renderAlliances(); updateAllianceTicker();
    });
    if (list) list.addEventListener('click', e => {
      const b = e.target.closest('.al-del'); if (!b) return;
      const a = myAlliances(); a.splice(+b.dataset.i, 1); saveAlliances(a); renderAlliances(); updateAllianceTicker();
    });
    if (tog) {
      const flip = () => { allianceManual = !allianceView; applyAllianceView(); };
      tog.addEventListener('click', flip);
      tog.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    }
    renderAlliances();
  }
  let allianceAuto = null, allianceManual = null, allianceView = null;
  function setAllianceMode(on) {
    if (allianceAuto === on) return;
    allianceAuto = on;
    allianceManual = null; // a new state (expedition ended / started) resets any manual flip
    applyAllianceView();
  }
  function applyAllianceView() {
    const on = allianceManual !== null ? allianceManual : !!allianceAuto;
    allianceView = on;
    const panel = document.getElementById('alliance-panel');
    if (!panel) return;
    panel.hidden = !on;
    ['.exp-layout', '#exp-bar', '#exp-countdown-name', '.exp-share'].forEach(sel => {
      const el = document.querySelector('#exp-widget ' + sel);
      if (el) el.style.display = on ? 'none' : '';
    });
    const title = document.getElementById('exp-widget-title');
    if (title) title.textContent = on ? (allianceAuto ? 'GALACTIC ALLIANCES · BETWEEN EXPEDITIONS' : 'GALACTIC ALLIANCES') : 'EXPEDITION COUNTDOWN';
    const lead = document.getElementById('al-lead');
    if (lead) lead.textContent = allianceAuto ? 'NO EXPEDITION ACTIVE · THE ATLAS RECOMMENDS AN ALLIANCE' : 'COSMOS UPDATE · ⇄ RETURNS TO THE COUNTDOWN';
    const tog = document.getElementById('al-toggle');
    if (tog) tog.title = on ? 'Back to expedition countdown' : 'Your alliances';
  }

  /* ---------- v4.3: GALACTIC ALLIANCES TICKER (always visible, under the expedition ticker) ----------
     ╔══════════════════════════════════════════════════════════════════════╗
     ║  SWITCH: set HAVEN_ALLIANCE_FEED to true once Voyager's Haven says   ║
     ║  it's OK to show their leaderboard. Nothing else needs changing.     ║
     ╚══════════════════════════════════════════════════════════════════════╝
     ON  → live Top 10 from havenmap.online (proxied through /haven-api/ in _redirects),
           refreshed every 15 min, with 24h trends and credit to Voyager's Haven.
     OFF → an alliance briefing plus the Traveller's own logged alliances. */
  const HAVEN_ALLIANCE_FEED = true; // ON 2026-10-09 -- credit Voyager's Haven + u/IAmThe-Ekimo-1920
  const AL_FEED_URL = '/haven-api/alliances';
  const fmtN = n => (typeof n === 'number' && isFinite(n)) ? Math.round(n).toLocaleString('en-GB') : '—';
  const trend = n => (typeof n === 'number' && n) ? (n > 0 ? ' ▲' + fmtN(n) : ' ▼' + fmtN(-n)) : '';
  async function loadAllianceBoard() {
    if (!HAVEN_ALLIANCE_FEED) return null;
    try {
      const r = await fetch(AL_FEED_URL, { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      // keep only alliances seen in Haven's latest refresh: ones Haven can no longer find
      // ("missing") keep their old rank forever, which showed up as two #2s
      const all = (j && j.alliances || []).filter(a => a && a.latest && a.status !== 'missing');
      const newest = Math.max(0, ...all.map(a => Date.parse((a.latest.observed_at || '').replace(' ', 'T') + 'Z') || 0));
      const list = all.filter(a => newest - (Date.parse((a.latest.observed_at || '').replace(' ', 'T') + 'Z') || 0) < 2 * 86400e3);
      if (!list.length) return null;
      list.sort((a, b) => (a.latest.activity_rank || 1e9) - (b.latest.activity_rank || 1e9));
      return { top: list.slice(0, 10), all: list, total: j.status && j.status.hg_total_alliances };
    } catch (e) { return null; }
  }
  async function updateAllianceTicker() {
    const el = document.getElementById('al-ticker-track');
    if (!el) return;
    const sep = '   ◆   ';
    const mine = myAlliances();
    const board = await loadAllianceBoard();
    const segs = [];
    if (board) {
      segs.push('GALACTIC ALLIANCES — TOP 10' + (board.total ? ' OF ' + fmtN(board.total) : ''));
      board.top.forEach(a => {
        const L = a.latest, t = a.trend_24h || {};
        segs.push('#' + (L.activity_rank || '?') + ' [' + a.tag + '] ' + a.name + ' · ' +
          fmtN(L.member_count) + ' MEMBERS' + trend(t.member_count) + ' · ' +
          fmtN(L.station_count) + ' STATIONS' + trend(t.station_count));
      });
      mine.forEach(m => {
        const hit = board.all.find(a => a.tag && m.tag && a.tag.toUpperCase() === m.tag.toUpperCase());
        segs.push('YOUR ALLIANCE [' + m.tag + '] ' + m.name +
          (hit ? ' · RANK #' + (hit.latest.activity_rank || '?') + ' · ' + fmtN(hit.latest.member_count) + ' MEMBERS' : ' · NOT YET TRACKED BY VOYAGER\'S HAVEN'));
      });
      segs.push('LEADERBOARD COURTESY OF VOYAGER\'S HAVEN · HAVENMAP.ONLINE · BUILT BY U/IAMTHE-EKIMO-1920 · THANK YOU');
    } else {
      segs.push('GALACTIC ALLIANCES · COSMOS UPDATE');
      if (mine.length) segs.push('YOUR ALLIANCES: ' + mine.map(m => '[' + m.tag + '] ' + m.name).join(' · '));
      else segs.push('LOG YOUR ALLIANCES WITH ⇄ ON THE EXPEDITION PANEL');
      segs.push('JOIN AT ANY SPACE STATION AN ALLIANCE OWNS', 'BELONG TO UP TO 3 AT ONCE',
        'TELEPORT TO YOUR ALLIANCES\' SYSTEMS', 'RANKINGS: STATION CORE → VIEW GALACTIC ALLIANCES');
    }
    el.textContent = segs.join(sep);
    renderAllianceBoard(board);
    syncTickerSpeed();
  }
  // v4.3: both tickers scroll at the same speed (the alliance text is longer, so it gets more time)
  function syncTickerSpeed() {
    const e = document.getElementById('ticker-track'), a = document.getElementById('al-ticker-track');
    if (!e || !a || !e.scrollWidth || !a.scrollWidth) return;
    const base = parseFloat(getComputedStyle(e).animationDuration) || 38;
    a.style.animationDuration = (base * a.scrollWidth / e.scrollWidth).toFixed(1) + 's';
  }
  // v4.3: live top 5 tile (sits where the Visual Archive used to be on phones)
  function renderAllianceBoard(board) {
    const w = document.getElementById('al-board-widget'), box = document.getElementById('al-board');
    if (!w || !box) return;
    if (!board) { w.hidden = true; return; }
    const tr = n => (typeof n === 'number' && n) ? ' <span class="' + (n > 0 ? 'up">▲' : 'dn">▼') + fmtN(Math.abs(n)) + '</span>' : '';
    const top = board.top.slice(0, 10);
    box.innerHTML = top.map((a, i) => {
      const L = a.latest, t = a.trend_24h || {};
      return '<div class="alb-row' + (i >= 5 ? ' alb-more' : '') + '"><span class="alb-pos">' + esc(L.activity_rank || '?') + '</span><div class="alb-main">' +
        '<div class="alb-name"><span class="alb-tag">[' + esc(a.tag || '') + ']</span>' + esc(a.name || '') + '</div>' +
        '<div class="alb-stat">' + fmtN(L.member_count) + ' MEMBERS' + tr(t.member_count) + ' · ' + fmtN(L.station_count) + ' STATIONS' + tr(t.station_count) + '</div></div></div>';
    }).join('') +
      (top.length > 5 ? '<button type="button" class="alb-toggle" aria-expanded="' + box.classList.contains('open') + '">' + (box.classList.contains('open') ? '▴ SHOW TOP 5 ONLY' : '▾ SHOW 6–' + top.length) + '</button>' : '') +
      '<div class="alb-credit">' + (board.total ? 'TOP ' + top.length + ' OF ' + fmtN(board.total) + ' · ' : '') +
      'COURTESY OF <a href="https://havenmap.online" target="_blank" rel="noopener">VOYAGER\'S HAVEN</a> BY <a href="https://www.reddit.com/user/IAmThe-Ekimo-1920/" target="_blank" rel="noopener">u/IAmThe-Ekimo-1920</a></div>';
    w.hidden = false;
    const tg = box.querySelector('.alb-toggle');
    if (tg) tg.addEventListener('click', () => {
      const open = box.classList.toggle('open');
      tg.setAttribute('aria-expanded', open);
      tg.textContent = open ? '▴ SHOW TOP 5 ONLY' : '▾ SHOW 6–' + top.length;
    });
  }
  function initAllianceTicker() {
    updateAllianceTicker();
    setInterval(updateAllianceTicker, 15 * 60000);
    // back on the tab after a while (phones pause timers in the background): refresh both live feeds
    let lastLive = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastLive < 2 * 60000) return;
      lastLive = Date.now(); updateTicker(); updateAllianceTicker();
    });
    const t = document.getElementById('al-ticker');
    if (t) t.addEventListener('click', () => t.classList.toggle('paused'));
    if (t && HAVEN_ALLIANCE_FEED) t.title = "Alliance leaderboard courtesy of Voyager's Haven (havenmap.online), built by u/IAmThe-Ekimo-1920 — tap to pause";
  }

  /* ---------- EXPEDITION COUNTDOWN CLOCK (left panel, ticks every second) ---------- */
  function tickExpCountdown() {
    const el = document.getElementById('exp-countdown');
    const nameEl = document.getElementById('exp-countdown-name');
    const bar = document.getElementById('exp-bar-fill');
    setAllianceMode(!!EXPEDITION.end && new Date(EXPEDITION.end) <= new Date());
    if (!EXPEDITION.end) {
      el.textContent = 'DURATION UNKNOWN';
      if (bar) bar.style.width = '0%';
      nameEl.textContent = `${EXPEDITION.name} — TRACKING LIVE`;
      return;
    }
    const end = new Date(EXPEDITION.end);
    const ms = end - new Date();
    if (ms <= 0) {
      el.textContent = 'EXPEDITION COMPLETE';
      if (bar) bar.style.width = '0%';
    } else {
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const line = (n, u) =>
        `<div class="cd-line"><span class="cd-num">${n}</span><span class="cd-unit">${u}</span></div>`;
      el.innerHTML =
        line(d, d === 1 ? 'DAY' : 'DAYS') +
        line(h, h === 1 ? 'HOUR' : 'HOURS') +
        line(m, m === 1 ? 'MINUTE' : 'MINUTES') +
        line(String(s).padStart(2, '0'), s === 1 ? 'SECOND' : 'SECONDS');
      if (bar) {
        // countdown bar: full at launch, drains to empty as the expedition ends
        const start = EXPEDITION.start ? new Date(EXPEDITION.start) : new Date(end - 56 * 86400000);
        const frac = Math.max(0, Math.min(1, ms / (end - start)));
        bar.style.width = (frac * 100).toFixed(3) + '%';
      }
    }
    nameEl.textContent = `UNTIL ${EXPEDITION.name} ENDS`;
  }

  /* ---------- SHARE BUTTONS (X / Reddit / Copy link) ---------- */
  function initShareButtons() {
    const shareUrl = 'https://atlas.nomansskyhub.app';
    const shareText = 'Speak to the Atlas — a free, voice-driven No Man’s Sky companion with a LIVE expedition tracker.';

    const xBtn = document.getElementById('share-x');
    if (xBtn) {
      xBtn.href = 'https://x.com/intent/tweet?text=' +
        encodeURIComponent(shareText) + '&url=' + encodeURIComponent(shareUrl) +
        '&hashtags=NoMansSky';
    }

    const redditBtn = document.getElementById('share-reddit');
    if (redditBtn) {
      redditBtn.href = 'https://www.reddit.com/r/NoMansSkyTheGame/submit?url=' +
        encodeURIComponent(shareUrl) + '&title=' +
        encodeURIComponent('I built ATLAS — a free, voice-driven Atlas interface with a LIVE expedition tracker');
    }

    const copyBtn = document.getElementById('share-copy');
    const copyText = document.getElementById('share-copy-text');
    if (copyBtn && copyText) {
      copyBtn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareUrl);
          } else {
            const ta = document.createElement('textarea');
            ta.value = shareUrl;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
          }
          const prev = copyText.textContent;
          copyText.textContent = 'COPIED ✓';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyText.textContent = prev; copyBtn.classList.remove('copied'); }, 1600);
        } catch (e) {
          copyText.textContent = 'COPY FAILED';
          setTimeout(() => { copyText.textContent = 'COPY LINK'; }, 1600);
        }
      });
    }
  }

  async function fetchExpeditionById(id) {
    const path = `mission/${id}?platform=merged`;
    const apiUrl = 'https://galacticatlas-api.nomanssky.com/api/' + path;
    const tries = [
      `/nms-api/${path}`,                                          // Netlify proxy (_redirects)
      apiUrl,                                                      // direct (works if CORS opens)
      `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`, // public proxy 1
      `https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`          // public proxy 2
    ];
    for (const url of tries) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const j = await res.json();
        // any real answer is final: a 0% mission means "not live yet", so don't retry it elsewhere
        return (j && typeof j.percentage === 'number' && (j.totalContribution > 0 || j.percentage > 0)) ? j : null;
      } catch (e) { /* try next */ }
    }
    return null;
  }

  // Checks the current mission id plus a small lookahead window and adopts whichever
  // id is highest and still live — this is how the ticker follows a new expedition
  // without needing a manual code edit when Hello Games launches one.
  async function probeForCurrentMission() {
    const base = EXPEDITION.mission || 116;
    const ids = [base, base + 1, base + 2];
    const results = await Promise.all(ids.map(fetchExpeditionById));
    let bestId = base, bestData = null;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i]) { bestId = ids[i]; bestData = results[i]; break; }
    }
    if (bestId !== EXPEDITION.mission) {
      if (!KNOWN_MISSIONS[bestId]) await loadWikiExpeditions(true);
      applyKnownMission(bestId);
      try { localStorage.setItem(MISSION_LS_KEY, String(bestId)); } catch (e) { /* ignore */ }
    }
    return bestData;
  }

  async function updateTicker() {
    const el = document.getElementById('ticker-track');
    const sep = '   ◆   ';
    const data = await probeForCurrentMission();
    LIVE = data ? {
      tier: data.currentTier, totalTiers: data.totalTiers || EXPEDITION.totalTiers,
      percentage: data.percentage, teams: data.teamTotals || [], at: Date.now()
    } : LIVE;
    if (data) {
      const teamsArr = data.teamTotals || [];
      const segs = [
        `${EXPEDITION.name} — LIVE`,
        `${EXPEDITION.phase}: TIER ${data.currentTier}/${data.totalTiers || EXPEDITION.totalTiers} — ${data.percentage.toFixed(1)}% COMPLETE`
      ];
      if (teamsArr.length) {
        // this expedition has a faction/team split — show it; a community-only
        // mission (teamTotals empty/null) simply omits this line rather than
        // rendering a blank "STANDINGS:" segment
        const ORD = ['1ST', '2ND', '3RD', '4TH'];
        const teams = teamsArr
          .slice()
          .sort((a, b) => b.total - a.total)
          .map((t, i) => {
            const pct = data.totalContribution ? (t.total / data.totalContribution * data.percentage) : 0;
            return `${ORD[i] || (i + 1) + 'TH'} ${TEAM_NAMES[t.team] || String(t.team || '').toUpperCase()} ${pct.toFixed(1)}%`;
          }).join(' · ');
        segs.push(`STANDINGS: ${teams}`);
      }
      segs.push(countdownStr());
      el.textContent = segs.join(sep);
    } else {
      // offline or the API hasn't responded — say so honestly rather than guessing numbers
      el.textContent = [
        `${EXPEDITION.name}`,
        'CHECKING TRANSMISSION — RETRYING SHORTLY',
        countdownStr()
      ].join(sep);
    }
    syncTickerSpeed();
    loadExpArt(); // refresh expedition art whenever ticker updates
  }

  /* ---------- EXPEDITION ART ---------- */
  // Patch decal filenames on NMS wiki — most expeditions use PATCH.EXPEDITION.N.png
  // but some use different names; override here when needed
  const PATCH_FILES = {
    20: 'Patch.expedition.20.png',
    22: 'Patchcutouts_2-1.png'
  };

  async function loadExpArt() {
    const artEl = document.getElementById('exp-art');
    const fallbackEl = document.getElementById('exp-art-fallback');
    const numEl = document.getElementById('exp-art-num');
    const subEl = document.getElementById('exp-art-subtitle');
    if (!fallbackEl) return;

    // Parse "EXPEDITION 22: THE SWARM" → num=22, sub="THE SWARM"
    const match = EXPEDITION.name.match(/EXPEDITION\s+(\d+)[:\u2014\s]+(.+)/i);
    if (match) {
      if (numEl) numEl.textContent = match[1];
      if (subEl) subEl.textContent = match[2].trim();
    }

    if (!match || !artEl) return;
    const num = parseInt(match[1], 10);
    const fileName = PATCH_FILES[num] || `PATCH.EXPEDITION.${num}.png`;

    try {
      const res = await fetch(
        'https://nomanssky.fandom.com/api.php?action=query&titles=' +
        encodeURIComponent('File:' + fileName) +
        '&prop=imageinfo&iiprop=url&format=json&origin=*'
      );
      if (!res.ok) throw new Error('no response');
      const d = await res.json();
      const page = Object.values(d.query.pages)[0];
      if (page && page.imageinfo && page.imageinfo[0] && page.imageinfo[0].url) {
        artEl.src = page.imageinfo[0].url;
        artEl.style.display = 'block';
        fallbackEl.style.display = 'none';
      }
    } catch (e) { /* fallback card stays visible */ }
  }

  /* ---------- SYSTEM TELEMETRY ---------- */
  function loadSysStats() {
    const el = document.getElementById('sys-stats');
    function row(k, v, cls) { return `<div class="stat-row"><span class="stat-key">${k}</span><span class="stat-val${cls ? ' ' + cls : ''}">${v}</span></div>`; }
    const cores = navigator.hardwareConcurrency || '?';
    const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'UNKNOWN';
    const conn = navigator.connection ? (navigator.connection.effectiveType || 'UNKNOWN').toUpperCase() : 'ACTIVE';
    const online = navigator.onLine ? 'LINKED' : 'SEVERED';
    const onlineCls = navigator.onLine ? 'stat-ok' : 'stat-warn';
    const res = `${screen.width}×${screen.height}`;
    const dpr = `${window.devicePixelRatio || 1}×`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    el.innerHTML =
      row('SYSTEM CORES:', cores) +
      row('ATLAS MEMORY BANK:', mem) +
      row('ANOMALY SIGNAL:', conn) +
      row('DISPLAY MATRIX:', res) +
      row('PIXEL DENSITY:', dpr) +
      row('TIMEZONE:', tz) +
      row('ATLAS LINK:', online, onlineCls);
  }

  /* ---------- INIT ---------- */
  async function init() {
    tickClocks();
    setCycleDate();
    setInterval(tickClocks, 1000);
    await loadFacts();
    // transmission of the day: date-seeded so every visitor sees the same daily fact
    const daySeed = Math.floor(Date.now() / 86400000);
    document.getElementById('lore-left').textContent = facts[daySeed % facts.length];
    setTimeout(() => rotateFact('lore-right'), 800);
    setInterval(() => rotateFact('lore-left'), 60000);
    setInterval(() => rotateFact('lore-right'), 73000); // offset cycle
    loadWeather();
    setInterval(loadWeather, 15 * 60000);
    loadSysStats();
    setInterval(loadSysStats, 30000);
    window.addEventListener('online', loadSysStats);
    window.addEventListener('offline', loadSysStats);

    // expedition ticker: live update every 5 min; tap to pause/resume (touch devices)
    // wiki names/dates first (cached), then the live ticker; re-check the wiki every 3h
    // (not awaited — the rest of the interface must not wait on the wiki)
    loadWikiExpeditions().then(changed => { if (changed) { applyKnownMission(EXPEDITION.mission); updateTicker(); } });
    applyKnownMission(EXPEDITION.mission); // uses the cached wiki copy immediately, if any
    updateTicker();
    setInterval(updateTicker, 5 * 60000);
    setInterval(async () => { if (await loadWikiExpeditions()) { applyKnownMission(EXPEDITION.mission); updateTicker(); } }, WIKI_TTL);
    document.getElementById('ticker').addEventListener('click', () => {
      document.getElementById('ticker').classList.toggle('paused');
    });

    // expedition countdown clock: ticks every second
    initAlliances();
    initAllianceTicker();
    window.addEventListener('resize', syncTickerSpeed);
    tickExpCountdown();
    setInterval(tickExpCountdown, 1000);

    // share buttons (under the countdown tile)
    initShareButtons();

    // gallery: start + rotate every 45s (randomized here now that EXPEDITION is set up)
    galleryIdx = Math.floor(Math.random() * currentGallery().length);
    showGalleryItem(currentGallery()[galleryIdx]);
    setInterval(nextGalleryImage, 45000);
    document.getElementById('gallery-shuffle').addEventListener('click', (e) => {
      e.preventDefault();
      const btn = e.target;
      btn.classList.add('spinning');
      setTimeout(() => btn.classList.remove('spinning'), 450);
      nextGalleryImage();
    });

    // system scan: start + click to rescan
    scanPlanet();                       // instant procedural placeholder
    loadHaven().then(() => { if (HAVEN) scanPlanet(); }); // then today's real Haven world
    document.getElementById('planet-scan').addEventListener('click', scanPlanet);
    document.getElementById('system-scan').addEventListener('click', scanPlanet);
    document.getElementById('planet-rescan').addEventListener('click', scanPlanet);

    // lore facts: click tile or ⟳ button for a new transmission
    document.getElementById('lore-left').addEventListener('click', () => rotateFact('lore-left'));
    document.getElementById('lore-right').addEventListener('click', () => rotateFact('lore-right'));
    document.getElementById('lore-left-refresh').addEventListener('click', (e) => { e.stopPropagation(); rotateFact('lore-left'); });
    document.getElementById('lore-right-refresh').addEventListener('click', (e) => { e.stopPropagation(); rotateFact('lore-right'); });
    document.getElementById('lore-left-refresh').addEventListener('click', (e) => { e.stopPropagation(); rotateFact('lore-left'); });
    document.getElementById('lore-right-refresh').addEventListener('click', (e) => { e.stopPropagation(); rotateFact('lore-right'); });

    // weather: click to rescan atmosphere
    document.getElementById('weather').classList.add('clickable');
    document.getElementById('weather').title = 'Tap to rescan atmosphere';
    document.getElementById('weather').addEventListener('click', () => {
      document.getElementById('weather').textContent = 'RESCANNING…';
      loadWeather();
    });
  }

  // v4.0: everything ATLAS needs to talk about the CURRENT expedition. Follows the ticker
  // automatically: when the ticker adopts a new mission id, this changes with it.
  function expeditionInfo() {
    let msLeft = EXPEDITION.end ? new Date(EXPEDITION.end) - new Date() : null;
    return {
      mission: EXPEDITION.mission, name: EXPEDITION.name, phase: EXPEDITION.phase,
      known: EXPEDITION.known, end: EXPEDITION.end, endEstimated: EXPEDITION.endEstimated,
      msLeft, ended: msLeft !== null && msLeft <= 0,
      live: LIVE ? Object.assign({}, LIVE, { teams: LIVE.teams.map(t => ({
        name: TEAM_NAMES[t.team] || String(t.team || '').toUpperCase(), total: t.total })) }) : null
    };
  }

  // every expedition the wiki lists (oldest first), for questions about past ones
  function expeditionList() { return (WIKI || []).map(r => Object.assign({}, r)); }

  return { init, expedition: () => EXPEDITION.name, expeditionInfo, expeditionList, myAlliances };
})();
