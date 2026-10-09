/* ================= ATLAS — scrollhints.js (v4.2) =================
   On portrait phones the side panels become sideways-scrolling strips, and
   nothing told Travellers there were more tiles. This adds diamond arrows at
   the edges of each strip: the right one shows while there's more to the
   right, the left one appears once you've scrolled. Tap to jump one tile.
   Desktop is untouched (the wrapper is display:contents there).
=================================================================== */
(() => {
  const STRIPS = ['panel-left', 'panel-right'];
  const MQ = window.matchMedia('(max-width: 768px) and (orientation: portrait)');

  function mk(dir) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sh-arrow sh-' + dir;
    b.setAttribute('aria-label', dir === 'left' ? 'Scroll to previous tiles' : 'Scroll to more tiles');
    b.innerHTML = dir === 'left'
      ? '<span class="sh-chev">‹</span><span class="sh-dia">◆</span>'
      : '<span class="sh-dia">◆</span><span class="sh-chev">›</span>';
    return b;
  }

  function setup(id) {
    const strip = document.getElementById(id);
    if (!strip || strip.parentElement.classList.contains('sh-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'sh-wrap';
    wrap.id = 'sh-' + id;
    strip.parentNode.insertBefore(wrap, strip);
    wrap.appendChild(strip);
    const L = mk('left'), R = mk('right');
    wrap.appendChild(L); wrap.appendChild(R);

    function update() {
      const max = strip.scrollWidth - strip.clientWidth;
      const on = MQ.matches && max > 4;
      L.classList.toggle('show', on && strip.scrollLeft > 4);
      R.classList.toggle('show', on && strip.scrollLeft < max - 4);
    }
    function step(dir) {
      const w = strip.querySelector('.widget');
      const by = w ? w.getBoundingClientRect().width + 12 : strip.clientWidth * 0.8;
      strip.scrollBy({ left: dir * by, behavior: 'smooth' });
    }
    // v4.3: the strip is only as tall as the tiles you can actually see, so a tall
    // tile (System Scan) no longer leaves empty space under the short ones
    let fitT = null;
    function fit() {
      if (!MQ.matches) { strip.style.height = ''; return; }
      const r = strip.getBoundingClientRect();
      let h = 0;
      strip.querySelectorAll(':scope > .widget').forEach(w => {
        const b = w.getBoundingClientRect();
        const vis = Math.min(b.right, r.right) - Math.max(b.left, r.left);
        if (vis > Math.min(b.width, r.width) * 0.3) h = Math.max(h, w.offsetHeight);
      });
      if (!h) return;
      const cs = getComputedStyle(strip);
      const extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + (strip.offsetHeight - strip.clientHeight);
      strip.style.height = Math.ceil(h + extra) + 'px';
    }
    function fitSoon() { clearTimeout(fitT); fitT = setTimeout(fit, 120); }
    L.addEventListener('click', () => step(-1));
    R.addEventListener('click', () => step(1));
    strip.addEventListener('scroll', () => { update(); fitSoon(); }, { passive: true });
    window.addEventListener('resize', fitSoon);
    if (MQ.addEventListener) MQ.addEventListener('change', fitSoon);
    window.addEventListener('resize', update);
    if (MQ.addEventListener) MQ.addEventListener('change', update);
    // content (weather, scans, gallery) loads late and changes widths
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(update);
      ro.observe(strip);
      const roW = new ResizeObserver(() => { update(); fitSoon(); });
      strip.querySelectorAll('.widget').forEach(w => roW.observe(w));
    }
    update(); fitSoon();
    setTimeout(() => { update(); fit(); }, 1500);
  }

  function init() { STRIPS.forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
