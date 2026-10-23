/* nms-push.js -- alerts for the No Man's Sky Hub apps (2026-10-23, Tony).
   Same file on the Hub, ATLAS, the Galactic Map and the Theme Pack. The sign-up server is
   the Weather station's (weather.nomansskyhub.app/api/push-subscribe, same keys), but each
   app signs up from its own address, so its alerts arrive under its own name and icon.

     NMS_PUSH.state(app)        -> Promise 'on' | 'off' | 'denied' | 'unsupported'
     NMS_PUSH.on(app, extra)    -> Promise true/false   extra: { prefs, name }
     NMS_PUSH.off(app)          -> Promise
   app: 'hub' | 'atlas' | 'map' | 'theme'. Alerts come in the language picked with 🌐
   (re-sent to the server whenever it changes). Needs the site's sw.js to handle 'push'. */
(function () {
  var KEY = 'BCRPzjU-oj-cd7LV1ClApXKwZwAHfgUL7EjIEkBUB8qET6AGIscSWXUm_wIlm_xazaDCD-vmQo4Py5zqgaVsE00';
  var API = 'https://weather.nomansskyhub.app/api/push-subscribe';
  var LS = 'nms-push-';

  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function lang() { try { return (window.NMS_LANG && NMS_LANG()) || 'en'; } catch (e) { return 'en'; } }
  function lsGet(app) { try { return JSON.parse(localStorage.getItem(LS + app) || 'null'); } catch (e) { return null; } }
  function lsSet(app, v) { try { if (v) localStorage.setItem(LS + app, JSON.stringify(v)); else localStorage.removeItem(LS + app); } catch (e) {} }
  function keyBytes() {
    var p = '='.repeat((4 - KEY.length % 4) % 4), raw = atob((KEY + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  }
  // ATLAS only registers its worker here, the others already have one running
  function ready() {
    return navigator.serviceWorker.getRegistration().then(function (r) { return r || navigator.serviceWorker.register('sw.js'); })
      .then(function () { return navigator.serviceWorker.ready; });
  }
  function send(app, sub, extra) {
    var body = { app: app, sub: sub.toJSON(), lang: lang() };
    if (extra && extra.prefs) body.prefs = extra.prefs;
    if (extra && extra.name) body.name = extra.name;
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('push-subscribe ' + r.status); lsSet(app, { extra: extra || {}, lang: body.lang }); return true; });
  }

  function state(app) {
    if (!supported()) return Promise.resolve('unsupported');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    if (!lsGet(app) || Notification.permission !== 'granted') return Promise.resolve('off');
    return navigator.serviceWorker.getRegistration().then(function (r) { return r ? r.pushManager.getSubscription() : null; })
      .then(function (s) { return s ? 'on' : 'off'; }).catch(function () { return 'off'; });
  }
  function on(app, extra) {
    if (!supported()) return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') return false;
      return ready().then(function (r) {
        return r.pushManager.getSubscription().then(function (s) { return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes() }); });
      }).then(function (sub) { return send(app, sub, extra); });
    }).catch(function (e) { console.warn('nms-push', e); return false; });
  }
  function off(app) {
    lsSet(app, null);
    if (!supported()) return Promise.resolve();
    return navigator.serviceWorker.getRegistration().then(function (r) { return r ? r.pushManager.getSubscription() : null; }).then(function (s) {
      if (!s) return;
      return fetch(API, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) })
        .catch(function () {}).then(function () { return s.unsubscribe(); });
    }).catch(function () {});
  }
  // a new 🌐 language: tell the server so the next alert is in it
  document.addEventListener('nms-lang', function () {
    ['hub', 'atlas', 'map', 'theme'].forEach(function (app) {
      var saved = lsGet(app);
      if (!saved || saved.lang === lang() || !supported() || Notification.permission !== 'granted') return;
      navigator.serviceWorker.getRegistration().then(function (r) { return r ? r.pushManager.getSubscription() : null; })
        .then(function (s) { if (s) return send(app, s, saved.extra); }).catch(function () {});
    });
  });

  // ---- a ready-made on/off button ----
  // NMS_PUSH.wire(button, app, { label, onLabel, okMsg, extra: function(){ return {..} or null }, fallbackHref })
  function T(s) { try { return window.NMS_T ? NMS_T(s) : s; } catch (e) { return s; } }
  function toast(msg) {
    var t = document.getElementById('nmsPushToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'nmsPushToast'; t.setAttribute('role', 'status');
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:min(92vw,420px);padding:12px 16px;border-radius:10px;' +
        'background:rgba(7,11,17,.96);border:1px solid rgba(0,229,255,.45);color:#dff8ff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, msg.length > 90 ? 8000 : 4500);
  }
  var IOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  function standalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function wire(btn, app, o) {
    if (!btn) return;
    var busy = false;
    function render() {
      return state(app).then(function (st) {
        btn.classList.toggle('on', st === 'on'); btn.setAttribute('aria-pressed', st === 'on');
        btn.textContent = T(st === 'on' ? o.onLabel : o.label); btn.dataset.state = st;
      });
    }
    btn.addEventListener('click', function (e) {
      if (busy) return; e.preventDefault();
      var st = btn.dataset.state;
      if (st === 'unsupported') {
        if (IOS) return toast(T('On iPhone, add this site to your Home Screen first, then turn alerts on.'));
        if (o.fallbackHref) { window.open(o.fallbackHref, '_blank', 'noopener'); return; }
        return toast(T('This browser can’t show notifications.'));
      }
      if (st === 'denied') return toast(T('Notifications are blocked for this site. Allow them in your browser or phone settings.'));
      if (st === 'on') { busy = true; off(app).then(render).then(function () { busy = false; toast(T('Alerts off.')); }); return; }
      var extra = o.extra ? o.extra() : {};
      if (extra === null) return;
      busy = true; btn.textContent = '…';
      on(app, extra).then(function (ok) {
        return render().then(function () { busy = false; toast(ok ? T(o.okMsg) + (standalone() ? '' : ' ' + T('Tip: install this app and alerts show under its own name and icon.')) : (Notification.permission === 'denied' ? T('Notifications are blocked for this site. Allow them in your browser or phone settings.') : T('Couldn’t turn alerts on. Try again in a moment.'))); });
      });
    });
    render();
    document.addEventListener('nms-lang', render);
  }
  window.NMS_PUSH = { state: state, on: on, off: off, supported: supported, wire: wire, toast: toast };
})();
