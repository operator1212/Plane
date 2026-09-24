// Paints albedo / bump / roughness maps for the upper and lower skins from the detail list.
(function (root) {
  const G = root.SERAC, D = root.SERAC_DETAILS;
  const X0 = -0.3, X1 = 20.8, Y0 = -7.6, Y1 = 7.6;

  // deterministic RNG so every render gets the same airframe
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function noiseCanvas(w, h, seed, lo, hi) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h), r = rng(seed);
    for (let i = 0; i < w * h; i++) { const v = lo + (hi - lo) * r(); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); return c;
  }

  function paint(which, mode, S) {
    const W = Math.round((X1 - X0) * S), H = Math.round((Y1 - Y0) * S);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const P = (p) => [(p[0] - X0) * S, (p[1] - Y0) * S];
    const path = (pts, close) => { g.beginPath(); pts.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); if (close) g.closePath(); };
    const items = which === 'upper' ? D.upper() : D.lower();
    const r = rng(which === 'upper' ? 91 : 17);
    const px = S / 194;   // line widths were tuned at 194 px/m

    // --- base ---
    const base = { albedo: which === 'upper' ? [88, 94, 101] : [92, 98, 105], bump: [128, 128, 128], rough: [120, 120, 120] }[mode];
    g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, W, H);
    if (mode !== 'bump') {
      // low-frequency mottling (paint lots, touch-ups, weathering)
      g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = mode === 'albedo' ? 0.5 : 0.6;
      g.drawImage(noiseCanvas(28, 20, which === 'upper' ? 3 : 4, 104, 152), 0, 0, W, H);
      g.globalAlpha = mode === 'albedo' ? 0.35 : 0.4;
      g.drawImage(noiseCanvas(140, 100, which === 'upper' ? 5 : 6, 112, 144), 0, 0, W, H);
      g.globalAlpha = mode === 'albedo' ? 0.5 : 0.4;
      g.imageSmoothingEnabled = false;
      const fine = noiseCanvas(512, 512, 9, 116, 140);
      for (let x = 0; x < W; x += 512) for (let y = 0; y < H; y += 512) g.drawImage(fine, x, y);
      g.restore();
      // aft weathering gradient: engine-bay heat and handling towards the tail
      const gr = g.createLinearGradient(P([9, 0])[0], 0, P([20.5, 0])[0], 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, mode === 'albedo' ? 'rgba(25,24,22,0.10)' : 'rgba(255,255,255,0.06)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }

    const toneFill = (tone, k) => {
      if (mode === 'albedo') return tone < 0 ? `rgba(18,21,25,${Math.min(1, -tone * (k || 2.2))})` : `rgba(215,222,230,${Math.min(1, tone * (k || 1.6))})`;
      return null;
    };
    const roughFill = (dr) => dr < 0 ? `rgba(0,0,0,${Math.min(1, -dr * 2.6)})` : `rgba(255,255,255,${Math.min(1, dr * 2.6)})`;

    // --- fills ---
    for (const it of items) {
      if (it.kind === 'band' || (it.kind === 'panel' && it.tone)) {
        path(it.pts, true);
        if (mode === 'albedo') { g.fillStyle = toneFill(it.tone || 0); g.fill(); }
        if (mode === 'rough' && it.rough) { g.fillStyle = roughFill(it.rough); g.fill(); }
        if (mode === 'bump' && it.kind === 'band') { g.fillStyle = 'rgba(255,255,255,0.04)'; g.fill(); }
      } else if (it.kind === 'stain' && mode !== 'bump') {
        const a = P(it.pts[0]), b = P(it.pts[it.pts.length - 1]);
        const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
        if (mode === 'albedo') { gr.addColorStop(0, `rgba(22,20,17,${-it.tone * 4})`); gr.addColorStop(1, 'rgba(22,20,17,0)'); }
        else { gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
        path(it.pts, true); g.fillStyle = gr; g.fill();
      } else if (it.kind === 'scuff' && mode !== 'bump') {
        path(it.pts, true);
        g.fillStyle = mode === 'albedo' ? 'rgba(190,196,204,0.025)' : 'rgba(0,0,0,0.12)'; g.fill();
        // boot scuffs
        for (let k = 0; k < 90; k++) {
          const t = r(), s2 = r();
          const p0 = it.pts[0], p1 = it.pts[1], p3 = it.pts[3];
          const x = p0[0] + (p1[0] - p0[0]) * t + (p3[0] - p0[0]) * s2, y = p0[1] + (p3[1] - p0[1]) * s2;
          const q = P([x, y]);
          g.fillStyle = mode === 'albedo' ? `rgba(200,205,212,${0.004 + r() * 0.008})` : `rgba(0,0,0,${0.04 + r() * 0.06})`;
          g.beginPath(); g.ellipse(q[0], q[1], (0.05 + r() * 0.07) * S, (0.02 + r() * 0.03) * S, r() * 3, 0, 7); g.fill();
        }
      } else if (it.kind === 'tiles') {
        const sz = it.size, x0 = it.x0;
        for (let yy = it.y0, row = 0; yy < it.y1 - 0.02; yy += sz * 0.78, row++) {
          for (let xx = x0; xx < 20.6; xx += sz) {
            const xa = Math.max(xx, x0), xb = xx + sz, ya = yy, yb = Math.min(yy + sz * 0.78, it.y1);
            if (xb <= xa) continue;
            const q0 = P([xa, ya]), q1 = P([xb, yb]);
            const d = (xa - x0) / 3.0; // 0 at nozzle
            if (mode === 'albedo') {
              // ceramic grey with heat tint: straw near the exit, blue-violet mid, sooted aft
              const heat = Math.exp(-d * 2.2), mid = Math.exp(-Math.pow((d - 0.45) / 0.25, 2));
              const k0 = 7 * r(); let R = 98 - k0, Gc = 98 - k0, B = 98 - k0;
              R += heat * 12; Gc += heat * 7; B -= heat * 3;
              R -= mid * 9; Gc -= mid * 6; B += mid * 7;
              const soot = Math.min(1, Math.max(0, d - 0.35) * 0.9) * (0.3 + 0.4 * r());
              R *= 1 - soot * 0.55; Gc *= 1 - soot * 0.55; B *= 1 - soot * 0.55;
              g.fillStyle = `rgb(${R | 0},${Gc | 0},${B | 0})`;
            } else if (mode === 'rough') { const v = (175 + r() * 30) | 0; g.fillStyle = `rgb(${v},${v},${v})`; }
            else g.fillStyle = `rgb(${(132 + r() * 8) | 0},${(132) | 0},${132})`;
            g.fillRect(q0[0], q0[1], q1[0] - q0[0], q1[1] - q0[1]);
            g.strokeStyle = mode === 'albedo' ? 'rgba(30,28,26,0.8)' : mode === 'bump' ? 'rgb(60,60,60)' : 'rgb(220,220,220)';
            g.lineWidth = 1.2 * px; g.strokeRect(q0[0], q0[1], q1[0] - q0[0], q1[1] - q0[1]);
          }
        }
      } else if (it.kind === 'flat') {
        path(it.pts, true);
        g.fillStyle = mode === 'albedo' ? 'rgb(22,24,27)' : mode === 'bump' ? 'rgb(128,128,128)' : 'rgb(235,235,235)'; g.fill();
      } else if (it.kind === 'window') {
        path(it.pts, true);
        g.fillStyle = mode === 'albedo' ? (it.tint === 'red' ? 'rgb(58,22,20)' : 'rgb(14,16,18)') : mode === 'rough' ? 'rgb(18,18,18)' : 'rgb(118,118,118)';
        g.fill();
        g.lineWidth = 1.4 * px; g.strokeStyle = mode === 'albedo' ? 'rgba(10,10,12,0.9)' : mode === 'bump' ? 'rgb(70,70,70)' : 'rgb(120,120,120)'; g.stroke();
        if (it.facets && mode === 'albedo') { g.strokeStyle = 'rgba(120,130,140,0.35)'; g.lineWidth = 1 * px; it.facets.forEach(f => { path(f); g.stroke(); }); }
      } else if (it.kind === 'light') {
        const a = P(it.pts[0]), b = P(it.pts[1]);
        g.lineCap = 'butt'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
        g.lineWidth = it.w * S;
        g.strokeStyle = mode === 'albedo' ? 'rgb(150,160,128)' : mode === 'rough' ? 'rgb(70,70,70)' : 'rgb(136,136,136)';
        g.stroke();
      } else if (it.kind === 'grille') {
        path(it.pts, true);
        g.fillStyle = mode === 'albedo' ? 'rgb(40,43,47)' : mode === 'bump' ? 'rgb(96,96,96)' : 'rgb(170,170,170)'; g.fill();
        const [a, b, cc, d] = it.pts;
        g.strokeStyle = mode === 'albedo' ? 'rgba(110,116,124,0.9)' : mode === 'bump' ? 'rgb(150,150,150)' : 'rgb(120,120,120)';
        g.lineWidth = 1.3 * px;
        for (let k = 1; k < it.n; k++) {
          const t = k / it.n;
          const p = [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t], q = [b[0] + (cc[0] - b[0]) * t, b[1] + (cc[1] - b[1]) * t];
          path([p, q]); g.stroke();
        }
      }
    }

    // --- grooves ---
    for (const it of items) {
      if (it.kind === 'panel' || it.kind === 'seam') {
        path(it.pts, it.kind === 'panel');
        const w = (it.w || 1.25) * (it.gap ? 1.7 : 1) * px;
        g.lineJoin = 'miter'; g.lineWidth = w;
        if (mode === 'albedo') g.strokeStyle = it.gap ? 'rgba(12,14,17,0.9)' : 'rgba(24,27,31,0.72)';
        else if (mode === 'bump') g.strokeStyle = it.gap ? 'rgb(20,20,20)' : 'rgb(55,55,55)';
        else g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.stroke();
        if (mode === 'albedo') { // faint lit lip beside every groove
          g.save(); g.translate(0.9 * px, 0.9 * px); g.lineWidth = 0.8 * px; g.strokeStyle = 'rgba(200,208,216,0.07)'; g.stroke(); g.restore();
        }
      } else if (it.kind === 'dash') {
        path(it.pts); g.setLineDash([0.12 * S, 0.08 * S]); g.lineWidth = 1.6 * px;
        g.strokeStyle = mode === 'albedo' ? 'rgba(150,158,166,0.35)' : mode === 'bump' ? 'rgba(128,128,128,0)' : 'rgba(0,0,0,0.1)';
        g.stroke(); g.setLineDash([]);
      } else if (it.kind === 'rivets') {
        const pts = it.pts; let carry = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let d = carry; d < L; d += it.spacing) {
            const t = d / L, q = P([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            const rr = 1.05 * px;
            if (mode === 'albedo') { g.fillStyle = r() < 0.08 ? 'rgba(160,168,176,0.28)' : 'rgba(30,33,37,0.32)'; }
            else if (mode === 'bump') g.fillStyle = 'rgb(104,104,104)';
            else g.fillStyle = 'rgba(0,0,0,0.25)';
            g.beginPath(); g.arc(q[0], q[1], rr, 0, 7); g.fill();
            carry = d + it.spacing - L;
          }
          if (carry < 0) carry = 0;
        }
      } else if (it.kind === 'port') {
        const q = P([it.x, it.y]);
        g.beginPath(); g.arc(q[0], q[1], it.r * S, 0, 7);
        g.fillStyle = mode === 'albedo' ? 'rgb(34,36,40)' : mode === 'bump' ? 'rgb(70,70,70)' : 'rgb(90,90,90)'; g.fill();
        g.lineWidth = 1 * px; g.strokeStyle = mode === 'albedo' ? 'rgba(160,168,176,0.3)' : 'rgba(128,128,128,0.2)'; g.stroke();
      } else if (it.kind === 'text' && mode === 'albedo') {
        const q = P([it.x, it.y]);
        g.save(); g.translate(q[0], q[1]);
        if (which === 'upper') g.scale(1, -1);
        g.font = `600 ${it.s * S}px "Archivo", "Arial Narrow", Arial, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const tone = it.tone == null ? 0.07 : it.tone;
        g.fillStyle = tone < 0 ? `rgba(20,23,27,${-tone * 3})` : `rgba(200,206,214,${tone * 2.2})`;
        g.fillText(it.str, 0, 0); g.restore();
      }
    }
    if (mode === 'bump') { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const g2 = c2.getContext('2d'); g2.filter = `blur(${0.7 * px}px)`; g2.drawImage(c, 0, 0); return c2; }
    return c;
  }

  root.SERAC_TEX = { paint, X0, X1, Y0, Y1 };
})(window);
