/* ================= ATLAS — heartbeat.js =================
   Idle-state orb heartbeat — completely isolated from atlas.js.
   Own AudioContext, own timers. Watches #orb-zone[data-state]
   via MutationObserver. Plays a synthetic lub-dub pulse synced
   to the idle-pulse CSS animation (3s cycle, peak at 1.5s).
   Respects the existing mute flag (atlas_muted in localStorage).
========================================================= */
(() => {
  let hbCtx = null;       // own AudioContext — never shared with atlas.js
  let hbTimer = null;
  let hbTimeout = null;

  function isMuted() {
    return localStorage.getItem('atlas_muted') === '1';
  }

  function playThud() {
    if (isMuted()) return;
    // Only play when context is running (unlocked by prior user gesture)
    if (!hbCtx || hbCtx.state !== 'running') {
      // Try to resume if suspended; will play on next beat
      if (hbCtx && hbCtx.state === 'suspended') hbCtx.resume().catch(() => {});
      return;
    }
    try {
      const t = hbCtx.currentTime;

      // "Lub" — first thud: 70→40 Hz, quick attack, 420ms decay
      const o1 = hbCtx.createOscillator(), g1 = hbCtx.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(70, t);
      o1.frequency.exponentialRampToValueAtTime(40, t + 0.35);
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(0.05, t + 0.012);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o1.connect(g1); g1.connect(hbCtx.destination);
      o1.start(t); o1.stop(t + 0.45);

      // "Dub" — 260ms later, slightly lower pitch
      const o2 = hbCtx.createOscillator(), g2 = hbCtx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(56, t + 0.26);
      o2.frequency.exponentialRampToValueAtTime(33, t + 0.58);
      g2.gain.setValueAtTime(0, t + 0.26);
      g2.gain.linearRampToValueAtTime(0.032, t + 0.272);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
      o2.connect(g2); g2.connect(hbCtx.destination);
      o2.start(t + 0.26); o2.stop(t + 0.68);
    } catch (e) { /* ignore */ }
  }

  function startHeartbeat() {
    stopHeartbeat();
    // 1.5s delay aligns first beat with the idle-pulse animation peak (50% keyframe)
    hbTimeout = setTimeout(() => {
      playThud();
      hbTimer = setInterval(playThud, 3000);
    }, 1500);
  }

  function stopHeartbeat() {
    clearInterval(hbTimer); hbTimer = null;
    clearTimeout(hbTimeout); hbTimeout = null;
  }

  // Unlock AudioContext on first user gesture, then keep it running
  function unlockAudio() {
    if (hbCtx) return;
    try {
      hbCtx = new (window.AudioContext || window.webkitAudioContext)();
      hbCtx.resume().catch(() => {});
    } catch (e) {}
  }

  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchend', unlockAudio, { once: true });

  // Watch #orb-zone data-state for idle ↔ active transitions
  const zone = document.getElementById('orb-zone');
  if (!zone) return;

  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.attributeName !== 'data-state') continue;
      zone.dataset.state === 'idle' ? startHeartbeat() : stopHeartbeat();
    }
  }).observe(zone, { attributes: true });

  // Bootstrap if already idle
  if (!zone.dataset.state || zone.dataset.state === 'idle') startHeartbeat();
})();
