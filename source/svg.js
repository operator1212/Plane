// Generates the orthographic line drawings (in metres, themed through CSS classes) from the same geometry.
const G = require('./geometry.js'), D = require('./details.js');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || 'out/svg';
fs.mkdirSync(out, { recursive: true });

const f = v => (Math.round(v * 1000) / 1000).toString();
const pth = (pts, close) => pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('') + (close ? 'Z' : '');
const el = (tag, attrs, inner) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}${inner == null ? '/>' : `>${inner}</${tag}>`}`;
const P = (d, cls) => el('path', { d, class: cls });
const T = (x, y, s, cls, anchor) => el('text', { x: f(x), y: f(y), class: cls || 'lbl', 'text-anchor': anchor || 'middle' }, s);
const svg = (vb, body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}" role="img" aria-label="${label}">${body}</svg>`;

// dimension line with ticks and label, horizontal or vertical
function dimH(x0, x1, y, label, ext0, ext1) {
  let s = P(pth([[x0, y], [x1, y]]), 'dim');
  s += P(pth([[x0, y - 0.25], [x0, y + 0.25]]), 'dim') + P(pth([[x1, y - 0.25], [x1, y + 0.25]]), 'dim');
  if (ext0 != null) s += P(pth([[x0, ext0], [x0, y]]), 'ext');
  if (ext1 != null) s += P(pth([[x1, ext1], [x1, y]]), 'ext');
  return s + T((x0 + x1) / 2, y - 0.22, label, 'dimt');
}
function dimV(x, y0, y1, label, ext0, ext1) {
  let s = P(pth([[x, y0], [x, y1]]), 'dim');
  s += P(pth([[x - 0.25, y0], [x + 0.25, y0]]), 'dim') + P(pth([[x - 0.25, y1], [x + 0.25, y1]]), 'dim');
  if (ext0 != null) s += P(pth([[ext0, y0], [x, y0]]), 'ext');
  if (ext1 != null) s += P(pth([[ext1, y1], [x, y1]]), 'ext');
  return s + `<text x="${f(x + 0.35)}" y="${f((y0 + y1) / 2)}" class="dimt" text-anchor="middle" transform="rotate(90 ${f(x + 0.35)} ${f((y0 + y1) / 2)})">${label}</text>`;
}

// ---------------- plan view ----------------
function planView(opts = {}) {
  const o = G.outline(0.05).full;
  let b = P(pth(o, true), 'body') ;
  const items = D.upper();
  for (const it of items) {
    if (it.kind === 'panel') b += P(pth(it.pts, true), 'pl');
    else if (it.kind === 'seam') b += P(pth(it.pts, false), 'pl');
    else if (it.kind === 'window') b += P(pth(it.pts, true), 'win');
    else if (it.kind === 'grille') b += P(pth(it.pts, true), 'pl');
    else if (it.kind === 'light') b += P(pth(it.pts, false), 'lite');
  }
  // canopy glass
  const can = []; for (let x = G.CAN_X0; x <= G.CAN_FRAME; x += 0.05) can.push([x, G.canA(x)]);
  b += P(pth(can.concat(can.slice().reverse().map(p => [p[0], -p[1]])), true), 'glass');
  b += P(pth([[G.CAN_FRAME, -G.canA(G.CAN_FRAME)], [G.CAN_FRAME, G.canA(G.CAN_FRAME)]]), 'ol');
  // exhaust troughs & nozzle exits
  for (const s of [1, -1]) {
    const tr = [[G.X_NOZ, 0.48 * s], [G.xTE(0.48), 0.48 * s], [G.xTE(1.62), 1.62 * s], [G.X_NOZ, 1.62 * s]];
    b += P(pth(tr, true), 'trough');
    b += P(pth([[G.X_NOZ, 0.48 * s], [G.X_NOZ, 1.62 * s]]), 'ol');
  }
  if (opts.phantom !== false) {
    for (const s of [1, -1]) {
      // engines and serpentine ducts
      const eng = [[9.3, (1.05 - 0.52) * s], [16.9, (1.05 - 0.45) * s], [16.9, (1.05 + 0.45) * s], [9.3, (1.05 + 0.52) * s]];
      b += P(pth(eng, true), 'hid');
      const duct = [];
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const x = 7.2 + t * 2.1, yin = 1.18, yc = yin + (1.05 - yin) * (t * t * (3 - 2 * t));
        const hw = 0.72 + (0.52 - 0.72) * t;
        duct.push([x, (yc - hw) * s, (yc + hw) * s]);
      }
      b += P(pth(duct.map(d => [d[0], d[1]])), 'hid') + P(pth(duct.map(d => [d[0], d[2]])), 'hid');
    }
    b += P(pth([[8.6, 0.4], [15.2, 0.4], [15.2, -0.4], [8.6, -0.4]], true), 'hid');
    b += P(pth([[-0.6, 0], [21.2, 0]]), 'ctr');
  }
  b += P(pth(o, true), 'ol');
  return b;
}

