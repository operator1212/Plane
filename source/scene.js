import * as THREE from 'three';

const G = window.SERAC, TEX = window.SERAC_TEX;
const XOFF = 10.2;
const P3 = (x, y, z) => [y, z, x - XOFF]; // aircraft (x aft, y stbd, z up) -> three (X stbd, Y up, Z aft)

function ystations(a, b, step) { const n = Math.max(1, Math.round((b - a) / step)); return Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n); }

function skinGeometry(ys, side, surface, droop) {
  const NU = 560;
  const nY = ys.length, pos = [], uv = [], col = [], idx = [];
  const yh = G.YH, zh = G.camber(15, yh);
  const cd = Math.cos(droop), sd = Math.sin(droop);
  for (let i = 0; i < nY; i++) {
    const y = ys[i], xl = G.xLE(y), xt = G.xTE(y), c = xt - xl;
    for (let j = 0; j <= NU; j++) {
      let t = j / NU;
      t = t < 0.5 ? 0.5 * Math.pow(2 * t, 1.12) : t; // mild clustering toward the leading edge
      const x = xl + c * t;
      const s = G.surf(x, y);
      let z = surface === 'upper' ? s.zu : s.zl;
      let yy = y;
      if (droop && y > yh) { const dy = y - yh, dz = z - zh; yy = yh + dy * cd + dz * sd; z = zh - dy * sd + dz * cd; }
      pos.push(...P3(x, side * yy, z));
      uv.push((x - TEX.X0) / (TEX.X1 - TEX.X0), (side * y - TEX.Y0) / (TEX.Y1 - TEX.Y0));
      const dark = surface === 'upper' ? 1 - 0.88 * s.nozDark : 1 - 0.975 * s.inDark;
      col.push(dark, dark, dark);
    }
  }
  const W = NU + 1;
  const up = surface === 'upper';
  const flip = (side > 0) !== up; // winding: starboard upper uses (a,c,b)
  for (let i = 0; i < nY - 1; i++) for (let j = 0; j < NU; j++) {
    const a = i * W + j, b = (i + 1) * W + j, c = i * W + j + 1, d = (i + 1) * W + j + 1;
    if (!flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function canopyGeometry(x0, x1, nx, ns) {
  const pos = [], uv = [], idx = [], n = 2.3;
  for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx, a = Math.max(G.canA(x), 1e-4), h = G.canH(x);
    for (let j = 0; j <= ns; j++) {
      const s = -1 + 2 * j / ns, y = a * s;
      const z = G.surf(x, Math.abs(y)).zu - 0.004 + h * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), n)), 1 / n);
      pos.push(...P3(x, y, z));
      uv.push((x - TEX.X0) / (TEX.X1 - TEX.X0), (y - TEX.Y0) / (TEX.Y1 - TEX.Y0));
    }
  }
  const W = ns + 1;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ns; j++) {
    const a = i * W + j, b = (i + 1) * W + j, c = i * W + j + 1, d = (i + 1) * W + j + 1;
    idx.push(a, b, c, c, b, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  g.setIndex(idx); g.computeVertexNormals();
  // make sure normals face outward (up)
  const nrm = g.getAttribute('normal'); const mid = Math.floor((nx / 2) * W + ns / 2);
  if (nrm.getY(mid) < 0) { const ix = g.getIndex().array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
  return g;
}

function frameRing(x) {
  const pts = [], a = G.canA(x), h = G.canH(x), n = 2.3;
  for (let j = 0; j <= 60; j++) {
    const s = -1 + 2 * j / 60, y = a * s;
    const z = G.surf(x, Math.abs(y)).zu + h * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), n)), 1 / n) + 0.006;
    pts.push(new THREE.Vector3(...P3(x, y, z)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.024, 8, false);
}

