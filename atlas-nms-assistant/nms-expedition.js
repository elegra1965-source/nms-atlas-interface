/* NMS Hub family: the shared expedition source (2026-11-25). One file, identical on every site.
   Reads the schedule that map.nomansskyhub.app builds from Hello Games' own news (checked every 3 hours,
   so a new expedition is picked up the day it is announced, no site update needed).
   NMSExp.get(force) -> Promise<{ live, next, last, research, stale, runs } | null>   (live/next/last are worked
   out here against the clock, so a run starts and ends on time even between fetches; the last good answer is
   kept on this device and used offline). NMSExp.cached() -> same, synchronous, or null. */
(function () {
  'use strict';
  var URL_ = 'https://map.nomansskyhub.app/.netlify/functions/expedition', LS = 'nms_exp_v1', TTL = 5 * 60000;
  var mem = null, inflight = null;
  function load() { try { var c = JSON.parse(localStorage.getItem(LS) || 'null'); return c && c.data && c.data.runs ? c : null; } catch (e) { return null; } }
  function nameOf(r) { return (r.num ? 'EXPEDITION ' + r.num + ': ' : 'EXPEDITION: ') + String(r.title).toUpperCase(); }
  function view(c) {
    if (!c) return null;
    var now = Date.now(), live = null, next = null, last = null;
    c.data.runs.forEach(function (r) {
      var ended = r.end && now >= r.end;
      if (r.start <= now && !ended) { if (!live || r.start > live.start) live = r; }
      else if (r.start > now) { if (!next || r.start < next.start) next = r; }
      else if (!last || r.end > last.end) last = r;
    });
    function n(r) { if (r && !r.name) r.name = nameOf(r); return r; }
    return { live: n(live), next: n(next), last: n(last), research: c.data.research || null,
      stale: !!c.data.stale || (Date.now() - c.at > 48 * 3600000 && !navigator.onLine), runs: c.data.runs, at: c.at };
  }
  function cached() { mem = mem || load(); return view(mem); }
  function get(force) {
    mem = mem || load();
    if (!force && mem && Date.now() - mem.at < TTL) return Promise.resolve(view(mem));
    if (inflight) return inflight;
    var ctl = window.AbortController ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, 9000) : 0;
    inflight = fetch(URL_, ctl ? { signal: ctl.signal } : undefined).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.runs) || !d.runs.length) throw new Error('empty');
        mem = { at: Date.now(), data: { runs: d.runs, research: d.research || null, stale: !!d.stale } };
        try { localStorage.setItem(LS, JSON.stringify(mem)); } catch (e) {}
        return view(mem);
      })
      .catch(function () { return view(mem); })
      .then(function (v) { clearTimeout(t); inflight = null; return v; });
    return inflight;
  }
  window.NMSExp = { get: get, cached: cached };
})();