// ---------------- silhouettes ----------------
function sideProfile() {
  const top = [], bot = [];
  for (let x = 0; x <= G.X_TAIL + 1e-9; x += 0.02) {
    let zt = -9, zb = 9;
    const hw = G.planHalfWidth(x);
    for (let y = 0; y <= hw; y += 0.02) {
      if (x < G.xLE(y) || x > G.xTE(y)) continue;
      const s = G.surf(x, y); zt = Math.max(zt, s.zu); zb = Math.min(zb, s.zl);
    }
    if (x >= G.CAN_X0 && x <= G.CAN_X1) zt = Math.max(zt, G.surf(x, 0).zu + G.canH(x));
    if (zt > -9) { top.push([x, zt]); bot.push([x, zb]); }
  }
  return { top, bot };
}
function frontProfile(droopDeg) {
  const top = [], bot = [];
  const yh = G.YH, zh = G.camber(15, yh), d = (droopDeg || 0) * G.D2R;
  for (let y = 0; y <= G.YTIP + 1e-9; y += 0.01) {
    let zt = -9, zb = 9;
    for (let x = G.xLE(y); x <= G.xTE(y); x += 0.04) { const s = G.surf(x, y); zt = Math.max(zt, s.zu); zb = Math.min(zb, s.zl); }
    if (y < 0.5) for (let x = G.CAN_X0; x <= G.CAN_X1; x += 0.02) {
      const a = G.canA(x); if (a < 1e-3 || y > a) continue;
      const n = 2.3, t = y / a;
      zt = Math.max(zt, G.surf(x, y).zu + G.canH(x) * Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n));
    }
    if (y > yh && d) {
      const rot = z => { const dy = y - yh, dz = z - zh; return [yh + dy * Math.cos(d) + dz * Math.sin(d), zh - dy * Math.sin(d) + dz * Math.cos(d)]; };
      top.push(rot(zt)); bot.push(rot(zb));
    } else { top.push([y, zt]); bot.push([y, zb]); }
  }
  return { top, bot };
}

