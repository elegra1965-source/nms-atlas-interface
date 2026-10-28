/* nms-totop.js — shared floating back-to-top arrow for every No Man's Sky Hub site (2026-10-28).
   Same look as the Theme Pack's original button: teal ring, ⇧ arrow, gentle bob once you've scrolled.
   Shows after 320px of scrolling, smooth-scrolls to the top (instant with reduced motion).
   Replaces the older phone-only .to-top arrow on the Hub and Weather. Same file in every repo. */
(function(){
  if (window.NMS_TOTOP) return; window.NMS_TOTOP = 1;
  function init(){
    if (document.getElementById('nms-top-btn')) return;           /* page already has one */
    document.documentElement.classList.add('nms-totop');
    var st = document.createElement('style');
    st.textContent =
      '.nms-totop .to-top{display:none!important}' +
      '#nms-top-btn{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 16px));width:48px;height:48px;' +
      'background:rgba(0,200,170,.12);border:1.5px solid rgba(0,200,170,.55);color:#00c8aa;border-radius:50%;cursor:pointer;font-size:22px;line-height:1;' +
      'display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .35s ease,box-shadow .35s ease;z-index:2147480000;' +
      'box-shadow:0 0 0 rgba(0,200,170,0);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);padding:0}' +
      '#nms-top-btn.nms-visible{opacity:1;pointer-events:auto;animation:nms-bob 2.2s ease-in-out infinite;box-shadow:0 0 14px rgba(0,200,170,.3)}' +
      '#nms-top-btn:hover,#nms-top-btn:focus-visible{background:rgba(0,200,170,.25);box-shadow:0 0 22px rgba(0,200,170,.5);outline:none}' +
      '@keyframes nms-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}' +
      '@media (min-width:761px){#nms-top-btn{right:2rem;bottom:2rem}}' +
      '@media (prefers-reduced-motion:reduce){#nms-top-btn.nms-visible{animation:none}#nms-top-btn{transition:none}}' +
      '@media print{#nms-top-btn{display:none}}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'nms-top-btn';
    b.setAttribute('aria-label', 'Back to top'); b.title = 'Back to top';
    b.innerHTML = '&#8679;';
    b.addEventListener('click', function(){
      var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({top:0, behavior: calm ? 'auto' : 'smooth'});
      b.blur();
    });
    document.body.appendChild(b);
    var on = false;
    function check(){ var v = (window.scrollY || document.documentElement.scrollTop) > 320; if (v !== on){ on = v; b.classList.toggle('nms-visible', v); } }
    window.addEventListener('scroll', check, {passive:true}); check();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
