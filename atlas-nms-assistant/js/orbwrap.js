/* ================= ATLAS — orbwrap.js =================
   Wraps the chamber GIF around the circular arch at runtime.
   Decodes the existing atlas-orb GIF in the browser, warps each
   frame (square -> disc elliptical mapping) onto a canvas so the
   top and sides bend around the circle — no separate GIF asset.
   Reflection is baked into the lower half of the warp.
   Falls back silently to the flat chamber if ImageDecoder
   is unavailable (older browsers).
========================================================= */
(() => {
  if (!('ImageDecoder' in window)) return;

  const arch = document.getElementById('orb-arch');
  const mirror = document.getElementById('orb-mirror');
  if (!arch || !mirror) return;

  const small = window.matchMedia('(max-width: 768px)').matches;
  const SRC = small ? 'assets/atlas-orb-small.gif' : 'assets/atlas-orb.gif';
  const DARK = [10, 6, 8]; // chamber dark the reflection fades into

  const canvas = document.createElement('canvas');
  canvas.id = 'orb-wrap';
  canvas.setAttribute('aria-hidden', 'true'); // decorative
  mirror.after(canvas); // below rings / vignette / status line
  const ctx = canvas.getContext('2d');

  let frames = []; // ImageData per source frame
  let durs = [];   // per-frame duration (ms)
  let map = null;  // dest pixel -> source sample lookup
  let out = null;  // output ImageData
  let D = 0;       // internal canvas resolution

  /* dest disc -> source rect (gif stacked over its own mirror) */
  function buildMap() {
    const rect = arch.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cap = small ? 420 : 640; // phones: cap the warp resolution to save battery
    D = Math.max(160, Math.min(cap, Math.round(rect.width * dpr)));
    canvas.width = D;
    canvas.height = D;

    const W = frames[0].width, H = frames[0].height;
    const n = D * D;
    map = {
      sx: new Float32Array(n),
      sy: new Float32Array(n),
      fac: new Float32Array(n),
      hit: new Uint8Array(n)
    };
    const R = D / 2;
    const s2 = Math.SQRT2;
    const q = a => Math.sqrt(Math.max(a, 0));

    let k = 0;
    for (let j = 0; j < D; j++) {
      const v = (j - R + 0.5) / R;
      for (let i = 0; i < D; i++, k++) {
        const u = (i - R + 0.5) / R;
        if (u * u + v * v > 1) continue;
        const uu = u * u, vv = v * v;
        // elliptical disc->square mapping: pulls corners around the rim
        const x = 0.5 * q(2 + uu - vv + 2 * s2 * u) - 0.5 * q(2 + uu - vv - 2 * s2 * u);
        const y = 0.5 * q(2 - uu + vv + 2 * s2 * v) - 0.5 * q(2 - uu + vv - 2 * s2 * v);
        const gy = (y + 1) / 2 * (2 * H - 1); // 0..2H-1 down the stacked source
        let sy, fac;
        if (gy < H) {           // upper half: the chamber itself
          sy = gy;
          fac = 1;
        } else {                // lower half: mirrored reflection, fading out
          const m = gy - H;
          sy = H - 1 - m;
          fac = Math.max(0, 1 - m / (H * 0.72)) * 0.52 * 0.8;
        }
        map.sx[k] = Math.min(W - 1.001, Math.max(0, (x + 1) / 2 * (W - 1)));
        map.sy[k] = Math.min(H - 1.001, Math.max(0, sy));
        map.fac[k] = fac;
        map.hit[k] = 1;
      }
    }
    out = ctx.createImageData(D, D);
  }

  /* warp one source frame onto the canvas (bilinear) */
  function renderFrame(f) {
    const src = frames[f].data, W = frames[f].width;
    const o = out.data;
    const n = D * D;
    for (let k = 0; k < n; k++) {
      const p = k * 4;
      if (!map.hit[k]) { o[p + 3] = 0; continue; }
      const sx = map.sx[k], sy = map.sy[k];
      const x0 = sx | 0, y0 = sy | 0;
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * W + x0) * 4, i01 = i00 + 4;
      const i10 = i00 + W * 4, i11 = i10 + 4;
      const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy);
      const w10 = (1 - fx) * fy, w11 = fx * fy;
      const fac = map.fac[k], inv = 1 - fac;
      o[p]     = (src[i00]     * w00 + src[i01]     * w01 + src[i10]     * w10 + src[i11]     * w11) * fac + DARK[0] * inv;
      o[p + 1] = (src[i00 + 1] * w00 + src[i01 + 1] * w01 + src[i10 + 1] * w10 + src[i11 + 1] * w11) * fac + DARK[1] * inv;
      o[p + 2] = (src[i00 + 2] * w00 + src[i01 + 2] * w01 + src[i10 + 2] * w10 + src[i11 + 2] * w11) * fac + DARK[2] * inv;
      o[p + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }

  async function init() {
    const buf = await (await fetch(SRC)).arrayBuffer();
    const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
    await dec.tracks.ready;
    const count = dec.tracks.selectedTrack.frameCount;

    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < count; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      if (i === 0) { tmp.width = image.displayWidth; tmp.height = image.displayHeight; }
      tctx.drawImage(image, 0, 0);
      frames.push(tctx.getImageData(0, 0, tmp.width, tmp.height));
      durs.push(image.duration ? image.duration / 1000 : 80);
      image.close();
    }
    dec.close();
    if (!frames.length) return;

    buildMap();
    renderFrame(0);
    arch.classList.add('wrapped'); // hide the flat chamber + mirror

    // reduced-motion users get a single still frame — no animation loop
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let rrt = null;
      window.addEventListener('resize', () => {
        clearTimeout(rrt);
        rrt = setTimeout(() => { buildMap(); renderFrame(0); }, 250);
      });
      return;
    }

    let f = 0, last = performance.now(), acc = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }
      acc += now - last;
      last = now;
      if (acc >= durs[f]) {
        acc = 0;
        f = (f + 1) % frames.length;
        renderFrame(f);
      }
    }
    requestAnimationFrame(tick);

    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { buildMap(); renderFrame(f); }, 250);
    });
  }

  init().catch(() => { /* flat chamber stays as fallback */ });
})();
