import * as THREE from 'three';

/**
 * Crystal Orb v4: dots only, no mesh, no DOM overlay.
 * - a fine lattice of crisp dots forms the sphere (edge-on dots glow, which makes the rim)
 * - two tilted rings of tiny dots orbit just outside the surface
 * - a small calculator built like a computer chip (gold pins, square key dies, traces, "GPU" in dots) sits inside the sphere.
 *   At rest it is faint (about 20%) with a slow glossy shimmer. On hover it moves forward,
 *   becomes fully visible and glows.
 * - a few small sparks drift away from the orb and fade out
 * - on hover the orb grows a little and the calculator grows and comes forward
 * - dots near the cursor grow, brighten and turn the hover colour; the orb tilts to follow
 * Transparent canvas, so it works on light and dark pages.
 */

export interface OrbColors {
  /** Lattice colour at the top of the sphere, e.g. electric blue */
  a?: string;
  /** Lattice colour at the bottom of the sphere, e.g. violet */
  b?: string;
  /** Ring and calculator colour */
  spark?: string;
  /** Colour dots turn near the cursor, also the calculator's accent key */
  hover?: string;
}

const DEFAULTS: Required<OrbColors> = {
  a: '#12b5ff',
  b: '#6a5cff',
  spark: '#00c2ff',
  hover: '#ffb81f',
};

/* ---------- sphere + rings ---------- */

const VERT = /* glsl */ `
attribute float aKind;
attribute vec3 aAxis;
attribute float aSpeed;
uniform float uTime;
uniform float uPx;
uniform float uScale;
uniform float uPower;
uniform vec3 uMouse;
varying float vA;
varying float vH;
varying float vKind;
varying float vY;

vec3 rot(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

void main() {
  vec3 p = rot(position, aAxis, uTime * aSpeed);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  // how edge-on this dot is (1 at the silhouette, 0 facing us)
  vec3 n = normalize(normalMatrix * normalize(p));
  vec3 v = normalize(-mv.xyz);
  float facing = dot(n, v);
  float edge = pow(1.0 - abs(facing), 2.0);

  vec3 d = mv.xyz - uMouse;
  float push = smoothstep(1.0, 0.0, length(d)) * uPower;
  mv.xyz += normalize(d + vec3(0.0001)) * push * 0.3;

  vKind = aKind;
  vY = p.y;
  vH = clamp(push * 1.8, 0.0, 1.0);

  float size;
  float alpha;
  if (aKind > 0.5) {
    // ring dot: tiny, steady
    size = 2.2 * (1.0 + push * 1.2);
    alpha = (facing < 0.0 ? 0.3 : 0.75);
  } else {
    // lattice dot: small and crisp; back-facing dots fade so the front reads clearly
    float back = facing < 0.0 ? 0.22 : 1.0;
    size = 2.6 * (0.75 + edge * 0.85) * (1.0 + push * 1.3);
    alpha = (0.38 + edge * 0.62) * back;
    alpha = min(1.0, alpha + push * 0.5);
  }
  vA = alpha;
  gl_PointSize = uPx * uScale * size * (4.1 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uSpark;
uniform vec3 uHover;
varying float vA;
varying float vH;
varying float vKind;
varying float vY;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  vec3 base = vKind > 0.5 ? uSpark : mix(uB, uA, clamp(vY * 0.5 + 0.5, 0.0, 1.0));
  vec3 col = mix(base, uHover, vH);
  gl_FragColor = vec4(col, smoothstep(0.5, 0.36, r) * vA);
}
`;

/* ---------- sparks drifting away from the orb ---------- */

const SPARK_VERT = /* glsl */ `
attribute vec3 aDir;
attribute float aPhase;
attribute float aSpd;
attribute float aRank;
uniform float uBurst;
uniform float uTime;
uniform float uPx;
uniform float uScale;
varying float vA;

void main() {
  float life = fract(uTime * aSpd + aPhase);
  vec3 p = aDir * (1.04 + life * 0.32);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // some sparks always run; more join in as the burst (hover) value rises
  float thresh = mix(0.62, 1.05, uBurst);
  float on = 1.0 - smoothstep(thresh - 0.05, thresh, aRank);
  vA = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.5, 1.0, life)) * 0.95 * on;
  gl_PointSize = uPx * uScale * 3.4 * (1.0 - life * 0.55) * (4.1 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const SPARK_FRAG = /* glsl */ `
