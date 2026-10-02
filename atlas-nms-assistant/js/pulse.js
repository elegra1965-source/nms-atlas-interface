/* ================= ATLAS — pulse.js (v4.0) =================
   Sound-reactive orb. Reads Voice.level() (0..1) every frame while
   ATLAS is listening or speaking and writes it to --lvl on #orb-arch;
   orb.css turns that into extra brightness and a ring swell.
   Idle/thinking: the loop sleeps. Reduced-motion: never runs.
=========================================================== */
(() => {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const arch = document.getElementById('orb-arch');
  const zone = document.getElementById('orb-zone');
  if (!arch || !zone || typeof Voice === 'undefined' || !Voice.level) return;

  let shown = 0, running = false;

  function active() {
    const s = zone.dataset.state;
    return s === 'speaking' || s === 'listening';
  }

  function frame() {
    const target = active() ? Voice.level() : 0;
    // quick attack, softer release — reads as a voice, not a strobe
    shown += (target - shown) * (target > shown ? 0.55 : 0.18);
    if (shown < 0.004) shown = 0;
    arch.style.setProperty('--lvl', shown.toFixed(3));
    if (active() || shown > 0) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    if (running || !active()) return;
    running = true;
    requestAnimationFrame(frame);
  }

  new MutationObserver(wake).observe(zone, { attributes: true, attributeFilter: ['data-state'] });
  wake();
})();
