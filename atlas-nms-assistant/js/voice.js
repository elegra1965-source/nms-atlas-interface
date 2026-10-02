/* ================= ATLAS — voice.js =================
   SpeechRecognition (input) + SpeechSynthesis (output).
===================================================== */
const Voice = (() => {

  /* ---------- INPUT ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let callbacks = { onInterim: null, onFinal: null, onStart: null, onEnd: null, onError: null };

  function supported() { return !!SR; }

  function initRecognition() {
    if (!SR) return null;
    const r = new SR();
    r.continuous = false;
    r.lang = 'en-GB';
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => { listening = true; callbacks.onStart && callbacks.onStart(); };
    r.onend = () => { listening = false; callbacks.onEnd && callbacks.onEnd(); };
    r.onerror = (e) => {
      listening = false;
      callbacks.onError && callbacks.onError(e.error);
    };
    r.onspeechstart = () => bump(0.5);
    r.onresult = (e) => {
      bump(0.75); // words arriving — the orb reacts to the Traveller's voice
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim && callbacks.onInterim) callbacks.onInterim(interim);
      if (final && callbacks.onFinal) callbacks.onFinal(final.trim());
    };
    return r;
  }

  function startListening(cbs) {
    if (!SR) { cbs.onError && cbs.onError('unsupported'); return; }
    callbacks = cbs;
    stopSpeaking(); // never listen while talking
    if (recognition) { try { recognition.abort(); } catch (e) {} }
    recognition = initRecognition();
    try { recognition.start(); } catch (e) { /* already started */ }
  }

  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch (e) {} }
  }

  function isListening() { return listening; }

  /* ---------- WAKE WORD (browser-native, no external SDK) ---------- */
  let wakeRec = null;
  let wakeActive = false;

  function startWakeListening(onWake) {
    if (!SR || wakeActive) return wakeActive;
    wakeActive = true;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-GB';
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase();
        if (t.includes('atlas') || t.includes('at last')) {
          wakeActive = false;
          try { r.abort(); } catch (err) {}
          wakeRec = null;
          onWake(t);
          return;
        }
      }
    };
    r.onend = () => {
      // engine times out periodically — restart while armed
      if (wakeActive && wakeRec === r) {
        try { r.start(); } catch (e) {}
      }
    };
    r.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        wakeActive = false; wakeRec = null;
      }
    };
    wakeRec = r;
    try { r.start(); } catch (e) { wakeActive = false; wakeRec = null; }
    return wakeActive;
  }

  function stopWakeListening() {
    wakeActive = false;
    if (wakeRec) { try { wakeRec.abort(); } catch (e) {} wakeRec = null; }
  }

  function isWakeActive() { return wakeActive; }

  /* ---------- v4.0: VOICE LEVEL (drives the sound-reactive orb, see js/pulse.js) ----------
     ElevenLabs audio: real loudness from an AnalyserNode.
     Device voices give no audio access, so each spoken word (boundary event)
     and each heard word while listening sends a short impulse instead. */
  let impulse = 0, impulseAt = 0;
  let curAnalyser = null, levelBuf = null;
  function bump(v) {
    impulse = Math.max(decayed(), v);
    impulseAt = performance.now();
  }
  function decayed() {
    return impulse * Math.exp(-(performance.now() - impulseAt) / 160);
  }
  function level() {
    let a = 0;
    if (curAnalyser) {
      if (!levelBuf || levelBuf.length !== curAnalyser.fftSize) levelBuf = new Uint8Array(curAnalyser.fftSize);
      curAnalyser.getByteTimeDomainData(levelBuf);
      let sum = 0;
      for (let i = 0; i < levelBuf.length; i++) { const d = (levelBuf[i] - 128) / 128; sum += d * d; }
      a = Math.min(1, Math.sqrt(sum / levelBuf.length) * 3.2);
    }
    return Math.max(a, decayed());
  }
  function makeAnalyser() {
    try { const an = elCtx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.6; return an; }
    catch (e) { return null; }
  }

  /* ---------- OUTPUT ---------- */
  const VOICE_STORE = 'atlas_voice';
  let lastSpoken = ''; // what ATLAS is currently saying (echo guard for barge-in)
  function getLastSpoken() { return lastSpoken; }
  let speechGen = 0; // bumped by stopSpeaking() to invalidate any in-flight speech chain
  let preferredVoice = null;
  let voicesReady = false;

  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;
    voicesReady = true;
    // user-selected voice wins, if it still exists on this device
    const saved = localStorage.getItem(VOICE_STORE);
    if (saved) {
      const match = voices.find(v => v.name === saved);
      if (match) { preferredVoice = match; return; }
    }
    // otherwise: known British voices, then any en-GB, then any English
    const prefs = ['Google UK English Female', 'Microsoft Hazel', 'Microsoft Susan', 'Daniel'];
    preferredVoice =
      voices.find(v => prefs.some(p => v.name.includes(p))) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang && v.lang.startsWith('en')) ||
      voices[0];
  }

  function listVoices() {
    return 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
  }

  function setVoice(name) {
    if (name) localStorage.setItem(VOICE_STORE, name);
    else localStorage.removeItem(VOICE_STORE);
    pickVoice();
  }

  function getVoiceName() { return localStorage.getItem(VOICE_STORE) || ''; }

  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  /* ---------- VOICE CHARACTER presets ----------
     Shape the voice toward NMS lore. Each preset sets:
     - el:       ElevenLabs voice (used when an EL key is present)
     - settings: EL expressiveness
     - fx:       "Atlas resonance" — WebAudio reverb + a pitched-down
                 ghost of the same voice layered underneath (EL path only)
     - bRate/bPitch: shaping for free device voices
  ------------------------------------------------ */
  const PRESET_STORE = 'atlas_voice_preset';
  const PRESETS = {
    atlas: {   // vast, warm, resonant — an entity older than stars
      el: 'JBFqnCBsd6RMkjVDRZzb', // George — deep British
      settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
      fx: { reverb: 2.6, wet: 0.32, ghost: 0.2 },
      bRate: 0.86, bPitch: 0.72
    },
    telamon: { // the exosuit AI — calm, clean, precise
      el: 'pFZP5JQG7iQjIQuC4Bku', // Lily — clear British
      settings: { stability: 0.65, similarity_boost: 0.75 },
      fx: null,
      bRate: 0.96, bPitch: 1.04
    },
    echo: {    // boundary failure — raspy, heavy resonance
      el: 'N2lVS1w4EtoT3dr4eOWO', // Callum — otherworldly
      settings: { stability: 0.38, similarity_boost: 0.7, style: 0.35 },
      fx: { reverb: 3.4, wet: 0.48, ghost: 0.3 },
      bRate: 0.9, bPitch: 0.76
    },
    traveller: { // weathered storyteller — the release-trailer feel
      el: 'pqHfZKP75CvOlQylNhV4', // Bill — older, lived-in narrator
      settings: { stability: 0.42, similarity_boost: 0.75, style: 0.3 },
      fx: { reverb: 1.8, wet: 0.18, ghost: 0.1 }, // a whisper of space, not a cathedral
      bRate: 0.84, bPitch: 0.8
    },
    classic: { // the original plain narrator
      el: 'onwK4e9ZLuTAKqWW03F9', // Daniel
      settings: { stability: 0.55, similarity_boost: 0.7 },
      fx: null,
      bRate: 0.92, bPitch: 0.85
    }
  };
  function getPreset() {
    const k = localStorage.getItem(PRESET_STORE);
    return PRESETS[k] ? k : 'atlas';
  }
  function setPreset(k) {
    if (PRESETS[k]) localStorage.setItem(PRESET_STORE, k);
  }

  /* ---------- ElevenLabs (optional, ultra-natural neural voice) ---------- */
  const EL_STORE = 'atlas_el_key';
  const EL_CUSTOM_STORE = 'atlas_el_custom_voice';
  const SOURCE_STORE = 'atlas_voice_source'; // 'auto' | 'device'
  function getSource() { return localStorage.getItem(SOURCE_STORE) === 'device' ? 'device' : 'auto'; }
  function setSource(s) {
    if (s === 'device') localStorage.setItem(SOURCE_STORE, 'device');
    else localStorage.removeItem(SOURCE_STORE);
  }
  function getCustomVoice() { return localStorage.getItem(EL_CUSTOM_STORE) || ''; }
  function setCustomVoice(id) {
    if (id && id.trim()) localStorage.setItem(EL_CUSTOM_STORE, id.trim());
    else localStorage.removeItem(EL_CUSTOM_STORE);
  }
  let elAudio = null;
  let elAudioOnEnd = null; // pending onEnd for elAudio; invoked manually since .pause() fires no event
  let elPlaying = false; // WebAudio (resonant) playback flag
  let elStop = null;     // halts current resonant playback
  let elAbort = null;    // AbortController for in-flight ElevenLabs fetch
  let elCtx = null;

  function reverbImpulse(ctx, seconds) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    return buf;
  }

  // "Atlas resonance": dry voice + cathedral reverb fed by the voice
  // and a quiet five-semitone-down ghost of itself
  /* ---------- v4.0: SPEECH PROGRESS (drives the word-by-word glyph/English decode) ----------
     Reports how far through a piece of text the voice is, 0..1, so each caption word
     appears only as it is actually spoken.
     - device voices: word "boundary" events give the exact character being spoken
     - ElevenLabs: how far the audio has played
     - a voice that reports nothing: estimated from speaking speed, held just short of the
       end until the voice really finishes. */
  function progressTracker(totalChars, rate, report) {
    const total = Math.max(1, totalChars);
    const msPerChar = 68 / (rate || 1);
    let best = 0, t0 = 0, iv = null, done = false, gotBoundary = false;
    const emit = f => {
      f = Math.max(0, Math.min(1, f));
      if (f > best) { best = f; try { report && report(best); } catch (e) {} }
    };
    return {
      start() {
        if (t0) return;
        t0 = performance.now();
        iv = setInterval(() => {
          if (done || gotBoundary) return;
          emit(Math.min(0.97, (performance.now() - t0) / msPerChar / total));
        }, 110);
      },
      boundary(absChar) { gotBoundary = true; emit((absChar + 1) / total); },
      at(absChar) { emit(absChar / total); },
      end() { done = true; clearInterval(iv); emit(1); },
      stop() { done = true; clearInterval(iv); }
    };
  }

  // audio playback progress for ElevenLabs (reads the clock every frame while playing)
  function audioProgress(getFrac, report) {
    let live = true;
    const tick = () => {
      if (!live) return;
      const f = getFrac();
      if (isFinite(f)) { try { report && report(Math.max(0, Math.min(1, f))); } catch (e) {} }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { live = false; };
  }

  async function playResonant(blob, fx, { onStart, onEnd, onProgress } = {}) {
    if (!elCtx) elCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (elCtx.state === 'suspended') await elCtx.resume();
    const buf = await elCtx.decodeAudioData(await blob.arrayBuffer());
    const src = elCtx.createBufferSource(); src.buffer = buf;
    const ghost = elCtx.createBufferSource(); ghost.buffer = buf;
    ghost.detune.value = -500;
    const dry = elCtx.createGain(); dry.gain.value = 1 - fx.wet * 0.35;
    const wet = elCtx.createGain(); wet.gain.value = fx.wet;
    const gg = elCtx.createGain(); gg.gain.value = fx.ghost;
    const conv = elCtx.createConvolver(); conv.buffer = reverbImpulse(elCtx, fx.reverb);
    const an = makeAnalyser();
    if (an) { src.connect(an); an.connect(dry); curAnalyser = an; } else src.connect(dry);
    dry.connect(elCtx.destination);
    src.connect(conv); ghost.connect(gg); gg.connect(conv);
    conv.connect(wet); wet.connect(elCtx.destination);
    elPlaying = true;
    let done = false;
    let stopProg = null;
    const finish = () => {
      if (done) return;
      done = true; elPlaying = false; elStop = null;
      if (stopProg) stopProg();
      if (curAnalyser === an) curAnalyser = null;
      onProgress && onProgress(1);
      onEnd && onEnd();
    };
    elStop = () => { try { src.stop(); ghost.stop(); } catch (e) {} try { wet.disconnect(); } catch (e) {} finish(); };
    src.onended = () => {
      try { ghost.stop(elCtx.currentTime + 0.3); } catch (e) {}
      setTimeout(finish, 350); // let the tail breathe
    };
    onStart && onStart();
    const t = elCtx.currentTime;
    src.start(t); ghost.start(t);
    if (onProgress) stopProg = audioProgress(() => (elCtx.currentTime - t) / buf.duration, onProgress);
  }

  async function playPlain(blob, { onStart, onEnd, onProgress } = {}) {
    const url = URL.createObjectURL(blob);
    elAudio = new Audio(url);
    const audio = elAudio;
    let an = null;
    try { // route through WebAudio only to measure loudness for the orb; plays exactly as before
      if (!elCtx && (window.AudioContext || window.webkitAudioContext)) elCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (elCtx) {
        if (elCtx.state === 'suspended') await elCtx.resume();
        if (elCtx.state === 'running') {
          an = makeAnalyser();
          if (an) { elCtx.createMediaElementSource(audio).connect(an); an.connect(elCtx.destination); curAnalyser = an; }
        }
      }
    } catch (e) { an = null; }
    let stopProg = null;
    const clearAn = () => {
      if (stopProg) { stopProg(); stopProg = null; }
      if (an && curAnalyser === an) curAnalyser = null;
      onProgress && onProgress(1);
    };
    if (onProgress) audio.addEventListener('playing', () => {
      if (!stopProg) stopProg = audioProgress(() => audio.duration ? audio.currentTime / audio.duration : 0, onProgress);
    });
    elAudioOnEnd = () => { clearAn(); onEnd && onEnd(); }; // .pause() fires no event, so stopSpeaking() calls this itself
    audio.onplay = () => { onStart && onStart(); };
    audio.onended = () => { URL.revokeObjectURL(url); if (elAudio === audio) elAudio = null; elAudioOnEnd = null; clearAn(); onEnd && onEnd(); };
    audio.onerror = () => { URL.revokeObjectURL(url); if (elAudio === audio) elAudio = null; elAudioOnEnd = null; clearAn(); onEnd && onEnd(); };
    await audio.play();
  }

  function getElKey() { return localStorage.getItem(EL_STORE) || ''; }
  function setElKey(k) {
    if (k && k.trim()) localStorage.setItem(EL_STORE, k.trim());
    else localStorage.removeItem(EL_STORE);
  }

  async function fetchEleven(clean, signal) {
    const p = PRESETS[getPreset()];
    const voiceId = getCustomVoice() || p.el; // pasted Voice Library ID wins; preset still shapes tone + resonance
    const res = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_64', {
        method: 'POST',
        headers: { 'xi-api-key': getElKey(), 'content-type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_multilingual_v2',
          voice_settings: p.settings
        }),
        signal
      });
    if (!res.ok) throw new Error('ElevenLabs ' + res.status);
    return res.blob();
  }

  async function playBlob(blob, cbs) {
    const p = PRESETS[getPreset()];
    if (p.fx && (window.AudioContext || window.webkitAudioContext)) await playResonant(blob, p.fx, cbs);
    else await playPlain(blob, cbs);
  }

  async function speakEleven(clean, { onStart, onEnd, onProgress } = {}) {
    elAbort = new AbortController();
    try {
      const blob = await fetchEleven(clean, elAbort.signal);
      elAbort = null;
      await playBlob(blob, { onStart, onEnd, onProgress });
    } catch (e) {
      elAudio = null; elPlaying = false; elStop = null; elAbort = null;
      if (e && e.name === 'AbortError') {
        // user pressed End Transmission before audio arrived — clean exit, show reply
        onEnd && onEnd();
        return;
      }
      // quota exhausted / bad key / offline — fall back to device voice
      try { window.dispatchEvent(new CustomEvent('atlas-el-fallback', { detail: String(e && e.message || e) })); } catch (err) {}
      speakBrowser(clean, { onStart, onEnd, onProgress });
    }
  }

  function speakBrowser(clean, { onStart, onEnd, onProgress } = {}) {
    if (!('speechSynthesis' in window)) { onEnd && onEnd(); return; }
    // long texts: chunk by sentence to dodge engine cutoffs (esp. Chrome)
    const chunks = clean.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) || [clean];
    let idx = 0;
    let started = false;
    const myGen = ++speechGen; // claims this chain; stopSpeaking() bumps speechGen to cancel it
    const prog = progressTracker(clean.length, PRESETS[getPreset()].bRate, onProgress);
    let offset = 0; // characters of `clean` already spoken by earlier chunks

    function speakNext() {
      // Chrome fires onend/onerror on the utterance stopSpeaking() just cancelled —
      // without this guard that "completion" event just kicked off the next chunk,
      // which is why Silence looked like it did nothing.
      if (myGen !== speechGen) { prog.stop(); onEnd && onEnd(); return; }
      if (idx >= chunks.length) { prog.end(); onEnd && onEnd(); return; }
      const chunkText = chunks[idx++], chunkStart = offset;
      offset += chunkText.length;
      const u = new SpeechSynthesisUtterance(chunkText);
      if (preferredVoice) u.voice = preferredVoice;
      u.lang = 'en-GB';
      const p = PRESETS[getPreset()];
      u.rate = p.bRate;
      u.pitch = p.bPitch;
      u.onstart = () => { prog.start(); if (!started) { started = true; onStart && onStart(); } };
      u.onboundary = (ev) => {
        if (ev.name && ev.name !== 'word') return;
        bump(0.75);
        prog.boundary(chunkStart + (ev.charIndex || 0));
      };
      u.onend = () => { prog.at(chunkStart + chunkText.length); speakNext(); };
      u.onerror = speakNext;
      speechSynthesis.speak(u);
    }
    speakNext();
  }

  function cleanForSpeech(text) {
    // strip any residual markdown/symbols for cleaner speech
    let clean = String(text || '').replace(/[*_#`>|]/g, '').replace(/\s+/g, ' ').trim();
    // TTS engines spell out long ALL-CAPS words as acronyms ("GLYPHS" -> G-L-Y-P-H-S);
    // normalise them to title case for the voice only — short caps (AI, NMS) stay intact
    clean = clean.replace(/\b[A-Z]{4,}\b/g, m => m.charAt(0) + m.slice(1).toLowerCase());
    // phonetic respellings for words some voices spell out or mangle (audio only)
    const PRONOUNCE = [
      [/\bglyphs\b/gi, 'gliffs'],
      [/\bglyph\b/gi, 'gliff'],
      [/\bvy'keen\b/gi, 'vye keen'],
      [/\bautophage\b/gi, 'auto fayj'],
      [/\bkorvax\b/gi, 'corvax']
    ];
    for (const [re, sub] of PRONOUNCE) clean = clean.replace(re, sub);
    return clean;
  }

  function speak(text, cbs = {}) {
    if (!text) { cbs.onEnd && cbs.onEnd(); return; }
    stopSpeaking();
    const clean = cleanForSpeech(text);
    lastSpoken = clean.toLowerCase();
    if (getElKey() && getSource() !== 'device') speakEleven(clean, cbs);
    else speakBrowser(clean, cbs);
  }

  /* ---------- v4.0: STREAMED SPEECH ----------
     ATLAS starts talking as soon as the first sentence of Claude's reply
     arrives, instead of waiting for the whole answer. atlas.js feeds
     sentence-sized pieces with pushStream(); endStream() marks the end.
     ElevenLabs pieces are fetched as soon as they arrive (in parallel)
     and played strictly in order. onEnd fires exactly once. */
  let stream = null;

  function startStream(cbs = {}) {
    stopSpeaking();
    stream = {
      gen: speechGen, queue: [], playing: false, closed: false, count: 0,
      started: false, ended: false, cbs,
      useEleven: !!getElKey() && getSource() !== 'device',
      abort: new AbortController()
    };
    lastSpoken = '';
  }

  function pushStream(text) {
    const s = stream;
    if (!s || s.ended) return;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    lastSpoken = (lastSpoken + ' ' + clean.toLowerCase()).trim();
    const item = { text: clean, idx: s.count++ };
    if (s.useEleven) {
      item.blob = fetchEleven(clean, s.abort.signal);
      item.blob.catch(() => {}); // handled when its turn comes
    }
    s.queue.push(item);
    pumpStream(s);
  }

  function endStream() {
    const s = stream;
    if (!s || s.ended) return;
    s.closed = true;
    pumpStream(s);
  }

  function finishStream(s) {
    if (s.ended) return;
    s.ended = true;
    if (stream === s) stream = null;
    try { s.abort.abort(); } catch (e) {}
    s.cbs.onEnd && s.cbs.onEnd();
  }

  function pumpStream(s) {
    if (s.ended || s.playing) return;
    if (s.gen !== speechGen) { finishStream(s); return; }
    const item = s.queue.shift();
    if (!item) { if (s.closed) finishStream(s); return; }
    s.playing = true;
    const onStart = () => { if (!s.started) { s.started = true; s.cbs.onStart && s.cbs.onStart(); } };
    const onProgress = f => { if (!s.ended && s.cbs.onProgress) s.cbs.onProgress(item.idx, f); };
    const done = () => {
      if (s.ended) return;
      s.playing = false;
      if (s.gen !== speechGen) { finishStream(s); return; }
      pumpStream(s);
    };
    if (item.blob) {
      item.blob.then(blob => {
        if (s.ended || s.gen !== speechGen) return;
        return playBlob(blob, { onStart, onEnd: done, onProgress });
      }).catch(e => {
        if (s.ended || s.gen !== speechGen) return;
        // quota / bad key / offline — say the rest with the device voice
        try { window.dispatchEvent(new CustomEvent('atlas-el-fallback', { detail: String(e && e.message || e) })); } catch (err) {}
        s.useEleven = false;
        for (const q of s.queue) q.blob = null;
        speakDevicePiece(item.text, s, onStart, done, onProgress);
      });
    } else {
      speakDevicePiece(item.text, s, onStart, done, onProgress);
    }
  }

  function speakDevicePiece(text, s, onStart, done, onProgress) {
    if (!('speechSynthesis' in window)) { onProgress && onProgress(1); done(); return; }
    const prog = progressTracker(text.length, PRESETS[getPreset()].bRate, onProgress);
    const u = new SpeechSynthesisUtterance(text);
    if (preferredVoice) u.voice = preferredVoice;
    u.lang = 'en-GB';
    const p = PRESETS[getPreset()];
    u.rate = p.bRate;
    u.pitch = p.bPitch;
    u.onstart = () => { prog.start(); onStart(); };
    u.onboundary = (ev) => {
      if (ev.name && ev.name !== 'word') return;
      bump(0.75);
      prog.boundary(ev.charIndex || 0);
    };
    u.onend = () => { prog.end(); done(); };
    u.onerror = () => { prog.stop(); done(); };
    speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    speechGen++; // invalidate any in-flight device-voice chunk chain
    if (stream) finishStream(stream); // streamed reply: end it now (its onEnd fires once)
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (elAbort) { try { elAbort.abort(); } catch (e) {} elAbort = null; }
    if (elAudio) {
      try { elAudio.pause(); } catch (e) {}
      elAudio = null;
      if (elAudioOnEnd) { const cb = elAudioOnEnd; elAudioOnEnd = null; cb(); }
    }
    if (elStop) { try { elStop(); } catch (e) {} elStop = null; }
    // Suspend the ElevenLabs audio context to guarantee silence on all nodes
    if (elCtx && elCtx.state === 'running') {
      elCtx.suspend().then(() => elCtx.resume()).catch(() => {});
    }
    elPlaying = false;
    curAnalyser = null;
  }

  function isSpeaking() {
    return (!!stream && stream.started && !stream.ended) ||
           elPlaying ||
           (!!elAudio && !elAudio.paused && !elAudio.ended) ||
           ('speechSynthesis' in window && speechSynthesis.speaking);
  }

  return { supported, startListening, stopListening, isListening, speak, stopSpeaking, isSpeaking,
           startStream, pushStream, endStream, level,
           listVoices, setVoice, getVoiceName, getElKey, setElKey, getPreset, setPreset, getCustomVoice, setCustomVoice, getSource, setSource, getLastSpoken,
           startWakeListening, stopWakeListening, isWakeActive };
})();
