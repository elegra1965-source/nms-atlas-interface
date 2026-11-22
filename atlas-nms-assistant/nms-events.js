/* nms-events.js (2026-11-23) -- the same file on every nomansskyhub.app site.
   Counts which features are used and which files are downloaded, as GoatCounter events
   (free, no cookies, same dashboard as the page views). Only a button name is sent: no
   text, files or personal data ever leave the device. Events appear in GoatCounter as
   download/<file>, open/<section>, use/<page>/<button id>, tab/<page>/<tab> and any name passed to window.nmsEv(). */
(function () {
  'use strict';
  var seen = {}, SKIP = /close|dismiss|skip|cancel|backspace|clear|reload|^lang|langbtn|^x$/i;
  function ev(name, title, once) {
    if (!name) return;
    if (once) { if (seen[name]) return; seen[name] = 1; }
    var n = 0;
    (function send() {
      var g = window.goatcounter;
      if (g && g.count) { try { g.count({ path: name, title: title || name, event: true }); } catch (e) {} }
      else if (++n < 10) setTimeout(send, 1000);
    })();
  }
  window.nmsEv = ev;
  function page() { var p = location.pathname.split('/').pop().replace(/\.html$/, ''); return p || 'index'; }
  function fname(a) {
    var n = a.getAttribute('download');
    var h = a.getAttribute('href') || '';
    if (!n || n === '') { n = h.indexOf('blob:') === 0 ? 'blob-' + (a.id || 'file') : h.split('#')[0].split('?')[0].split('/').pop(); }
    return (n || 'file').toLowerCase();
  }
  /* downloads: real clicks on <a download>, and files the pages save from code (a.click()) */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var a = t.closest('a[download]');
    if (a) { var f = fname(a); ev('download/' + f, 'Download: ' + f); return; }
    var x = t.closest('[data-ev]');
    if (x) { ev(x.getAttribute('data-ev')); return; }
    var b = t.closest('button[id], [role="tab"]');
    if (!b) return;
    var k = b.id || b.getAttribute('aria-controls') || b.getAttribute('data-tab') || (b.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
    if (!k || SKIP.test(k)) return;
    ev((b.getAttribute('role') === 'tab' ? 'tab/' : 'use/') + page() + '/' + k, 'Used: ' + page() + ' ' + k);
  }, true);
  try {
    var oc = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      try { if (this.hasAttribute('download') && !this.isConnected) { var f = fname(this); ev('download/' + f, 'Download: ' + f); } } catch (e) {}
      return oc.apply(this, arguments);
    };
  } catch (e) {}
  /* section opens: the first time each accordion section is opened on a visit */
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    var s = d.closest('section[id]'); if (s) ev('open/' + s.id, 'Opened: ' + s.id, true);
  }, true);
})();
