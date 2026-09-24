// NF-9 SERAC — surface detail definition (panel lines, doors, apertures, markings).
// Every item is in aircraft planform coordinates (x aft, y starboard, metres).
// kinds: panel (closed groove), seam (open groove), rivets (fastener row), band (tone patch),
//        window (glossy aperture), light (formation strip), text, grille, tiles, stain, port
(function (root) {
  const G = (typeof module !== 'undefined' && module.exports) ? require('./geometry.js') : root.SERAC;
  const T = G.TAN50;

  const mir = pts => pts.map(p => [p[0], -p[1]]);
  const both = (item) => {
    const m = Object.assign({}, item, { mirrored: true });
    if (item.pts) m.pts = mir(item.pts);
    if ('y' in item) m.y = -item.y;
    if ('y0' in item) { m.y0 = -item.y1; m.y1 = -item.y0; }
    return [item, m];
  };
  const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

  function offsetPolyline(pts, d) {
    // offset by d to the left of travel direction
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      return [p[0] - dy / L * d, p[1] + dx / L * d];
    });
  }
  const insetPoly = (pts, d) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.map(p => { const dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1; return [p[0] - dx / L * d, p[1] - dy / L * d]; });
  };
  // aligned diamond centred at (cx, cy)
  const diamond = (cx, cy, a) => [[cx - a, cy], [cx, cy + a / T], [cx + a, cy], [cx, cy - a / T]];
  // chevron door straddling the centreline, edges on the 50-degree family
  const chevron = (x0, x1, hw) => [[x0, 0], [x0 + hw * T, hw], [x1 + hw * T, hw], [x1, 0], [x1 + hw * T, -hw], [x0 + hw * T, -hw]];
  // aligned parallelogram between spans y0..y1, forward edge starting at xf
  const para = (xf, xr, y0, y1, dir) => {
    const s = (dir || 1) * T;
    return [[xf, y0], [xf + (y1 - y0) * s, y1], [xr + (y1 - y0) * s, y1], [xr, y0]];
  };
  // sawtooth line across span from ya..yb near station x, tooth half-width h
  function sawtooth(x, ya, yb, h, fn) {
    const pts = []; let up = true;
    for (let y = ya; y <= yb + 1e-9; y += h) { pts.push([(fn ? fn(y) : x) + (up ? 0 : h * T), y]); up = !up; }
    return pts;
  }
  function rivetsAlong(pts, spacing, inset) {
    const path = inset ? offsetPolyline(pts, inset) : pts;
    return { kind: 'rivets', pts: path, spacing: spacing || 0.045 };
  }

  const leLine = (y0, y1, n) => range(y0, y1, n).map(y => [G.xLE(y), y]);
  const teLine = (y0, y1, n) => range(y0, y1, n).map(y => [G.xTE(y), y]);

  function common() {
    const items = [];
    // leading-edge treatment band (chine + wing), starboard side travelling outboard
    const le = [];
    for (let x = 0.25; x < G.XJ; x += 0.1) le.push([x, G.chineW(x)]);
    le.push(...leLine(G.YJ, G.YTIP - 0.02, 40));
    const leIn = offsetPolyline(le, -0.2);
    items.push(...both({ kind: 'band', tone: -0.07, rough: -0.1, pts: le.concat(leIn.slice().reverse()) }));
    items.push(...both({ kind: 'seam', pts: leIn, w: 0.9 }));
    // trailing-edge bands on the outer wing
    const te = teLine(G.Y_N1, G.YTIP, 20);
    items.push(...both({ kind: 'band', tone: -0.05, rough: -0.08, pts: te.concat(te.map(p => [p[0] - 0.12, p[1]]).reverse()) }));
    // radome joint: sawtooth
    const rad = sawtooth(2.62, -G.chineW(2.75) + 0.02, G.chineW(2.75) - 0.02, 0.12);
    items.push({ kind: 'seam', pts: rad, w: 1.1 }, rivetsAlong(rad.map(p => [p[0] + 0.05, p[1]]), 0.05));
    // outer elevons (two per side), inner elevon, ATP hinge & split rudder
    const elev = (ya, yb, chord) => [[G.xTE(ya), ya], [G.xTE(yb), yb], [G.xTE(yb) - chord, yb], [G.xTE(ya) - chord, ya]];
    items.push(...both({ kind: 'panel', pts: elev(3.72, 4.58, 1.05), gap: true }));
    items.push(...both({ kind: 'panel', pts: elev(4.66, 5.6, 1.05), gap: true }));
    items.push(...both({ kind: 'panel', pts: elev(2.14, 3.36, 0.92), gap: true }));
    items.push(...both({ kind: 'panel', pts: elev(5.86, 7.22, 0.72), gap: true }));
    items.push(...both({ kind: 'seam', pts: [[G.xLE(G.YH) + 0.02, G.YH], [G.xTE(G.YH) - 0.02, G.YH]], w: 1.6 }));
    // rear spar / front spar fastener lines
    items.push(...both(rivetsAlong(range(2.3, 5.6, 30).map(y => [G.xLE(y) + 1.55, y]), 0.06)));
    items.push(...both(rivetsAlong(range(3.72, 5.6, 16).map(y => [G.xTE(y) - 1.2, y]), 0.06)));
    items.push(...both(rivetsAlong(range(5.8, 7.25, 14).map(y => [G.xLE(y) + 0.9, y]), 0.06)));
    // ATP root rib fastener rows either side of hinge
    items.push(...both(rivetsAlong([[G.xLE(5.64) + 0.25, 5.64], [G.xTE(5.64) - 0.25, 5.64]], 0.05)));
    items.push(...both(rivetsAlong([[G.xLE(5.76) + 0.25, 5.76], [G.xTE(5.76) - 0.25, 5.76]], 0.05)));
    return items;
  }

  function upper() {
    const it = common();
    // canopy sill and seal
    const sill = [];
    for (let x = G.CAN_X0; x <= G.CAN_X1; x += 0.05) sill.push([x, G.canA(x) + 0.03]);
    const sillFull = sill.concat(mir(sill).reverse());
    it.push({ kind: 'panel', pts: sillFull, w: 1.8 });
    const seal = sill.map(p => [p[0], p[1] + 0.07]);
    it.push({ kind: 'band', tone: -0.09, rough: 0.05, pts: sill.concat(seal.slice().reverse()) });
    it.push({ kind: 'band', tone: -0.09, rough: 0.05, pts: mir(sill).concat(mir(seal).reverse()) });
    it.push({ kind: 'seam', pts: seal.concat(mir(seal).reverse()), w: 0.9 });
    // flush air-data ports, forward DAS windows
    [[1.25, 0.22], [1.6, 0.3], [2.05, 0.36]].forEach(([x, y]) => { it.push({ kind: 'port', x, y, r: 0.018 }, { kind: 'port', x, y: -y, r: 0.018 }); });
    it.push(...both({ kind: 'window', pts: [[3.34, 0.74], [3.42, 0.86], [3.6, 0.86], [3.64, 0.76], [3.52, 0.7]] }));
    // forebody formation strip on the upper flank
    it.push(...both({ kind: 'light', pts: [[5.25, G.chineW(5.25) - 0.13], [6.2, G.chineW(6.2) - 0.13]], w: 0.045 }));
    // refuelling receptacle, slipway markings
    const rec = chevron(8.12, 8.74, 0.26);
    it.push({ kind: 'panel', pts: rec, w: 1.6 }, { kind: 'seam', pts: [[8.12, 0], [8.74, 0]], w: 0.8 });
    it.push(rivetsAlong(insetPoly(rec, -0.05).concat([insetPoly(rec, -0.05)[0]]), 0.045));
    it.push({ kind: 'band', tone: 0.1, rough: 0, pts: [[7.35, 0.3], [8.3, 0.3], [8.3, 0.33], [7.35, 0.33]] });
    it.push({ kind: 'band', tone: 0.1, rough: 0, pts: [[7.35, -0.3], [8.3, -0.3], [8.3, -0.33], [7.35, -0.33]] });
    it.push({ kind: 'text', x: 9.25, y: 0, s: 0.07, rot: 0, str: 'AAR', tone: 0.08 });
    // aft DAS window on the spine
    it.push({ kind: 'window', pts: [[9.55, 0], [9.66, 0.07], [9.82, 0.07], [9.9, 0], [9.82, -0.07], [9.66, -0.07]] });
    // spine chevrons
    [[10.2, 10.95], [11.05, 11.95], [12.05, 13.05], [13.15, 14.1], [14.2, 15.05]].forEach(([a, b], i) => {
      const p = chevron(a, b, 0.34);
      it.push({ kind: 'panel', pts: p, tone: (i % 2 ? 0.012 : -0.01) });
      it.push(rivetsAlong(insetPoly(p, 0.035).concat([insetPoly(p, 0.035)[0]]), 0.05));
    });
    // conformal SATCOM patch
    it.push({ kind: 'band', tone: 0.035, rough: 0.08, pts: [[12.2, 0.12], [12.95, 0.12], [12.95, -0.12], [12.2, -0.12]] });
    // engine bay upper doors (two per side)
    const eb1 = [[10.25, 0.46], [10.25 + 1.2 * T, 1.66], [12.95 + 1.2 * T, 1.66], [12.95, 0.46]];
    const eb2 = [[13.05, 0.46], [13.05 + 1.2 * T, 1.66], [16.55 - 1.2 * T, 1.66], [16.55, 0.46]];
    [eb1, eb2].forEach((p, i) => {
      it.push(...both({ kind: 'panel', pts: p, tone: i ? 0.015 : -0.012 }));
      it.push(...both(rivetsAlong(insetPoly(p, 0.04).concat([insetPoly(p, 0.04)[0]]), 0.05)));
    });
    // auxiliary intake doors (blow-in), outboard of the hump
    it.push(...both({ kind: 'panel', pts: para(8.55, 9.25, 1.62, 1.86, 1), w: 1.4 }));
    it.push(...both({ kind: 'grille', pts: para(8.62, 9.18, 1.65, 1.83, 1), n: 6 }));
    // heat-exchanger exhaust vents
    it.push(...both({ kind: 'panel', pts: para(15.35, 16.0, 1.78, 2.28, -1), w: 1.4 }));
    it.push(...both({ kind: 'grille', pts: para(15.4, 15.95, 1.82, 2.24, -1), n: 9 }));
    it.push(...both({ kind: 'stain', pts: [[16.0, 1.84], [16.0, 2.2], [17.6, 2.14], [17.6, 1.98]], tone: -0.035 }));
    // nozzle upper flap: sawtooth trailing edge + tile field in trough
    const flap = sawtooth(16.72, 0.44, 1.66, 0.1);
    it.push(...both({ kind: 'seam', pts: flap, w: 1.3 }));
    it.push(...both({ kind: 'seam', pts: [[15.9, 0.44], [15.9, 1.66]], w: 1.1 }));
    it.push(...both(rivetsAlong([[15.96, 0.46], [15.96, 1.64]], 0.045)));
    it.push(...both({ kind: 'flat', pts: [[G.X_NOZ - 0.07, 0.4], [G.X_NOZ + 0.07, 0.4], [G.X_NOZ + 0.07, 1.7], [G.X_NOZ - 0.07, 1.7]] }));
    it.push(...both({ kind: 'tiles', x0: G.X_NOZ + 0.06, y0: 0.5, y1: 1.6, size: 0.19 }));
    // wing: fuel access diamonds
    [[11.3, 2.85, 0.3], [12.55, 3.95, 0.26], [13.55, 4.85, 0.22], [14.65, 3.05, 0.26], [10.3, 2.35, 0.22], [15.3, 5.9, 0.2]].forEach(([x, y, a]) => {
      const d = diamond(x, y, a);
      it.push(...both({ kind: 'panel', pts: d, tone: 0.012 }));
      it.push(...both(rivetsAlong(insetPoly(d, 0.03).concat([insetPoly(d, 0.03)[0]]), 0.045)));
    });
    // walkway outline and stencils
    it.push(...both({ kind: 'dash', pts: [[7.9, 1.72], [9.9, 1.72], [10.6, 2.45], [8.5, 2.45], [7.9, 1.72]] }));
    it.push(...both({ kind: 'scuff', pts: [[8.1, 1.78], [9.8, 1.78], [10.4, 2.4], [8.6, 2.4]] }));
    it.push({ kind: 'text', x: 13.2, y: 5.25, s: 0.1, rot: 0, str: 'NO STEP' }, { kind: 'text', x: 13.2, y: -5.25, s: 0.1, rot: 0, str: 'NO STEP' });
    it.push({ kind: 'text', x: 15.6, y: 6.55, s: 0.22, rot: 0, str: 'NF 903', tone: -0.06 });
    it.push({ kind: 'text', x: 15.6, y: -6.55, s: 0.22, rot: 0, str: 'NF 903', tone: -0.06 });
    it.push({ kind: 'text', x: 6.95, y: 0.72, s: 0.06, rot: 0, str: 'RESCUE ▸', tone: 0.06 });
    // ATP formation strip + tip datalink patch
    it.push(...both({ kind: 'light', pts: [[G.xLE(6.35) + 1.2, 6.35], [G.xLE(6.35) + 1.2 + 0.9 * T, 6.35 + 0.9]], w: 0.05 }));
    it.push(...both({ kind: 'band', tone: 0.03, rough: 0.07, pts: para(G.xLE(7.0) + 0.35, G.xLE(7.0) + 0.95, 7.0, 7.3, 1) }));
    // ATP actuator fairing panel
    it.push(...both({ kind: 'panel', pts: para(G.xLE(5.45) + 1.5, G.xLE(5.45) + 3.6, 5.45, 5.66, 1), tone: -0.01 }));
    return it;
  }

  function lower() {
    const it = common();
    // chin EO window, faceted
    const eo = [[1.92, 0], [2.06, 0.16], [2.5, 0.16], [2.64, 0], [2.5, -0.16], [2.06, -0.16]];
    it.push({ kind: 'window', pts: eo, facets: [[[2.06, 0.16], [2.2, 0], [2.06, -0.16]], [[2.2, 0], [2.5, 0]], [[2.5, 0.16], [2.36, 0], [2.5, -0.16]]] });
    it.push({ kind: 'panel', pts: insetPoly(eo, -0.06), w: 1.3 });
    [[1.25, 0.2], [1.55, 0.28]].forEach(([x, y]) => { it.push({ kind: 'port', x, y, r: 0.02 }, { kind: 'port', x, y: -y, r: 0.02 }); });
    // lower DAS windows
    it.push(...both({ kind: 'window', pts: [[4.9, 0.95], [5.0, 1.06], [5.18, 1.06], [5.22, 0.96], [5.1, 0.9]] }));
    // side-looking chine arrays (dielectric panels just under the chine)
    const ca = [], cb = [];
    for (let x = 3.4; x <= 6.3; x += 0.1) { ca.push([x, G.chineW(x) - 0.07]); cb.push([x, G.chineW(x) - 0.36]); }
    const arr = ca.concat(cb.slice().reverse());
    it.push(...both({ kind: 'band', tone: 0.04, rough: 0.1, pts: arr }));
    it.push(...both({ kind: 'panel', pts: arr, w: 1.0 }));
    // nose gear doors
    const ng = chevron(3.62, 5.62, 0.3);
    it.push({ kind: 'panel', pts: ng }, { kind: 'seam', pts: [[3.62, 0], [5.62, 0]], w: 0.9 });
    it.push(rivetsAlong(insetPoly(ng, -0.05).concat([insetPoly(ng, -0.05)[0]]), 0.05));
    it.push({ kind: 'text', x: 6.35, y: 0, s: 0.06, rot: 0, str: 'JACK', tone: 0.06 });
    // inlet lip band (edge treatment behind the aperture)
    const lip = range(0.3, 1.95, 16).map(y => [G.xIn(y) + 0.14, y]);
    const lipB = lip.map(p => [p[0] + 0.2, p[1]]);
    it.push(...both({ kind: 'band', tone: -0.08, rough: -0.1, pts: lip.concat(lipB.slice().reverse()) }));
    it.push(...both({ kind: 'seam', pts: lipB, w: 1.0 }));
    it.push(...both({ kind: 'text', x: 8.1, y: 1.05, s: 0.06, rot: 0, str: 'DANGER · INTAKE', tone: 0.06 }));
    // inlet aperture face: flat, fully rough (kills bump streaks on the near-vertical face)
    const fa = range(0.2, 2.0, 18).map(y => [G.xIn(y) - 0.05, y]), fb = range(0.2, 2.0, 18).map(y => [G.xIn(y) + 0.17, y]).reverse();
    it.push(...both({ kind: 'flat', pts: fa.concat(fb) }));
    // centreline bay doors
    const bay = chevron(8.6, 14.72, 0.4);
    it.push({ kind: 'panel', pts: bay, w: 1.7 }, { kind: 'seam', pts: [[8.6, 0], [14.72, 0]], w: 1.2 });
    it.push(rivetsAlong(insetPoly(bay, -0.05).concat([insetPoly(bay, -0.05)[0]]), 0.05));
    // main gear doors on nacelle bottoms
    const mg = para(10.3, 12.9, 0.6, 1.45, 1);
    it.push(...both({ kind: 'panel', pts: mg, w: 1.6 }));
    it.push(...both(rivetsAlong(insetPoly(mg, -0.05).concat([insetPoly(mg, -0.05)[0]]), 0.05)));
    // engine access doors
    const ea = para(13.9, 16.4, 0.55, 1.55, 1);
    it.push(...both({ kind: 'panel', pts: ea, tone: 0.014 }));
    it.push(...both(rivetsAlong(insetPoly(ea, 0.04).concat([insetPoly(ea, 0.04)[0]]), 0.045)));
    const ea2 = para(9.2, 10.0, 0.55, 1.55, 1);
    it.push(...both({ kind: 'panel', pts: ea2, tone: -0.012 }));
    // wing lower fuel panels
    [[11.8, 3.1, 0.3], [13.2, 4.3, 0.24], [14.2, 3.5, 0.2], [10.8, 2.5, 0.2]].forEach(([x, y, a]) => {
      const d = diamond(x, y, a);
      it.push(...both({ kind: 'panel', pts: d, tone: -0.01 }));
      it.push(...both(rivetsAlong(insetPoly(d, 0.03).concat([insetPoly(d, 0.03)[0]]), 0.045)));
    });
    // drains, flush ports and the fluid streaks they leave
    [[12.95, 1.25], [14.0, 0.7], [16.5, 1.2], [9.9, 1.4], [15.2, 2.3]].forEach(([x, y], i) => {
      it.push(...both({ kind: 'port', x, y, r: 0.014 }));
      it.push(...both({ kind: 'stain', pts: [[x, y - 0.02], [x, y + 0.02], [x + 1.4 + i * 0.3, y + 0.06], [x + 1.4 + i * 0.3, y - 0.05]], tone: -0.06 }));
    });
    // IFF / datalink patches, anti-collision light
    it.push({ kind: 'band', tone: 0.035, rough: 0.08, pts: [[15.3, 0.16], [15.9, 0.16], [15.9, -0.16], [15.3, -0.16]] });
    it.push(...both({ kind: 'band', tone: 0.03, rough: 0.08, pts: para(G.xLE(6.4) + 0.6, G.xLE(6.4) + 1.2, 6.4, 6.8, 1) }));
    it.push({ kind: 'window', pts: [[16.9, 0.06], [17.1, 0.06], [17.1, -0.06], [16.9, -0.06]], tint: 'red' });
    // aft-deck lower tone: exhaust soot under the tail
    it.push({ kind: 'stain', pts: [[17.5, -1.7], [17.5, 1.7], [20.3, 0.4], [20.3, -0.4]], tone: -0.05 });
    return it;
  }

  const api = { upper, lower, offsetPolyline, insetPoly, diamond, chevron, para };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SERAC_DETAILS = api;
})(typeof window !== 'undefined' ? window : globalThis);
