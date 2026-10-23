/* ============================================================
   Language choice (2026-10-20) -- the same file on every nomansskyhub.app site.

   HOW IT WORKS
   - English is the page itself. A language pack, lang/<code>.json next to this
     file, maps English text to the translation:
        "Six nodes. One network.": "Seis nodos. Una red."
     Text is matched after squashing spaces, so line breaks in the HTML don't
     matter. Anything not in the pack simply stays English.
   - Templates: "{n} systems charted": "{n} sistemas cartografiados".
     {n} matches a number, any other {name} matches any text (kept as it is:
     names, galaxies, addresses). A value can be {"one":..,"few":..,"many":..,
     "other":..} to pick the right plural for {n} (Polish needs few/many).
   - Keys that contain "<" are whole-element HTML (a paragraph with <b> inside):
     matched against an element's innerHTML, so the sentence is translated as one.
   - Text the sites add later (live feeds, toasts, pop-ups) is translated as it
     appears (MutationObserver), so most site scripts need no changes at all.
   - Never translated: anything inside translate="no" / .notranslate (glyphs,
     hex addresses, system / traveller / galaxy names, the alien font), inputs,
     textareas, scripts, code. Browser "Translate this page" honours the same marks.
   - Script helpers: NMS_T('English', {vars}) -> translated string,
     NMS_LANG() -> 'es', NMS_SET_LANG('de'), NMS_DATE(date, opts),
     document event 'nms-lang' after every switch.
   - Choice remembered in a cookie on .nomansskyhub.app, so it is the same on all
     six sites (localStorage fallback elsewhere). ?lang=xx forces one for a visit.
   - First visit: if the phone's language is one we have, it is offered once
     ("¿Ver en español?"). The page never switches by itself.
   - Any element with data-lang-btn opens the language list.
   - Polish (and other Latin Extended) letters that Orbitron / Share Tech Mono
     lack are drawn with Chakra Petch / JetBrains Mono (fonts/, OFL licence),
     only for those letters, downloaded only when a page shows one.
   - ?langdebug=1 logs English text that has no translation (NMS_MISSING).
   Load in <head> without defer, after calm.js.
   ============================================================ */