// ---------------- side view ----------------
function sideView() {
  const { top, bot } = sideProfile();
  const Z = p => [p[0], -p[1]];
  const sil = top.map(Z).concat(bot.slice().reverse().map(Z));
  let b = P(pth(sil, true), 'body');
  // canopy glass region in profile
  const cg = []; for (let x = G.CAN_X0; x <= G.CAN_FRAME; x += 0.03) cg.push([x, -(G.surf(x, 0).zu + G.canH(x))]);
  const sill = []; for (let x = G.CAN_FRAME; x >= G.CAN_X0; x -= 0.03) sill.push([x, -(G.surf(x, G.canA(x) * 0.98).zu)]);
  b += P(pth(cg.concat(sill), true), 'glass');
  b += P(pth([[G.CAN_FRAME, -(G.surf(G.CAN_FRAME, 0).zu + G.canH(G.CAN_FRAME))], [G.CAN_FRAME, -G.surf(G.CAN_FRAME, 0.42).zu]]), 'ol');
  // chine line and wing leading-edge line (visible plane)
  const ch = []; for (let x = 0.1; x <= G.XJ; x += 0.05) ch.push([x, -G.camber(x, G.chineW(x))]);
  const wl = []; for (let y = G.YJ; y <= G.YTIP; y += 0.1) wl.push([G.xLE(y), -G.camber(G.xLE(y), y)]);
  b += P(pth(ch.concat(wl)), 'pl');
  // inlet aperture
  const ya = [0.5, 1.0, 1.5, 1.9];
  const inl = [[G.xIn(1.9), -G.surf(G.xIn(1.9) - 0.03, 1.9).zl], [G.xIn(1.9) + 0.12, -G.surf(G.xIn(1.9) + 0.2, 1.9).zl], [G.xIn(0.5) + 0.12, -G.surf(G.xIn(1.0) + 0.2, 1.0).zl]];
  b += P(pth([[G.xIn(0.6), -G.surf(G.xIn(0.6) - 0.03, 0.9).zl], [G.xIn(1.9), -G.surf(G.xIn(1.9) - 0.03, 1.9).zl + 0.02], [G.xIn(1.9) + 0.1, -G.surf(G.xIn(1.2) + 0.25, 1.2).zl], [G.xIn(0.6) + 0.1, -G.surf(G.xIn(1.2) + 0.25, 1.2).zl]], true), 'dark');
  // nacelle chine (outer lower edge) and nozzle exit
  const nl = []; for (let x = G.xIn(1.9) + 0.15; x <= 18.4; x += 0.1) nl.push([x, -(G.surf(x, 1.62).zl * 0.55 + G.surf(x, 1.62).zc * 0.45)]);
  b += P(pth(nl), 'pl');
  b += P(pth([[G.X_NOZ, -G.surf(G.X_NOZ - 0.1, 1.05).zu], [G.X_NOZ, -G.surf(G.X_NOZ + 0.2, 1.05).zu]]), 'ol');
  b += P(pth([[2.62, -G.surf(2.62, 0).zu], [2.75, -G.surf(2.75, 0).zl]]), 'pl');
  // gear doors (lower line segments)
  [[3.62, 5.62, 0.02], [10.3, 12.9, 1.0]].forEach(([a, c, y]) => { b += P(pth([[a, -G.surf(a, y).zl + 0.03], [c, -G.surf(c, y).zl + 0.03]]), 'pl'); });
  // ground line with gear phantom
  const gz = 2.25;
  b += P(pth([[-0.5, gz], [21, gz]]), 'ext');
  b += P(pth([[4.8, -G.surf(4.8, 0).zl], [4.95, gz - 0.33]]), 'hid') + `<circle cx="4.95" cy="${f(gz - 0.33)}" r="0.33" class="hid"/>`;
  b += P(pth([[11.6, -G.surf(11.6, 1.0).zl], [11.9, gz - 0.42]]), 'hid') + `<circle cx="11.9" cy="${f(gz - 0.42)}" r="0.42" class="hid"/>`;
  b += P(pth(sil, true), 'ol');
  return { b, top, bot, gz };
}

// ---------------- front view ----------------
function frontView(droop, withInlet) {
  const { top, bot } = frontProfile(droop);
  const half = top.map(p => [p[0], -p[1]]).concat(bot.slice().reverse().map(p => [p[0], -p[1]]));
  const full = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
  let b = P(pth(half, true), 'body') + P(pth(half.map(p => [-p[0], p[1]]), true), 'body');
  if (withInlet) {
    for (const s of [1, -1]) {
      const ap = [], lo = [];
      for (let y = 0.34; y <= 1.96; y += 0.04) {
        ap.push([y * s, -G.surf(G.xIn(y) - 0.04, y).zl]);
        lo.push([y * s, -G.surf(G.xIn(y) + 0.3, y).zl]);
      }
      b += P(pth(ap.concat(lo.reverse()), true), 'dark');
    }
    // canopy glass in front view
    const cg = []; for (let y = -0.46; y <= 0.46; y += 0.02) {
      let zt = -9; for (let x = G.CAN_X0; x <= G.CAN_FRAME; x += 0.02) { const a = G.canA(x); if (a < 1e-3 || Math.abs(y) > a) continue; zt = Math.max(zt, G.surf(x, Math.abs(y)).zu + G.canH(x) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y) / a, 2.3)), 1 / 2.3)); }
      if (zt > -9) cg.push([y, -zt]);
    }
    const base = cg.slice().reverse().map(p => [p[0], -G.surf(5.0, Math.abs(p[0])).zu]);
    b += P(pth(cg.concat(base), true), 'glass');
    b += P(pth([[0, -3.2], [0, 2.4]]), 'ctr');
  }
  b += P(pth(half, true), 'ol') + P(pth(half.map(p => [-p[0], p[1]]), true), 'ol');
  return { b, top, bot };
}

