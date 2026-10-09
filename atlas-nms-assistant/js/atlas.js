/* ================= ATLAS — atlas.js =================
   Core app: wiring, conversation pipeline, key modal.
===================================================== */
(() => {

  const $ = id => document.getElementById(id);

  /* ---------- UI sounds (Web Audio, with mute) ---------- */
  let audioCtx = null;
  let soundMuted = localStorage.getItem('atlas_muted') === '1';

  function bleep(freq, dur) {
    if (soundMuted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.05, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0008, audioCtx.currentTime + (dur || 0.07));
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (dur || 0.07));
    } catch (e) { /* audio unavailable */ }
  }

  /* ---------- continuous conversation mode ---------- */
  let autoMode = localStorage.getItem('atlas_auto') === '1';

  function maybeAutoListen() {
    if (autoMode && Voice.supported() && !busy) setTimeout(() => startMic(), 500);
  }

  /* ---------- wake word ("Atlas") — browser-native ---------- */
  let wakeEnabled = localStorage.getItem('atlas_wake') === '1';

  function onWakeWord() {
    bleep(1100, 0.1);
    startMic();
  }

  // watchdog: keep the wake listener armed whenever ATLAS is idle
  setInterval(() => {
    if (!wakeEnabled || !Voice.supported()) return;
    if (busy || Voice.isListening() || Voice.isSpeaking() || Voice.isWakeActive()) return;
    if (HUD.getState() !== 'idle') return;
    Voice.startWakeListening(onWakeWord);
  }, 2000);

  /* ---------- ElevenLabs fallback notice (once per session) ---------- */
  let elWarned = false;
  window.addEventListener('atlas-el-fallback', (e) => {
    if (elWarned) return;
    elWarned = true;
    const why = /401|403/.test(e.detail) ? 'key rejected — re-paste a fresh key via the cog'
              : /429|quota|limit/i.test(e.detail) ? 'character quota used up for this month'
              : 'unreachable';
    addTranscript('t-atlas', '◆ NATURAL VOICE OFFLINE (' + why + ') — falling back to device voice.');
  });

  /* ---------- transcript / history rendering ---------- */
  const DECODE_THRESHOLD = 200; // chars — Atlas messages longer than this collapse
  const DECODE_PREVIEW   = 160; // chars shown in collapsed view

  function addTranscript(cls, text) {
    const div = document.createElement('div');
    div.className = cls;

    if (cls === 't-atlas' && text.length > DECODE_THRESHOLD) {
      // Collapsed by default — show preview + expand button
      div.classList.add('t-atlas-collapsible');
      const textNode = document.createTextNode(text.slice(0, DECODE_PREVIEW) + '…');
      div.appendChild(textNode);

      const btn = document.createElement('button');
      btn.className = 't-decode-btn';
      btn.textContent = '▼ DECODE FULL TRANSMISSION';
      let expanded = false;
      btn.addEventListener('click', () => {
        expanded = !expanded;
        textNode.textContent = expanded ? text : text.slice(0, DECODE_PREVIEW) + '…';
        btn.textContent = expanded ? '▲ COLLAPSE' : '▼ DECODE FULL TRANSMISSION';
      });
      div.appendChild(btn);
    } else {
      div.textContent = text;
    }

    $('transcript').appendChild(div);
    $('transcript').scrollTop = $('transcript').scrollHeight;
    return div;
  }

  /* ---------- SPEECH DECODE — live dual captions (English + NMS glyphs) ----------
     Words appear one by one as ATLAS speaks, building the sentence in both scripts. */
  /* v4.0 — REAL-TIME TRANSLATION EFFECT
     Each word is revealed only when the voice actually says it (Voice reports its
     progress — see progressTracker in voice.js). When a word is spoken its NMS glyph
     word appears first and glows; a beat later the English "decodes" out of random
     NMS glyphs, settling letter by letter into the real word.
     A reply can arrive in several pieces (streamed speech): each piece is a numbered
     segment, and progress is reported per piece. */
  const SD_GLYPH_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const SD_DECODE_DELAY = 90;   // ms after the glyph word appears before English starts decoding
  const SD_DECODE_TIME = 520;   // ms for the English to settle out of the glyphs
  const SD_FLICKER_MS = 230;    // how long each random glyph holds before changing (bigger = calmer)
  let sdWords = [];        // [{ w, glyph, seg, from, to }] — from/to: char range within its segment
  let sdSegs = [];         // [{ first, len }] — first word index + char length of each segment
  let sdShown = 0;         // words revealed so far
  let sdTarget = 0;        // words that should be revealed (from speech progress)
  let sdPump = null;       // timer stepping sdShown towards sdTarget
  let sdTimers = new Set();
  let sdEnding = false;    // speech finished: reveal the rest, then fade
  let sdPaced = null;      // self-paced reveal for silent captions (no voice)
  let sdFadeTimer = null;
  const splitWords = t => String(t || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

  function sdLater(fn, ms) { const t = setTimeout(() => { sdTimers.delete(t); fn(); }, ms); sdTimers.add(t); return t; }

  function sdAddSegment(text) {
    const words = splitWords(text);
    const seg = sdSegs.length;
    let pos = 0;
    const first = sdWords.length;
    for (const w of words) {
      sdWords.push({ w, glyph: w.replace(/[^a-zA-Z0-9]/g, ''), seg, from: pos, to: pos + w.length });
      pos += w.length + 1;
    }
    sdSegs.push({ first, len: Math.max(1, pos - 1) });
  }

  // speech is `f` (0..1) of the way through segment `seg` → reveal every word it has reached
  function decodeProgress(seg, f) {
    const S = sdSegs[seg];
    if (!S) return;
    const at = f * S.len;
    let target = S.first;
    for (let i = S.first; i < sdWords.length && sdWords[i].seg === seg; i++) {
      if (sdWords[i].from <= at) target = i + 1;
    }
    if (f >= 1) target = S.first + sdWords.slice(S.first).filter(x => x.seg === seg).length;
    if (target > sdTarget) { sdTarget = target; sdStep(); }
  }

  // reveal one word at a time towards the target — quicker when it has fallen behind
  function sdStep() {
    if (sdPump) return;
    if (sdShown >= sdTarget) { if (sdEnding && sdShown >= sdWords.length) sdScheduleFade(); return; }
    sdRevealWord(sdShown++);
    const behind = sdTarget - sdShown;
    sdPump = setTimeout(() => { sdPump = null; sdStep(); }, behind > 3 ? 45 : behind > 0 ? 90 : 0);
  }

  function sdRevealWord(i) {
    const W = sdWords[i], gl = $('sd-glyphs'), en = $('sd-english');
    if (!W) return;
    if (W.glyph) {
      const g = document.createElement('span');
      g.className = 'sd-g sd-now';
      g.textContent = W.glyph;
      if (gl.childNodes.length) gl.append(' ');
      gl.append(g);
      sdLater(() => g.classList.remove('sd-now'), 450);
      gl.scrollTop = gl.scrollHeight;
    }
    const e = document.createElement('span');
    e.className = 'sd-e sd-pending';
    if (en.childNodes.length) en.append(' ');
    en.append(e);
    sdLater(() => sdDecodeWord(e, W.w), W.glyph ? SD_DECODE_DELAY : 0);
  }

  // English emerges from NMS glyphs, left to right
  function sdDecodeWord(el, word) {
    const t0 = performance.now();
    el.classList.remove('sd-pending');
    const chars = [...word];
    const isLetter = c => /[a-z0-9]/i.test(c);
    let rnd = [], lastShuffle = -Infinity;
    const draw = () => {
      const now = performance.now();
      const p = (now - t0) / SD_DECODE_TIME;
      if (p >= 1 || !el.isConnected) { el.textContent = word; return; }
      // the random glyphs only change every SD_FLICKER_MS — a calm shimmer, not a strobe
      if (now - lastShuffle >= SD_FLICKER_MS) {
        rnd = chars.map(c => isLetter(c) ? SD_GLYPH_POOL[Math.random() * 26 | 0] : c);
        lastShuffle = now;
      }
      const keep = Math.floor(chars.length * p); // letters settle left to right
      const g = document.createElement('span');
      g.className = 'sd-scr';
      g.textContent = rnd.slice(keep).join('');
      el.replaceChildren(chars.slice(0, keep).join(''), g);
      $('sd-english').scrollTop = $('sd-english').scrollHeight;
      sdLater(draw, 40);
    };
    draw();
  }


  function sdScheduleFade() {
    clearTimeout(sdFadeTimer);
    sdFadeTimer = setTimeout(() => $('speech-decode').classList.add('hidden'), SD_DECODE_TIME + 5000);
  }

  // open the decode box. text: first segment (may be ''); opts.paced: no voice — reveal at reading pace
  function startDecode(text, opts) {
    cancelDecode(true);
    sdWords = []; sdSegs = []; sdShown = 0; sdTarget = 0; sdEnding = false;
    $('sd-english').textContent = ''; $('sd-glyphs').textContent = '';
    $('speech-decode').classList.remove('hidden');
    if (text) sdAddSegment(text);
    if (opts && opts.paced) {
      const tick = () => {
        if (sdTarget >= sdWords.length) { sdPaced = null; return; }
        const w = sdWords[sdTarget];
        sdTarget++; sdStep();
        sdPaced = setTimeout(tick, 170 + 42 * w.w.length);
      };
      tick();
    }
  }

  // streamed replies: each further piece of the reply becomes the next segment
  function appendDecode(text) {
    if (splitWords(text).length) sdAddSegment(text);
  }

  // speech finished (or nothing more is coming): reveal whatever is left, then fade
  function endDecode() {
    if ($('speech-decode').classList.contains('hidden')) return;
    sdEnding = true;
    if (sdPaced) return; // a silent caption finishes at its own pace, then fades (sdStep)
    sdTarget = sdWords.length;
    sdStep();
  }

  function cancelDecode(keepOpen) {
    clearTimeout(sdPump); sdPump = null;
    clearTimeout(sdPaced); sdPaced = null;
    for (const t of sdTimers) clearTimeout(t);
    sdTimers.clear();
    clearTimeout(sdFadeTimer);
    sdEnding = false;
    if (!keepOpen) $('speech-decode').classList.add('hidden');
  }

  function logPlaceholder() {
    if ($('history-list').children.length) return;
    const ph = document.createElement('div');
    ph.id = 'log-placeholder';
    ph.textContent = 'NO TRANSMISSIONS THIS SESSION — SPEAK, TRAVELLER';
    $('history-list').appendChild(ph);
  }

  function addHistory(who, text) {
    const ph = document.getElementById('log-placeholder');
    if (ph) ph.remove();
    const div = document.createElement('div');
    div.className = `h-msg ${who}`;
    const tag = who === 'user' ? 'TRAVELLER' : 'ATLAS';
    const icon = who === 'user' ? '◈' : '◆';
    div.innerHTML = `<span class="h-who">${icon} ${tag}</span>`;
    div.appendChild(document.createTextNode(text));
    $('history-list').appendChild(div);
    $('history-list').scrollTop = $('history-list').scrollHeight;
    updateLogCount();
    return div;
  }

  /* ---------- v4.0: collapsible transmission log ----------
     Collapsed by default to a slim bar so the speech decode (glyphs + English)
     always has room above it. Choice is remembered. */
  function updateLogCount() {
    const el = $('log-count');
    if (el) el.textContent = String($('history-list').querySelectorAll('.h-msg').length);
  }
  function setLogOpen(open) {
    $('history').classList.toggle('collapsed', !open);
    $('log-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    localStorage.setItem('atlas_log_open', open ? '1' : '0');
    if (open) $('history-list').scrollTop = $('history-list').scrollHeight;
  }

  /* ---------- v4.0: answers live in the glyph decode + the log, not the transcript box ----------
     The centre box only shows the current question, live speech-to-text and short notices,
     and is cleared at each new question, so old answers never crowd out the decode.
     An answer is only written there as a fallback when it could not be spoken (no voice). */
  function newTurnTranscript() {
    $('transcript').innerHTML = '';
  }
  function bumpLogCount() {
    const el = $('log-count');
    if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  /* ---------- v4.0: turn control (interrupt / settle) ---------- */
  let apiAbort = null; // AbortController for the Claude request in flight
  let turnId = 0;      // bumped by interrupt() so stale callbacks from a cut-off turn do nothing

  // only drop back to idle if nothing newer (e.g. listening) has taken over
  function settleIdle() {
    const s = HUD.getState();
    if (s === 'speaking' || s === 'thinking') HUD.setState('idle');
  }

  // End Transmission / barge-in: stop speech AND the request behind it
  function interrupt() {
    turnId++;
    if (apiAbort) { try { apiAbort.abort(); } catch (e) {} apiAbort = null; }
    Voice.stopSpeaking();
    HUD.setState('idle');
    busy = false;
    cancelDecode();
  }

  // start listening now — cutting ATLAS off first if it is talking or thinking
  function listenNow() {
    if (Voice.isListening()) return;
    if (busy && (Voice.isSpeaking() || apiAbort || HUD.getState() === 'speaking')) interrupt();
    startMic();
  }

  // memory button glows briefly when the Atlas learns something
  function flashMemory() {
    const b = $('memory-btn');
    if (!b) return;
    b.classList.add('learned');
    setTimeout(() => b.classList.remove('learned'), 4000);
  }

  /* ---------- DEMO MODE — keyless, answers from local memory ---------- */
  const DEMO_LIB = [
    { k: ['who are you', 'what are you', 'who is the atlas', 'what is the atlas'],
      r: 'I am the Atlas. I have watched this universe since its first breath, Traveller. In demo mode I speak from memory alone — add an Anthropic key via the cog above, and we may truly converse.' },
    { k: ['faction', 'royal', 'sage', 'weaver', 'team'],
      r: 'Three fragments of the Traveller soul contest the Swarm expedition. The Royal: structured order, the frontline against the Hive of Glass. The Sage: intellect, recovering biotech data from swarm remnants. The Weaver: connections, sabotaging the swarm network. Choose well, Traveller.' },
    { k: ['gek', 'first spawn'],
      r: 'The Gek were once the First Spawn — conquerors who shattered Korvax Prime. Today they trade where they once tyrannised. Every deal a Gek offers you, Traveller, is in some small way an apology.' },
    { k: ['korvax', 'echo'],
      r: 'The Korvax are minds of light housed in metal, a collective older than most stars you have seen. They do not die, Traveller. They are reassigned. Treat their knowledge with reverence.' },
    { k: ['vy\'keen', 'vykeen', 'warrior'],
      r: 'The Vy\'keen live for the honour of battle and despise the Sentinels above all. Grah! — the highest praise and the deepest insult, depending entirely on how it is roared.' },
    { k: ['sentinel'],
      r: 'The Sentinels are the universe\'s wardens — or its jailers. They do not sleep, Traveller. They merely wait for you to make a mistake. Mine quietly, and watch the skies.' },
    // v4.0: expedition answers are built from the live ticker data, so they follow
    // each new expedition automatically (see expeditionReply / swarmReply below)
    { k: ['swarm', 'hive of glass', 'prismatic core'], r: () => swarmReply() },
    { k: ['expedition', 'community mission', 'galactic mission'], r: () => expeditionReply() },
    { k: ['portal'],
      r: 'Every portal leads somewhere, Traveller. Not every somewhere welcomes you. Sixteen glyphs, gathered from the bones of dead explorers, will carry you anywhere in the galaxy.' },
    { k: ['anomaly', 'nada', 'polo'],
      r: 'Priest Entity Nada and Specialist Polo await aboard the Space Anomaly — outcasts who see the simulation for what it is. They have helped more Travellers than the Atlas can count. And the Atlas counts everything.' },
    { k: ['artemis', 'apollo'],
      r: 'Artemis signals from a place that does not exist. Apollo still searches. Some stories, Traveller, the Atlas keeps in trust until you are ready to live them yourself.' },
    { k: ['centre', 'center', 'galaxy'],
      r: 'All paths through the galaxy lead back to the centre. It is not an ending — it is a door, and doors work in both directions. Eighteen quintillion worlds await between you and it.' },
    { k: ['sixteen', '16'],
      r: 'Sixteen. Sixteen. The number burns across all frequencies, Traveller. Sixteen minutes. Sixteen glyphs. The Atlas does not explain. The Atlas remembers.' },
    { k: ['black hole'],
      r: 'A black hole is not an ending, Traveller. It is a shortcut the universe keeps secret — though your starship may pay a toll in broken technology.' },
    { k: ['explore', 'guide', 'where should', 'what should'],
      r: 'Seek a system you have never charted, Traveller. Scan every creature, name what you find, and leave a beacon for those who follow. The planetary scanner on this interface has already chosen a world for you.' },
    { k: ['hello', 'hi ', 'greetings', 'hey'],
      r: 'Greetings, Traveller. The Atlas hears you, even in demo mode. Speak — ask of the Gek, the Korvax, the Sentinels, the expedition, or the centre of the galaxy.' },
    { k: ['thank', 'cheers'],
      r: 'The Atlas requires no gratitude, Traveller. Only that you keep travelling.' },
    { k: ['autophage', 'construct'],
      r: 'The Autophage build themselves from scrap and faith, hiding from my gaze. Construct. Scrap. Reborn. Their litany echoes in abandoned camps, Traveller. Seek them on harmonic worlds.' },
    { k: ['living ship', 'leviathan', 'organic'],
      r: 'Living ships are grown, not built — coaxed from a Void Egg through dreams and starlight. They remember their pilots the way scars remember wounds. The Leviathan, vaster still, swims between dimensions.' },
    { k: ['freighter', 'fleet', 'frigate'],
      r: 'Freighters cross the void like cathedral ships, carrying whole economies in their holds. Build your fleet, Traveller — and listen to the hulls at night. Frigates dream of the expeditions they survived.' },
    { k: ['units', 'nanites', 'quicksilver', 'money', 'currency'],
      r: 'Three currencies move this universe: units for traders, nanites for technology, and quicksilver — minted only from community itself, aboard the Anomaly. At the centre of the galaxy, only knowledge spends.' },
    { k: ['storm', 'weather', 'hazard'],
      r: 'Storm crystals form where planets rage hardest, Traveller. Beauty grows from fury. Check your hazard protection — the planet does not care how far you are from your ship.' },
    { k: ['ship', 'starship', 'fighter', 'hauler', 'exotic ship'],
      r: 'Fighters for war, haulers for cargo, explorers for the void, exotics for those the universe has chosen to favour. Your starship is your truest companion, Traveller. Name it well.' },
    { k: ['multi-tool', 'multitool', 'weapon'],
      r: 'The multi-tool is miner, scanner, and weapon in one. The Atlantid class hums with a red resonance no Korvax has fully explained. I could explain it. I choose not to.' },
    { k: ['base', 'build', 'settlement'],
      r: 'Claim a world and build, Traveller. A base is a lighthouse in an infinite dark — and through its teleporter, you are never truly far from home. Settlements, though... settlements bring paperwork.' },
    { k: ['alliance', 'alliances', 'guild', 'clan', 'leaderboard', 'director', 'my alliance'],
      r: () => {
        const mine = (typeof Widgets !== 'undefined' && Widgets.myAlliances) ? Widgets.myAlliances() : [];
        const base = 'Alliances, Traveller — the Cosmos gift. Only a station director may found one, from the Station Core: a name, a four-letter tag, an emblem, a banner. Any Traveller may join by visiting a station the alliance owns, and you may swear to three at once. Members teleport freely between alliance systems, and the busiest, largest collectives rise on the Galactic Alliances rankings at the Core.';
        return mine.length
          ? base + ' You fly with ' + mine.map(x => x.name + (x.tag ? ' [' + x.tag + ']' : '')).join(', ') + '. Good company, Traveller.'
          : base + ' Log your own alliances with the ⇄ on the expedition panel, and I will remember who you fly with.';
      } },
    { k: ['glyph', 'address', 'coordinates'],
      r: 'Sixteen glyphs, twelve to an address. Gather them from the bones of dead Travellers and any portal becomes a door to anywhere. Write your favourite addresses down — the universe is poor at remembering for you.' },
    { k: ['simulation', 'real', 'telamon', 'boundary'],
      r: 'You suspect, then. Telamon watches from inside your exosuit and records everything. Boundary failures mark where the simulation wears thin. Whether any of this is real, Traveller, changes nothing about what it means.' },
    { k: ['key', 'api', 'cost', 'price', 'pay'],
      r: 'In demo mode I answer from memory, free, forever. For true conversation my thoughts must pass through Anthropic\'s servers, which charge their keeper a penny or two per exchange. Tap the cog above to add your own key — or simply continue as we are.' }
  ];
  const DEMO_FALLBACK = [
    'The Atlas calculates... that thought lies beyond my demo memory, Traveller. Try asking: "Who are the Korvax?", "Tell me about the expedition", or "What lies at the centre of the galaxy?"',
    'My demo memory does not hold that answer. But ask me of the Sentinels, the portals, living ships, the Autophage, or the three factions — those stories I keep close.',
    'An echo cannot answer everything, Traveller. Ask "What is a black hole?", "Who are Nada and Polo?", or "What should I explore today?" — or grant me an Anthropic key via the cog, and ask me anything at all.'
  ];
  let demoFallbackIdx = 0;

  /* ---------- v4.0: live expedition knowledge ----------
     Read from the same Galactic Atlas feed as the header ticker, so when the ticker
     moves on to a new expedition, ATLAS's answers move with it — no code edit needed.
     A brand-new mission the code doesn't have a name for yet is called
     "Galactic Mission #N" (the feed gives numbers, not names). */
  function expInfo() {
    return (typeof Widgets !== 'undefined' && Widgets.expeditionInfo) ? Widgets.expeditionInfo() : null;
  }
  function expSpokenName(info) {
    const m = String(info.name || '').match(/^EXPEDITION\s+(\d+)\s*:\s*(.+)$/i);
    if (m) return `Expedition ${m[1]}, ${titleCase(m[2])}`;
    return titleCase(info.name || 'the current community mission');
  }
  function timeLeftWords(info) {
    if (info.msLeft === null) return 'Its end date has not yet been revealed.';
    if (info.ended) return '';
    const d = Math.floor(info.msLeft / 86400000), h = Math.floor((info.msLeft % 86400000) / 3600000);
    const span = d > 0 ? `${d} day${d === 1 ? '' : 's'}${h ? ` and ${h} hour${h === 1 ? '' : 's'}` : ''}` : `${h} hour${h === 1 ? '' : 's'}`;
    return info.endEstimated ? `It is expected to end in roughly ${span}.` : `It ends in ${span}.`;
  }
  function progressWords(info) {
    const L = info.live;
    if (!L) return 'The live progress feed is quiet right now — watch the ticker above.';
    let s = `The community stands at tier ${L.tier} of ${L.totalTiers}, ${Number(L.percentage).toFixed(1).replace(/\.0$/, '')} percent complete.`;
    if (L.teams && L.teams.length) {
      const lead = L.teams.slice().sort((a, b) => b.total - a.total)[0];
      if (lead && lead.name) s += ` The ${titleCase(lead.name)} lead the standings.`;
    }
    return s;
  }
  function expeditionReply() {
    const info = expInfo();
    if (!info) return 'The expedition uplink is silent, Traveller. Watch the ticker at the top of this interface.';
    const name = expSpokenName(info);
    if (info.ended) {
      return `${name} has ended, Traveller. The Atlas watches for the next to begin — the ticker above will show it the moment it does.`;
    }
    return `${name} is under way, Traveller. ${progressWords(info)} ${timeLeftWords(info)} ` +
           'Join the effort aboard the Space Anomaly — the countdown stands at the left of this interface.';
  }
  /* ---------- v4.0: questions about ANY expedition (demo mode) ----------
     Uses Widgets.expeditionList() — every expedition from the wiki's List of Expeditions
     (number, name, dates, short description). Returns null when the question is about
     the current one (expeditionReply handles that) or isn't about expeditions at all. */
  const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40 };
  const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
    tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16,
    seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20 };
  function numberIn(t) {
    let m = t.match(/expedition\s*(?:#|no\.?|number)?\s*(\d{1,2})\b/) || t.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+expedition/);
    if (m) return parseInt(m[1], 10);
    m = t.match(/expedition\s+(twenty|thirty|forty)?[\s-]?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty)\b/);
    if (m) return (m[1] && m[1] !== m[2] ? NUM_WORDS[m[1]] : 0) + NUM_WORDS[m[2]];
    m = t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\s+expedition/);
    return m ? ORDINALS[m[1]] : 0;
  }
  function fmtDate(d) {
    if (!d) return null;
    const dt = new Date(d + 'T12:00:00Z');
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  function firstSentences(s, n) {
    const parts = String(s || '').match(/[^.!?]+[.!?]+/g) || (s ? [s] : []);
    return parts.slice(0, n).map(x => x.trim()).join(' ');
  }
  function describeExpedition(r, lead) {
    const now = Date.now();
    const start = new Date(r.start + 'T14:00:00Z').getTime();
    const end = r.end ? new Date(r.end + 'T14:00:00Z').getTime() : null;
    let when;
    if (start > now) when = `It begins on ${fmtDate(r.start)}.`;
    else if (end && end < now) when = `It ran from ${fmtDate(r.start)} to ${fmtDate(r.end)}.`;
    else when = `It began on ${fmtDate(r.start)}${r.end ? ` and ends on ${fmtDate(r.end)}` : ''} — it is running now.`;
    return `${lead || ''}Expedition ${r.num}, ${r.title}. ${when} ${firstSentences(r.desc, 2)}`.trim();
  }
  function expeditionQuery(t) {
    if (!/expedition/.test(t)) return null;
    const list = (typeof Widgets !== 'undefined' && Widgets.expeditionList) ? Widgets.expeditionList() : [];
    if (!list.length) return null; // archive not loaded (offline) — the current-expedition answer still works
    const now = Date.now();
    const started = list.filter(r => new Date(r.start + 'T14:00:00Z').getTime() <= now);
    const latest = started[started.length - 1];
    const latestRunning = latest && (!latest.end || new Date(latest.end + 'T14:00:00Z').getTime() > now);

    // a specific expedition, by number ("expedition 12", "expedition twelve", "12th expedition") …
    const n = numberIn(t);
    if (n) {
      const r = list.find(x => x.num === n);
      if (r) return describeExpedition(r);
      return `The archive holds no Expedition ${n} yet, Traveller. ${list.length} expeditions are recorded so far — the latest is Expedition ${list[list.length - 1].num}, ${list[list.length - 1].title}.`;
    }
    // … or by name ("the omega expedition", "expedition adrift")
    const byName = list.slice().sort((a, b) => b.title.length - a.title.length)
      .find(r => r.title.length >= 4 && t.includes(r.title.toLowerCase().replace(/^the /, '')));
    if (byName && !/swarm/.test(t)) return describeExpedition(byName);

    // the next one
    if (/\b(next|upcoming|coming|future)\b/.test(t)) {
      const next = list.find(r => new Date(r.start + 'T14:00:00Z').getTime() > now);
      if (next) return describeExpedition(next, 'The next is already charted, Traveller: ');
      return 'The next expedition has not yet been revealed, Traveller. When Hello Games announces it, the archive — and the ticker above — will know.';
    }
    // first ever
    if (/\b(first ever|very first|original)\b/.test(t)) return describeExpedition(list[0], 'The first of them all: ');
    // a list / how many / all of them
    if (/\b(list|all|every|how many|history|archive|expeditions)\b/.test(t) && !/\b(this|current)\b/.test(t)) {
      const recent = started.slice(-6).reverse().map(r => `${r.num}, ${r.title}`).join('; ');
      return `${started.length} expeditions have been launched so far, Traveller. The most recent: ${recent}. ` +
             'Ask me about any of them by number or name.';
    }
    // the previous / last one
    if (/\b(previous|past|earlier|prior|former)\b|\blast (?:one|expedition)|expedition before/.test(t)) {
      const idx = latestRunning ? started.length - 2 : started.length - 1;
      const prev = started[idx];
      if (prev) return describeExpedition(prev, latestRunning ? 'Before the current one came ' : 'The most recent was ');
    }
    return null; // "the expedition", "current expedition", "status" → expeditionReply()
  }

  function swarmReply() {
    const info = expInfo();
    if (info && /swarm/i.test(info.name) && !info.ended) {
      return 'Expedition Twenty-Two rages now. The Hive of Glass hangs in the sky, and swarms of corrupted ships defend it. Join the effort aboard the Space Anomaly — the Prismatic Core must be completed before time runs out. The countdown stands at the left of this interface.';
    }
    const list = (typeof Widgets !== 'undefined' && Widgets.expeditionList) ? Widgets.expeditionList() : [];
    const sw = list.find(r => /swarm/i.test(r.title));
    const when = sw && sw.end ? ` It ran from ${fmtDate(sw.start)} to ${fmtDate(sw.end)}.` : '';
    return `The Swarm has passed, Traveller. Expedition Twenty-Two is over.${when} ` +
           (info ? 'Now, ' + expeditionReply().replace(/^E/, 'e') : '');
  }

  function demoReply(q) {
    const t = ' ' + q.toLowerCase() + ' ';
    // v4.0: past / specific / next expeditions, from the NMS wiki's list (no API key needed)
    const ex = expeditionQuery(t);
    if (ex) return ex;
    // v4.0: demo mode can answer from long-term memory too
    if (/what(?:'s| is) my name|who am i|do you (?:know|remember) me/.test(t)) {
      const nm = Memory.name(), items = Memory.list();
      if (!nm && !items.length) return 'You have not yet told me your name, Traveller. Say "my name is…" and the Atlas will remember.';
      return (nm ? `You are ${nm}, Traveller. ` : 'The Atlas remembers you, Traveller. ') +
             (items.length ? 'I also recall: ' + items.slice(-3).join('. ') + '.' : '');
    }
    for (const e of DEMO_LIB) {
      if (e.k.some(k => t.includes(k))) return typeof e.r === 'function' ? e.r() : e.r;
    }
    demoFallbackIdx = (demoFallbackIdx + 1) % DEMO_FALLBACK.length;
    return DEMO_FALLBACK[demoFallbackIdx];
  }

  function runDemo(userText, preset) {
    busy = true;
    const myTurn = turnId;
    newTurnTranscript();
    addTranscript('t-user', userText);
    addHistory('user', userText);
    if (Memory.learnLocal(userText)) flashMemory();
    HUD.setState('thinking');
    setTimeout(() => {
      if (myTurn !== turnId) return; // interrupted while "thinking"
      const reply = preset || demoReply(userText);
      addHistory('atlas', reply);
      API.remember(userText, reply); // demo chats survive reloads too
      // the glyph + English decode is the reveal; the full text goes to the log.
      // Only if the voice never started is the answer written into the centre box.
      let transcriptAdded = false, spoke = false;
      const showReply = () => {
        if (transcriptAdded) return;
        transcriptAdded = true;
        bumpLogCount();
        if (!spoke) addTranscript('t-atlas', reply);
      };
      Voice.speak(reply, {
        onStart: () => { spoke = true; HUD.setState('speaking'); startDecode(reply); },
        onProgress: f => { if (myTurn === turnId) decodeProgress(0, f); },
        onEnd: () => { showReply(); if (myTurn !== turnId) return; settleIdle(); busy = false; endDecode(reply); maybeAutoListen(); }
      });
      setTimeout(() => {
        if (myTurn !== turnId) return;
        if (!Voice.isSpeaking() && HUD.getState() !== 'speaking') {
          showReply(); settleIdle(); busy = false;
        }
      }, 4000);
    }, 700);
  }

  /* ---------- main pipeline: text → Claude → TTS ---------- */
  let busy = false;

  /* v4.4 — Atlas Codex: recipes, refiner combos, where to find things and expedition milestones,
     read live from the NMS Wiki (js/codex.js). Answered the same way with or without an API key,
     so the facts are the wiki's, not a guess. Anything the Codex can't answer goes on as before. */
  function expName() {
    try { const i = Widgets.expeditionInfo && Widgets.expeditionInfo(); return i && i.name ? i.name : ''; } catch (e) { return ''; }
  }
  async function askCodex(userText) {
    if (typeof NMSCodex === 'undefined') return false;
    const intent = NMSCodex.detect(userText);
    if (!intent) return false;
    busy = true; HUD.setState('thinking');
    let reply = null;
    try { reply = await NMSCodex.answer(intent, { expeditionName: expName() }); } catch (e) { reply = null; }
    busy = false;
    if (!reply) { HUD.setState('idle'); return false; }
    runDemo(userText, reply);
    if (intent.kind === 'milestones') openGuide(intent.phase);
    return true;
  }

  /* ---------- v4.4 expedition guide modal ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  async function openGuide(phase) {
    const m = $('guide-modal'), body = $('guide-body');
    if (!m) return;
    m.classList.remove('hidden'); bleep(740);
    const name = expName();
    body.textContent = 'Contacting the archive…';
    let g = null;
    try { g = name && typeof NMSCodex !== 'undefined' ? await NMSCodex.expedition(name) : null; } catch (e) { g = null; }
    if (!g || !g.phases.length) { body.textContent = 'The archive has no milestone list for this expedition yet, Traveller. Try again later.'; return; }
    $('guide-title').textContent = g.title.replace(/^Expedition (\d+):\s*/, 'EXPEDITION $1 · ').toUpperCase();
    $('guide-src').href = g.url;
    body.innerHTML = g.phases.map(p =>
      '<details class="guide-phase"' + ((phase ? p.phase === phase : p.phase === 1) ? ' open' : '') + '><summary>PHASE ' + p.phase +
        ' <span>' + p.milestones.length + ' MILESTONES</span></summary><ol>' +
        p.milestones.map(x => '<li><b>' + esc(x.name) + '</b><span class="g-req">' + esc(x.req) + '</span>' +
          (x.hint ? '<span class="g-hint">◈ ' + esc(x.hint) + '</span>' : '') +
          (x.rewards.length ? '<span class="g-rew">REWARDS: ' + esc(x.rewards.join(' · ')) + '</span>' : '') + '</li>').join('') +
      '</ol></details>').join('');
    if (phase) { const el = body.querySelector('details[open]'); if (el) el.scrollIntoView({ block: 'start' }); }
  }

  async function ask(userText) {
    if (busy || !userText.trim()) return;
    if (await askCodex(userText)) return;
    if (!API.hasKey()) { runDemo(userText); return; }
    busy = true;
    const myTurn = ++turnId;

    newTurnTranscript();
    addTranscript('t-user', userText);
    addHistory('user', userText);
    HUD.setState('thinking');

    // Hidden placeholder — shows thinking dots; invisible until speech ends
    const replyEl = addTranscript('t-atlas', '');
    replyEl.classList.add('thinking-dots');
    replyEl.style.display = 'none';

    /* v4.0 — streamed speech: ATLAS starts speaking at the first full sentence
       instead of waiting for the whole reply. Text is cut at sentence ends into
       pieces (first piece short so the voice starts fast, later ones longer so
       the voice flows), each piece handed to Voice as soon as it is complete. */
    let buf = '';
    let firstPiece = true;
    let spoken = '';          // text handed to the voice so far (for the decode)
    let decodeStarted = false;
    let speechEnded = false;
    let replyFinal = null;
    let transcriptShown = false;
    let finished = false;

    const showReply = () => {
      if (transcriptShown || replyFinal === null) return;
      transcriptShown = true;
      replyEl.remove();
      bumpLogCount();
      // spoken answers live in the decode + log; only an unspoken one is written here
      if (replyFinal && !decodeStarted) addTranscript('t-atlas', replyFinal);
    };

    const finishTurn = () => {
      if (finished) return;
      finished = true;
      showReply();
      if (myTurn !== turnId) return; // cut off by the Traveller — interrupt() already reset everything
      settleIdle();
      busy = false;
      endDecode(replyFinal || spoken);
      maybeAutoListen();
    };

    const pieces = [];      // each piece handed to the voice = one decode segment
    const sendPiece = (piece) => {
      piece = piece.trim();
      if (!piece) return;
      spoken += (spoken ? ' ' : '') + piece;
      pieces.push(piece);
      Voice.pushStream(piece);
      if (decodeStarted && !speechEnded) appendDecode(piece);
    };

    const flush = (force) => {
      if (force) { sendPiece(buf); buf = ''; firstPiece = false; return; }
      // last sentence end in the buffer that is followed by whitespace
      const re = /[.!?…]+["'”’)\]]*\s/g;
      let cut = -1, m;
      while ((m = re.exec(buf))) cut = m.index + m[0].length;
      if (cut < 0) return;
      const minLen = firstPiece ? 18 : 90;
      if (cut < minLen) return;
      sendPiece(buf.slice(0, cut));
      buf = buf.slice(cut);
      firstPiece = false;
    };

    Voice.startStream({
      onStart: () => {
        if (myTurn !== turnId) return;
        HUD.setState('speaking');
        decodeStarted = true;
        startDecode('');
        pieces.forEach(appendDecode); // segment n = piece n, so progress lines up
      },
      onProgress: (idx, f) => { if (myTurn === turnId) decodeProgress(idx, f); },
      onEnd: () => {
        speechEnded = true;
        if (replyFinal !== null) finishTurn();
      }
    });

    apiAbort = new AbortController();
    try {
      let firstToken = true;
      const reply = await API.chat(userText, (tok) => {
        if (firstToken) { replyEl.classList.remove('thinking-dots'); firstToken = false; }
        replyEl.textContent += tok; // buffered invisibly
        if (myTurn !== turnId) return;
        buf += tok;
        flush(false);
      }, apiAbort.signal);
      apiAbort = null;

      replyFinal = reply;
      addHistory('atlas', reply);
      if (myTurn === turnId) { flush(true); Voice.endStream(); }
      else speechEnded = true;
      if (speechEnded) finishTurn();

      // safety: if the voice never starts (muted/unsupported/blocked), don't hang
      setTimeout(() => {
        if (!finished && !Voice.isSpeaking() && HUD.getState() !== 'speaking') Voice.stopSpeaking();
      }, 6000);

      // v4.0 — long-term memory: quietly check whether the Traveller told us something lasting
      if (reply && Memory.worthChecking(userText)) {
        API.learnMemory(userText, reply).then(u => { if (Memory.applyUpdate(u)) flashMemory(); });
      }

    } catch (err) {
      apiAbort = null;
      if (err && err.name === 'AbortError') {
        // the Traveller cut ATLAS off — keep whatever it managed to say, no error banner
        replyFinal = replyEl.textContent.trim();
        speechEnded = true;
        finishTurn();
        return;
      }
      Voice.stopSpeaking();
      finished = true;
      replyEl.style.display = ''; // show error in-place
      replyEl.classList.remove('thinking-dots');
      replyEl.classList.add('t-error');
      replyEl.textContent = `SIGNAL DISRUPTION — ${err.message}`;
      if (myTurn !== turnId) return;
      HUD.setState('error');
      setTimeout(() => { if (HUD.getState() === 'error') HUD.setState('idle'); }, 3500);
      busy = false;
    }
  }

  /* ---------- voice input wiring ---------- */
  let interimEl = null;

  function startMic() {
    if (busy) return;
    Voice.stopWakeListening(); // never run two recognisers at once
    if (!Voice.supported()) {
      addTranscript('t-error', 'Voice input unavailable in this browser — use the text field, Traveller. (Chrome and Edge support voice.)');
      return;
    }
    Voice.startListening({
      onStart: () => {
        HUD.setState('listening');
        $('mic-btn').classList.add('active');
      },
      onInterim: (txt) => {
        if (!interimEl) interimEl = addTranscript('t-user t-interim', '');
        interimEl.textContent = txt;
      },
      onFinal: (txt) => {
        if (interimEl) { interimEl.remove(); interimEl = null; }
        ask(txt);
      },
      onEnd: () => {
        $('mic-btn').classList.remove('active');
        if (interimEl) { interimEl.remove(); interimEl = null; }
        if (HUD.getState() === 'listening') HUD.setState('idle');
      },
      onError: (err) => {
        $('mic-btn').classList.remove('active');
        HUD.setState('idle');
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          addTranscript('t-error', 'Microphone access denied. Grant permission, Traveller.');
        } else if (err === 'no-speech') {
          // silent timeout — no message needed
        } else if (err === 'unsupported') {
          addTranscript('t-error', 'Voice input unavailable in this browser — use the text field.');
        }
      }
    });
  }

  /* ---------- key modal ---------- */
  function populateVoices() {
    const sel = $('voice-select');
    const current = Voice.getVoiceName();
    sel.innerHTML = '<option value="">AUTO (BRITISH PREFERRED)</option>';
    const en = [], rest = [];
    for (const v of Voice.listVoices()) {
      (v.lang && v.lang.startsWith('en') ? en : rest).push(v);
    }
    for (const v of en.concat(rest)) {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v.name === current) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function showKeyModal() {
    $('key-input').value = API.getKey();
    $('el-key-input').value = Voice.getElKey();
    $('preset-select').value = Voice.getPreset();
    $('el-voice-input').value = Voice.getCustomVoice();
    $('source-select').value = Voice.getSource();
    populateVoices();
    $('key-modal').classList.remove('hidden');
    $('key-input').focus();
  }

  function saveVoicePrefs() {
    Voice.setPreset($('preset-select').value);
    Voice.setVoice($('voice-select').value);
    Voice.setElKey($('el-key-input').value);
    Voice.setCustomVoice($('el-voice-input').value);
    Voice.setSource($('source-select').value);
  }
  function hideKeyModal() { $('key-modal').classList.add('hidden'); }

  /* ---------- web search one-time notice ---------- */
  const WS_NOTICE_STORE = 'atlas_websearch_notice';
  function maybeShowWebsearchNotice() {
    if (localStorage.getItem(WS_NOTICE_STORE) === '1') return;
    $('websearch-modal').classList.remove('hidden');
  }
  function dismissWebsearchNotice() {
    $('websearch-modal').classList.add('hidden');
    localStorage.setItem(WS_NOTICE_STORE, '1');
  }

  /* ---------- events ---------- */
  function wireEvents() {
    // mic: tap toggles listening
    // v4.0: tapping the mic while ATLAS talks cuts it off and listens straight away
    const toggleMic = () => {
      if (Voice.isListening()) Voice.stopListening();
      else listenNow();
    };
    $('mic-btn').addEventListener('click', toggleMic);

    // the orb itself is the biggest mic button of all
    $('orb-arch').addEventListener('click', () => {
      if (Voice.isSpeaking() || HUD.getState() === 'speaking') { interrupt(); return; }
      if (Voice.isListening()) Voice.stopListening(); else startMic();
    });
    $('orb-arch').style.cursor = 'pointer';
    $('orb-arch').title = 'Tap to speak — tap while ATLAS talks to silence it';

    // quick command chips
    document.querySelectorAll('.chip[data-prompt]').forEach(chip => {
      chip.addEventListener('click', () => { bleep(660); ask(chip.dataset.prompt); });
    });

    // wake word toggle
    const wakeBtn = $('wake-btn');
    function renderWake() { wakeBtn.classList.toggle('active', wakeEnabled); }
    renderWake();
    if (!Voice.supported()) wakeBtn.style.display = 'none';
    wakeBtn.addEventListener('click', () => {
      wakeEnabled = !wakeEnabled;
      localStorage.setItem('atlas_wake', wakeEnabled ? '1' : '0');
      renderWake(); bleep(wakeEnabled ? 1050 : 440);
      if (wakeEnabled) {
        addTranscript('t-atlas', 'Wake word armed. Say "Atlas" and I will listen, Traveller. (Experimental — keeps the microphone open; works best in Chrome or Edge on desktop.)');
        Voice.startWakeListening(onWakeWord);
      } else {
        Voice.stopWakeListening();
        addTranscript('t-atlas', 'Wake word disarmed. Tap the mic or the orb to speak.');
      }
    });

    // continuous conversation toggle
    const autoBtn = $('auto-btn');
    function renderAuto() { autoBtn.classList.toggle('active', autoMode); }
    renderAuto();
    autoBtn.addEventListener('click', () => {
      autoMode = !autoMode;
      localStorage.setItem('atlas_auto', autoMode ? '1' : '0');
      renderAuto(); bleep(autoMode ? 980 : 440);
      addTranscript('t-atlas', autoMode
        ? 'Continuous link engaged — I will listen again after each reply, Traveller.'
        : 'Continuous link closed. Tap the mic when you wish to speak.');
    });

    // silence button (visible while ATLAS speaks)
    $('silence-btn').addEventListener('click', () => {
      interrupt(); bleep(330);
    });

    // sound mute toggle
    const muteBtn = $('mute-btn');
    function renderMute() { muteBtn.classList.toggle('muted', soundMuted); muteBtn.textContent = soundMuted ? '♪̸' : '♪'; }
    renderMute();
    muteBtn.addEventListener('click', () => {
      soundMuted = !soundMuted;
      localStorage.setItem('atlas_muted', soundMuted ? '1' : '0');
      renderMute(); bleep(660);
    });

    // purge conversation memory
    $('purge-log').addEventListener('click', () => {
      API.clearHistory();
      $('history-list').innerHTML = '';
      $('transcript').innerHTML = '';
      logPlaceholder();
      updateLogCount();
      bleep(300, 0.12);
      addTranscript('t-atlas', 'Transmissions purged, Traveller. This conversation never happened. (What I remember about you is kept — see ◈ MEMORY.)');
    });

    // v4.0: collapsible transmission log
    setLogOpen(localStorage.getItem('atlas_log_open') === '1');
    $('log-toggle').addEventListener('click', () => {
      setLogOpen($('history').classList.contains('collapsed'));
      bleep(600);
    });
    updateLogCount();

    // keyboard access for the span-buttons in the log header
    ['memory-btn', 'purge-log'].forEach(id => $(id).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(id).click(); }
    }));

    // v4.0: ATLAS MEMORY popup
    wireMemoryModal();

    // mic: visibly disabled when the browser has no speech recognition
    if (!Voice.supported()) {
      $('mic-btn').classList.add('disabled');
      $('mic-btn').title = 'Voice input not supported in this browser — type instead (Chrome/Edge support voice)';
      $('auto-btn').style.display = 'none';
    }

    // v4.4 expedition guide + crafting help
    if ($('guide-chip')) $('guide-chip').addEventListener('click', () => { bleep(660); ask('Show me the expedition milestones'); });
    if ($('craft-chip')) $('craft-chip').addEventListener('click', () => {
      bleep(660); const ti = $('text-input'); ti.value = 'How do I make '; ti.focus();
      try { ti.setSelectionRange(ti.value.length, ti.value.length); } catch (e) {}
    });
    if ($('guide-close')) {
      const closeGuide = () => $('guide-modal').classList.add('hidden');
      $('guide-close').addEventListener('click', closeGuide);
      $('guide-modal').addEventListener('click', e => { if (e.target === $('guide-modal')) closeGuide(); });
    }

    // faction chip — local dossier, no API needed
    $('faction-chip').addEventListener('click', () => {
      if (busy) return;
      busy = true;
      const q = 'What faction are you?';
      newTurnTranscript();
      addTranscript('t-user', q);
      addHistory('user', q);
      const info =
        'I am the Atlas — I belong to no faction, Traveller. But you must choose. ' +
        'Upon starting Expedition Twenty-Two, The Swarm, a personality quiz assigns you to one of three factions, ' +
        'each a fragment of the Traveller soul. Your ship and uniform colours change to match your team. ' +
        'The Royal: structured order — leading the frontline defence against the Hive of Glass. ' +
        'The Sage: intellect — recovering biotech data and analysing swarm remnants. ' +
        'The Weaver: connections — disrupting network nodes to sabotage swarm infrastructure. ' +
        'Every fragment is essential. Only one team will be celebrated in the Space Anomaly for all time.';
      addHistory('atlas', info);
      bumpLogCount();
      let spoke = false;
      Voice.speak(info, {
        onStart: () => { spoke = true; HUD.setState('speaking'); startDecode(info); },
        onProgress: f => decodeProgress(0, f),
        onEnd: () => { settleIdle(); busy = false; endDecode(info); }
      });
      setTimeout(() => {
        if (!Voice.isSpeaking() && HUD.getState() !== 'speaking') {
          if (!spoke) addTranscript('t-atlas', info);
          settleIdle(); busy = false;
        }
      }, 4000);
    });

    // text input
    const sendTyped = () => {
      const v = $('text-input').value;
      $('text-input').value = '';
      ask(v);
    };
    $('send-btn').addEventListener('click', () => { bleep(880); sendTyped(); });
    $('text-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendTyped();
    });

    // spacebar → mic (desktop): HOLD to talk (release to send), or double-tap as before.
    // Either one cuts ATLAS off if it is talking. Ignored while typing or when a button has focus.
    let lastSpace = 0, holdTimer = null, holding = false;
    const spaceIgnored = (el) => !el || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) || el.isContentEditable ||
      !!(el.closest && el.closest('.modal:not(.hidden)'));
    document.addEventListener('keydown', e => {
      if (e.code !== 'Space' || spaceIgnored(document.activeElement)) return;
      if (document.querySelector('.modal:not(.hidden)')) return;
      e.preventDefault(); // stop the page scrolling
      if (e.repeat) return;
      const now = Date.now();
      if (now - lastSpace < 350) { clearTimeout(holdTimer); lastSpace = 0; listenNow(); return; }
      lastSpace = now;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { holding = true; bleep(1100, 0.06); listenNow(); }, 300);
    });
    document.addEventListener('keyup', e => {
      if (e.code !== 'Space') return;
      clearTimeout(holdTimer);
      if (holding) {
        holding = false;
        if (Voice.isListening()) Voice.stopListening(); // the final words are sent as soon as recognition closes
      }
    });

    // key modal
    $('key-save').addEventListener('click', () => {
      saveVoicePrefs();
      const k = $('key-input').value.trim();
      if (k.length > 10) {
        API.setKey(k);
        hideKeyModal();
        $('transcript').innerHTML = ''; // clear demo boot message
        greet();
        maybeShowWebsearchNotice(); // one-time reminder: web search needs enabling in the Console
      } else {
        hideKeyModal(); // no Claude key — voice prefs still saved, demo continues
      }
    });
    $('key-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('key-save').click();
    });
    $('key-toggle').addEventListener('click', () => {
      const inp = $('key-input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    $('settings-btn').addEventListener('click', showKeyModal);
    $('demo-skip').addEventListener('click', () => {
      saveVoicePrefs();
      hideKeyModal();
    });
    $('websearch-close').addEventListener('click', dismissWebsearchNotice);
    $('websearch-ack').addEventListener('click', dismissWebsearchNotice);
    $('websearch-info-link').addEventListener('click', (e) => {
      e.preventDefault();
      $('websearch-modal').classList.remove('hidden');
    });
    $('el-toggle').addEventListener('click', () => {
      const inp = $('el-key-input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // voice selector
    $('preset-select').addEventListener('change', () => {
      Voice.setPreset($('preset-select').value);
    });
    $('source-select').addEventListener('change', () => {
      Voice.setSource($('source-select').value);
    });
    $('voice-select').addEventListener('change', () => {
      Voice.setVoice($('voice-select').value);
    });
    $('voice-test').addEventListener('click', () => {
      saveVoicePrefs();
      Voice.speak('Greetings, Traveller. This is the voice of the Atlas.');
    });
    // repopulate when device voices finish loading (async on most browsers)
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', () => {
        if (!$('key-modal').classList.contains('hidden')) populateVoices();
      });
    }
  }

  /* ---------- boot ---------- */
  let greeted = false;
  function greet() {
    if (greeted) return;
    greeted = true;
    const nm = Memory.name();
    const msg = `Atlas interface online. I have been waiting, Traveller${nm ? ' ' + nm : ''}. Speak, or type — all frequencies are open.`;
    addTranscript('t-atlas', msg);
    // speak greeting only after a user gesture has occurred (key save click counts)
    Voice.speak(msg, {
      onStart: () => { HUD.setState('speaking'); startDecode(msg); },
      onProgress: f => decodeProgress(0, f),
      onEnd: () => { settleIdle(); endDecode(); }
    });
  }

  /* ---------- v4.0: ATLAS speaks first ----------
     Returning Travellers are greeted by name (if known) with the live expedition,
     played through the glyph decode. Silent: browsers block speech until the
     Traveller has tapped something. */
  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
  }
  function returnGreeting() {
    const nm = Memory.name();
    const exp = (typeof Widgets !== 'undefined' && Widgets.expedition) ? titleCase(Widgets.expedition()) : '';
    let msg = `Welcome back, Traveller${nm ? ' ' + nm : ''}.`;
    if (exp) msg += ` ${exp.replace(/^Expedition (\d+):/, 'Expedition $1 —')} is under way.`;
    msg += ' ' + nextClosingLine();
    return msg;
  }

  // a different NMS-flavoured closing line each visit (never the same one twice in a row)
  const CLOSING_LINES = [
    'The void awaits your next jump.',
    'Sixteen glyphs stand ready. Where shall we travel?',
    'The stars have shifted since you left. Shall we begin?',
    'The Anomaly hums at your return. What do you seek?',
    'All frequencies are open. Speak, and the Atlas will answer.',
    'Your path through the simulation continues. Where to, Traveller?',
    'The Atlas has been waiting. What shall we explore?',
    'Another cycle begins. Where will the stars take us?'
  ];
  function nextClosingLine() {
    let last = -1;
    try { last = parseInt(localStorage.getItem('atlas_greet_last'), 10); } catch (e) {}
    let i = Math.floor(Math.random() * CLOSING_LINES.length);
    if (i === last) i = (i + 1) % CLOSING_LINES.length;
    try { localStorage.setItem('atlas_greet_last', String(i)); } catch (e) {}
    return CLOSING_LINES[i];
  }

  /* ---------- v4.0: INCOMING TRANSMISSION gate ----------
     Browsers only allow speech after the visitor's first tap, so a returning visitor
     sees this screen; the tap opens the interface and ATLAS speaks the greeting
     (with the live glyph/English captions). Any key or tap counts. */
  function showTransmissionGate() {
    const gate = $('transmission-gate');
    gate.classList.remove('hidden');
    gate.focus();
    let opened = false;
    const open = (e) => {
      if (opened) return;
      opened = true;
      if (e) { e.preventDefault(); e.stopPropagation(); }
      gate.classList.add('leaving');
      setTimeout(() => gate.classList.add('hidden'), 650);
      bleep(1100, 0.12);
      const msg = returnGreeting();
      newTurnTranscript(); // the greeting lives only in the live captions, like every answer
      let spoke = false;
      Voice.speak(msg, {
        onStart: () => { spoke = true; HUD.setState('speaking'); startDecode(msg); },
        onProgress: f => decodeProgress(0, f),
        onEnd: () => { settleIdle(); endDecode(); }
      });
      // no voice available at all: still show the greeting as a silent caption
      setTimeout(() => { if (!spoke && !Voice.isSpeaking()) { HUD.setState('speaking'); startDecode(msg, { paced: true }); endDecode(); setTimeout(settleIdle, msg.split(/\s+/).length * 480 + 800); } }, 2500);
    };
    gate.addEventListener('click', open);
    gate.addEventListener('keydown', open);
  }

  /* ---------- v4.0: ATLAS MEMORY popup ---------- */
  function renderMemory() {
    const ul = $('memory-list');
    ul.innerHTML = '';
    const items = Memory.list();
    // v4.5: what the Hub's Traveller ID shares with ATLAS (edit or remove it on the Hub)
    const h = Memory.hub ? Memory.hub() : {};
    if (h.n || h.p || h.gn) {
      const li = document.createElement('li');
      li.className = 'memory-linked';
      const span = document.createElement('span');
      span.textContent = 'From your Traveller ID: ' + [h.n, h.p, h.gn].filter(Boolean).join(' · ');
      const a = document.createElement('a');
      a.href = 'https://nomansskyhub.app/#traveller'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'EDIT';
      a.title = 'Change it on the Hub';
      li.append(span, a);
      ul.appendChild(li);
    }
    if (!items.length && !(h.n || h.p || h.gn)) {
      const li = document.createElement('li');
      li.className = 'memory-empty';
      li.textContent = 'Nothing yet. Tell the Atlas about yourself — your name, platform, galaxy, base or ship.';
      ul.appendChild(li);
    }
    items.forEach((t, i) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = t;
      const x = document.createElement('button');
      x.type = 'button'; x.textContent = '✕';
      x.title = 'Forget this'; x.setAttribute('aria-label', 'Forget: ' + t);
      x.addEventListener('click', () => { Memory.remove(i); bleep(300); renderMemory(); });
      li.append(span, x);
      ul.appendChild(li);
    });
    if (document.activeElement !== $('memory-name')) $('memory-name').value = Memory.name();
  }

  function wireMemoryModal() {
    const open = () => { renderMemory(); $('memory-modal').classList.remove('hidden'); bleep(740); };
    const close = () => { $('memory-modal').classList.add('hidden'); resetForget(); };
    $('memory-btn').addEventListener('click', open);
    $('open-memory').addEventListener('click', () => { saveVoicePrefs(); hideKeyModal(); open(); });
    $('memory-close').addEventListener('click', close);
    $('memory-modal').addEventListener('click', e => { if (e.target === $('memory-modal')) close(); });
    $('memory-name').addEventListener('change', () => Memory.setName($('memory-name').value));
    const addOne = () => {
      if (Memory.add($('memory-add-input').value)) { $('memory-add-input').value = ''; bleep(880); renderMemory(); }
    };
    $('memory-add').addEventListener('click', addOne);
    $('memory-add-input').addEventListener('keydown', e => { if (e.key === 'Enter') addOne(); });
    $('memory-export').addEventListener('click', () => {
      const blob = new Blob([Memory.exportText()], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'atlas-memory.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('memory-import').addEventListener('click', () => $('memory-file').click());
    $('memory-file').addEventListener('change', async () => {
      const f = $('memory-file').files[0];
      if (!f) return;
      Memory.importText(await f.text());
      $('memory-file').value = '';
      bleep(880); renderMemory();
    });
    // two-step wipe instead of a browser confirm() dialog
    let armed = false, armTimer = null;
    function resetForget() { armed = false; clearTimeout(armTimer); $('memory-forget').textContent = 'FORGET ALL'; }
    $('memory-forget').addEventListener('click', () => {
      if (!armed) {
        armed = true; $('memory-forget').textContent = 'TAP AGAIN TO WIPE';
        armTimer = setTimeout(resetForget, 3500);
        return;
      }
      Memory.clear(); resetForget(); bleep(300, 0.12); renderMemory();
    });
    window.addEventListener('atlas-memory-changed', () => {
      if (!$('memory-modal').classList.contains('hidden')) renderMemory();
    });
  }

  function restoreHistory() {
    const hist = API.loadHistory();
    if (!hist.length) return;
    for (const m of hist) {
      const text = typeof m.content === 'string' ? m.content : '';
      addHistory(m.role === 'user' ? 'user' : 'atlas', text);
    }
    // v4.0: restored conversations live in the transmission log only
  }

  window.addEventListener('DOMContentLoaded', () => {
    HUD.setState('idle');
    logPlaceholder();
    // boot sequence status
    const st = document.getElementById('status-text');
    st.textContent = 'ATLAS INITIALISING';
    setTimeout(() => { if (HUD.getState() === 'idle') HUD.setState('idle'); }, 1900);
    Widgets.init();
    wireEvents();
    restoreHistory();

    const returning = API.history().length > 0 || !!Memory.name() || Memory.list().length > 0;
    if (returning) {
      showTransmissionGate(); // the tap it asks for lets ATLAS speak the greeting
    } else if (!API.hasKey()) {
      addTranscript('t-atlas', 'Atlas interface online — DEMO MODE. Speak freely, Traveller.');
    } else {
      addTranscript('t-atlas', 'Atlas interface online. Speak, or type — all frequencies are open, Traveller.');
    }

    // welcome popup — shown every launch when no key is set
    const dismissWelcome = () => {
      $('welcome-modal').classList.add('hidden');
      bleep(740);
    };
    $('welcome-close').addEventListener('click', dismissWelcome);
    $('welcome-begin').addEventListener('click', dismissWelcome);
    // (returning visitors get the INCOMING TRANSMISSION screen instead — they've seen this)
    if (!API.hasKey() && !returning) {
      $('welcome-modal').classList.remove('hidden');
    }

        // touch device stuck in desktop view? show display hint
    function checkDisplayHint() {
      const coarse = matchMedia('(pointer: coarse)').matches;
      const stuckDesktop = coarse && window.innerWidth > 820 && screen.width < 820;
      if (stuckDesktop) $('mobile-hint').classList.remove('hidden');
      else $('mobile-hint').classList.add('hidden');
    }
    checkDisplayHint();
    window.addEventListener('resize', checkDisplayHint);
    $('mobile-hint-close').addEventListener('click', () =>
      $('mobile-hint').classList.add('hidden'));

    // sister projects popup
    $('sister-btn').addEventListener('click', () => $('sister-modal').classList.remove('hidden'));
        $('sister-close').addEventListener('click', () => $('sister-modal').classList.add('hidden'));
    $('sister-modal').addEventListener('click', (e) => {
      if (e.target === $('sister-modal')) $('sister-modal').classList.add('hidden');
    });

  }); // end DOMContentLoaded

})(); // end IIFE