(function(){
  'use strict';
  if(window.NMS_SET_LANG) return;
  var LANGS = [
    ['en','English'], ['es','Español'], ['de','Deutsch'], ['nl','Nederlands'],
    ['pl','Polski'], ['fr','Français'], ['pt-BR','Português (Brasil)'], ['it','Italiano']
  ];
  var OFFER = {
    es:['¿Ver en español?','SÍ','NO, GRACIAS'],
    de:['Auf Deutsch anzeigen?','JA','NEIN, DANKE'],
    nl:['In het Nederlands bekijken?','JA','NEE, BEDANKT'],
    pl:['Wyświetlić po polsku?','TAK','NIE, DZIĘKUJĘ'],
    fr:['Afficher en français ?','OUI','NON, MERCI'],
    'pt-BR':['Ver em português?','SIM','NÃO, OBRIGADO'],
    it:['Visualizzare in italiano?','SÌ','NO, GRAZIE']
  };
  var UI = { /* the picker's own words, so it works before any pack loads */
    en:['LANGUAGE','Remembers your language on this device and on every NMS Hub site. Names, glyphs and addresses stay as they are.'],
    es:['IDIOMA','Recuerda tu idioma en este dispositivo y en todas las webs de NMS Hub. Los nombres, glifos y direcciones no cambian.'],
    de:['SPRACHE','Merkt sich deine Sprache auf diesem Gerät und auf allen NMS-Hub-Seiten. Namen, Glyphen und Adressen bleiben unverändert.'],
    nl:['TAAL','Onthoudt je taal op dit apparaat en op elke NMS Hub-site. Namen, glyphs en adressen blijven zoals ze zijn.'],
    pl:['JĘZYK','Zapamiętuje Twój język na tym urządzeniu i na każdej stronie NMS Hub. Nazwy, glify i adresy pozostają bez zmian.'],
    fr:['LANGUE','Mémorise ta langue sur cet appareil et sur tous les sites NMS Hub. Les noms, glyphes et adresses restent tels quels.'],
    'pt-BR':['IDIOMA','Lembra seu idioma neste dispositivo e em todos os sites do NMS Hub. Nomes, glifos e endereços continuam como estão.'],
    it:['LINGUA','Ricorda la tua lingua su questo dispositivo e su tutti i siti NMS Hub. Nomi, glifi e indirizzi restano come sono.']
  };
  var PACK_V = '1';
  var K = 'nms_lang', host = location.hostname;
  var CODES = LANGS.map(function(l){ return l[0]; });
  var SELF = (document.currentScript && document.currentScript.src) || location.href;
  var DEBUG = /[?&]langdebug=1/.test(location.search);

  function norm(c){
    if(!c) return '';
    c = String(c);
    if(/^pt/i.test(c)) return 'pt-BR';
    c = c.slice(0,2).toLowerCase();
    return CODES.indexOf(c) >= 0 ? c : '';
  }
  function saved(){
    var m = document.cookie.match(/(?:^|;\s*)nms_lang=([A-Za-z-]+)/);
    if(m) return norm(m[1]) || 'en';
    try{ return norm(localStorage.getItem(K)) || ''; }catch(e){ return ''; }
  }
  function save(c){
    var dom = /(^|\.)nomansskyhub\.app$/.test(host) ? ';domain=.nomansskyhub.app' : '';
    document.cookie = K + '=' + c + ';path=/;max-age=31536000;SameSite=Lax' + dom +
      (location.protocol === 'https:' ? ';secure' : '');
    try{ localStorage.setItem(K, c); }catch(e){}
  }
  function forced(){ var m = location.search.match(/[?&]lang=([A-Za-z-]+)/); return m ? norm(m[1]) : ''; }

  var want = forced() || saved() || 'en';
  if(want !== 'en'){
    document.documentElement.classList.add('lang-wait');
    setTimeout(function(){ document.documentElement.classList.remove('lang-wait'); }, 1500);
  }

  /* ---------- styles: Polish letters + picker ---------- */
  var FB; try{ FB = new URL('fonts/', SELF).href; }catch(e){ FB = 'fonts/'; }
  var EXT = 'unicode-range:U+0100-024F,U+1E00-1EFF;font-display:swap;';
  var st = document.createElement('style');
  st.textContent =
    "@font-face{font-family:'Orbitron';font-weight:100 500;" + EXT + "src:url(" + FB + "chakra-petch-latin-ext-500.woff2) format('woff2')}" +
    "@font-face{font-family:'Orbitron';font-weight:600 900;" + EXT + "src:url(" + FB + "chakra-petch-latin-ext-700.woff2) format('woff2')}" +
    "@font-face{font-family:'Share Tech Mono';font-weight:100 900;" + EXT + "src:url(" + FB + "jetbrains-mono-latin-ext-400.woff2) format('woff2')}" +
    'html.lang-wait body{visibility:hidden}' +
    '#nmsLangPop{position:fixed;z-index:2147483000;width:min(270px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:rgba(6,12,20,.97);border:1px solid rgba(0,229,255,.45);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 24px rgba(0,229,255,.15);padding:10px;font-family:Rajdhani,system-ui,sans-serif;color:#cfe0f0;text-align:left;letter-spacing:normal;text-transform:none}' +
    '#nmsLangPop[hidden]{display:none}' +
    '#nmsLangPop h3{margin:2px 6px 8px;font:700 .7rem/1 "Share Tech Mono",monospace;letter-spacing:3px;color:#00e5ff}' +
    '#nmsLangPop ul{list-style:none;margin:0;padding:0}' +
    '#nmsLangPop button.o{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:0;border-radius:6px;background:none;color:#e6f2ff;font:600 1.05rem/1.1 Rajdhani,system-ui,sans-serif;text-align:left;cursor:pointer;letter-spacing:normal;text-transform:none}' +
    '#nmsLangPop button.o:hover,#nmsLangPop button.o:focus-visible{background:rgba(0,229,255,.1);outline:none}' +
    '#nmsLangPop button.o[aria-checked="true"]{background:rgba(0,229,255,.14);color:#fff}' +
    '#nmsLangPop button.o small{font:.68rem "Share Tech Mono",monospace;letter-spacing:2px;color:#7f98ad}' +
    '#nmsLangPop button.o[aria-checked="true"] small{color:#f0a500}' +
    '#nmsLangPop p{margin:8px 6px 2px;font-size:.82rem;line-height:1.35;color:#8ea6ba}' +
    '#nmsLangOffer{position:fixed;left:12px;right:12px;bottom:16px;margin:0 auto;width:fit-content;max-width:calc(100vw - 24px);box-sizing:border-box;z-index:2147482000;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(6,12,20,.97);border:1px solid rgba(0,229,255,.5);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.6);font:600 1rem Rajdhani,system-ui,sans-serif;color:#e6f2ff;letter-spacing:normal;text-transform:none}' +
    '#nmsLangOffer button{height:32px;padding:0 12px;border-radius:7px;border:1px solid rgba(0,229,255,.4);background:none;color:#cfe0f0;font:600 .72rem "Share Tech Mono",monospace;letter-spacing:2px;cursor:pointer}' +
    '#nmsLangOffer button.y{background:rgba(0,229,255,.16);border-color:#00e5ff;color:#fff}';
  (document.head || document.documentElement).appendChild(st);

  /* ---------- the pack ---------- */
  var cur = 'en', exact = new Map(), tmpl = [], htmlMap = new Map(), rawT = new Map();
  var missing = new Set(); window.NMS_MISSING = missing;
  function sq(s){ return String(s).replace(/\s+/g, ' ').trim(); }
  function esc(s){ return s.replace(/[.*+?^$()|[\]\\]/g, '\\$&'); }
  function compile(p){
    exact = new Map(); tmpl = []; htmlMap = new Map(); rawT = new Map();
    Object.keys(p || {}).forEach(function(k){
      if(k.charAt(0) === '_') return;
      var v = p[k], key = sq(k);
      if(key.indexOf('<') >= 0){ htmlMap.set(key, v); return; }
      if(/\{\w+\}/.test(key)){
        rawT.set(key, v);
        var names = [], re = '';
        key.split(/(\{\w+\})/).forEach(function(part){
          var m = /^\{(\w+)\}$/.exec(part);
          if(m){ names.push(m[1]); re += m[1] === 'n' ? '(\\d[\\d.,\\u00a0\\u202f ]*)' : '(.+?)'; }
          else re += esc(part);
        });
        tmpl.push({ re: new RegExp('^' + re + '$'), names: names, v: v, fixed: key.replace(/\{\w+\}/g, '').length });
      } else exact.set(key, v);
    });
    tmpl.sort(function(a, b){ return b.fixed - a.fixed; }); /* most specific first */
  }
  var plural = null;
  function pick(v, n){
    if(typeof v === 'string') return v;
    var c = 'other';
    try{ c = (plural || (plural = new Intl.PluralRules(cur))).select(n); }catch(e){ c = n === 1 ? 'one' : 'other'; }
    return v[c] != null ? v[c] : (v.other != null ? v.other : (v.many != null ? v.many : v.one));
  }
  function fill(s, vars){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return vars && vars[k] != null ? vars[k] : m; }); }
  function lookup(text, depth){
    var key = sq(text);
    if(!key) return null;
    var v = exact.get(key);
    if(v != null) return pick(v, 1);
    for(var i = 0; i < tmpl.length; i++){
      var t = tmpl[i], m = t.re.exec(key);
      if(!m) continue;
      var vars = {}, n = 1;
      t.names.forEach(function(nm, j){
        var raw = m[j + 1];
        if(nm === 'n'){ n = parseFloat(raw.replace(/[^\d.]/g, '')) || 0; vars[nm] = raw; }
        else { /* "LOCKED · {g}" keeps a name as it is, but translates a known phrase ("8 DAYS") */
          var inner = depth ? (exact.has(sq(raw)) ? pick(exact.get(sq(raw)), 1) : null) : lookup(raw, 1);
          vars[nm] = inner != null ? inner : raw;
        }
      });
      return fill(pick(t.v, n), vars);
    }
    return null;
  }
  /* NMS_T('{n} DAYS', {n: 3}) or NMS_T('ONLINE'): the pack's wording for a key, filled in */
  window.NMS_T = function(en, vars){
    if(cur !== 'en'){
      var key = sq(en), v = rawT.get(key);
      if(v == null) v = exact.get(key);
      if(v != null) return fill(pick(v, vars && vars.n != null ? +vars.n : 1), vars);
    }
    return fill(en, vars);
  };
  /* NMS_TR('ENDS IN 8 DAYS 1 HOUR'): translate a finished English string, templates included */
  window.NMS_TR = function(s){ if(cur === 'en') return s; var t = lookup(s); return t != null ? t : s; };
  window.NMS_LANG = function(){ return cur; };
  window.NMS_DATE = function(d, opts){
    try{ return new Intl.DateTimeFormat(cur === 'en' ? 'en-GB' : cur, opts).format(d); }catch(e){ return String(d); }
  };

  /* ---------- swapping text in the page ---------- */
  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  var SKIP = 'SCRIPT,STYLE,NOSCRIPT,TEXTAREA,CODE,PRE,TEMPLATE'.split(',');
  var HTMLTAGS = /^(P|LI|DIV|SPAN|LABEL|SMALL|H[1-6]|BUTTON|A|TD|TH|DT|DD|SUMMARY|EM|STRONG|B|FIGCAPTION|LEGEND)$/;
  var texts = new Map(), attrs = new Map(), htmls = new Map();
  function skipEl(el){
    if(SKIP.indexOf(el.tagName) >= 0) return true;
    if(el.getAttribute('translate') === 'no') return true;
    if(el.classList && (el.classList.contains('notranslate') || el.hasAttribute('data-nms-html'))) return true;
    if(el.isContentEditable && el.parentElement && el.parentElement.isContentEditable) return true;
    if(el.id === 'nmsLangPop' || el.id === 'nmsLangOffer') return true;
    return false;
  }
  function blocked(node){
    for(var el = node.nodeType === 1 ? node : node.parentElement; el; el = el.parentElement){ if(skipEl(el)) return true; }
    return false;
  }
  function note(s){ if(DEBUG && missing.size < 3000){ s = sq(s); if(s && /[A-Za-z]{2}/.test(s)) missing.add(s); } }
  function doText(node){
    var v = node.nodeValue, r = texts.get(node);
    if(r && v === r.out) return;
    if(!/[A-Za-z]/.test(v)){ if(r) texts.delete(node); return; }
    var t = lookup(v);
    if(t == null){ if(r) texts.delete(node); note(v); return; }
    var out = v.match(/^\s*/)[0] + t + v.match(/\s*$/)[0];
    texts.set(node, { en: v, out: out });
    if(out !== v) node.nodeValue = out;
  }
  function doAttrs(el){
    var rec = attrs.get(el);
    for(var i = 0; i < ATTRS.length; i++){
      var a = ATTRS[i], v = el.getAttribute(a);
      if(v == null || !/[A-Za-z]/.test(v)) continue;
      if(el.tagName === 'IMG' && a === 'alt' && v.length < 2) continue;
      var r = rec && rec[a];
      if(r && v === r.out) continue;
      var t = lookup(v);
      if(t == null){ if(r) delete rec[a]; note(v); continue; }
      rec = rec || {}; rec[a] = { en: v, out: t }; attrs.set(el, rec);
      if(t !== v) el.setAttribute(a, t);
    }
    if(el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value){
      var rv = rec && rec.value, vv = el.value;
      if(!(rv && vv === rv.out)){
        var tv = lookup(vv);
        if(tv != null){ rec = rec || {}; rec.value = { en: vv, out: tv }; attrs.set(el, rec); el.value = tv; }
      }
    }
  }
  function doHtml(el){
    if(!htmlMap.size || !HTMLTAGS.test(el.tagName) || !el.firstElementChild) return false;
    var h = el.innerHTML; if(h.length > 2000) return false;
    var t = htmlMap.get(sq(h)); if(t == null) return false;
    htmls.set(el, { en: h, out: t });
    el.setAttribute('data-nms-html', '');
    el.innerHTML = t;
    return true;
  }
  function scan(root){
    if(cur === 'en' || !root) return;
    if(root.nodeType === 3){ if(!blocked(root)) doText(root); return; }
    if(root.nodeType !== 1 || blocked(root)) return;
    var w = document.createTreeWalker(root, 5 /* elements + text */, {
      acceptNode: function(n){
        if(n.nodeType === 3) return 1;
        if(skipEl(n)) return 2;
        doAttrs(n);
        return doHtml(n) ? 2 : 1;
      }
    });
    if(root.nodeType === 1){ doAttrs(root); if(doHtml(root)) return; }
    var n; while((n = w.nextNode())) if(n.nodeType === 3) doText(n);
  }
  function restore(){
    htmls.forEach(function(r, el){ if(el.isConnected && el.innerHTML === r.out){ el.innerHTML = r.en; } el.removeAttribute('data-nms-html'); });
    texts.forEach(function(r, node){ if(node.nodeValue === r.out) node.nodeValue = r.en; });
    attrs.forEach(function(rec, el){ Object.keys(rec).forEach(function(a){
      if(a === 'value'){ if(el.value === rec.value.out) el.value = rec.value.en; }
      else if(el.getAttribute(a) === rec[a].out) el.setAttribute(a, rec[a].en);
    }); });
    texts = new Map(); attrs = new Map(); htmls = new Map();
  }
  var mo = null;
  function watch(){
    if(mo || !('MutationObserver' in window)) return;
    mo = new MutationObserver(function(ms){
      if(cur === 'en') return;
      for(var i = 0; i < ms.length; i++){
        var m = ms[i];
        if(m.type === 'childList'){ for(var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]); }
        else if(m.type === 'characterData'){ if(!blocked(m.target)) doText(m.target); }
        else if(m.type === 'attributes'){ if(!blocked(m.target)) doAttrs(m.target); }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /* ---------- switching ---------- */
  function codeLabel(c){ return c === 'pt-BR' ? 'PT' : c.toUpperCase(); }
  function apply(){
    document.documentElement.lang = cur === 'en' ? 'en' : cur;
    document.querySelectorAll('[data-lang-code]').forEach(function(b){ b.textContent = codeLabel(cur); });
    if(cur !== 'en' && document.body){ scan(document.body); scan(document.head.querySelector('title')); }
    try{ document.dispatchEvent(new CustomEvent('nms-lang', { detail: { lang: cur } })); }catch(e){}
  }
  var packs = {};
  function load(c){
    if(c === 'en') return Promise.resolve({});
    if(packs[c]) return Promise.resolve(packs[c]);
    return fetch(new URL('lang/' + c + '.json?v=' + PACK_V, SELF)).then(function(r){
      if(!r.ok) throw new Error(r.status); return r.json();
    }).then(function(p){ packs[c] = p; return p; });
  }
  function setLang(c, remember){
    c = norm(c) || 'en';
    return load(c).then(function(p){
      restore();
      cur = c; plural = null; missing.clear(); compile(p);
      if(remember !== false) save(c);
      apply();
    }).catch(function(){ restore(); cur = 'en'; compile({}); apply(); })
      .then(function(){
        document.documentElement.classList.remove('lang-wait');
        if(DEBUG && cur !== 'en') setTimeout(function(){ console.log('[lang] ' + missing.size + ' untranslated:', Array.from(missing)); }, 4000);
      });
  }
  window.NMS_SET_LANG = setLang;

  /* ---------- picker ---------- */
  var pop;
  function closePop(){
    if(pop) pop.hidden = true;
    document.querySelectorAll('[data-lang-btn]').forEach(function(b){ b.setAttribute('aria-expanded', 'false'); });
  }
  function openPop(btn){
    if(!pop){
      pop = document.createElement('div');
      pop.id = 'nmsLangPop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('translate', 'no'); pop.hidden = true;
      document.body.appendChild(pop);
      document.addEventListener('click', function(e){
        if(!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest('[data-lang-btn]'))) closePop();
      });
      document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePop(); });
      window.addEventListener('resize', closePop);
    }
    var u = UI[cur] || UI.en;
    pop.setAttribute('aria-label', u[0]);
    var h = '<h3>' + u[0] + '</h3><ul role="radiogroup" aria-label="' + u[0] + '">';
    LANGS.forEach(function(l){
      var on = l[0] === cur;
      h += '<li><button class="o" type="button" role="radio" lang="' + l[0] + '" data-c="' + l[0] + '" aria-checked="' + on +
        '"><span>' + l[1] + '</span><small>' + (on ? '✓ ' : '') + codeLabel(l[0]) + '</small></button></li>';
    });
    pop.innerHTML = h + '</ul><p>' + u[1] + '</p>';
    pop.querySelectorAll('button.o').forEach(function(b){
      b.addEventListener('click', function(){ closePop(); setLang(b.getAttribute('data-c')); });
    });
    pop.hidden = false;
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(Math.max(12, r.right - w), innerWidth - w - 12);
    var top = r.bottom + 8;
    if(top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    document.querySelectorAll('[data-lang-btn]').forEach(function(b){ b.setAttribute('aria-expanded', b === btn ? 'true' : 'false'); });
    var on = pop.querySelector('[aria-checked="true"]'); if(on) on.focus({ preventScroll: true });
  }
  /* one click handler for every [data-lang-btn], including buttons a site adds later */
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-lang-btn]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    if(pop && !pop.hidden && b.getAttribute('aria-expanded') === 'true') closePop(); else openPop(b);
  }, true);

  /* ---------- first-visit offer ---------- */
  function offer(){
    if(saved() || forced()) return;
    var c = norm((navigator.languages && navigator.languages[0]) || navigator.language);
    if(!c || c === 'en' || !OFFER[c]) return;
    var o = OFFER[c], d = document.createElement('div');
    d.id = 'nmsLangOffer'; d.setAttribute('role', 'region'); d.setAttribute('lang', c); d.setAttribute('translate', 'no');
    d.innerHTML = '<span>🌐 ' + o[0] + '</span><button class="y" type="button">' + o[1] + '</button><button type="button">' + o[2] + '</button>';
    var bs = d.querySelectorAll('button');
    bs[0].onclick = function(){ d.remove(); setLang(c); };
    bs[1].onclick = function(){ d.remove(); save('en'); };
    document.body.appendChild(d);
  }

  function start(){
    document.querySelectorAll('[data-lang-btn]').forEach(function(b){ b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false'); });
    watch();
    if(want !== 'en') setLang(want, !forced()); else apply();
    setTimeout(offer, 1500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