// ---- compose files ----
// plan
{
  let b = planView();
  b += dimH(0, G.X_TAIL, -8.6, '≈ 20.5 m', -0.5, -0.5);
  b += dimV(21.6, -G.YTIP, G.YTIP, '≈ 14.8 m  (ATP flat)', G.XTIPTE + 0.3, G.XTIPTE + 0.3);
  fs.writeFileSync(path.join(out, 'plan.svg'), svg([-1, -9.8, 24, 18.6], b, 'Plan view of the NF-9 general arrangement'));
}
// side
{
  const { b: sb, top } = sideView();
  let b = sb;
  const zmax = Math.max(...top.map(p => p[1]));
  b += dimV(21.3, -zmax, 2.25, '≈ 3.5 m on gear', 5.6, 20.6);
  fs.writeFileSync(path.join(out, 'side.svg'), svg([-1, -2.3, 24, 5.2], b, 'Side view of the NF-9 general arrangement'));
}
// front
{
  const { b } = frontView(0, true);
  fs.writeFileSync(path.join(out, 'front.svg'), svg([-8.2, -2.1, 16.4, 3.6], b, 'Front view of the NF-9 general arrangement'));
}
// ATP modes: three front views
for (const [name, d] of [['atp0', 0], ['atp30', 30], ['atp65', 65]]) {
  const { b } = frontView(d, true);
  let extra = '';
  if (d) {
    // hinge marker and angle arc on starboard side
    const yh = G.YH, zh = -G.camber(15, yh);
    extra += `<circle cx="${f(yh)}" cy="${f(zh)}" r="0.09" class="hinge"/>`;
    const r = 1.1, a = d * G.D2R;
    extra += P(`M${f(yh + r)} ${f(zh)} A${r} ${r} 0 0 1 ${f(yh + r * Math.cos(a))} ${f(zh + r * Math.sin(a))}`, 'arc');
    extra += P(pth([[yh, zh], [yh + 1.7, zh]]), 'ext');
  }
  fs.writeFileSync(path.join(out, name + '.svg'), svg([-8.2, -2.1, 16.4, d ? 3.9 + d / 30 : 3.6], b + extra, `Front view with tip panels at ${d} degrees`));
}
// bare outline for the page's own diagrams (edge alignment, material zones, apertures)
fs.writeFileSync(path.join(out, 'outline.json'), JSON.stringify({
  outline: G.outline(0.1).full.map(p => [+f(p[0]), +f(p[1])]),
  canopy: (() => { const c = []; for (let x = G.CAN_X0; x <= G.CAN_X1; x += 0.1) c.push([+f(x), +f(G.canA(x))]); return c; })(),
  consts: { XJ: G.XJ, YJ: G.YJ, YH: G.YH, YTIP: G.YTIP, XTIPLE: G.XTIPLE, XTIPTE: G.XTIPTE, X_N1: G.X_N1, Y_N1: G.Y_N1, X_N2: G.X_N2, Y_N2: G.Y_N2, X_TAIL: G.X_TAIL, X_NOZ: G.X_NOZ },
}));
console.log('ok', fs.readdirSync(out).map(n => n + ':' + fs.statSync(path.join(out, n)).size).join(' '));

