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
    L.addEventListener('click', () => step(-1));
    R.addEventListener('click', () => step(1));
    strip.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    if (MQ.addEventListener) MQ.addEventListener('change', update);
    // content (weather, scans, gallery) loads late and changes widths
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(update);
      ro.observe(strip);
      strip.querySelectorAll('.widget').forEach(w => ro.observe(w));
    }
    update();
    setTimeout(update, 1500);
  }

  function init() { STRIPS.forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
