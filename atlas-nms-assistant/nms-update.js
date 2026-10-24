/* nms-update.js -- shared by all six No Man's Sky Hub sites (2026-10-24, Tony).
   An installed app on a phone is not reloaded when you switch back to it, so it
   could keep showing an old version until it was closed and reopened.
   Now: each time the app comes back to the screen (and every 30 minutes while it
   stays open) it asks for the newest sw.js. When a new version has been put live,
   a small bar shows at the bottom: "New version ready · tap to update". One tap
   reloads in place; x hides it until the next new version.
   Never reloads by itself (that could lose a half-typed edit or a 3D view).
   Text comes from the site's language pack via NMS_T when lang.js is loaded. */
(function () {
  if (!('serviceWorker' in navigator) || window.NMS_UPDATE) return;
  var bar = null, lastCheck = 0, loadedAt = Date.now();
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
    go.addEventListener('click', function () { tx.textContent = '…'; location.reload(); });
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

  window.NMS_UPDATE = { check: check, show: show };
})();
