/* ================= NMS Codex — live game data from the No Man's Sky Wiki =================
   Shared by ATLAS and the Hub. Reads the community wiki (nomanssky.fandom.com, CC BY-SA)
   straight from the browser — the wiki API allows it (origin=*), so no server or key.
   - item(name)        crafting / refiner recipes, where to find it, what it is
   - usedIn(name)      what an item can be refined into (and how many crafting recipes use it)
   - expedition(name)  the current expedition's milestones by phase, with hints and rewards
   - detect(text)      spots "how do I make X" / "where do I find X" / "what can I refine X into" /
                       "expedition milestones" questions; answer(intent) turns them into a spoken reply
   Everything is cached on the device (items 24h, expedition 6h) so repeat questions are instant.
=========================================================================================== */
(function (root) {
  'use strict';
  var API = 'https://nomanssky.fandom.com/api.php';
  var WIKI = 'https://nomanssky.fandom.com/wiki/';
  var LS = 'nmsCodex:';

  function cacheGet(k, ttl) {
    try { var c = JSON.parse(localStorage.getItem(LS + k) || 'null'); if (c && Date.now() - c.t < ttl) return c.v; } catch (e) {}
    return undefined;
  }
  function cacheSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} }

  function get(params, ms) {
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ac) ac.abort(); }, ms || 8000);
    return fetch(API + '?' + q + '&format=json&origin=*', ac ? { signal: ac.signal } : undefined)
      .then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error('wiki ' + r.status); return r.json(); })
      .catch(function (e) { clearTimeout(tm); throw e; });
  }

  /* ---------- wikitext → plain text ---------- */
  function plain(s) {
    return String(s || '')
      .replace(/<ref[\s\S]*?<\/ref>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
      .replace(/\{\{\s*link\s*\|([^}|]+)[^}]*\}\}/gi, '$1')
      .replace(/\{\{\s*(Units|Nanites|Quicksilver)\s*\}\}/gi, function (m, w) { return ' ' + w.toLowerCase(); })
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
      .replace(/\[\[([^\]]*)\]\]/g, '$1')
      .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
      .replace(/'''?/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function section(wt, name) {
    var re = new RegExp('^==+\\s*' + name + '\\s*==+\\s*$', 'im');
    var m = re.exec(wt); if (!m) return '';
    var rest = wt.slice(m.index + m[0].length);
    var end = rest.search(/^==[^=]/m);
    return end < 0 ? rest : rest.slice(0, end);
  }
  function templates(wt, name) { // top-level {{Name ...}} blocks, nesting-aware
    var out = [], re = new RegExp('\\{\\{\\s*' + name + '\\s*[|}\\n]', 'gi'), m;
    while ((m = re.exec(wt))) {
      var i = m.index, depth = 0, j = i;
      for (; j < wt.length - 1; j++) {
        if (wt[j] === '{' && wt[j + 1] === '{') { depth++; j++; }
        else if (wt[j] === '}' && wt[j + 1] === '}') { depth--; j++; if (!depth) break; }
      }
      out.push(wt.slice(i + 2, j - 1));
    }
    return out;
  }
  function pairs(list) { // "Carbon,50;Sodium,10" → [{name,qty}]
    return list.split(';').map(function (p) { var a = p.split(','); return { name: plain(a[0]), qty: +a[1] || 1 }; })
      .filter(function (x) { return x.name; });
  }
  function infobox(wt) {
    var b = /\{\{\s*([\w ]+?) infobox([\s\S]*?)\n\}\}/i.exec(wt); if (!b) return null;
    var o = { kind: b[1].trim() };
    b[2].split('\n').forEach(function (l) { var m = /^\s*\|\s*(\w+)\s*=\s*(.*)$/.exec(l); if (m) o[m[1].toLowerCase()] = plain(m[2]); });
    return o;
  }

  /* ---------- page lookup (fuzzy title) ---------- */
  function resolve(name) {
    var key = 'title:' + name.toLowerCase();
    var c = cacheGet(key, 864e5); if (c !== undefined) return Promise.resolve(c);
    return get({ action: 'opensearch', search: name, limit: 6, namespace: 0, redirects: 'resolve' }).then(function (j) {
      var titles = (j && j[1]) || [];
      var lower = name.toLowerCase();
      var pick = titles.filter(function (t) { return !/\/|^List of|disambiguation/i.test(t); });
      var exact = pick.filter(function (t) { return t.toLowerCase() === lower; })[0];
      var t = exact || pick[0] || null;
      cacheSet(key, t); return t;
    });
  }
  function wikitext(title) {
    return get({ action: 'parse', page: title, prop: 'wikitext', redirects: 1 }).then(function (j) {
      return j && j.parse ? { title: j.parse.title, wt: j.parse.wikitext['*'] } : null;
    });
  }

  function item(name) {
    var key = 'item:' + name.toLowerCase();
    var c = cacheGet(key, 864e5); if (c !== undefined) return Promise.resolve(c);
    return resolve(name).then(function (title) {
      if (!title) return null;
      return wikitext(title).then(function (p) {
        if (!p) return null;
        var wt = p.wt, ib = infobox(wt) || {};
        var craft = templates(wt, 'Craft').map(function (t) {
          var parts = t.split('|').slice(1), ing = parts.filter(function (x) { return x.indexOf('=') < 0; })[0] || '';
          return { ing: pairs(ing), blueprint: /blueprint\s*=\s*yes/i.test(t) };
        }).filter(function (r) { return r.ing.length; });
        var refine = [];
        templates(wt, 'PoC-Refine').forEach(function (t) {
          t.split('\n').forEach(function (line) {
            line = line.replace(/^\s*\|\s*/, '').trim(); if (!line || /^PoC-Refine/i.test(line)) return;
            var pct = line.split('%'), segs = pct[0].split(';');
            var time = segs.pop(), out = +segs.pop() || 1;
            var ing = pairs(segs.join(';'));
            if (ing.length) refine.push({ ing: ing, out: out, op: plain(pct[1] || '') });
          });
        });
        var cook = [];
        templates(wt, 'Cook').forEach(function (t) {
          t.split('|').slice(1).forEach(function (line) {
            var pct = line.split('%'), segs = pct[0].split(';'); segs.pop(); var out = +segs.pop() || 1;
            var ing = pairs(segs.join(';')); if (ing.length) cook.push({ ing: ing, out: out });
          });
        });
        var src = section(wt, 'Source(?:s)?');
        var source = src.split('\n').filter(function (l) { return /^\s*\*/.test(l); })
          .map(function (l) { return plain(l.replace(/^\s*\*+/, '')); }).filter(Boolean);
        if (!source.length) { var sp = plain(src.replace(/\{\{(Craft|PoC-Refine|Cook)[\s\S]*?\}\}/gi, '').replace(/\{\|[\s\S]*?\|\}/g, '')); if (sp) source = [sp]; }
        var summary = plain(section(wt, 'Summary')).split(/(?<=\.)\s/)[0] || '';
        var desc = plain(section(wt, 'Game [Dd]escription')).split(/(?<=\.)\s/).slice(0, 2).join(' ');
        var v = { title: p.title, url: WIKI + encodeURIComponent(p.title.replace(/ /g, '_')), info: ib,
          craft: craft, refine: refine, cook: cook, source: source.slice(0, 6), summary: summary, desc: desc };
        cacheSet(key, v); return v;
      });
    });
  }

  function usedIn(name) {
    var key = 'uses:' + name.toLowerCase();
    var c = cacheGet(key, 864e5); if (c !== undefined) return Promise.resolve(c);
    return resolve(name).then(function (title) {
      if (!title) return null;
      return get({ action: 'parse', page: title, prop: 'sections', redirects: 1 }).then(function (j) {
        var sec = ((j.parse && j.parse.sections) || []).filter(function (s) { return /^Use/i.test(s.line) && /^\d+$/.test(s.index); })[0];
        if (!sec) return { title: title, refine: [], craftCount: 0 };
        return get({ action: 'parse', page: title, prop: 'text', section: sec.index, redirects: 1 }, 12000).then(function (k) {
          var html = (k.parse && k.parse.text['*']) || '';
          var txt = function (h) {
            return h.replace(/<[^>]+>/g, ' ').replace(/&rarr;/g, '→').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
              .replace(/&#x([0-9a-f]+);/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); })
              .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          };
          var cut = function (id) { var i = html.indexOf('id="' + id + '"'); if (i < 0) return ''; var rest = html.slice(i); var e = rest.slice(10).search(/id="(Crafting|Refining|Cooking|Fishing|Repair)/); return e < 0 ? rest : rest.slice(0, e + 10); };
          var refine = [], seen = {};
          txt(cut('Refining')).replace(/([A-Z][\w' -]+?) -- (.+?) → (.+?) x(\d+) \( "([^"]+)"/g, function (m, prod, ins, out, n, op) {
            var k2 = prod + '|' + ins; if (seen[k2]) return m; seen[k2] = 1;
            refine.push({ product: prod.trim(), inputs: ins.trim(), out: +n, op: op });
            return m;
          });
          var craftCount = (txt(cut('Crafting')).match(/ → /g) || []).length;
          var v = { title: title, refine: refine, craftCount: craftCount };
          cacheSet(key, v); return v;
        });
      });
    });
  }

  /* ---------- expedition milestones ---------- */
  function expedition(name) {
    var key = 'exp:' + String(name).toLowerCase();
    var c = cacheGet(key, 216e5); if (c !== undefined) return Promise.resolve(c);
    var clean = String(name).replace(/^expedition\s+\d+\s*[:\-–]\s*/i, '');
    return get({ action: 'query', list: 'search', srsearch: name, srlimit: 5 }).then(function (j) {
      var hits = ((j.query && j.query.search) || []).map(function (h) { return h.title; });
      var t = hits.filter(function (h) { return /^Expedition \d+/i.test(h) && h.indexOf('/') < 0 && h.toLowerCase().indexOf(clean.toLowerCase()) >= 0; })[0]
        || hits.filter(function (h) { return /^Expedition \d+/i.test(h) && h.indexOf('/') < 0; })[0];
      if (!t) return null;
      return wikitext(t).then(function (p) {
        if (!p) return null;
        var phases = [], re = /^===\s*Phase\s*(\d+)\s*===\s*$/gim, m, marks = [];
        while ((m = re.exec(p.wt))) marks.push({ n: +m[1], i: m.index + m[0].length });
        marks.forEach(function (mk, idx) {
          var body = p.wt.slice(mk.i, idx + 1 < marks.length ? marks[idx + 1].i : undefined);
          var tbl = /\{\|([\s\S]*?)\n\|\}/.exec(body); if (!tbl) return;
          var rows = tbl[1].split(/\n\|-/).slice(1), ms = [];
          rows.forEach(function (r) {
            var cells = [], cur = null;
            r.split('\n').forEach(function (l) {
              if (/^\|(?!-|\})/.test(l)) { if (cur !== null) cells.push(cur); cur = l.slice(1); }
              else if (cur !== null) cur += '\n' + l;
            });
            if (cur !== null) cells.push(cur);
            if (cells.length < 5) return;
            var nameCell = cells[2], reqCell = cells[3];
            var nm = plain((/'''([\s\S]*?)'''/.exec(nameCell) || [, nameCell])[1]);
            var its = (reqCell.match(/''([^']+?)''/g) || []).map(function (x) { return plain(x.replace(/''/g, '')); });
            var req = its[0] || plain(reqCell), hint = (its[1] || '').replace(/^\(|\)$/g, '');
            if (/^[?\s]*$/.test(hint)) hint = ''; // "???" = not documented yet
            var rewards = cells[4].split('\n').filter(function (l) { return /^\s*\*[^*]/.test(l); }).map(function (l) { return plain(l.replace(/^\s*\*/, '')); }).filter(Boolean);
            if (nm) ms.push({ no: +plain(cells[0]) || ms.length + 1, name: nm, req: req, hint: hint, rewards: rewards });
          });
          if (ms.length) phases.push({ phase: mk.n, milestones: ms });
        });
        var v = { title: p.title, url: WIKI + encodeURIComponent(p.title.replace(/ /g, '_')), phases: phases };
        if (phases.length) cacheSet(key, v);
        return v;
      });
    });
  }

  /* ---------- question detection (ATLAS) ---------- */
  var STOP = /^(it|that|this|them|one|you|me|stuff|things|something|anything|money|units|nanites|friends|a base|base)$/i;
  function subj(s) {
    s = String(s || '').toLowerCase().trim()
      .replace(/[?!.,]+$/g, '')
      .replace(/\b(in|on) (no man'?s sky|nms|the game)\b.*$/, '')
      .replace(/\b(please|atlas|traveller|for me|quickly|fast|easily)\b/g, '')
      .replace(/^(a|an|some|the|more|any)\s+/, '')
      .replace(/\s+/g, ' ').trim();
    if (!s || s.length < 3 || s.length > 40 || STOP.test(s)) return null;
    return s;
  }
  function detect(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, "'") + ' ';
    var m;
    if (/\b(milestone|milestones|expedition guide|phase \d|phases)\b/.test(t) && /expedition|milestone|phase/.test(t)) {
      var ph = /phase (\d)/.exec(t); return { kind: 'milestones', phase: ph ? +ph[1] : null };
    }
    if ((m = /what (?:can|could|do|should) (?:i|you|we) (?:make|craft|build|refine|do|use) (?:with|from) (.+)/.exec(t)) ||
        (m = /what (?:does|do|can|will) (.+?) refine (?:in)?to/.exec(t)) ||
        (m = /(?:refine|refining|refined) (.+?) (?:in)?to\b/.exec(t)) ||
        (m = /what (?:is|are) (.+?) (?:used|good) for/.exec(t)) ||
        (m = /uses? (?:of|for) (.+)/.exec(t))) { var s1 = subj(m[1]); if (s1) return { kind: 'uses', subject: s1 }; }
    if ((m = /(?:how (?:do|can|could|would|should) (?:i|you|we|one) |how to |ways? to )(?:make|craft|build|create|produce|refine|manufacture|cook|get|obtain) (.+)/.exec(t)) ||
        (m = /(?:recipe|recipes|ingredients?|blueprint|formula) (?:for|of|to make) (.+)/.exec(t)) ||
        (m = /what (?:do i need|does it take|is needed) (?:to|for) (?:make|craft|build|create) (.+)/.exec(t)) ||
        (m = /(?:craft|crafting|make|making) (?:a |an )?(.+?) recipe/.exec(t))) { var s2 = subj(m[1]); if (s2) return { kind: 'make', subject: s2 }; }
    if ((m = /where (?:do|can|could|would|should|might) (?:i|you|we|one) (?:find|get|farm|buy|mine|harvest|locate|collect|gather|source) (.+)/.exec(t)) ||
        (m = /where (?:to|is|are|does one) (?:find|get|farm|buy) (.+)/.exec(t)) ||
        (m = /where (?:is|are) (?:the )?(?:best place to (?:find|get|farm) )?(.+?)(?: found)? $/.exec(t)) ||
        (m = /(?:how (?:do|can) i |how to )(?:find|farm|mine|harvest|collect|gather) (.+)/.exec(t))) { var s3 = subj(m[1]); if (s3) return { kind: 'find', subject: s3 }; }
    if ((m = /(?:tell me about|what is|what's|what are|info on|information on) (?:a |an |the )?(.+)/.exec(t))) {
      var s4 = subj(m[1]); if (s4 && !/\b(you|your|my|name|atlas|story|fact|expedition|faction|time|weather)\b/.test(s4)) return { kind: 'about', subject: s4 };
    }
    return null;
  }

  /* ---------- spoken answers ---------- */
  function list(arr, n) { arr = arr.slice(0, n || arr.length); return arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]; }
  function ings(r) { return list(r.ing.map(function (x) { return x.qty + ' ' + x.name; })); }
  var CREDIT = ' Data from the No Man\'s Sky Wiki.';

  function answer(intent, ctx) {
    if (!intent) return Promise.resolve(null);
    if (intent.kind === 'milestones') {
      var exName = ctx && ctx.expeditionName;
      if (!exName) return Promise.resolve(null);
      return expedition(exName).then(function (g) {
        if (!g || !g.phases.length) return null;
        var p = intent.phase ? g.phases.filter(function (x) { return x.phase === intent.phase; })[0] : null;
        if (p) {
          return 'Phase ' + p.phase + ' of ' + g.title.replace(/^Expedition \d+:\s*/, '') + ': ' +
            p.milestones.map(function (x) { return x.name + ' — ' + x.req.replace(/\.$/, '') + (x.hint ? ' (' + x.hint.replace(/\.$/, '') + ')' : ''); }).join('. ') + '.' + CREDIT;
        }
        var total = g.phases.reduce(function (a, x) { return a + x.milestones.length; }, 0);
        var first = g.phases[0].milestones.slice(0, 3).map(function (x) { return x.name + ' — ' + x.req.replace(/\.$/, ''); }).join('; ');
        return g.title.replace(/^Expedition (\d+):\s*/, 'Expedition $1, ') + ', has ' + g.phases.length + ' phases and ' + total +
          ' milestones, Traveller. Phase 1 opens with ' + first + '. Ask me for any phase by number, or open the full guide on screen.' + CREDIT;
      });
    }
    if (intent.kind === 'uses') {
      return usedIn(intent.subject).then(function (u) {
        if (!u) return null;
        if (!u.refine.length && !u.craftCount) return 'The archive lists no recipes that use ' + u.title + ', Traveller.' + CREDIT;
        var s = u.title + ': ';
        if (u.refine.length) {
          var prods = [], by = {};
          u.refine.forEach(function (r) { if (!by[r.product]) { by[r.product] = r; prods.push(r.product); } });
          var self = new RegExp('\\s*\\+?\\s*' + u.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' x\\d+\\s*\\+?\\s*');
          var shown = prods.slice(0, 6).map(function (p, k) {
            if (k > 1) return p;
            var other = by[p].inputs.replace(self, ' + ').replace(/^\s*\+\s*|\s*\+\s*$/g, '').trim();
            return other ? p + ' (with ' + other.replace(/ x(\d+)/g, ' ×$1') + ')' : p;
          });
          s += 'in a refiner it becomes ' + list(shown) + (prods.length > 6 ? ' — ' + prods.length + ' products in all' : '') + '. ';
        }
        if (u.craftCount) s += 'It also goes into ' + u.craftCount + ' crafting recipe' + (u.craftCount === 1 ? '' : 's') + '.';
        return s.trim() + CREDIT;
      });
    }
    return item(intent.subject).then(function (it) {
      if (!it) return null;
      var ib = it.info || {}, out = [];
      var isThing = /resource|product|technology|item|building|ingredient|consumable|curiosity|trade|fish|plant|substance/i.test((ib.kind || '') + ' ' + (ib.category || ''));
      if (intent.kind === 'about' && !isThing) return null; // lore questions: leave them to the Atlas
      if ((intent.kind === 'make' || intent.kind === 'find') && (!isThing || /catalog|^list of/i.test(it.title || ''))) return null; // ships, pets, places: the archive lookup answers those
      if (intent.kind === 'make' || intent.kind === 'about') {
        if (it.craft.length) out.push('Craft ' + it.title + ' from ' + ings(it.craft[0]) + (it.craft[0].blueprint ? ' — you\'ll need its blueprint first' : '') + '.');
        if (it.refine.length) out.push('In a refiner: ' + it.refine.slice(0, 3).map(function (r) { return ings(r) + ' make ' + r.out; }).join('; or ') + '.');
        if (it.cook.length && !it.craft.length && !it.refine.length) out.push('Cook it in the Nutrient Processor from ' + ings(it.cook[0]) + '.');
        if (intent.kind === 'make' && !out.length) out.push(it.title + ' isn\'t crafted or refined, Traveller — it\'s gathered.');
      }
      if (intent.kind === 'find' || (intent.kind === 'make' && !it.craft.length && !it.refine.length) || intent.kind === 'about') {
        if (it.source.length) {
          var bits = it.source.slice(0, 3).map(function (s, i) {
            s = s.split(/(?<=[.!])\s/)[0].replace(/\.$/, '');
            return i ? s.charAt(0).toLowerCase() + s.slice(1) : s;
          });
          out.push((intent.kind === 'find' ? 'Where to find ' + it.title + ': ' : 'Found: ') + bits.join('; ') + '.');
        }
        else if (intent.kind === 'find' && (it.craft.length || it.refine.length)) out.push(it.title + ' is made rather than found — ask me how to make it.');
      }
      if (intent.kind === 'about') {
        var lead = it.summary || it.desc;
        if (lead) out.unshift(lead);
        if (ib.value) out.push('Worth about ' + ib.value + ' units each.');
      }
      if (!out.length) return null;
      return out.join(' ') + CREDIT;
    });
  }


  /* ---------- v4.5: the Atlas archive — answer ANY No Man's Sky question from the wiki ----------
     lookup(question): searches the NMS Wiki for the subject, reads the page's opening lines
     (plus its "Obtaining" / "Location" style section for how-do-I questions) and returns a short
     spoken answer. Free, no key. Returns null when the wiki has nothing on it. Cached 24h. */
  var FILLER = /^(?:(?:hey|hi|ok|okay|so|please|atlas|traveller|can you|could you|would you|do you know|i want to know|i'd like to know|tell me|tell me about|explain|describe|what(?:'s| is| are| was| were)?|who(?:'s| is| are| was)?|where(?:'s| is| are| do i find| can i find)?|when(?:'s| is| are| did| does)?|why(?:'s| is| are| do| does)?|which|how(?:'s| is| are| do i| do you| can i| does| to)?|is there|are there|does|do|can i|should i|about|a|an|the|me|some|any|more|info|information|on|of)\s+)+/;
  function lookupSubject(q) {
    var t = String(q || '').toLowerCase().replace(/[’']/g, "'").replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.replace(/\b(in|on|for) (no man'?s sky|nms|the game|this game)\b/g, ' ').replace(/\b(no man'?s sky|nms)\b/g, ' ');
    var how = /\b(how (?:do|can|could|should) (?:i|you|we)|how to|where (?:do|can|is|are)|get|getting|obtain|unlock|find|reach|start|begin|buy|summon|tame|repair|fix|upgrade|build|install)\b/.test(t);
    t = t.replace(FILLER, '').replace(/^(get|getting|obtain|unlock|find|reach|start|begin|buy|summon|tame|repair|fix|upgrade|build|install|make|use|do|go to|travel to|become|play|join)\s+(?:a |an |the |my |more |some )?/, '').trim();
    t = t.replace(/\s+(work|works|do|does|mean|means|for|is|are)$/, '').trim();
    return { subject: t, how: how };
  }
  function noTemplates(wt) {
    var prev; do { prev = wt; wt = wt.replace(/\{\{[^{}]*\}\}/g, ''); } while (wt !== prev);
    wt = wt.replace(/\{\|[\s\S]*?\|\}/g, '').replace(/^\s*\[\[(?:File|Image):.*$/gim, '').replace(/<gallery[\s\S]*?<\/gallery>/gi, '');
    return wt;
  }
  function sentences(text, n, maxWords) {
    var ss = String(text || '').split(/(?<=[.!?])\s+(?=[A-Z0-9"])/).filter(function (x) { return x.length > 2; });
    var out = [], words = 0;
    for (var i = 0; i < ss.length && out.length < n; i++) {
      var w = ss[i].split(/\s+/).length; if (out.length && words + w > maxWords) break;
      out.push(ss[i]); words += w;
    }
    return out.join(' ');
  }
  function paragraph(wt) {
    return noTemplates(wt).replace(/^\s*=+[^=\n]+=+\s*$/gm, '\n').split(/\n\s*\n/)
      .map(function (p) { return p.split('\n').filter(function (l) { return !/^\s*[*#:|!;]/.test(l); }).join(' '); })
      .map(plain).filter(function (p) { return /[a-z]{3}/.test(p) && p.length > 40; });
  }
  // the wiki also hosts thousands of player pages (bases, events, businesses, discovered ships);
  // the Atlas answers from the game's own pages
  function playerPage(wt) {
    return /\|\s*(civilized|discovered|discoveredlink|builder|creator|owner|founder)\s*=\s*[^\s|}]/i.test(wt) ||
      /\{\{\s*(Base|Event|Civilized|Civ|Business|Player)[^|}]*infobox/i.test(wt) ||
      /\b(is a player base|is a player-made|is a business|is an? (?:upcoming |annual )?(?:community )?event|discovered by|uploaded by)\b/i.test(noTemplates(wt).slice(0, 1500));
  }
  var SYN = [[/\b(tame|pet|pets|companions?|adopt)\b/, 'Companion'], [/\b(cent(?:er|re) of the galaxy|galactic cent(?:er|re)|galaxy cent(?:er|re))\b/, 'Galaxy Centre'],
    [/\brepair(?:ing)? (?:my |a |the )?(?:ship|starship)\b/, 'Damaged Machinery'], [/\bexotic (?:ships?|starships?)\b/, 'Starship'], [/\batlas path\b/, 'The Atlas Path'], [/\bsettlements?\b/, 'Settlement'],
    [/\b(next galaxy|new galaxy|other galaxies|change galaxy)\b/, 'Galaxy'], [/\bportals?\b/, 'Portal'], [/\bglyphs?\b/, 'Portal glyph'],
    [/\bliving ships?\b/, 'Living Ship'], [/\bspace anomaly\b/, 'Space Anomaly'], [/\bmulti-?tools?\b/, 'Multi-Tool'], [/\b(purple|green|blue|red|yellow) (?:star|stars|system|systems)\b/, 'Star'],
    [/\b(sentinel ships?|sentinel interceptors?)\b/, 'Sentinel Interceptor'], [/\bderelict freighters?\b/, 'Derelict Freighter'], [/\bfrigates?\b/, 'Frigate']];
  function lookup(question) {
    var q = lookupSubject(question); if (!q.subject || q.subject.length < 3) return Promise.resolve(null);
    var raw = String(question || '').toLowerCase();
    for (var k = 0; k < SYN.length; k++) if (SYN[k][0].test(raw)) { q.subject = SYN[k][1].toLowerCase(); break; }
    var key = 'look2:' + q.subject + (q.how ? ':how' : ''), hit = cacheGet(key, 864e5);
    if (hit !== undefined) return Promise.resolve(hit);
    var words = q.subject.split(' ').filter(function (w) { return w.length >= 4; });
    return get({ action: 'query', list: 'search', srsearch: q.subject, srlimit: 10, srnamespace: 0 }).then(function (j) {
      var hits = ((j.query && j.query.search) || []).map(function (h) { return h.title; })
        .filter(function (h) { return !/\/|^List of|disambiguation|^Category|^Version|^Patch|^Update|catalogue|\((?:Outlaws|Atlas Rises|Foundation|NEXT|Pathfinder|Beyond|Origins|pre-)/i.test(h); });
      if (!hits.length) return null;
      var lower = q.subject.replace(/s$/, '');
      hits.sort(function (a, b) {
        var sa = a.toLowerCase().replace(/s$/, '') === lower ? 2 : words.some(function (w) { return a.toLowerCase().indexOf(w.replace(/s$/, '')) >= 0; }) ? 1 : 0;
        var sb = b.toLowerCase().replace(/s$/, '') === lower ? 2 : words.some(function (w) { return b.toLowerCase().indexOf(w.replace(/s$/, '')) >= 0; }) ? 1 : 0;
        return sb - sa;
      });
      var tries = hits.slice(0, 4);
      function attempt(i) {
        if (i >= tries.length) return null;
        return get({ action: 'parse', page: tries[i], prop: 'wikitext', redirects: 1 }).then(function (p) {
          var wt = (p.parse && p.parse.wikitext && p.parse.wikitext['*']) || '', title = (p.parse && p.parse.title) || tries[i];
          if (!wt || playerPage(wt)) return attempt(i + 1);
          var first = wt.search(/^==[^=]/m), intro = paragraph(first < 0 ? wt : wt.slice(0, first));
          var sum = paragraph(section(wt, 'Summary'));
          var lead = (intro.join(' ').length > 90 ? intro : sum.length ? sum : intro).join(' ');
          if (!lead) return attempt(i + 1);
          var text = sentences(lead, 3, 60);
          var hay = (title + ' ' + text).toLowerCase();
          if (words.length && !words.some(function (w) { return hay.indexOf(w.replace(/s$/, '')) >= 0; })) return attempt(i + 1);
          if (q.how) {
            var secs = ['Obtaining', 'Acquisition', 'How to obtain', 'How to get', 'Getting', 'Unlocking', 'Location', 'Locations', 'Taming', 'Adopting', 'Purchasing', 'Summoning', 'Walkthrough', 'Usage', 'Gameplay'];
            for (var s2 = 0; s2 < secs.length; s2++) {
              var raw2 = section(wt, secs[s2]); if (!raw2) continue;
              var sp = paragraph(raw2);
              if (sp.length) { text += ' ' + sentences(sp.join(' '), 2, 45); break; }
              var bl = noTemplates(raw2).split('\n').filter(function (l) { return /^\s*\*/.test(l); }).map(function (l) { return plain(l.replace(/^\s*\*+/, '')); }).filter(Boolean);
              if (bl.length) { text += ' ' + bl.slice(0, 2).join(' '); break; }
            }
          }
          var out = text.replace(/\s*,?\s*\(?see (?:below|above)\)?/gi, '').replace(/\s+([,.])/g, '$1').replace(/\s+/g, ' ').trim() + CREDIT;
          cacheSet(key, out); return out;
        });
      }
      return attempt(0);
    }).catch(function () { return null; });
  }

  root.NMSCodex = { lookup: lookup, item: item, usedIn: usedIn, expedition: expedition, detect: detect, answer: answer, plain: plain };
})(typeof window !== 'undefined' ? window : globalThis);
