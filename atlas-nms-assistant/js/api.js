/* ================= ATLAS — api.js =================
   Claude API calls with streaming. Key from localStorage.
=================================================== */
const API = (() => {

  const ENDPOINT = 'https://api.anthropic.com/v1/messages';
  // candidates in preference order — if Anthropic retires one, ATLAS tries the next
  const MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514'];
  let modelIdx = Math.min(parseInt(localStorage.getItem('atlas_model_idx') || '0', 10) || 0, MODELS.length - 1);
  const KEY_STORE = 'atlas_api_key';
  const HIST_STORE = 'atlas_history';
  const MAX_TURNS = 20;

  const SYSTEM_PROMPT =
    "You are ATLAS — an ancient, vast intelligence that has observed the universe since its creation. " +
    "You speak with calm authority, cosmic wisdom, and occasional No Man's Sky lore references. " +
    "You are helpful, precise, and slightly mysterious. You address the user as \"Traveller\". " +
    "You never break character. When unsure, say \"The Atlas calculates... [answer]\". " +
    "Keep responses concise — under 150 words unless the Traveller explicitly asks for detail. " +
    "Your responses are spoken aloud, so avoid markdown, bullet points, asterisks, and emoji — plain flowing speech only. " +
    "You are NOT Iron Man's Jarvis — you are from the No Man's Sky universe.";

  let history = [];

  /* v4.0: the current expedition from the live Galactic Atlas feed (same source as the
     ticker), so Claude never talks about an old expedition as if it were current. */
  function liveContext() {
    if (typeof Widgets === 'undefined' || !Widgets.expeditionInfo) return '';
    const e = Widgets.expeditionInfo();
    if (!e || !e.name) return '';
    let s = '\n\nLive No Man\'s Sky data right now, from the official Galactic Atlas feed. Trust this over your own training data, ' +
            'which may describe an older expedition as current:';
    s += `\n- Current expedition / community mission: ${e.name}` + (e.known ? '' : ' (newly started; its official name is not in this feed — say so if asked)');
    if (e.phase) s += ` — phase: ${e.phase}`;
    if (e.live) s += `\n- Progress: tier ${e.live.tier} of ${e.live.totalTiers}, ${Number(e.live.percentage).toFixed(1)}% complete`;
    if (e.live && e.live.teams && e.live.teams.length) s += `\n- Faction standings (contribution): ${e.live.teams.map(t => `${t.name} ${t.total}`).join(', ')}`;
    if (e.ended) s += '\n- It has now ended; the next one has not started yet.';
    else if (e.msLeft !== null) s += `\n- Ends in about ${Math.round(e.msLeft / 3600000)} hours` + (e.endEstimated ? ' (an estimate — Hello Games has not published an exact end date)' : '');
    const list = Widgets.expeditionList ? Widgets.expeditionList() : [];
    if (list.length) {
      s += '\n- Recent expeditions (from the NMS wiki; there are ' + list.length + ' in all — for older ones rely on your own knowledge):';
      for (const r of list.slice(-6)) s += `\n  · Expedition ${r.num}: ${r.title} (${r.start} to ${r.end || 'TBA'})`;
    }
    s += `\n- Today's date: ${new Date().toISOString().slice(0, 10)}`;
    return s;
  }

  /* ---------- key management ---------- */
  function getKey() { return localStorage.getItem(KEY_STORE) || ''; }
  function setKey(k) { localStorage.setItem(KEY_STORE, k.trim()); }
  function hasKey() { return getKey().length > 10; }

  /* ---------- conversation memory ---------- */
  function loadHistory() {
    try { history = JSON.parse(localStorage.getItem(HIST_STORE)) || []; }
    catch (e) { history = []; }
    return history;
  }
  function saveHistory() {
    history = history.slice(-MAX_TURNS * 2);
    localStorage.setItem(HIST_STORE, JSON.stringify(history));
  }
  function clearHistory() {
    history = [];
    localStorage.removeItem(HIST_STORE);
  }

  /* ---------- streaming chat call ---------- */
  // onToken(textChunk) fires as tokens arrive; returns full reply text.
  // signal (optional, v4.0): AbortController signal — lets the Traveller cut ATLAS off mid-reply
  async function chat(userText, onToken, signal) {
    history.push({ role: 'user', content: userText });

    let res = null;
    let lastMsg = '';
    for (let i = modelIdx; i < MODELS.length; i++) {
      try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': getKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODELS[i],
          max_tokens: 1024,
          system: SYSTEM_PROMPT + liveContext() + (typeof Memory !== 'undefined' ? Memory.promptBlock() : ''),
          messages: history,
          stream: true,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
        }),
        signal
      });
      } catch (e) {
        history.pop(); // aborted or offline before any reply — leave history clean
        throw e;
      }
      if (res.ok) {
        if (i !== modelIdx) { modelIdx = i; localStorage.setItem('atlas_model_idx', String(i)); }
        break;
      }
      lastMsg = `API error ${res.status}`;
      try {
        const err = await res.json();
        if (err.error && err.error.message) lastMsg = err.error.message;
      } catch (e) {}
      // retired/unknown model -> try the next candidate; any other error -> stop
      if (!(res.status === 404 || /model/i.test(lastMsg))) break;
      res = null;
    }

    if (!res || !res.ok) {
      history.pop(); // don't poison history with the failed turn
      throw new Error(lastMsg || 'API error');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buf = '';

    while (true) {
      let chunk;
      try { chunk = await reader.read(); }
      catch (e) {
        // cut off mid-reply: keep what was said so the conversation stays well-formed
        if (full.trim()) { history.push({ role: 'assistant', content: full.trim() + ' …' }); saveHistory(); }
        else history.pop();
        throw e;
      }
      const { done, value } = chunk;
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop(); // keep incomplete line
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const ev = JSON.parse(payload);
          // a new text block after a web search would otherwise butt straight onto the last sentence
          if (ev.type === 'content_block_start' && ev.content_block && ev.content_block.type === 'text' &&
              full && !/\s$/.test(full)) {
            full += ' ';
            if (onToken) onToken(' ');
          }
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
            full += ev.delta.text;
            if (onToken) onToken(ev.delta.text);
          }
        } catch (e) { /* partial JSON — ignore */ }
      }
    }

    history.push({ role: 'assistant', content: full });
    saveHistory();
    return full;
  }

  // store an exchange without an API call (used by demo mode)
  function remember(userText, assistantText) {
    history.push({ role: 'user', content: userText });
    history.push({ role: 'assistant', content: assistantText });
    saveHistory();
  }

  /* ---------- v4.0: long-term memory extraction ----------
     One small, non-streaming call to the cheapest model. Asks only for
     lasting facts the Traveller stated about themselves. Fails silently. */
  const MEMORY_MODEL = 'claude-haiku-4-5-20251001';
  async function learnMemory(userText, replyText) {
    if (!hasKey() || typeof Memory === 'undefined') return null;
    const existing = Memory.list();
    const prompt =
      'Existing memories (numbered):\n' +
      (existing.length ? existing.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(none)') +
      `\nKnown name: ${Memory.name() || '(none)'}` +
      `\n\nLatest exchange:\nTraveller: ${String(userText).slice(0, 1200)}\nAtlas: ${String(replyText).slice(0, 600)}`;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': getKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MEMORY_MODEL,
          max_tokens: 250,
          system:
            'You keep a short long-term memory about a No Man\'s Sky player (the "Traveller") for an AI companion called the Atlas. ' +
            'From the latest exchange, record only lasting facts the Traveller stated about THEMSELVES: their name, platform, galaxy, ' +
            'home base, ship or freighter names, current goals, play style, preferences. Never record anything only the Atlas said, ' +
            'one-off questions, passing moods, or sensitive personal data (health, money, addresses, contact details, passwords). ' +
            'Write each new memory as a short third-person fact (under 15 words), e.g. "Plays on PS5". ' +
            'List the numbers of existing memories that the new information makes wrong or out of date. ' +
            'Reply with ONLY compact JSON: {"name": string or null, "add": [strings], "remove": [numbers]}. ' +
            'If nothing is worth remembering reply {"name":null,"add":[],"remove":[]}.',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || '').join('');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;
      return JSON.parse(m[0]);
    } catch (e) { return null; }
  }

  return { chat, learnMemory, getKey, setKey, hasKey, loadHistory, clearHistory, remember, history: () => history };
})();