function canvasTex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = false; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function envScene(kind) {
  const s = new THREE.Scene();
  const sg = new THREE.SphereGeometry(100, 64, 32);
  const cols = [], p = sg.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 100;
    let c;
    if (kind === 'sky') {
      c = y > 0 ? new THREE.Color().lerpColors(new THREE.Color(0.55, 0.68, 0.86), new THREE.Color(0.10, 0.22, 0.48), Math.pow(y, 0.55))
        : new THREE.Color().lerpColors(new THREE.Color(0.62, 0.64, 0.67), new THREE.Color(0.42, 0.44, 0.46), Math.pow(-y, 0.4));
      c.multiplyScalar(1.1);
    } else {
      c = y > 0 ? new THREE.Color().lerpColors(new THREE.Color(0.11, 0.115, 0.125), new THREE.Color(0.2, 0.21, 0.225), y)
        : new THREE.Color().lerpColors(new THREE.Color(0.09, 0.09, 0.095), new THREE.Color(0.03, 0.03, 0.032), Math.pow(-y, 0.5));
    }
    cols.push(c.r, c.g, c.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, pos, look, I, tint) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...(tint || [1, 1, 1])).multiplyScalar(I), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  if (kind === 'sky') {
    box(9, 9, [-40, 55, -30], [0, 0, 0], 40, [1, 0.96, 0.9]);        // sun
  } else {
    box(40, 18, [10, 60, 10], [0, 0, 0], 1.1);                          // overhead softbox
    box(12, 40, [-55, 22, -22], [0, 0, 0], 5.0);                      // key strip, port front
    box(8, 40, [50, 14, 30], [0, 0, 0], 3.2, [0.85, 0.92, 1.0]);      // cool rim, starboard aft
    box(40, 6, [0, 8, 60], [0, 0, 0], 2.0);                           // back strip
    box(70, 20, [0, -40, 0], [0, 0, 0], 0.35, [1, 0.97, 0.92]);        // floor bounce
  }
  return s;
}

let renderer, scene, camera, pmrem, key, fill, meshes = {}, mats = {};

async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  pmrem = new THREE.PMREMGenerator(renderer);

  await document.fonts.ready;
  const S = 194;
  const up = { a: TEX.paint('upper', 'albedo', S), b: TEX.paint('upper', 'bump', S), r: TEX.paint('upper', 'rough', S) };
  const lo = { a: TEX.paint('lower', 'albedo', S), b: TEX.paint('lower', 'bump', S), r: TEX.paint('lower', 'rough', S) };
  window.__tex = { up, lo };
  const mk = (t) => new THREE.MeshPhysicalMaterial({
    map: canvasTex(t.a, true), bumpMap: canvasTex(t.b), roughnessMap: canvasTex(t.r),
    roughness: 1, metalness: 0.2, bumpScale: 1.2, vertexColors: true,
    sheen: 0.1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.55, 0.6, 0.7),
  });
  mats.up = mk(up); mats.lo = mk(lo);
  mats.glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.018, 0.016, 0.012), metalness: 0, roughness: 0.035,
    clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, specularColor: new THREE.Color(1.0, 0.78, 0.45),
    iridescence: 0.55, iridescenceIOR: 1.7, iridescenceThicknessRange: [280, 520], envMapIntensity: 1.5,
  });
  mats.frame = new THREE.MeshPhysicalMaterial({ color: 0x3b3f44, roughness: 0.55, metalness: 0.3 });

  scene = new THREE.Scene();
  key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 80 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  scene.add(key, key.target);
  fill = new THREE.HemisphereLight(0xdfe6ee, 0x202124, 0.25);
  scene.add(fill);
}

function buildAircraft(droopDeg) {
  if (meshes.group) { scene.remove(meshes.group); meshes.group.traverse(o => o.geometry && o.geometry.dispose()); }
  const grp = new THREE.Group();
  const droop = droopDeg * Math.PI / 180;
  const inner = [...ystations(0, 2.6, 0.018), ...ystations(2.6, G.YH, 0.045).slice(1)];
  const atp = ystations(G.YH, G.YTIP, 0.035);
  for (const side of [1, -1]) {
    for (const surface of ['upper', 'lower']) {
      const m = surface === 'upper' ? mats.up : mats.lo;
      for (const ys of [inner, atp]) {
        const mesh = new THREE.Mesh(skinGeometry(ys, side, surface, ys === atp ? droop : 0), m);
        mesh.castShadow = mesh.receiveShadow = true; grp.add(mesh);
      }
    }
  }
  const glass = new THREE.Mesh(canopyGeometry(G.CAN_X0, G.CAN_FRAME, 90, 64), mats.glass);
  const fair = new THREE.Mesh(canopyGeometry(G.CAN_FRAME, G.CAN_X1, 40, 64), mats.up);
  const ring = new THREE.Mesh(frameRing(G.CAN_FRAME), mats.frame);
  [glass, fair, ring].forEach(m => { m.castShadow = m.receiveShadow = true; grp.add(m); });
  scene.add(grp); meshes.group = grp;
}

