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
    r.onresult = (e) => {
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
          onWake();
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

  /* ---------- OUTPUT ---------- */
  const VOICE_STORE = 'atlas_voice';
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

  /* ---------- ElevenLabs (optional, ultra-natural neural voice) ---------- */
  const EL_STORE = 'atlas_el_key';
  const EL_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9'; // "Daniel" — calm, deep, British
  let elAudio = null;

  function getElKey() { return localStorage.getItem(EL_STORE) || ''; }
  function setElKey(k) {
    if (k && k.trim()) localStorage.setItem(EL_STORE, k.trim());
    else localStorage.removeItem(EL_STORE);
  }

  async function speakEleven(clean, { onStart, onEnd } = {}) {
    try {
      const res = await fetch(
        'https://api.elevenlabs.io/v1/text-to-speech/' + EL_VOICE_ID + '?output_format=mp3_44100_64', {
          method: 'POST',
          headers: { 'xi-api-key': getElKey(), 'content-type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.55, similarity_boost: 0.7 }
          })
        });
      if (!res.ok) throw new Error('ElevenLabs ' + res.status);
      const url = URL.createObjectURL(await res.blob());
      elAudio = new Audio(url);
      elAudio.onplay = () => { onStart && onStart(); };
      elAudio.onended = () => { URL.revokeObjectURL(url); elAudio = null; onEnd && onEnd(); };
      elAudio.onerror = () => { URL.revokeObjectURL(url); elAudio = null; onEnd && onEnd(); };
      await elAudio.play();
    } catch (e) {
      // quota exhausted / bad key / offline — fall back to device voice
      elAudio = null;
      speakBrowser(clean, { onStart, onEnd });
    }
  }

  function speakBrowser(clean, { onStart, onEnd } = {}) {
    if (!('speechSynthesis' in window)) { onEnd && onEnd(); return; }
    // long texts: chunk by sentence to dodge engine cutoffs (esp. Chrome)
    const chunks = clean.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) || [clean];
    let idx = 0;
    let started = false;

    function speakNext() {
      if (idx >= chunks.length) { onEnd && onEnd(); return; }
      const u = new SpeechSynthesisUtterance(chunks[idx++]);
      if (preferredVoice) u.voice = preferredVoice;
      u.lang = 'en-GB';
      u.rate = 0.92;
      u.pitch = 0.85;
      u.onstart = () => { if (!started) { started = true; onStart && onStart(); } };
      u.onend = speakNext;
      u.onerror = speakNext;
      speechSynthesis.speak(u);
    }
    speakNext();
  }

  function speak(text, cbs = {}) {
    if (!text) { cbs.onEnd && cbs.onEnd(); return; }
    stopSpeaking();
    // strip any residual markdown/symbols for cleaner speech
    let clean = text.replace(/[*_#`>|]/g, '').replace(/\s+/g, ' ').trim();
    // TTS engines spell out long ALL-CAPS words as acronyms ("GLYPHS" -> G-L-Y-P-H-S);
    // normalise them to title case for the voice only — short caps (AI, NMS) stay intact
    clean = clean.replace(/\b[A-Z]{4,}\b/g, m => m.charAt(0) + m.slice(1).toLowerCase());
    if (getElKey()) speakEleven(clean, cbs);
    else speakBrowser(clean, cbs);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (elAudio) { try { elAudio.pause(); } catch (e) {} elAudio = null; }
  }

  function isSpeaking() {
    return (!!elAudio && !elAudio.paused && !elAudio.ended) ||
           ('speechSynthesis' in window && speechSynthesis.speaking);
  }

  return { supported, startListening, stopListening, isListening, speak, stopSpeaking, isSpeaking,
           listVoices, setVoice, getVoiceName, getElKey, setElKey,
           startWakeListening, stopWakeListening, isWakeActive };
})();