uniform vec3 uSpark;
uniform vec3 uWarm;
uniform float uBurst;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  // warm orange at rest, cooling to the cyan accent as the cursor arrives
  vec3 col = mix(uWarm, uSpark, uBurst);
  gl_FragColor = vec4(col, smoothstep(0.5, 0.2, r) * vA);
}
`;

function makeSparkDots(): THREE.BufferGeometry {
  const n = 260; // about 160 show at rest, all of them on hover
  const pos = new Float32Array(n * 3);
  const dir = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  const spd = new Float32Array(n);
  const rank = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // evenly spread directions, slightly flattened so they stay inside the frame
    const y = (i / (n - 1)) * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    const th = i * Math.PI * (3 - Math.sqrt(5));
    const v = new THREE.Vector3(Math.cos(th) * r, y * 0.75, Math.sin(th) * r).normalize();
    dir.set([v.x, v.y, v.z], i * 3);
    phase[i] = (i * 0.7548776662) % 1;
    rank[i] = (i * 0.618034) % 1;
    spd[i] = 0.2 + ((i * 37) % 10) / 10 * 0.12; // 5 to 3 seconds per spark
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1));
  g.setAttribute('aRank', new THREE.BufferAttribute(rank, 1));
  return g;
}

/* ---------- calculator made of dots ---------- */

const CALC_VERT = /* glsl */ `
attribute float aTone;
uniform float uTime;
uniform float uPx;
uniform float uScale;
uniform float uHov;
varying float vTone;
varying float vA;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);

  // slow glossy band sweeping diagonally across the calculator
  float sweep = mod(uTime * 0.3, 3.2) - 1.6;
  float band = exp(-pow(((position.x + position.y) * 0.7 - sweep) * 3.2, 2.0));

  float rest = 0.2 + band * 0.4;        // about 20% visible, shimmering
  float on = 0.85 + band * 0.15;        // clearly visible on hover
  float a = mix(rest, on, uHov);

  float size = 2.3;
  if (aTone > 5.5) { size = 1.3; a *= 0.6; }          // traces
  else if (aTone > 4.5) { size = 2.2; a *= 0.95; }    // pins
  else if (aTone > 3.5) { size = 2.0; a *= 0.7; }     // display frame
  else if (aTone > 2.5) { size = 3.0; a *= 1.0; }     // GPU letters
  else if (aTone > 1.5) { size = 2.6; }               // accent key
  else if (aTone > 0.5) { size = 2.9; }               // keys (square dies)
  size *= 1.0 + uHov * 0.3 + band * 0.25 * (1.0 - uHov);

  vTone = aTone;
  vA = a;
  gl_PointSize = uPx * uScale * size * 2.4 * (4.1 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const CALC_FRAG = /* glsl */ `
uniform vec3 uSpark;
uniform vec3 uB;
uniform vec3 uAccent;
uniform float uHov;
varying float vTone;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  bool letter = vTone > 2.5 && vTone < 3.5;
  vec3 col = uSpark;
  if (letter) col = mix(uSpark, uB, 0.3);
  if (vTone > 1.5 && vTone < 2.5) col = uAccent;               // accent key
  if (vTone > 4.5 && vTone < 5.5) col = mix(uAccent, uSpark, 0.25); // gold pins
  // chip parts are small rounded squares, letters stay round
  vec2 q = abs(c) - 0.05;
  float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float shape = letter ? r : box;
  float core = letter ? smoothstep(0.23, 0.17, shape) : smoothstep(0.15, 0.11, shape);
  float halo = pow(max(0.0, 1.0 - r * 2.0), 2.0) * 0.55 * uHov;
  float a = max(core, halo);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a * vA);
}
`;

function makeSphereDots(): THREE.BufferGeometry {
  const lattice = 460;
  const ringDots = 64;
  // rings hug the sphere surface so the shape stays a clean ball
  const rings = [
    { tiltX: 1.15, tiltZ: 0.25, radius: 1.07, speed: 0.5 },
    { tiltX: -0.7, tiltZ: -0.5, radius: 1.07, speed: -0.4 },
  ];
  const total = lattice + ringDots * rings.length;

  const pos = new Float32Array(total * 3);
  const kind = new Float32Array(total);
  const axis = new Float32Array(total * 3);
  const speed = new Float32Array(total);
  let i = 0;
  const put = (p: THREE.Vector3, k: number, ax: THREE.Vector3, sp: number) => {
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
    axis[i * 3] = ax.x;
    axis[i * 3 + 1] = ax.y;
    axis[i * 3 + 2] = ax.z;
    kind[i] = k;
    speed[i] = sp;
    i++;
  };

  // lattice
  const golden = Math.PI * (3 - Math.sqrt(5));
  const up = new THREE.Vector3(0, 1, 0);
  for (let n = 0; n < lattice; n++) {
    const y = 1 - (n / (lattice - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * n;
    put(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r), 0, up, 0);
  }

  // rings of tiny dots, each spinning about its own normal
  for (const ring of rings) {
    const e = new THREE.Euler(ring.tiltX, 0, ring.tiltZ);
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(e);
    for (let n = 0; n < ringDots; n++) {
      const a = (n / ringDots) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * ring.radius, 0, Math.sin(a) * ring.radius).applyEuler(e);
      put(p, 1, normal, ring.speed);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  g.setAttribute('aAxis', new THREE.BufferAttribute(axis, 3));
  g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  return g;
}

// 5 x 7 dot-matrix letters
const GLYPHS: Record<string, string[]> = {
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
};

/**
 * Tone codes: 0 package outline, 1 key die, 2 accent key, 3 letter, 4 display die, 5 pin, 6 trace.
 * Units are sphere radii; the calculator is 1.2 wide and 1.5 tall.
 */
function makeCalcDots(): THREE.BufferGeometry {
  const pts: number[] = [];
  const tones: number[] = [];
  const add = (x: number, y: number, tone: number) => {
    pts.push(x, y, 0);
    tones.push(tone);
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const frame = (cx: number, cy: number, w: number, h: number, pitch: number, tone: number) => {
    const nx = Math.max(2, Math.round(w / pitch));
    const ny = Math.max(2, Math.round(h / pitch));
    for (let k = 0; k <= nx; k++) {
      const x = cx - w / 2 + (k / nx) * w;
      add(x, cy + h / 2, tone);
      add(x, cy - h / 2, tone);
    }
    for (let k = 1; k < ny; k++) {
      const y = cy - h / 2 + (k / ny) * h;
      add(cx - w / 2, y, tone);
      add(cx + w / 2, y, tone);
    }
  };

  // dots along a rounded rectangle, evenly spaced
  const roundFrame = (cx: number, cy: number, w: number, h: number, rad: number, pitch: number, tone: number) => {
    const hw = w / 2 - rad;
    const hh = h / 2 - rad;
    const path: [number, number][] = [];
    const seg = (x0: number, y0: number, x1: number, y1: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = Math.max(1, Math.round(len / pitch));
      for (let k = 0; k < m; k++) path.push([x0 + ((x1 - x0) * k) / m, y0 + ((y1 - y0) * k) / m]);
    };
    const arc = (ax: number, ay: number, a0: number) => {
      const m = Math.max(2, Math.round((rad * Math.PI) / 2 / pitch));
      for (let k = 0; k < m; k++) {
        const a = a0 + ((Math.PI / 2) * k) / m;
        path.push([ax + Math.cos(a) * rad, ay + Math.sin(a) * rad]);
      }
    };
    seg(-hw, -h / 2, hw, -h / 2); // bottom edge
    arc(hw, -hh, -Math.PI / 2);
    seg(w / 2, -hh, w / 2, hh); // right edge
    arc(hw, hh, 0);
    seg(hw, h / 2, -hw, h / 2); // top edge
    arc(-hw, hh, Math.PI / 2);
    seg(-w / 2, hh, -w / 2, -hh); // left edge
    arc(-hw, -hh, Math.PI);
    for (const [x, y] of path) add(cx + x, cy + y, tone);
  };

  // package outline, rounded corners
  roundFrame(0, 0, 1.2, 1.5, 0.2, 0.075, 0);
  // gold pins along all four sides, like a chip package
  for (let k = 0; k < 8; k++) {
    const y = -0.63 + k * 0.18;
    for (const sx of [-1, 1]) {
      add(sx * 0.68, y, 5);
      add(sx * 0.76, y, 5);
    }
  }
  for (let k = 0; k < 6; k++) {
    const x = -0.5 + k * 0.2;
    for (const sy of [-1, 1]) {
      add(x, sy * 0.83, 5);
      add(x, sy * 0.91, 5);
    }
  }
  // display frame
  roundFrame(0, 0.46, 1.0, 0.36, 0.1, 0.07, 4);

  // "GPU" in dots
  const pitch = 0.05;
  const word = ['G', 'P', 'U'];
  const startX = -((word.length * 5 + (word.length - 1)) * pitch) / 2 + pitch / 2;
  word.forEach((ch, wi) => {
    GLYPHS[ch].forEach((row, r) => {
      for (let c = 0; c < 5; c++) {
        if (row[c] === '1') add(startX + (wi * 6 + c) * pitch, 0.46 + 3 * pitch - r * pitch, 3);
      }
    });
  });

  // circuit traces between the key dies
  for (let row = 0; row < 3; row++) {
    const cy = -0.02 - row * 0.26;
    for (const x of [-0.185, 0.185]) add(x, cy, 6);
  }
  for (let col = 0; col < 3; col++) {
    const cx = (col - 1) * 0.37;
    for (const y of [-0.15, -0.41]) add(cx, y, 6);
  }

  // 3 x 3 keys, each a small square die; the last key is the accent colour
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = (col - 1) * 0.37;
      const cy = -0.02 - row * 0.26;
      const tone = row === 2 && col === 2 ? 2 : 1;
      for (let ix = 0; ix < 3; ix++) {
        for (let iy = 0; iy < 3; iy++) {
          add(cx + (ix - 1) * 0.07, cy + (iy - 1) * 0.07, tone);
        }
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  g.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(tones), 1));
  return g;
}

export function createOrb(container: HTMLElement, colors: OrbColors = {}): () => void {
  const c = { ...DEFAULTS, ...colors };
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
  } catch {
    container.dataset.orb = 'fallback';
    return () => {};
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(canvas);

  const FOV = 40;
  const BASE_Z = 4.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  let camZ = BASE_Z;
  camera.position.z = camZ;
  const group = new THREE.Group();
  scene.add(group);

  const uniforms = {
    uTime: { value: 0 },
    uPx: { value: renderer.getPixelRatio() },
    uScale: { value: 1 },
    uPower: { value: 0 },
    uMouse: { value: new THREE.Vector3(0, 0, -3.4) },
    uA: { value: new THREE.Color(c.a) },
    uB: { value: new THREE.Color(c.b) },
    uSpark: { value: new THREE.Color(c.spark) },
    uHover: { value: new THREE.Color(c.hover) },
  };
  const calcUniforms = {
    uTime: uniforms.uTime,
    uPx: uniforms.uPx,
    uScale: uniforms.uScale,
    uHov: { value: 0 },
    uSpark: uniforms.uSpark,
    uB: uniforms.uB,
    uAccent: uniforms.uHover,
  };

  const geo = makeSphereDots();
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sphere = new THREE.Points(geo, mat);
  group.add(sphere);

  const sparkUniforms = {
    uTime: uniforms.uTime,
    uPx: uniforms.uPx,
    uScale: uniforms.uScale,
    uSpark: uniforms.uSpark,
    uWarm: uniforms.uHover,
    uBurst: { value: 0 },
  };
  const sparkGeo = makeSparkDots();
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: sparkUniforms,
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.visible = !reduce; // a still frame stays clean
  sparks.renderOrder = 1;
  group.add(sparks);

  const calcGeo = makeCalcDots();
  const calcMat = new THREE.ShaderMaterial({
    uniforms: calcUniforms,
    vertexShader: CALC_VERT,
    fragmentShader: CALC_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const calc = new THREE.Points(calcGeo, calcMat);
  scene.add(calc);

  const CALC_SCALE = 0.76;
  const REST_Z = -0.35; // behind the front of the sphere
  const HOVER_Z = 0.5; // forward on hover
  const ORB_GROW = 0.18; // orb gets 18% bigger on hover
  const CALC_GROW = 0.22; // calculator gets 22% bigger on hover
  calc.position.z = REST_Z;
  calc.scale.setScalar(CALC_SCALE);
  calc.renderOrder = 0;
  sphere.renderOrder = 1; // sphere dots draw over the faint calculator

  let inside = false;
  let nx = 0;
  let ny = 0;
  let tiltX = 0;
  let tiltY = 0;
  let hov = 0;

  const onMove = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    const m = 40;
    inside =
      e.clientX >= r.left - m &&
      e.clientX <= r.right + m &&
      e.clientY >= r.top - m &&
      e.clientY <= r.bottom + m;
    if (inside) {
      nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    }
  };
  const onLeave = () => {
    inside = false;
  };

  const render = (t: number) => {
    uniforms.uTime.value = t;
    renderer.render(scene, camera);
  };

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camZ = BASE_Z * Math.max(1, 0.95 / camera.aspect);
    camera.position.z = camZ;
    camera.updateProjectionMatrix();
    // keep dots a readable size on small screens
    uniforms.uScale.value = Math.min(1.3, Math.max(0.8, h / 150));
    if (reduce) render(2);
  };

  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  let visible = true;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < 22) return; // about 45 frames a second is plenty
    lastDraw = now;
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    const t = now / 1000;

    const depth = camZ - 0.8;
    const halfH = Math.tan((FOV * Math.PI) / 360) * depth;
    const k = 1 - Math.exp(-dt * 10);
    const m = uniforms.uMouse.value;
    if (inside) {
      m.x += (nx * halfH * camera.aspect - m.x) * k;
      m.y += (ny * halfH - m.y) * k;
    }
    m.z = -depth;
    uniforms.uPower.value += ((inside ? 1 : 0) - uniforms.uPower.value) * k;

    const kt = 1 - Math.exp(-dt * 4);
    tiltX += ((inside ? -ny * 0.3 : 0) - tiltX) * kt;
    tiltY += ((inside ? nx * 0.4 : 0) - tiltY) * kt;
    group.rotation.x = tiltX;
    group.rotation.y = t * 0.22 + tiltY;

    // calculator: faint and behind at rest, forward and glowing on hover
    hov += ((inside ? 1 : 0) - hov) * (1 - Math.exp(-dt * 7));
    calcUniforms.uHov.value = hov;
    sparkUniforms.uBurst.value = hov;
    calc.position.z = REST_Z + (HOVER_Z - REST_Z) * hov;
    calc.scale.setScalar(CALC_SCALE * (1 + hov * CALC_GROW));
    group.scale.setScalar(1 + hov * ORB_GROW);
    calc.rotation.x = tiltX * 0.5;
    calc.rotation.y = tiltY * 0.5;
    // once it is mostly forward, draw it over the sphere dots
    calc.renderOrder = hov > 0.5 ? 2 : 0;
    render(t);
  };

  const update = () => {
    const shouldRun = visible && !document.hidden && !reduce;
    if (shouldRun && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    update();
  });
  io.observe(container);
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  document.addEventListener('visibilitychange', update);
  if (!reduce) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
  }
  resize();
  update();
  if (reduce) render(2);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    geo.dispose();
    mat.dispose();
    sparkGeo.dispose();
    sparkMat.dispose();
    calcGeo.dispose();
    calcMat.dispose();
    renderer.dispose();
    canvas.remove();
  };
}