const VIEWS = {
  hero:   { env: 'studio', droop: 0,  cam: [-17.5, 9.2, -17.5], tgt: [0.3, -0.35, 0.6], fov: 25, key: [-28, 14, 6], keyI: 2.4, w: 1800, h: 1013, roll: 0 },
  low:    { env: 'sky',    droop: 58, cam: [15.5, -7.2, -17.0], tgt: [0, 0.3, 0.2],     fov: 25, key: [-25, 40, -12], keyI: 2.6, w: 1800, h: 1013, roll: -0.10 },
  rear:   { env: 'studio', droop: 22, cam: [13.8, 10.2, 18.5],  tgt: [0.2, -0.3, 1.2],  fov: 25, key: [-15, 30, 20], keyI: 2.1, w: 1800, h: 1013, roll: 0 },
  canopy: { env: 'studio', droop: 0,  cam: [-5.2, 2.6, -11.3],  tgt: [0.1, 0.55, -4.7], fov: 22, key: [-20, 30, -10], keyI: 2.2, w: 1800, h: 1013, roll: 0 },
  plan:   { env: 'studio', droop: 0,  ortho: true, key: [-6, 40, -4], keyI: 1.8, w: 2400, h: 1800 },
  side:   { env: 'studio', droop: 0,  orthoSide: true, key: [-30, 20, -6], keyI: 2.0, w: 2400, h: 600 },
};

let currentEnv = null;
function setEnv(kind) {
  if (currentEnv === kind) return;
  const rt = pmrem.fromScene(envScene(kind), 0.015);
  scene.environment = rt.texture; currentEnv = kind;
  fill.intensity = kind === 'sky' ? 0.35 : 0.2;
  key.color.set(kind === 'sky' ? 0xfff3e2 : 0xffffff);
}

function backdrop(g, w, h, kind) {
  if (kind === 'sky') {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0f2446'); gr.addColorStop(0.55, '#2c4c7a'); gr.addColorStop(0.86, '#7f98b8'); gr.addColorStop(1, '#a9b7c6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  } else {
    const gr = g.createRadialGradient(w * 0.5, h * 0.42, h * 0.05, w * 0.5, h * 0.5, w * 0.72);
    gr.addColorStop(0, '#2a2e33'); gr.addColorStop(0.55, '#17191c'); gr.addColorStop(1, '#0b0c0e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
}

export async function renderView(name, opts = {}) {
  const v = Object.assign({}, VIEWS[name], opts);
  const SS = v.ss || 2;
  const W = v.w * SS, H = v.h * SS;
  renderer.setSize(W, H, false);
  setEnv(v.env);
  buildAircraft(v.droop);
  key.position.set(...v.key); key.intensity = v.keyI;
  if (v.ortho) {
    const half = 11.4, aspect = v.w / v.h;
    camera = new THREE.OrthographicCamera(-half, half, half / aspect, -half / aspect, 0.1, 200);
    camera.position.set(0, 40, 0.1); camera.up.set(1, 0, 0); camera.lookAt(0, 0, 0.1);
  } else if (v.orthoSide) {
    const half = 11.4, aspect = v.w / v.h;
    camera = new THREE.OrthographicCamera(-half, half, half / aspect, -half / aspect, 0.1, 200);
    camera.position.set(-40, 0.1, 0.1); camera.lookAt(0, 0.1, 0.1);
  } else {
    camera = new THREE.PerspectiveCamera(v.fov, v.w / v.h, 0.5, 300);
    camera.position.set(...v.cam); camera.lookAt(...v.tgt);
    camera.rotateZ(v.roll || 0);
  }
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  // composite: backdrop + downsampled render + grain + vignette
  const out = document.createElement('canvas'); out.width = v.w; out.height = v.h;
  const g = out.getContext('2d');
  if (!v.transparent) backdrop(g, v.w, v.h, v.env);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(renderer.domElement, 0, 0, v.w, v.h);
  if (!v.transparent) {
    const vg = g.createRadialGradient(v.w / 2, v.h / 2, v.h * 0.35, v.w / 2, v.h / 2, v.w * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = vg; g.fillRect(0, 0, v.w, v.h);
    const im = g.getImageData(0, 0, v.w, v.h), d = im.data;
    let s = 12345;
    for (let i = 0; i < d.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.045; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }
  return out.toDataURL(v.transparent ? 'image/png' : 'image/jpeg', 0.9);
}

export function textureDataURL(which, mode) {
  const c = window.__tex[which === 'upper' ? 'up' : 'lo'][{ albedo: 'a', bump: 'b', rough: 'r' }[mode]];
  return c.toDataURL('image/jpeg', 0.85);
}

await init();
window.renderView = renderView;
window.textureDataURL = textureDataURL;
window.__ready = true;
