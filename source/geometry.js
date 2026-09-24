// NF-9 SERAC — parametric outer mould line.
// Aircraft axes: x aft from nose tip (m), y to starboard (m), z up (m).
// Shared by the WebGL renderer (browser global SERAC) and the SVG drawing generator (Node).
(function (root) {
  const D2R = Math.PI / 180;
  const TAN50 = Math.tan(50 * D2R);

  // ---- planform ------------------------------------------------------------
  const XJ = 6.6, YJ = 1.42;            // chine / leading-edge junction
  const YTIP = 7.4, YH = 5.7;           // wingtip, ATP hinge (streamwise)
  const TIPCHORD = 1.5;
  const XTIPLE = XJ + (YTIP - YJ) * TAN50;
  const XTIPTE = XTIPLE + TIPCHORD;
  const Y_N1 = 3.5, X_N1 = XTIPTE + (YTIP - Y_N1) * TAN50;
  const Y_N2 = 2.0, X_N2 = X_N1 - (Y_N1 - Y_N2) * TAN50;
  const X_TAIL = X_N2 + Y_N2 * TAN50;
  const CHINE_EXP = 0.66;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function smax(a, b, k) {
    k = Math.min(k, Math.max(a, b, 1e-6));
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.max(a, b) + h * h * k * 0.25;
  }

  // monotone cubic interpolation, clamped at the ends
  function mono(points) {
    const n = points.length, xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  const chineW = x => YJ * Math.pow(clamp(x, 0, XJ) / XJ, CHINE_EXP);
  function xLE(y) {
    y = Math.abs(y);
    if (y <= YJ) return XJ * Math.pow(y / YJ, 1 / CHINE_EXP);
    return XJ + (y - YJ) * TAN50;
  }
  function xTE(y) {
    y = Math.abs(y);
    if (y <= Y_N2) return X_TAIL - y * TAN50;
    if (y <= Y_N1) return X_N2 + (y - Y_N2) * TAN50;
    return X_N1 - (y - Y_N1) * TAN50;
  }
  // half-width of the planform at station x (outermost), for silhouettes
  function planHalfWidth(x) {
    let best = 0;
    for (let y = 0; y <= YTIP; y += 0.01) if (x >= xLE(y) && x <= xTE(y)) best = y;
    return best;
  }

  function outline(step) {
    step = step || 0.05;
    const pts = [];
    for (let x = 0; x < XJ; x += step * 0.5) pts.push([x, chineW(x)]);
    pts.push([XJ, YJ], [XTIPLE, YTIP], [XTIPTE, YTIP], [X_N1, Y_N1], [X_N2, Y_N2], [X_TAIL, 0]);
    const full = pts.slice();
    for (let i = pts.length - 2; i >= 1; i--) full.push([pts[i][0], -pts[i][1]]);
    return { half: pts, full };
  }

  // ---- body stack ---------------------------------------------------------
  const Ht = mono([[0, 0], [0.6, 0.15], [1.5, 0.29], [2.5, 0.4], [3.3, 0.47], [4.5, 0.54], [6, 0.6], [7.5, 0.68], [9, 0.72], [11, 0.7], [13, 0.63], [15, 0.52], [17, 0.4], [19, 0.22], [20.5, 0.03]]);
  const Hb = mono([[0, 0], [0.6, 0.12], [1.5, 0.26], [2.5, 0.38], [3.5, 0.48], [5, 0.58], [6.5, 0.64], [8, 0.7], [10, 0.72], [14, 0.7], [16, 0.6], [18, 0.4], [19.5, 0.18], [20.5, 0.03]]);
  const Baft = mono([[XJ, YJ], [7.6, 1.62], [9.2, 1.9], [15, 1.95], [17.5, 1.8], [20.5, 1.4]]);
  const Bw = x => (x <= XJ ? Math.max(chineW(x), 1e-4) : Baft(x));
  const humpA = mono([[6, 0], [8.4, 0], [10.5, 0.63], [15.5, 0.64], [17.2, 0.52], [19, 0.3]]);
  const nacD = mono([[6, 0.92], [12, 0.92], [15, 0.8], [17, 0.6], [19, 0.3], [20.5, 0.05]]);

  const ENG_Y = 1.05;
  const X_NOZ = 17.0;
  const xIn = y => 7.0 + (clamp(y, 0.45, 1.9) - 0.45) * 0.42;   // raked inlet face

  function hump(x, y) {
    const s = Math.abs(y - ENG_Y) / 0.8;
    if (s >= 1) return 0;
    const b = Math.cos(s * Math.PI / 2);
    return humpA(x) * b * b;
  }
  function nacelleLat(y) { return sstep(0.24, 0.5, y) * (1 - sstep(1.62, 1.98, y)); }
  function nacelle(x, y) {
    const s = nacelleLat(y);
    if (s <= 0) return 0;
    const xi = xIn(y);
    return nacD(x) * sstep(xi, xi + 0.12, x) * s;
  }
  function airfoil(u) {
    if (u <= 0 || u >= 1) return 0;
    return Math.pow(u, 0.6) * Math.pow(1 - u, 1.1) / 0.4337;
  }
  function camber(x, y) {
    const n = Math.max(0, 1 - x / 5.5);
    return -0.12 * n * n - Math.max(0, Math.abs(y) - 2.2) * Math.tan(1.5 * D2R);
  }
  const troughLat = y => sstep(0.42, 0.54, y) * (1 - sstep(1.56, 1.68, y));

  // canopy (transparency ends at the aft frame, fairing continues)
  const canA = mono([[3.05, 0], [3.5, 0.24], [4.2, 0.41], [5.0, 0.47], [5.9, 0.46], [6.35, 0.43], [7.0, 0.33], [7.7, 0.12], [8.0, 0]]);
  const canH = mono([[3.05, 0], [3.5, 0.2], [4.2, 0.46], [4.9, 0.6], [5.6, 0.6], [6.35, 0.5], [7.0, 0.3], [7.7, 0.08], [8.0, 0]]);
  const CAN_X0 = 3.05, CAN_X1 = 8.0, CAN_FRAME = 6.35;

  // returns upper & lower surface z plus shading hints at (x, y)
  function surf(x, y) {
    const ay = Math.abs(y);
    const xl = xLE(ay), xt = xTE(ay), c = Math.max(xt - xl, 1e-6), u = (x - xl) / c;
    const dLE = x - xl, dTE = xt - x;
    const eLE = sstep(0, 0.35, dLE), eTE = Math.pow(sstep(0, 1.1, dTE), 0.9);
    const B = Bw(x), t = Math.min(ay / B, 1);
    const pt = lerp(1.45, 2.6, sstep(5, 10, x)), pb = lerp(2.2, 3.4, sstep(5, 10, x));
    let bu = Ht(x) * (1 - Math.pow(t, pt));
    let bl = Hb(x) * (1 - Math.pow(t, pb));
    bu = smax(bu, hump(x, ay), 0.15);
    bl = smax(bl, nacelle(x, ay), 0.06);
    const tc = lerp(0, 0.046, sstep(0.9, 2.2, ay)) * lerp(1, 0.72, sstep(2.2, YTIP, ay));
    const w = 0.5 * tc * c * airfoil(u) * (1 - 0.8 * sstep(YTIP - 0.12, YTIP, ay));
    const edge = eLE * eTE;
    let Tu = smax(bu * edge, w, 0.12);
    let Tl = smax(bl * edge, w * 0.85, 0.1);
    // shielded exhaust trough
    const tl = troughLat(ay);
    const tx = sstep(X_NOZ - 0.02, X_NOZ + 0.05, x);
    const tr = tl * tx;
    const floor = (0.05 + 0.03 * sstep(X_NOZ, 19, x)) * eTE;
    Tu = lerp(Tu, Math.min(Tu, floor), tr);
    const zc = camber(x, ay);
    // shading hints: dark apertures
    const nozDark = tl * Math.exp(-Math.pow((x - (X_NOZ + 0.015)) / 0.06, 2));
    const xi = xIn(ay);
    const inDark = (nacelleLat(ay) > 0.2 && x > xi - 0.03 && x < xi + 0.16) ? sstep(0.2, 0.5, nacelleLat(ay)) : 0;
    return { zu: zc + Tu, zl: zc - Tl, zc, nozDark, inDark, trough: tr };
  }

  const api = {
    D2R, TAN50, XJ, YJ, YTIP, YH, TIPCHORD, XTIPLE, XTIPTE, Y_N1, X_N1, Y_N2, X_N2, X_TAIL, ENG_Y, X_NOZ,
    clamp, lerp, sstep, smax, mono, chineW, xLE, xTE, xIn, planHalfWidth, outline, surf, camber,
    canA, canH, CAN_X0, CAN_X1, CAN_FRAME, Ht, Hb, nacelleLat, troughLat,
    LENGTH: X_TAIL, SPAN: 2 * YTIP,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SERAC = api;
})(typeof window !== 'undefined' ? window : globalThis);