// ---------------- diagram plates ----------------
const OL = G.outline(0.05).full;
const area = (() => { let a = 0; for (let i = 0; i < OL.length; i++) { const p = OL[i], q = OL[(i + 1) % OL.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; })();
console.log('planform area', area.toFixed(1));
const VB = [-1, -8.4, 22.6, 16.8];
// edge families
{
  let b = P(pth(OL, true), 'body');
  const famA = [], famB = [], strm = [];
  for (let i = 0; i < OL.length; i++) {
    const p = OL[i], q = OL[(i + 1) % OL.length], dx = q[0] - p[0], dy = q[1] - p[1];
    if (Math.hypot(dx, dy) < 0.6) continue;
    if (Math.abs(dy) < 1e-6) strm.push([p, q]); else if (dx * dy > 0) famA.push([p, q]); else famB.push([p, q]);
  }
  // ghost alignment lines through the aircraft
  for (let k = -3; k <= 3; k++) {
    const c = 11 + k * 2.2;
    b += P(pth([[c - 8 * G.TAN50, -8], [c + 8 * G.TAN50, 8]].map(p => [p[0], p[1]])), 'ghostA');
    b += P(pth([[c - 8 * G.TAN50, 8], [c + 8 * G.TAN50, -8]]), 'ghostB');
  }
  b += P(pth(OL, true), 'olm');
  famA.forEach(s => b += P(pth(s), 'famA')); famB.forEach(s => b += P(pth(s), 'famB')); strm.forEach(s => b += P(pth(s), 'famS'));
  b += P(pth([[G.xLE(G.YH), G.YH], [G.xTE(G.YH), G.YH]]), 'famS') + P(pth([[G.xLE(G.YH), -G.YH], [G.xTE(G.YH), -G.YH]]), 'famS');
  fs.writeFileSync(path.join(out, 'edges.svg'), svg(VB, `<defs><clipPath id="edgeclip"><path d="${pth(OL, true)}"/></clipPath></defs>` + b.replace(/<path d="([^"]+)" class="ghost(A|B)"\/>/g, '<path d="$1" class="ghost$2" clip-path="url(#edgeclip)"/>'), 'Planform edge families'));
}
// material zones
{
  let b = P(pth(OL, true), 'm-skin');
  const bandsU = D.upper().filter(it => it.kind === 'band' && it.tone < -0.04 && it.pts.length > 20);
  // ATP
  for (const s of [1, -1]) b += P(pth([[G.xLE(G.YH), G.YH * s], [G.XTIPLE, G.YTIP * s], [G.XTIPTE, G.YTIP * s], [G.xTE(G.YH), G.YH * s]], true), 'm-atp');
  // control surfaces
  D.upper().filter(it => it.kind === 'panel' && it.gap).forEach(it => b += P(pth(it.pts, true), 'm-ctl'));
  // hot structure
  for (const s of [1, -1]) b += P(pth([[14.6, 0.3 * s], [14.6, 1.8 * s], [G.X_NOZ, 1.8 * s], [G.X_NOZ, 0.3 * s]], true), 'm-ti');
  b += P(pth([[16.2, 0.3], [G.X_TAIL - 0.2, 0.05], [G.X_TAIL - 0.2, -0.05], [16.2, -0.3]], true), 'm-ti');
  for (const s of [1, -1]) b += P(pth([[G.X_NOZ, 0.48 * s], [G.xTE(0.48), 0.48 * s], [G.xTE(1.62), 1.62 * s], [G.X_NOZ, 1.62 * s]], true), 'm-cmc');
  // radome
  const rad = OL.filter(p => p[0] <= 2.7);
  b += P(pth(rad.concat([[2.7, -G.chineW(2.7)]]), true), 'm-rad');
  bandsU.forEach(it => b += P(pth(it.pts, true), 'm-edge'));
  const can = []; for (let x = G.CAN_X0; x <= G.CAN_FRAME; x += 0.05) can.push([x, G.canA(x)]);
  b += P(pth(can.concat(can.slice().reverse().map(p => [p[0], -p[1]])), true), 'm-ito');
  b += P(pth(OL, true), 'olm');
  fs.writeFileSync(path.join(out, 'materials.svg'), svg(VB, b, 'Material zones on the upper surface'));
}
// apertures
{
  let b = P(pth(OL, true), 'body') + P(pth(OL, true), 'olm');
  const can = []; for (let x = G.CAN_X0; x <= G.CAN_X1; x += 0.05) can.push([x, G.canA(x)]);
  b += P(pth(can.concat(can.slice().reverse().map(p => [p[0], -p[1]])), true), 'olm');
  // coverage fans for side-looking chine arrays and nose array
  const fan = (x, y, dir, spread, r, cls) => { const a0 = dir - spread, a1 = dir + spread; return P(`M${f(x)} ${f(y)} L${f(x + r * Math.cos(a0))} ${f(y + r * Math.sin(a0))} A${r} ${r} 0 0 1 ${f(x + r * Math.cos(a1))} ${f(y + r * Math.sin(a1))} Z`, cls); };
  b = fan(1.2, 0, Math.PI, 1.05, 3.2, 'fan') + fan(4.8, 1.25, Math.PI / 2, 1.0, 2.6, 'fan') + fan(4.8, -1.25, -Math.PI / 2, 1.0, 2.6, 'fan') + b;
  const marks = [
    [1, 1.2, 0], [2, 4.8, 1.12], [2, 4.8, -1.12], [3, 3.5, 0.8], [3, 3.5, -0.8], [3, 5.08, 1.0], [3, 5.08, -1.0], [3, 9.72, 0],
    [4, 2.28, 0], [5, 12.6, 0], [6, 14.3, 7.12], [6, 14.3, -7.12], [7, 15.6, 0], [8, 11.9, 6.2], [8, 11.9, -6.2], [9, 18.4, 4.8], [9, 18.4, -4.8],
  ];
  marks.forEach(([n, x, y]) => { b += `<circle cx="${f(x)}" cy="${f(y)}" r="0.44" class="mk"/><text x="${f(x)}" y="${f(y + 0.16)}" class="mkt" text-anchor="middle">${n}</text>`; });
  fs.writeFileSync(path.join(out, 'apertures.svg'), svg(VB, b, 'Sensor and aperture locations'));
}
