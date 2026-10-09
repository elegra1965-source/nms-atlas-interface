/* ================= ATLAS — memory.js (v4.0) =================
   Long-term memory: durable facts about the Traveller that survive
   past the 20-exchange chat history. Stored only in localStorage.
   - With an API key: api.js asks a small model after each exchange
     whether anything worth remembering was said (see learnFromAI).
   - Demo mode: a few simple patterns ("my name is…", "I play on…").
   Fed back to Claude through promptBlock() on every chat.
============================================================== */
const Memory = (() => {
  const STORE = 'atlas_memory';
  const NAME_STORE = 'atlas_traveller_name';
  const MAX = 40;

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE));
      return Array.isArray(v) ? v.filter(x => x && typeof x.t === 'string') : [];
    } catch (e) { return []; }
  }
  function save(items) {
    try { localStorage.setItem(STORE, JSON.stringify(items.slice(-MAX))); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('atlas-memory-changed')); } catch (e) {}
  }

  function list() { return load().map(x => x.t); }

  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  function add(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (t.length < 3) return false;
    const items = load();
    if (items.some(x => norm(x.t) === norm(t))) return false;
    items.push({ t, at: Date.now() });
    save(items);
    return true;
  }
  function remove(i) {
    const items = load();
    if (i < 0 || i >= items.length) return;
    items.splice(i, 1);
    save(items);
  }
  function clear() {
    try { localStorage.removeItem(STORE); localStorage.removeItem(NAME_STORE); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('atlas-memory-changed')); } catch (e) {}
  }

  // falls back to the Traveller ID saved on the Hub (shared cookie on .nomansskyhub.app)
  function hubName() { try { const m = document.cookie.match(/(?:^|; )nmsTraveller=([^;]*)/); return m ? (JSON.parse(decodeURIComponent(m[1])).n || '') : ''; } catch (e) { return ''; } }
  function name() { return localStorage.getItem(NAME_STORE) || hubName(); }
  function setName(n) {
    const v = String(n || '').replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 40);
    if (v) localStorage.setItem(NAME_STORE, v);
    else localStorage.removeItem(NAME_STORE);
    try { window.dispatchEvent(new CustomEvent('atlas-memory-changed')); } catch (e) {}
  }

  // text appended to Claude's system prompt
  function promptBlock() {
    const n = name(), items = list();
    if (!n && !items.length) return '';
    let s = '\n\nWhat you remember about this Traveller from earlier visits (use it naturally when relevant, never recite it as a list):';
    if (n) s += `\n- Their name is ${n}. You may address them as "Traveller ${n}" now and then.`;
    for (const t of items) s += `\n- ${t}`;
    return s;
  }

  /* ---------- demo-mode learning (no API) ---------- */
  const STOP = /^(sure|sorry|not|just|so|going|looking|trying|here|fine|good|ok|okay|back|a|the|an|in|on|at|playing|new)$/i;
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  function learnLocal(userText) {
    const t = ' ' + String(userText || '') + ' ';
    let learned = false;
    let m = t.match(/\b(?:my name is|call me|i am called|i'm called)\s+([A-Za-z][A-Za-z'\-]{1,20})/i);
    if (m && !STOP.test(m[1])) { setName(cap(m[1])); learned = true; }
    m = t.match(/\bi (?:play|am playing|'m playing|play it) on (?:the |a |my )?(pc|steam|ps4|ps5|playstation(?: \d)?|xbox(?: series [xs])?|xbox one|switch(?: 2)?|mac|steam deck)\b/i);
    if (m) { learned = add('Plays No Man\'s Sky on ' + m[1].replace(/\b\w/g, c => c.toUpperCase())) || learned; }
    m = t.match(/\bmy (ship|starship|freighter|frigate|base|multi-?tool|companion|pet) is (?:called|named)\s+([^.,!?]{2,30})/i);
    if (m) { learned = add(`Their ${m[1].toLowerCase()} is called ${m[2].trim()}`) || learned; }
    m = t.match(/\bi(?:'m| am) (?:in|exploring) (?:the )?([A-Z][a-z]+(?: [A-Z][a-z]+)?) galaxy\b/);
    if (m) { learned = add(`Currently exploring the ${m[1]} galaxy`) || learned; }
    return learned;
  }

  // cheap gate: only ask the model when the Traveller seems to talk about themselves
  function worthChecking(userText) {
    return /\b(i|i'm|im|i've|ive|my|me|mine|myself|call me)\b/i.test(String(userText || ''));
  }

  // apply a {name, add, remove} result from the extraction model
  function applyUpdate(u) {
    if (!u || typeof u !== 'object') return false;
    let changed = false;
    const items = load();
    const drop = new Set((Array.isArray(u.remove) ? u.remove : [])
      .map(n => parseInt(n, 10) - 1).filter(n => n >= 0 && n < items.length));
    let kept = items.filter((_, i) => !drop.has(i));
    if (kept.length !== items.length) changed = true;
    for (const raw of (Array.isArray(u.add) ? u.add : []).slice(0, 4)) {
      const t = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      if (t.length < 3 || kept.some(x => norm(x.t) === norm(t))) continue;
      kept.push({ t, at: Date.now() });
      changed = true;
    }
    if (changed) save(kept);
    if (typeof u.name === 'string' && u.name.trim() && u.name.trim() !== name()) { setName(u.name); changed = true; }
    return changed;
  }

  /* ---------- export / import (plain text, one memory per line) ---------- */
  function exportText() {
    const lines = ['ATLAS MEMORY — exported ' + new Date().toISOString().slice(0, 10)];
    if (name()) lines.push('NAME: ' + name());
    for (const t of list()) lines.push('- ' + t);
    return lines.join('\n') + '\n';
  }
  function importText(text) {
    let n = 0;
    for (const line of String(text || '').split(/\r?\n/)) {
      const nm = line.match(/^NAME:\s*(.+)$/i);
      if (nm) { setName(nm[1]); continue; }
      const m = line.match(/^\s*[-•*◆]\s*(.+)$/);
      if (m && add(m[1])) n++;
    }
    return n;
  }

  return { list, add, remove, clear, name, setName, promptBlock, learnLocal, worthChecking, applyUpdate, exportText, importText };
})();
