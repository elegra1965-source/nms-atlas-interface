/* nms-update.js -- shared by all six No Man's Sky Hub sites (2026-10-24, Tony).
   An installed app on a phone is not reloaded when you switch back to it, so it
   could keep showing an old version until it was closed and reopened.
   Now: each time the app comes back to the screen (and every 30 minutes while it
   stays open) it asks for the newest sw.js. When a new version has been put live,
   a small bar shows at the bottom: "New version ready · tap to update". One tap
   reloads in place; x hides it until the next new version.
   Never reloads by itself (that could lose a half-typed edit or a 3D view).
   Text comes from the site's language pack via NMS_T when lang.js is loaded.
   2026-10-27: + the ⟳ Refresh button for installed apps (see mountRefresh below).
   2026-10-31: + PATCH NOTES pop-up after an update (see openNotes below). */
(function () {
  if (!('serviceWorker' in navigator) || window.NMS_UPDATE) return;
  var bar = null, lastCheck = 0, loadedAt = Date.now();
  var SELF_SRC = (document.currentScript && document.currentScript.src) || location.href;
  function T(s) { return window.NMS_T ? window.NMS_T(s) : s; }

  function show() {
    if (bar) { bar.style.display = ''; return; }
    var st = document.createElement('style');
    st.textContent =
      '#nmsUpd{position:fixed;left:12px;right:12px;margin:0 auto;width:-webkit-fit-content;width:fit-content;max-width:min(520px,calc(100vw - 24px));bottom:calc(14px + env(safe-area-inset-bottom,0px));' +
      'z-index:2147483000;display:flex;align-items:stretch;box-sizing:border-box;' +
      'background:rgba(8,14,22,.96);border:1px solid #2ee6d6;border-radius:6px;box-shadow:0 0 18px rgba(46,230,214,.35),0 8px 24px rgba(0,0,0,.6);' +
      'animation:nmsUpdIn .35s ease-out}' +
      '#nmsUpd button{font-family:inherit;font-weight:600;font-size:14px;line-height:1.25;letter-spacing:normal;text-transform:none;white-space:normal;color:#e8fbff;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '#nmsUpdGo{flex:1 1 auto;min-width:0;padding:12px 14px 12px 16px;text-align:left;letter-spacing:.03em;display:flex;align-items:center;gap:10px;min-height:44px}' +
      '#nmsUpdGo b{color:#2ee6d6;font-size:16px}' +
      '#nmsUpd #nmsUpdX{padding:0 14px;border-left:1px solid rgba(46,230,214,.3);color:#9fb6c2;font-size:18px;min-width:44px}' +
      '#nmsUpd button:focus-visible{outline:2px solid #2ee6d6;outline-offset:-3px}' +
      '@keyframes nmsUpdIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
      '@media (prefers-reduced-motion:reduce){#nmsUpd{animation:none}}';
    document.head.appendChild(st);
    bar = document.createElement('div');
    bar.id = 'nmsUpd';
    bar.setAttribute('role', 'status');
    var go = document.createElement('button');
    go.id = 'nmsUpdGo'; go.type = 'button';
    var ic = document.createElement('b'); ic.textContent = '↻'; ic.setAttribute('aria-hidden', 'true');
    var tx = document.createElement('span'); tx.textContent = T('New version ready · tap to update');
    go.appendChild(ic); go.appendChild(tx);
    go.addEventListener('click', function () { tx.textContent = '…'; try { sessionStorage.setItem('nmsPNgo', '1'); } catch (e) {} location.reload(); });
    var x = document.createElement('button');
    x.id = 'nmsUpdX'; x.type = 'button'; x.textContent = '×';
    x.setAttribute('aria-label', T('Later')); x.title = T('Later');
    x.addEventListener('click', function () { bar.style.display = 'none'; });
    bar.appendChild(go); bar.appendChild(x);
    (document.body || document.documentElement).appendChild(bar);
  }

  function watch(w) {
    if (!w) return;
    if (w.state === 'activated') { show(); return; }
    w.addEventListener('statechange', function () { if (w.state === 'activated') show(); });
  }

  function check() {
    // the page itself was just loaded from the network, so it is already the newest
    if (Date.now() - loadedAt < 60000 || Date.now() - lastCheck < 30000) return;
    lastCheck = Date.now();
    navigator.serviceWorker.getRegistration().then(function (r) {
      if (!r || !r.active) return;
      var before = r.active;
      r.addEventListener('updatefound', function () { watch(r.installing); }, { once: true });
      return r.update().then(function () {
        var w = r.installing || r.waiting;
        if (w) watch(w); else if (r.active && r.active !== before) show();
      });
    }).catch(function () {});
  }

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });
  setInterval(function () { if (document.visibilityState === 'visible') check(); }, 30 * 60000);

  /* ⟳ Refresh (2026-10-27, Tony): an installed app has no browser reload and pull-to-refresh
     doesn't work on every page (the Map's drag moves the map). So installed apps get a small ⟳
     button next to the language button (or in a [data-nms-refresh-slot] the page provides).
     Tap: fetch the newest sw.js, let a new version take over if there is one, then reload in
     place (same address, so the same view). Shown only in the installed app. */
  var note = null;
  function say(msg) {
    if (!note) {
      note = document.createElement('div'); note.id = 'nmsRefNote'; note.setAttribute('role', 'status');
      note.style.cssText = 'position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:2147483001;' +
        'background:rgba(8,14,22,.96);border:1px solid #2ee6d6;border-radius:6px;color:#e8fbff;font:600 14px/1.3 system-ui,sans-serif;' +
        'padding:10px 16px;box-shadow:0 0 18px rgba(46,230,214,.35);width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;text-align:center;pointer-events:none';
      (document.body || document.documentElement).appendChild(note);
    }
    note.textContent = msg; note.style.display = '';
  }
  function refresh() {
    say(T('Updating…'));
    var go = function () { location.reload(); };
    navigator.serviceWorker.getRegistration().then(function (r) {
      if (!r) return go();
      var before = r.active;
      return r.update().then(function () {
        var w = r.installing || r.waiting;
        if (!w && r.active === before) { say(T('✓ Up to date')); setTimeout(go, 700); return; }
        var done = false, fin = function () { if (!done) { done = true; go(); } };
        navigator.serviceWorker.addEventListener('controllerchange', fin);
        if (w) w.addEventListener('statechange', function () { if (w.state === 'activated') fin(); });
        setTimeout(fin, 4000);
      });
    }).catch(go);
  }
  function installed() {
    try {
      return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches ||
        matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: minimal-ui)').matches;
    } catch (e) { return false; }
  }
  function mountRefresh() {
    if (!installed() || document.getElementById('nmsRefresh')) return;
    var slot = document.querySelector('[data-nms-refresh-slot]');
    var ref = slot || document.querySelector('[data-lang-btn]') || document.getElementById('langSel');
    if (!ref) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'nmsRefresh';
    b.className = slot ? (slot.getAttribute('data-nms-refresh-slot') || '') : (ref.tagName === 'BUTTON' ? ref.className : '');
    b.textContent = '⟳';
    b.title = T('Refresh'); b.setAttribute('aria-label', T('Refresh'));
    b.addEventListener('click', refresh);
    var st = document.createElement('style');
    st.textContent = '#nmsRefresh{font-size:1.15em;line-height:1;min-width:36px;cursor:pointer}' +
      (b.className ? '' : '#nmsRefresh{background:rgba(8,14,22,.85);color:#2ee6d6;border:1px solid rgba(46,230,214,.55);border-radius:6px;padding:6px 10px;min-height:32px}');
    document.head.appendChild(st);
    if (slot) slot.appendChild(b); else ref.parentNode.insertBefore(b, ref.nextSibling);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountRefresh); else mountRefresh();

  /* PATCH NOTES pop-up (2026-10-31, Tony). Replaces the old '✓ Updated · last update today' toast.
     Each site ships its own patch-notes.json next to this file:
       {version:'v41', date:'YYYY-MM-DD', site:'NMS GALACTIC MAP', lastToday:false,
        items:[{tag:'new'|'improved'|'fixed', text:{en,es,...}, url?}],
        others:[{site, version, url, items:[...]}]}   <- Hub only: one folded line per other updated site
     Shown once per version: after a tap on the update bar, or on the first open of a new version
     (only for people who had the site before = a service worker already controlled the page).
     Skipped versions: only the newest notes (the file only holds the newest). Frame words come
     from the language pack (NMS_T); note texts pick the current language, English if missing.
     Open by hand: NMS_UPDATE.notes()  or add ?patchnotes to the address. */
  var PN_URL = (function () { try { return new URL('patch-notes.json', SELF_SRC).href; } catch (e) { return 'patch-notes.json'; } })();
  var hadSW = !!navigator.serviceWorker.controller, pnData = null, pnEl = null;
  function lang() { try { return window.NMS_LANG ? window.NMS_LANG() : 'en'; } catch (e) { return 'en'; } }
  function pick(t) { if (!t || typeof t === 'string') return t || ''; return t[lang()] || t.en || ''; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmtDate(s) {
    try {
      var d = new Date(s + 'T12:00:00');
      if (window.NMS_DATE) return window.NMS_DATE(d, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
      return d.toLocaleDateString(lang(), { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    } catch (e) { return s; }
  }
  var TAGS = { 'new': 'NEW', improved: 'IMPROVED', fixed: 'FIXED' };
  function itemList(items, openN) {
    var ul = el('ul'), more = [];
    items.forEach(function (it, i) {
      var li = el('li'), tg = it.tag in TAGS ? it.tag : 'new';
      li.appendChild(el('span', 'pn-tag pn-' + tg, T(TAGS[tg])));
      var tx;
      if (it.url) { tx = el('a', 'pn-tx', pick(it.text) + ' →'); tx.href = it.url; }
      else tx = el('span', 'pn-tx', pick(it.text));
      li.appendChild(tx);
      if (openN && i >= openN) { li.hidden = true; more.push(li); }
      ul.appendChild(li);
    });
    return { ul: ul, more: more };
  }
  function pnCSS() {
    if (document.getElementById('nmsPNcss')) return;
    var st = document.createElement('style'); st.id = 'nmsPNcss';
    var OR = "Orbitron,'Chakra Petch',sans-serif", MO = "'Share Tech Mono',ui-monospace,monospace", RJ = "Rajdhani,'Chakra Petch',system-ui,sans-serif";
    st.textContent =
      '#nmsPN{position:fixed;inset:0;z-index:2147483002;background:rgba(2,6,12,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;opacity:0;transition:opacity .25s}' +
      '#nmsPN.on{opacity:1}' +
      '#nmsPN *{box-sizing:border-box}' +
      '#nmsPN button::before,#nmsPN button::after,#nmsPN a::before,#nmsPN a::after{content:none!important;display:none!important}' +
      '#nmsPN button{margin:0;box-shadow:none;text-shadow:none;transform:none;border-radius:0;text-transform:none;width:auto;height:auto;-webkit-tap-highlight-color:transparent}' +
      '#nmsPN .pn{position:relative;width:min(440px,100%);max-height:calc(100% - 8px);display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(15,22,32,.97),rgba(7,11,17,.97));border:1px solid rgba(0,229,255,.35);box-shadow:0 0 40px rgba(0,229,255,.15),inset 0 0 30px rgba(0,229,255,.05);color:#cfe0f0;font:500 16px/1.35 ' + RJ + ';text-align:left;clip-path:inset(0 0 100% 0)}' +
      '#nmsPN .pn-sc{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;padding:22px 20px 16px}' +
      '#nmsPN .pn-c{position:absolute;width:16px;height:16px;border:2px solid #00e5ff;opacity:0;transform:scale(1.6);transition:opacity .2s,transform .25s;pointer-events:none}' +
      '#nmsPN .pn.done .pn-c{opacity:1;transform:none}' +
      '#nmsPN .c1{top:-1px;left:-1px;border-right:0;border-bottom:0}#nmsPN .c2{top:-1px;right:-1px;border-left:0;border-bottom:0}' +
      '#nmsPN .c3{bottom:-1px;left:-1px;border-right:0;border-top:0}#nmsPN .c4{bottom:-1px;right:-1px;border-left:0;border-top:0}' +
      '#nmsPN .pn-x{position:absolute;z-index:1;top:6px;right:8px;background:rgba(15,22,32,.97);border-radius:4px!important;border:0;color:#00e5ff;font:700 20px ' + OR + ';cursor:pointer;padding:6px 10px;min-width:44px;min-height:44px;line-height:1}' +
      '#nmsPN .pn-k{font:13px ' + MO + ';color:#f0a500;letter-spacing:.12em;padding-right:40px}' +
      '#nmsPN .pn-k i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#f0a500;margin-right:7px;vertical-align:1px;animation:nmsPNb 1.2s infinite}' +
      '#nmsPN h2{margin:6px 0 2px;padding-right:36px;font:900 21px/1.25 ' + OR + ';color:#eaf6ff;letter-spacing:.06em;text-transform:none}' +
      '#nmsPN h2 b{color:#00e5ff;letter-spacing:.1em;white-space:nowrap}' +
      '#nmsPN .pn-sub{font:12px ' + MO + ';color:#0096a8;letter-spacing:.1em;margin-bottom:12px;border-bottom:1px solid rgba(0,229,255,.15);padding-bottom:10px}' +
      '#nmsPN ul{list-style:none;margin:0;padding:0}' +
      '#nmsPN li{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed rgba(0,229,255,.08);margin:0}' +
      '#nmsPN li[hidden]{display:none}' +
      '#nmsPN .pn-tag{flex:0 0 auto;min-width:84px;max-width:40%;text-align:center;font:700 10px/1.2 ' + OR + ';letter-spacing:.1em;padding:3px 4px;margin-top:2px;border:1px solid;overflow-wrap:anywhere}' +
      '#nmsPN .pn-new{color:#00e5ff;border-color:#00e5ff}#nmsPN .pn-fixed{color:#00ff88;border-color:#00ff88}#nmsPN .pn-improved{color:#f0a500;border-color:#f0a500}' +
      '#nmsPN .pn-tx{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;color:inherit}' +
      '#nmsPN a.pn-tx{color:#7ff3ff;text-decoration:underline;text-underline-offset:3px}' +
      '#nmsPN .pn-more{background:none;border:0;color:#00e5ff;font:600 15px ' + RJ + ';cursor:pointer;padding:8px 0;letter-spacing:.05em;min-height:40px}' +
      '#nmsPN .pn-also{margin-top:10px;font:11px ' + MO + ';color:#0096a8;letter-spacing:.12em}' +
      '#nmsPN .pn-site{border:1px solid rgba(0,229,255,.18);margin-top:6px}' +
      '#nmsPN .pn-site>button{display:flex;width:100%!important;align-items:center;gap:8px;background:rgba(0,229,255,.04);border:0;color:#eaf6ff;font:700 12px/1.3 ' + OR + ';letter-spacing:.08em;padding:10px;cursor:pointer;text-align:left;min-height:42px}' +
      '#nmsPN .pn-site>button b{color:#00e5ff;letter-spacing:.1em;font-weight:700}' +
      '#nmsPN .pn-site>button span{margin-left:auto;color:#00e5ff}' +
      '#nmsPN .pn-site .pn-in{padding:0 10px 8px}' +
      '#nmsPN .pn-site .pn-go{display:inline-block;margin-top:8px;color:#00e5ff;font:600 15px ' + RJ + ';text-decoration:none}' +
      '#nmsPN .pn-ok{display:block;width:100%!important;margin-top:12px;padding:11px;background:rgba(0,229,255,.08);border:1px solid #00e5ff;color:#00e5ff;font:700 13px ' + OR + ';letter-spacing:.14em;cursor:pointer;min-height:44px}' +
      '#nmsPN .pn-ok:hover{background:rgba(0,229,255,.18)}' +
      '#nmsPN button:focus-visible,#nmsPN a:focus-visible{outline:2px solid #00e5ff;outline-offset:2px}' +
      '#nmsPN .pn-foot{margin-top:9px;text-align:center;font:11px ' + MO + ';color:#6f8aa3;letter-spacing:.06em}' +
      '#nmsPNbar{position:fixed;left:0;right:0;top:-10px;height:2px;background:#00e5ff;box-shadow:0 0 12px 3px rgba(0,229,255,.7),0 0 40px 8px rgba(0,229,255,.25);z-index:2147483003;pointer-events:none}' +
      '#nmsPNbar::after{content:"";position:absolute;left:0;right:0;bottom:2px;height:70px;background:linear-gradient(0deg,rgba(0,229,255,.18),transparent)}' +
      '#nmsPNbar.up::after{bottom:auto;top:2px;background:linear-gradient(180deg,rgba(0,229,255,.18),transparent)}' +
      '@keyframes nmsPNb{50%{opacity:.2}}' +
      '@media (max-width:360px){#nmsPN .pn-sc{padding:20px 14px 14px}#nmsPN h2{font-size:18px}#nmsPN .pn-tag{min-width:72px}}' +
      '@media (prefers-reduced-motion:reduce){#nmsPN .pn{clip-path:none!important}#nmsPNbar{display:none}#nmsPN .pn-k i{animation:none}}';
    document.head.appendChild(st);
  }
  var reduce = function () { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function sweep(pn, bar, down, ms, done) {
    if (reduce()) { pn.style.clipPath = 'none'; done && done(); return; }
    var t0 = performance.now(); bar.classList.toggle('up', !down);
    (function f(t) {
      var k = Math.min(1, (t - t0) / ms); k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var H = innerHeight, y = down ? k * H : (1 - k) * H; bar.style.top = y + 'px';
      var r = pn.getBoundingClientRect(), vis = Math.max(0, Math.min(r.height, y - r.top));
      pn.style.clipPath = 'inset(0 0 ' + (r.height - vis) + 'px 0)';
      if (k < 1) requestAnimationFrame(f); else { bar.style.top = '-10px'; if (down) pn.style.clipPath = 'none'; done && done(); }
    })(t0);
  }
  var pushed = false, lastFocus = null;
  function build(d) {
    var back = el('div'); back.id = 'nmsPN'; back.setAttribute('translate', 'no'); back.className = 'notranslate';
    var pn = el('div', 'pn'); pn.tabIndex = -1; pn.style.outline = 'none'; pn.setAttribute('role', 'dialog'); pn.setAttribute('aria-modal', 'true'); pn.setAttribute('aria-labelledby', 'nmsPNt');
    ['c1', 'c2', 'c3', 'c4'].forEach(function (c) { pn.appendChild(el('span', 'pn-c ' + c)); });
    var x = el('button', 'pn-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', T('Close')); x.onclick = function () { closeNotes(); };
    pn.appendChild(x);
    var sc = el('div', 'pn-sc'); pn.appendChild(sc); var pn0 = pn; pn = sc;
    var k = el('div', 'pn-k'); k.appendChild(el('i')); k.appendChild(document.createTextNode(T('SYSTEM UPDATE RECEIVED'))); pn.appendChild(k);
    var h = el('h2'); h.id = 'nmsPNt'; h.appendChild(document.createTextNode(T('PATCH NOTES') + ' · ')); h.appendChild(el('b', '', d.version || '')); pn.appendChild(h);
    pn.appendChild(el('div', 'pn-sub', [d.date ? fmtDate(d.date) : '', d.site || ''].filter(Boolean).join(' · ')));
    var L = itemList(d.items || [], 3); pn.appendChild(L.ul);
    if (L.more.length) {
      var mb = el('button', 'pn-more', '▾ ' + T('Show all ({n})', { n: (d.items || []).length }).replace('{n}', (d.items || []).length)); mb.type = 'button';
      mb.onclick = function () { L.more.forEach(function (li) { li.hidden = false; }); mb.remove(); };
      pn.appendChild(mb);
    }
    if (d.others && d.others.length) {
      pn.appendChild(el('div', 'pn-also', T('ALSO UPDATED')));
      d.others.forEach(function (o) {
        var box = el('div', 'pn-site'), b = el('button'); b.type = 'button'; b.setAttribute('aria-expanded', 'false');
        b.appendChild(document.createTextNode((o.site || '') + ' · ')); b.appendChild(el('b', '', o.version || ''));
        var arr = el('span', '', '▸'); b.appendChild(arr);
        var inn = el('div', 'pn-in'); inn.hidden = true; inn.appendChild(itemList(o.items || []).ul);
        if (o.url) { var a = el('a', 'pn-go', T('Open') + ' →'); a.href = o.url; inn.appendChild(a); }
        b.onclick = function () { inn.hidden = !inn.hidden; arr.textContent = inn.hidden ? '▸' : '▾'; b.setAttribute('aria-expanded', String(!inn.hidden)); };
        box.appendChild(b); box.appendChild(inn); pn.appendChild(box);
      });
    }
    var ok = el('button', 'pn-ok', T('ACKNOWLEDGED')); ok.type = 'button'; ok.onclick = function () { closeNotes(); }; pn.appendChild(ok);
    if (d.lastToday) pn.appendChild(el('div', 'pn-foot', T('✓ That\'s the last update today')));
    back.appendChild(pn0);
    back.addEventListener('click', function (e) { if (e.target === back) closeNotes(); });
    return back;
  }
  function onKey(e) { if (e.key === 'Escape' && pnEl) { e.preventDefault(); closeNotes(); } }
  function onPop() { if (pnEl) closeNotes(true); }
  function openNotes(d) {
    d = d || pnData; if (!d || pnEl) return;
    pnCSS(); lastFocus = document.activeElement;
    if (bar) bar.style.display = 'none';
    var back = build(d), bar2 = el('div'); bar2.id = 'nmsPNbar';
    (document.body || document.documentElement).appendChild(bar2);
    (document.body || document.documentElement).appendChild(back);
    pnEl = back; var pn = back.firstChild;
    requestAnimationFrame(function () { back.classList.add('on'); });
    setTimeout(function () { sweep(pn, bar2, true, 2200, function () { pn.classList.add('done'); }); }, reduce() ? 0 : 150);
    setTimeout(function () { try { back.firstChild.focus({ preventScroll: true }); } catch (e) {} }, 60);
    document.addEventListener('keydown', onKey);
    try { history.pushState({ nmsPN: 1 }, ''); pushed = true; window.addEventListener('popstate', onPop); } catch (e) { pushed = false; }
  }
  function closeNotes(fromBack) {
    if (!pnEl) return;
    var back = pnEl, pn = back.firstChild, bar2 = document.getElementById('nmsPNbar');
    pnEl = null;
    document.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onPop);
    if (pushed && !fromBack) { pushed = false; try { if (history.state && history.state.nmsPN) history.back(); } catch (e) {} }
    pushed = false;
    pn.classList.remove('done');
    var fin = function () { back.remove(); if (bar2) bar2.remove(); try { lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); } catch (e) {} };
    if (reduce() || !bar2) { back.classList.remove('on'); setTimeout(fin, 250); return; }
    pn.style.clipPath = 'inset(0 0 0 0)';
    sweep(pn, bar2, false, 1400, function () { back.classList.remove('on'); setTimeout(fin, 250); });
  }
  document.addEventListener('nms-lang', function () {
    if (!pnEl || !pnData) return;   // language changed while open: rebuild in the new language
    var old = pnEl, nw = build(pnData); nw.classList.add('on'); nw.firstChild.style.clipPath = 'none'; nw.firstChild.classList.add('done');
    old.parentNode.replaceChild(nw, old); pnEl = nw;
  });
  function loadNotes() {
    return fetch(PN_URL, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.version && d.items && d.items.length) pnData = d;
      return pnData;
    }).catch(function () { return null; });
  }
  function pnStart() {
    var force = /[?&]patchnotes\b/.test(location.search), go = false;
    try { go = sessionStorage.getItem('nmsPNgo') === '1'; sessionStorage.removeItem('nmsPNgo'); } catch (e) {}
    loadNotes().then(function (d) {
      if (!d) return;
      var seen = null; try { seen = localStorage.getItem('nmsPN'); } catch (e) {}
      var show = force || go || (seen !== d.version && hadSW);
      try { localStorage.setItem('nmsPN', d.version); } catch (e) {}
      if (show) setTimeout(function () { openNotes(d); }, 1200);
    });
  }
  if (document.readyState === 'complete') pnStart(); else window.addEventListener('load', pnStart);

  window.NMS_UPDATE = { check: check, show: show, refresh: refresh, mountRefresh: mountRefresh,
    notes: function () { if (pnData) openNotes(); else loadNotes().then(function (d) { d && openNotes(d); }); }, closeNotes: closeNotes };
})();
