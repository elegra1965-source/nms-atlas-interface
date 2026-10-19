/* ============================================================
   Calm mode (2026-10-18) -- shared by every nomansskyhub.app site.

   Feedback from r/NMSCoordinateExchange: some pages "look cool, but are
   really busy with density of text and a patterned / image background".
   Calm mode is an opt-in switch (small "Calm" pill, bottom-left) that
   swaps the moving/patterned/image backgrounds for a plain dark
   background. Everything else -- text, glyphs, the alien-font decode,
   colours, layout -- stays the same.

   - Remembered in a cookie on .nomansskyhub.app, so turning it on in one
     site turns it on in all of them (localStorage fallback elsewhere).
   - ?calm=1 / ?calm=0 in the URL forces it on/off.
   - Load in <head> (no defer) so the class lands before first paint.
   - Each site's own background layers are listed in SITE below; anything
     not listed is untouched.
   ============================================================ */
(function(){
  var K = "nms_calm";
  var host = location.hostname;
  var CALM_BG = "#070b11";

  /* Per-site background layers to remove in Calm mode. */
  var COMMON =
    "html.calm,html.calm body{background:" + CALM_BG + "!important;background-image:none!important}";
  var SITE = [
    /* Hub */
    [/^(www\.)?nomansskyhub\.app$|^localhost$/,
      "html.calm .hero .slide,html.calm .hero .lines,html.calm .hero-scan,html.calm .nodes .stars{display:none!important}" +
      "html.calm .hero{background:" + CALM_BG + "!important}" +
      "html.calm .card .img,html.calm .card .holo,html.calm .card .sheen{display:none!important}" +
      "html.calm .card .shade{background:#0b121c!important}"],
    /* Theme Pack */
    [/^theme\.nomansskyhub\.app$/,
      "html.calm .bg-layer,html.calm .grid-bg,html.calm .orb,html.calm .scanlines,html.calm .vignette{display:none!important}"],
    /* Weather */
    [/^weather\.nomansskyhub\.app$/,
      "html.calm .atm{display:none!important}"],
    /* Alphabet Translator */
    [/^translator\.nomansskyhub\.app$/,
      "html.calm body::before{display:none!important}"],
    /* ATLAS */
    [/^atlas\.nomansskyhub\.app$/,
      "html.calm #bg-base,html.calm #bg-scanlines,html.calm #bg-vignette{display:none!important}"]
  ];

  function read(){
    var q = location.search;
    if(/[?&]calm=1\b/.test(q)) return true;
    if(/[?&]calm=0\b/.test(q)) return false;
    var m = document.cookie.match(/(?:^|;\s*)nms_calm=([01])/);
    if(m) return m[1] === "1";
    try{ return localStorage.getItem(K) === "1"; }catch(e){ return false; }
  }
  function save(on){
    var dom = /(^|\.)nomansskyhub\.app$/.test(host) ? ";domain=.nomansskyhub.app" : "";
    document.cookie = K + "=" + (on ? 1 : 0) + ";path=/;max-age=31536000;SameSite=Lax" + dom;
    try{ localStorage.setItem(K, on ? "1" : "0"); }catch(e){}
  }

  var css = COMMON;
  for(var i = 0; i < SITE.length; i++) if(SITE[i][0].test(host)) css += SITE[i][1];
  css +=
    "#nmsCalmBtn{position:fixed;left:12px;bottom:12px;z-index:9990;display:flex;align-items:center;gap:6px;" +
    "padding:6px 11px;border-radius:999px;border:1px solid rgba(0,229,255,.35);background:rgba(5,9,14,.85);" +
    "color:#9fdcea;font:600 11px/1 'Rajdhani','Segoe UI',system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;" +
    "cursor:pointer;opacity:.75;transition:opacity .2s,border-color .2s;-webkit-tap-highlight-color:transparent}" +
    "#nmsCalmBtn:hover,#nmsCalmBtn:focus-visible{opacity:1;border-color:rgba(0,229,255,.7);outline:none}" +
    "#nmsCalmBtn .dot{width:10px;height:10px;border-radius:50%;border:1.5px solid currentColor;box-sizing:border-box}" +
    "html.calm #nmsCalmBtn{color:#f0a500;border-color:rgba(240,165,0,.55)}" +
    "html.calm #nmsCalmBtn .dot{background:currentColor}" +
    "@media print{#nmsCalmBtn{display:none}}";

  var st = document.createElement("style");
  st.id = "nmsCalmCss";
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var on = read();
  document.documentElement.classList.toggle("calm", on);

  function mount(){
    if(document.getElementById("nmsCalmBtn")) return;
    var b = document.createElement("button");
    b.id = "nmsCalmBtn";
    b.type = "button";
    b.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Calm</span>';
    function sync(){
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.title = on ? "Calm mode is on: plain background. Click to turn it off."
                   : "Calm mode: swap the busy backgrounds for a plain dark one (all Hub sites).";
    }
    sync();
    b.addEventListener("click", function(){
      on = !on;
      document.documentElement.classList.toggle("calm", on);
      save(on); sync();
    });
    // A site can give the switch a home of its own (the Galactic Map puts it in its
    // settings panel, since a floating pill would sit on top of the map's own panels).
    var slot = document.getElementById("nmsCalmSlot");
    (slot || document.body).appendChild(b);
  }
  if(document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
