import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 *  月見マート / TSUKIMI MART — a rainy Japanese street corner
 *  A self-contained, hand-built toon diorama.
 * ------------------------------------------------------------------ */

const params = new URLSearchParams(window.location.search);
const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SKIP_INTRO = params.has('skipIntro') || PREFERS_REDUCED_MOTION;
const DPR = Math.min(window.devicePixelRatio || 1, 1.65);
const BASE_HALF = 12.7;
const WALK_Y = 0.18;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------------------------------- renderer ---------------------------------- */

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.domElement.setAttribute('aria-label', '雨夜便利店街角微缩模型');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060b15);
scene.fog = new THREE.Fog(0x07101c, 40, 96);

const camera = new THREE.PerspectiveCamera(37, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(20.0, 17.5, 30.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-1.9, 0.2, 0.0);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.82;
controls.enablePan = false;
controls.minDistance = 17;
controls.maxDistance = 59;
controls.minPolarAngle = 0.18;
controls.maxPolarAngle = Math.PI * 0.485;
controls.update();

const cameraOverride = params.get('cam');
if (cameraOverride) {
  const v = cameraOverride.split(',').map(Number);
  if (v.length === 6 && v.every(Number.isFinite)) {
    camera.position.set(v[0], v[1], v[2]);
    controls.target.set(v[3], v[4], v[5]);
    controls.update();
  }
}
const fovOverride = Number(params.get('fov'));
const hasFovOverride = Number.isFinite(fovOverride) && fovOverride > 15 && fovOverride < 80;
if (hasFovOverride) {
  camera.fov = fovOverride;
  camera.updateProjectionMatrix();
}
let userHasInteracted = false;
function applyResponsiveFov() {
  if (hasFovOverride) return;
  const aspect = camera.aspect;
  const referenceAspect = 1.54;
  const baseFov = 37;
  if (aspect >= referenceAspect) {
    camera.fov = baseFov;
  } else {
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov * 0.5)) * referenceAspect);
    const vHalf = Math.atan(Math.tan(hHalf) / Math.max(aspect, 0.45));
    camera.fov = Math.min(66, THREE.MathUtils.radToDeg(vHalf * 2));
  }
  camera.updateProjectionMatrix();
}
applyResponsiveFov();
const NO_BLOOM = params.has('noBloom');
const NO_OUTLINE = params.has('noOutline');
const DEBUG_MODE = params.get('debug') || '';

/* ---------------------------------- atmosphere ---------------------------------- */

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(130, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x04070f) },
      uHorizon: { value: new THREE.Color(0x0d1a2c) },
      uGlow: { value: new THREE.Color(0x183351) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.55 * noise(p);
        v += 0.28 * noise(p * 2.1 + 5.3);
        v += 0.17 * noise(p * 4.3 + 9.1);
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.9 + 0.08, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.92, h));

        // soft, overcast glow low above the rooftops
        float horizon = exp(-abs(d.y - 0.03) * 7.0);
        col += uGlow * horizon * 0.32;

        // rain clouds, kept very low contrast
        vec2 uv = d.xz / max(d.y + 0.24, 0.18);
        float cloud = fbm(uv * 1.15 + vec2(uTime * 0.002, 0.0));
        cloud = smoothstep(0.36, 0.86, cloud);
        col += vec3(0.018, 0.028, 0.045) * cloud * smoothstep(0.02, 0.5, d.y + 0.15);

        // subtle cool rim just above the horizon line
        float band = exp(-abs(d.y - 0.16) * 18.0);
        col += vec3(0.042, 0.075, 0.10) * band * fbm(vec2(d.x * 3.0, d.z * 3.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
);
sky.frustumCulled = false;
sky.renderOrder = -20;
scene.add(sky);

/* ---------------------------------- shared helpers ---------------------------------- */

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  return c;
}

function canvasTexture(w, h, draw, { repeat = null, nearest = false, transparent = false } = {}) {
  const c = makeCanvas(w, h, draw);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  if (nearest) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  }
  if (transparent) t.premultiplyAlpha = false;
  t.needsUpdate = true;
  return t;
}

function canvasRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const gradientMap = (() => {
  const data = new Uint8Array([28, 92, 168, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const toonCache = new Map();
function toon(color, opts = {}) {
  const { noCache, flatShading, ...materialOpts } = opts;
  const key = `${color}|${JSON.stringify(materialOpts)}`;
  if (!noCache && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap, ...materialOpts });
  if (!noCache) toonCache.set(key, m);
  return m;
}

const MAT = {
  ink: toon(0x17212b),
  dark: toon(0x1d2a33),
  asphalt: toon(0x111a22),
  metal: toon(0x596772),
  metalLight: toon(0x87959b),
  darkMetal: toon(0x2d3940),
  concrete: toon(0x9aa1a3),
  concreteDark: toon(0x6d777c),
  cream: toon(0xf0e7d3),
  white: toon(0xe9ece5),
  wall: toon(0xe5dfce),
  wallCool: toon(0xc8d0cd),
  teal: toon(0x286c68),
  tealDeep: toon(0x123e43),
  tealLight: toon(0x64bcae),
  coral: toon(0xd96b5b),
  amber: toon(0xe5a84e),
  wood: toon(0x5a4133),
  woodDark: toon(0x33251f),
  roof: toon(0x263e41),
  wire: toon(0x12161c),
  rubber: toon(0x171b1f),
};

function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

function roundedBox(w, h, d, r, mat, x = 0, y = 0, z = 0, parent = scene, segments = 2) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 12, parent = scene, shadow = true) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

function sphere(r, mat, x = 0, y = 0, z = 0, parent = scene, seg = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function plane(w, h, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function groundPlane(w, d, mat, x = 0, y = 0.02, z = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function tubeBetween(a, b, radius, mat, parent = scene, radial = 6, shadow = false) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, radial), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

function wire(a, b, sag = 0.6, radius = 0.023, mat = MAT.wire, parent = scene) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const geo = new THREE.TubeGeometry(curve, 22, radius, 4, false);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

function markNoOutline(obj) {
  obj.traverse((o) => { o.userData.noOutline = true; });
  return obj;
}

const glowTexture = canvasTexture(256, 256, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.72)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.20)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

function glowSprite(color, scale, opacity = 0.7, x = 0, y = 0, z = 0, parent = scene) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  s.position.set(x, y, z);
  s.userData.noOutline = true;
  s.renderOrder = 6;
  parent.add(s);
  return s;
}

const softShadowTexture = canvasTexture(256, 256, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.04, w / 2, h / 2, w * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0.82)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.44)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

function contactShadow(w, d, x, y, z, opacity = 0.45, parent = scene, rotation = 0) {
  const mat = new THREE.MeshBasicMaterial({
    map: softShadowTexture,
    transparent: true,
    opacity,
    depthWrite: false,
    color: 0x000000,
    blending: THREE.NormalBlending,
  });
  const m = groundPlane(w, d, mat, x, y, z, parent);
  m.rotation.z = rotation;
  m.userData.noOutline = true;
  m.renderOrder = 2;
  return m;
}

/* ---------------------------------- textures ---------------------------------- */

const pavingTexture = canvasTexture(1024, 1024, (ctx, w, h) => {
  ctx.fillStyle = '#7c8287';
  ctx.fillRect(0, 0, w, h);
  const tiles = 8;
  const tw = w / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const shade = 118 + Math.floor(Math.random() * 22);
      ctx.fillStyle = `rgb(${shade},${shade + 5},${shade + 8})`;
      ctx.fillRect(x * tw + 3, y * tw + 3, tw - 6, tw - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(x * tw + 6, y * tw + 6, tw - 12, 3);
    }
  }
  ctx.strokeStyle = 'rgba(48,56,60,0.62)';
  ctx.lineWidth = 5;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tw, 0);
    ctx.lineTo(i * tw, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * tw);
    ctx.lineTo(w, i * tw);
    ctx.stroke();
  }
  // small wet stains and darkened joints
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = `rgba(25,35,42,${rand(0.08, 0.015)})`;
    ctx.beginPath();
    ctx.ellipse(rand(w), rand(h), rand(70, 8), rand(18, 3), rand(TAU), 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 28; i++) {
    ctx.strokeStyle = `rgba(45,54,58,${rand(0.22, 0.08)})`;
    ctx.lineWidth = rand(2, 0.7);
    ctx.beginPath();
    let x = rand(w), y = rand(h);
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += rand(35, -35);
      y += rand(35, -35);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}, { repeat: [5.8, 5.8] });

const grateTexture = canvasTexture(512, 160, (ctx, w, h) => {
  ctx.fillStyle = '#20282c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#4f5c60';
  ctx.lineWidth = 7;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  for (let i = 0; i < 20; i++) {
    const x = 18 + i * 24;
    ctx.fillStyle = i % 2 ? '#0c1114' : '#59656a';
    ctx.fillRect(x, 17, 10, h - 34);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(8, 8, w - 16, 3);
});

const tactileTexture = canvasTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#b7973e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(68,57,26,0.36)';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if ((x + y) % 2) continue;
      ctx.beginPath();
      ctx.arc(26 + x * 51, 26 + y * 51, 13, 0, TAU);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(255,238,176,0.20)';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, w - 6, h - 6);
}, { repeat: [3, 1] });

const tactileLineTexture = canvasTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#b7973e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(69,57,25,0.36)';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(25 + i * 47, 8, 16, h - 16);
  }
  ctx.strokeStyle = 'rgba(255,238,176,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, w - 6, h - 6);
}, { repeat: [1, 3] });

const crosswalkTexture = canvasTexture(512, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(232,235,224,0.92)';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(80,92,92,${rand(0.13, 0.025)})`;
    ctx.beginPath();
    ctx.ellipse(rand(w), rand(h), rand(28, 2), rand(6, 1), rand(TAU), 0, TAU);
    ctx.fill();
  }
  // worn wet edges
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(18,28,33,${rand(0.22, 0.06)})`;
    ctx.beginPath();
    ctx.ellipse(rand(w), rand(h), rand(36, 5), rand(7, 1), rand(TAU), 0, TAU);
    ctx.fill();
  }
});

const stopMarkTexture = canvasTexture(512, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.fillStyle = 'rgba(232,234,222,0.88)';
  ctx.font = '900 170px "Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('止まれ', 0, 8);
  ctx.restore();
  // worn grit
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand(0.7, 0.15)})`;
    ctx.beginPath();
    ctx.ellipse(rand(w), rand(h), rand(11, 1), rand(4, 1), rand(TAU), 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
});

const parkingPTexture = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(232,235,225,0.78)';
  ctx.font = '900 340px "Arial Narrow", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', w / 2, h / 2 + 12);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    ctx.ellipse(rand(w), rand(h), rand(24, 2), rand(8, 1), rand(TAU), 0, TAU);
    ctx.fill();
  }
});

const manholeTexture = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#30383b';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#5b6668';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 234, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#141b1e';
  ctx.lineWidth = 12;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    ctx.beginPath();
    ctx.moveTo(w / 2 + Math.cos(a) * 54, h / 2 + Math.sin(a) * 54);
    ctx.lineTo(w / 2 + Math.cos(a) * 218, h / 2 + Math.sin(a) * 218);
    ctx.stroke();
  }
  ctx.fillStyle = '#596466';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 58, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#252e30';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 35, 0, TAU);
  ctx.fill();
});

const noParkingTexture = canvasTexture(256, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#214f75';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 118, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#e9ece3';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 110, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#d94b45';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 94, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#f1f1e9';
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.25);
  ctx.lineTo(w * 0.75, h * 0.75);
  ctx.stroke();
  ctx.fillStyle = '#f1f1e9';
  ctx.font = '900 127px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('駐', w / 2, h / 2 + 7);
});

const mainSignTexture = canvasTexture(1792, 320, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fbf4e2');
  g.addColorStop(1, '#e9dfc8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#173e43';
  ctx.lineWidth = 10;
  ctx.strokeRect(9, 9, w - 18, h - 18);

  ctx.save();
  ctx.translate(142, 148);
  ctx.fillStyle = '#173e43';
  ctx.beginPath();
  ctx.arc(0, 0, 102, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fbf4e2';
  ctx.beginPath();
  ctx.arc(31, -24, 84, 0, TAU);
  ctx.fill();
  drawStar(ctx, 59, 45, 17, '#e9b45f');
  drawStar(ctx, 85, -21, 7, '#7fcabd');
  ctx.restore();

  ctx.fillStyle = '#173e43';
  ctx.font = '900 132px "Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('月見マート', 286, 133);
  ctx.font = '700 39px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillStyle = '#3b5a5b';
  ctx.letterSpacing = '13px';
  ctx.fillText('TSUKIMI MART', 292, 236);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#173e43';
  canvasRoundRect(ctx, 1398, 38, 338, 244, 10);
  ctx.fill();
  ctx.fillStyle = '#f8f0dc';
  ctx.font = '900 150px "Arial Narrow", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('24', 1544, 142);
  ctx.fillStyle = '#e47963';
  ctx.font = '900 56px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('HOURS', 1546, 223);
  ctx.strokeStyle = '#e9b45f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(1433, 53);
  ctx.lineTo(1699, 53);
  ctx.stroke();

  ctx.fillStyle = '#2f857a';
  ctx.fillRect(27, h - 33, 280, 18);
  ctx.fillStyle = '#e47963';
  ctx.fillRect(316, h - 33, 170, 18);
  ctx.fillStyle = '#e9b45f';
  ctx.fillRect(495, h - 33, 84, 18);

  ctx.textAlign = 'left';
  ctx.font = '700 29px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillStyle = '#406769';
  ctx.fillText('OPEN EVERY DAY  ·  ATM  ·  COPY  ·  DELIVERY', 616, 281);
});

const sideSignTexture = canvasTexture(1024, 512, (ctx, w, h) => {
  ctx.fillStyle = '#f8f0dd';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#173e43';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = '#173e43';
  ctx.fillRect(0, h - 108, w, 108);
  drawStar(ctx, 100, 138, 57, '#e7b15d');
  ctx.fillStyle = '#e47963';
  ctx.beginPath();
  ctx.arc(100, 138, 23, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#173e43';
  ctx.font = '900 112px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('月見マート', 186, 140);
  ctx.fillStyle = '#406769';
  ctx.font = '700 44px "Trebuchet MS", "Arial", sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('TSUKIMI MART', 190, 246);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#f8f0dd';
  ctx.font = '700 54px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('24時間 営業中', 56, 442);
  ctx.fillStyle = '#6bcfc0';
  ctx.font = '900 52px "Trebuchet MS", "Arial", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('24H', 966, 171);
  ctx.textAlign = 'left';
});

const bladeSignTexture = canvasTexture(448, 1024, (ctx, w, h) => {
  ctx.fillStyle = '#153b42';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#f4ead3';
  ctx.lineWidth = 15;
  ctx.strokeRect(13, 13, w - 26, h - 26);
  ctx.fillStyle = '#f4ead3';
  ctx.font = '900 146px "Arial Narrow", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('24', w / 2, 188);
  ctx.fillStyle = '#e47963';
  ctx.beginPath();
  ctx.arc(w / 2, 354, 65, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f4ead3';
  ctx.font = '900 92px "Arial", sans-serif';
  ctx.fillText('H', w / 2, 359);
  ctx.fillStyle = '#7fd2c2';
  ctx.font = '900 62px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('営業中', w / 2, 492);
  ctx.fillStyle = '#e7b15d';
  ctx.fillRect(52, 560, w - 104, 6);
  ctx.fillStyle = '#f4ead3';
  ctx.font = '700 47px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('TSUKIMI', w / 2, 630);
  ctx.fillText('MART', w / 2, 690);
  ctx.font = '600 31px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillStyle = '#9abbb7';
  ctx.fillText('ATM / COPY', w / 2, 775);
  ctx.fillText('宅配便受付', w / 2, 823);
  ctx.fillStyle = '#e47963';
  ctx.fillRect(68, 888, w - 136, 5);
});

const windowBannerTexture = canvasTexture(1600, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(241,235,215,0.94)';
  canvasRoundRect(ctx, 0, 6, w, h - 12, 16);
  ctx.fill();
  ctx.fillStyle = '#e87960';
  ctx.fillRect(16, 22, 196, h - 44);
  ctx.fillStyle = '#fff8e7';
  ctx.font = '900 51px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('新発売', 114, 110);
  ctx.font = '700 27px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('NEW!', 114, 162);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#214a4c';
  ctx.font = '900 55px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('からあげ弁当', 246, 107);
  ctx.fillStyle = '#698281';
  ctx.font = '700 29px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('あったか〜い  のり弁も入荷しました', 248, 160);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#214a4c';
  ctx.font = '900 81px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('¥498', w - 58, 150);
  ctx.font = '700 25px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillStyle = '#a15446';
  ctx.fillText('税込', w - 58, 198);
});

const doorStickerTexture = canvasTexture(1024, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(247,241,224,0.90)';
  canvasRoundRect(ctx, 52, 312, 486, 93, 10);
  ctx.fill();
  ctx.fillStyle = '#245358';
  ctx.font = '800 41px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('自動ドア  AUTO DOOR', 295, 360);
  ctx.fillStyle = '#e9b15c';
  ctx.beginPath();
  ctx.arc(592, 358, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#245358';
  ctx.font = '900 35px "Arial", sans-serif';
  ctx.fillText('24', 592, 360);
  ctx.fillStyle = '#7bcabd';
  ctx.font = '800 31px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('防犯カメラ作動中', 646, 360);

  ctx.fillStyle = 'rgba(246,239,222,0.97)';
  ctx.save();
  ctx.translate(790, 136);
  ctx.rotate(-0.09);
  canvasRoundRect(ctx, -172, -67, 344, 134, 7);
  ctx.fill();
  ctx.strokeStyle = '#d8caad';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#25555a';
  ctx.font = '800 31px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATM・コピー・宅配便', 0, -20);
  ctx.fillStyle = '#d06e59';
  ctx.font = '900 39px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('24時間 受付', 0, 34);
  ctx.restore();
});

const vendingTexture = canvasTexture(512, 1024, (ctx, w, h) => {
  ctx.fillStyle = '#e9e9df';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, 440);
  g.addColorStop(0, '#fdf8e9');
  g.addColorStop(1, '#dbece8');
  ctx.fillStyle = g;
  ctx.fillRect(20, 20, w - 40, 430);
  ctx.fillStyle = '#d75f58';
  ctx.fillRect(20, 20, w - 40, 95);
  ctx.fillStyle = '#fff8ea';
  ctx.font = '900 65px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('つめた〜い', w / 2, 87);
  ctx.fillStyle = '#26484c';
  ctx.font = '900 28px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('TSUKIMI DRINK', w / 2, 145);

  const canCols = ['#dd735e', '#639fa4', '#e6b65e', '#8e6e9b', '#74a86a', '#d7d2c3'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 52 + col * 82;
      const y = 174 + row * 82;
      ctx.fillStyle = 'rgba(35,54,55,0.15)';
      canvasRoundRect(ctx, x + 4, y + 4, 52, 66, 8);
      ctx.fill();
      ctx.fillStyle = pick(canCols);
      canvasRoundRect(ctx, x, y, 53, 67, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.fillRect(x + 8, y + 11, 37, 10);
      ctx.fillStyle = 'rgba(18,31,33,0.65)';
      ctx.font = '700 14px "Arial", sans-serif';
      ctx.fillText('DRINK', x + 26, y + 52);
      ctx.fillStyle = '#34605b';
      ctx.beginPath();
      ctx.arc(x + 27, y + 78, 4, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(16,26,28,0.96)';
  ctx.fillRect(24, 480, w - 48, 380);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(34, 493, w - 68, 7);
  ctx.fillStyle = '#f7efdb';
  ctx.font = '800 28px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('つめた〜い / あったか〜い', 52, 934);
  ctx.fillStyle = '#dce3df';
  ctx.fillRect(52, 953, 172, 11);
  ctx.fillStyle = '#e0a451';
  ctx.fillRect(250, 953, 105, 11);
  ctx.fillStyle = '#292f30';
  ctx.fillRect(44, 879, 352, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 8; i++) ctx.fillRect(48 + i * 54, 500, 2, 360);
});

const noticeBoardTexture = canvasTexture(1024, 640, (ctx, w, h) => {
  ctx.fillStyle = '#7d5c40';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(40,27,18,${rand(0.12, 0.025)})`;
    ctx.fillRect(rand(w), rand(h), rand(20, 2), rand(8, 2));
  }
  const flyers = [
    { x: 38, y: 52, w: 260, h: 330, c: '#f1e6ce', rot: -0.03, title: '月見町 夏祭り', sub: '8.24  SAT', accent: '#d36c56' },
    { x: 328, y: 92, w: 226, h: 280, c: '#e8efe5', rot: 0.035, title: '迷い猫', sub: 'さがしています', accent: '#467c78' },
    { x: 584, y: 42, w: 190, h: 244, c: '#e9e2d1', rot: -0.02, title: '防災訓練', sub: '9.01  SUN', accent: '#9d7d44' },
    { x: 795, y: 88, w: 178, h: 262, c: '#f1e1ce', rot: 0.05, title: '求人募集', sub: '夜勤スタッフ', accent: '#b5644d' },
    { x: 364, y: 398, w: 262, h: 174, c: '#e1e6dd', rot: -0.025, title: '古本市', sub: '駅前広場にて', accent: '#537476' },
    { x: 668, y: 386, w: 280, h: 190, c: '#efe0c1', rot: 0.02, title: '花火大会', sub: '打上 19:30', accent: '#b76450' },
  ];
  for (const f of flyers) {
    ctx.save();
    ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
    ctx.rotate(f.rot);
    ctx.fillStyle = 'rgba(31,23,16,0.34)';
    ctx.fillRect(-f.w / 2 + 6, -f.h / 2 + 8, f.w, f.h);
    ctx.fillStyle = f.c;
    ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.fillStyle = f.accent;
    ctx.fillRect(-f.w / 2, -f.h / 2, f.w, 32);
    ctx.fillStyle = 'rgba(55,62,58,0.78)';
    ctx.font = '700 17px "Yu Gothic", "Meiryo", sans-serif';
    ctx.fillText(f.sub, -f.w / 2 + 14, -f.h / 2 + 59);
    ctx.fillStyle = '#344441';
    ctx.font = '900 27px "Yu Gothic", "Meiryo", sans-serif';
    ctx.fillText(f.title, -f.w / 2 + 14, -f.h / 2 + 101);
    ctx.strokeStyle = 'rgba(60,68,63,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(-f.w / 2 + 16, -f.h / 2 + 132 + i * 22);
      ctx.lineTo(f.w / 2 - 16, -f.h / 2 + 132 + i * 22);
      ctx.stroke();
    }
    if (f.title === '迷い猫') {
      ctx.fillStyle = '#e5ddcd';
      ctx.beginPath();
      ctx.arc(0, -10, 42, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5c5448';
      ctx.beginPath();
      ctx.arc(-14, -17, 4, 0, TAU);
      ctx.arc(14, -17, 4, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-34, -36); ctx.lineTo(-18, -57); ctx.lineTo(-3, -39);
      ctx.moveTo(34, -36); ctx.lineTo(18, -57); ctx.lineTo(3, -39);
      ctx.fill();
    }
    ctx.fillStyle = '#d16f59';
    ctx.beginPath();
    ctx.arc(0, -f.h / 2 + 14, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(40,27,18,${rand(0.20, 0.05)})`;
    ctx.beginPath();
    ctx.moveTo(rand(w), 0);
    ctx.lineTo(rand(w), h);
    ctx.stroke();
  }
});

const coolerTexture = canvasTexture(1024, 512, (ctx, w, h) => {
  ctx.fillStyle = '#152b30';
  ctx.fillRect(0, 0, w, h);
  const doors = 4;
  const dw = w / doors;
  for (let d = 0; d < doors; d++) {
    const x = d * dw;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e6f9f4');
    g.addColorStop(0.25, '#a7e0d8');
    g.addColorStop(1, '#5a9a9a');
    ctx.fillStyle = g;
    ctx.fillRect(x + 8, 8, dw - 16, h - 16);
    for (let row = 0; row < 4; row++) {
      const sy = 44 + row * 108;
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(x + 22, sy + 78, dw - 44, 5);
      for (let col = 0; col < 6; col++) {
        const bx = x + 28 + col * ((dw - 56) / 6);
        const bh = 53 + (row % 2) * 10;
        const colors = ['#d96752', '#e9ad51', '#4d8a8a', '#d9d8c6', '#6988a5', '#86a96f'];
        ctx.fillStyle = colors[(row * 2 + col + d) % colors.length];
        canvasRoundRect(ctx, bx, sy + 76 - bh, 26, bh, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.44)';
        ctx.fillRect(bx + 5, sy + 87 - bh, 16, 7);
      }
    }
    ctx.fillStyle = 'rgba(15,29,31,0.80)';
    ctx.fillRect(x + dw / 2 - 5, 0, 10, h);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillRect(x + dw / 2 + 13, h * 0.44, 6, 65);
    ctx.strokeStyle = 'rgba(13,27,29,0.20)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 11, 11, dw - 22, h - 22);
  }
  ctx.fillStyle = 'rgba(234,249,243,0.7)';
  ctx.font = '700 22px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('つめたい飲みもの', 28, 35);
});

const streetSignTexture = canvasTexture(1024, 256, (ctx, w, h) => {
  ctx.fillStyle = '#1c4b4d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e9eee3';
  ctx.lineWidth = 9;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.fillStyle = '#eef1e7';
  ctx.font = '800 88px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('月見町 二丁目', w / 2, 92);
  ctx.font = '700 41px "Trebuchet MS", "Arial", sans-serif';
  ctx.letterSpacing = '12px';
  ctx.fillStyle = '#a5c3b8';
  ctx.fillText('TSUKIMI-CHO 2', w / 2, 184);
  ctx.letterSpacing = '0px';
});

const posterTexture = canvasTexture(512, 720, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#22494c');
  g.addColorStop(1, '#172f35');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e8b662';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = '#e8b662';
  ctx.beginPath();
  ctx.arc(w / 2, 212, 98, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#22494c';
  ctx.beginPath();
  ctx.arc(w / 2 + 29, 188, 84, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2e9d3';
  ctx.font = '900 62px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('月見町', w / 2, 386);
  ctx.font = '800 43px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('夏祭り', w / 2, 450);
  ctx.fillStyle = '#e47963';
  ctx.font = '700 30px "Trebuchet MS", "Arial"';
  ctx.fillText('AUG. 24  /  18:00', w / 2, 531);
  ctx.fillStyle = '#82c4b8';
  ctx.font = '600 24px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('月見町商店街', w / 2, 634);
});

const awningStripeTexture = canvasTexture(1024, 256, (ctx, w, h) => {
  ctx.fillStyle = '#143f42';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.055)';
    ctx.fillRect(i * 102, 0, 102, h);
  }
  ctx.fillStyle = '#e9b45f';
  ctx.fillRect(0, h - 10, w, 4);
  ctx.fillStyle = 'rgba(180,237,222,0.8)';
  ctx.font = '700 34px "Trebuchet MS", "Arial", sans-serif';
  ctx.letterSpacing = '10px';
  ctx.textAlign = 'center';
  ctx.fillText('TSUKIMI MART   ·   OPEN 24 HOURS', w / 2, h * 0.56);
  ctx.letterSpacing = '0px';
});

/* ---------------------------------- environment / glass ---------------------------------- */

const environmentTexture = canvasTexture(1024, 512, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#03060d');
  g.addColorStop(0.47, '#0c1826');
  g.addColorStop(0.53, '#1a2c3c');
  g.addColorStop(0.64, '#0a1119');
  g.addColorStop(1, '#05090f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const glows = [
    [210, 262, 170, 42, 'rgba(255,204,135,0.8)'],
    [536, 256, 240, 31, 'rgba(112,225,204,0.55)'],
    [820, 277, 142, 27, 'rgba(255,128,144,0.46)'],
  ];
  for (const [x, y, rx, ry, color] of glows) {
    const rg = ctx.createRadialGradient(x, y, 2, x, y, rx);
    rg.addColorStop(0, color);
    rg.addColorStop(0.23, color.replace(/[\d.]+\)$/, '0.20)'));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = `rgba(126,205,220,${rand(0.16, 0.02)})`;
    ctx.fillRect(rand(w), rand(h * 0.35, h * 0.7), rand(16, 2), rand(3, 1));
  }
});
environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = environmentTexture;

const glassMaterial = new THREE.MeshBasicMaterial({
  color: 0x9fc6c8,
  transparent: true,
  opacity: 0.075,
  side: THREE.DoubleSide,
  depthWrite: false,
  toneMapped: true,
});
glassMaterial.userData.isGlass = true;

const puddleMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x182833,
  metalness: 0.72,
  roughness: 0.06,
  envMapIntensity: 1.65,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
});

/* ---------------------------------- lights ---------------------------------- */

scene.add(new THREE.HemisphereLight(0x7593c0, 0x1e1a22, 0.74));
scene.add(new THREE.AmbientLight(0x3d5474, 0.3));

const moon = new THREE.DirectionalLight(0x9ebaff, 1.15);
moon.position.set(-13, 26, 18);
moon.target.position.set(-1, 0, -2);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -23;
moon.shadow.camera.right = 23;
moon.shadow.camera.top = 23;
moon.shadow.camera.bottom = -23;
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 70;
moon.shadow.bias = -0.0008;
moon.shadow.normalBias = 0.035;
moon.shadow.radius = 2.5;
scene.add(moon);
scene.add(moon.target);

const coolRim = new THREE.DirectionalLight(0x3e79a0, 0.48);
coolRim.position.set(18, 10, 15);
coolRim.target.position.set(0, 2, 0);
scene.add(coolRim);
scene.add(coolRim.target);

const shopLightA = new THREE.PointLight(0xffc17a, 31, 14, 2);
shopLightA.position.set(-4.6, 3.25, -2.6);
scene.add(shopLightA);

const shopLightB = new THREE.PointLight(0xffd399, 19, 12, 2);
shopLightB.position.set(0.4, 3.0, -1.4);
scene.add(shopLightB);

const canopyLight = new THREE.PointLight(0xffc17d, 9, 8, 2);
canopyLight.position.set(-0.25, 2.7, 1.65);
scene.add(canopyLight);

const shopSpill = new THREE.PointLight(0xffa35e, 16, 10, 2);
shopSpill.position.set(-1.2, 2.0, 2.1);
scene.add(shopSpill);

const alleyLight = new THREE.PointLight(0xff5a7d, 8, 10, 2);
alleyLight.position.set(-9.8, 2.5, 0.7);
scene.add(alleyLight);

const sideLight = new THREE.PointLight(0xa7f4e5, 8, 8, 2);
sideLight.position.set(3.2, 2.4, 1.9);
scene.add(sideLight);

/* ---------------------------------- assembly registry ---------------------------------- */

const assembly = [];
const assemblyRoot = new THREE.Group();
scene.add(assemblyRoot);

function registerAssembly(obj, delay = 0, opts = {}) {
  const item = {
    obj,
    delay,
    duration: opts.duration ?? rand(0.95, 0.72),
    lift: opts.lift ?? rand(4.9, 3.4),
    drift: new THREE.Vector3(opts.dx ?? rand(0.55, -0.55), 0, opts.dz ?? rand(0.55, -0.55)),
    spin: opts.spin ?? rand(0.12, -0.12),
    scaleFrom: opts.scaleFrom ?? rand(0.93, 0.8),
    finalPos: obj.position.clone(),
    finalRot: obj.rotation.clone(),
    finalScale: obj.scale.clone(),
    started: false,
    done: false,
  };
  obj.userData.assembly = item;
  obj.visible = false;
  assembly.push(item);
  return obj;
}

/* ---------------------------------- the plinth ---------------------------------- */

const world = new THREE.Group();
scene.add(world);

const baseGroup = new THREE.Group();
world.add(baseGroup);

const baseBodyMat = toon(0x18222d, { flatShading: false });
// The model is a compact, square block. Its inner street surface measures 21.6 units;
// the stone rim adds the last few centimetres of collectible weight.
const BASE_CX = -1.9;
const BASE_CZ = 0.0;
const BASE_OUTER_W = 23.5;
const SURF_MIN_X = -12.7;
const SURF_MAX_X = 8.9;
const SURF_MIN_Z = -10.8;
const SURF_MAX_Z = 10.8;

const baseBody = new THREE.Mesh(new RoundedBoxGeometry(23.5, 1.6, 23.5, 3, 0.12), baseBodyMat);
baseBody.position.set(BASE_CX, -0.795, BASE_CZ);
baseBody.castShadow = true;
baseBody.receiveShadow = true;
baseGroup.add(baseBody);

const baseFoot = new THREE.Mesh(new RoundedBoxGeometry(24.1, 0.22, 24.1, 2, 0.06), toon(0x0b1017));
baseFoot.position.set(BASE_CX, -1.73, BASE_CZ);
baseFoot.castShadow = true;
baseFoot.receiveShadow = true;
baseGroup.add(baseFoot);

// a thin, warm metal band and a cool inset stripe make the plinth feel collectible
const bandMat = toon(0x7c674b);
box(23.72, 0.055, 23.72, bandMat, BASE_CX, -1.57, BASE_CZ, baseGroup);
const midBand = toon(0x283947);
box(23.62, 0.07, 23.62, midBand, BASE_CX, -0.07, BASE_CZ, baseGroup);

const rimShape = new THREE.Shape();
rimShape.moveTo(-13.65, -11.75);
rimShape.lineTo(9.85, -11.75);
rimShape.lineTo(9.85, 11.75);
rimShape.lineTo(-13.65, 11.75);
rimShape.closePath();
const rimHole = new THREE.Path();
rimHole.moveTo(-12.7, -10.8);
rimHole.lineTo(-12.7, 10.8);
rimHole.lineTo(8.9, 10.8);
rimHole.lineTo(8.9, -10.8);
rimHole.closePath();
rimShape.holes.push(rimHole);
const rimGeo = new THREE.ShapeGeometry(rimShape, 1);
rimGeo.rotateX(-Math.PI / 2);
const rimMat = new THREE.MeshStandardMaterial({ color: 0x24313a, roughness: 0.41, metalness: 0.36 });
const rim = new THREE.Mesh(rimGeo, rimMat);
rim.position.y = 0.006;
rim.receiveShadow = true;
baseGroup.add(rim);

// the little engraved plaque on the front of the base
const plaqueTexture = canvasTexture(1400, 300, (ctx, w, h) => {
  ctx.fillStyle = '#2e2a23';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#b89b69');
  g.addColorStop(0.5, '#e0c995');
  g.addColorStop(1, '#8e7048');
  ctx.fillStyle = g;
  ctx.fillRect(10, 10, w - 20, h - 20);
  ctx.strokeStyle = '#6e5535';
  ctx.lineWidth = 5;
  ctx.strokeRect(27, 27, w - 54, h - 54);
  ctx.fillStyle = '#2c3433';
  ctx.font = '800 78px "Trebuchet MS", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '10px';
  ctx.fillText('TSUKIMI MART', w / 2, 125);
  ctx.letterSpacing = '3px';
  ctx.font = '700 45px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('月見町 二丁目  ·  雨夜の街角', w / 2, 204);
  ctx.font = '600 25px "Trebuchet MS", "Arial", sans-serif';
  ctx.letterSpacing = '7px';
  ctx.fillStyle = 'rgba(44,52,51,0.75)';
  ctx.fillText('MINIATURE ARCHIVE  /  01', w / 2, 252);
});

const plaque = box(4.2, 0.9, 0.06, toon(0x2a2621), BASE_CX, -0.88, 11.76, baseGroup);
const plaqueFace = plane(3.96, 0.78, new THREE.MeshBasicMaterial({ map: plaqueTexture, toneMapped: true }), BASE_CX, -0.88, 11.793);
baseGroup.add(plaqueFace);

for (const [sx, sz] of [[-13.1, -11.2], [9.3, -11.2], [-13.1, 11.2], [9.3, 11.2]]) {
  const corner = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.42), toon(0xbfa274));
  corner.position.set(sx, 0.022, sz);
  baseGroup.add(corner);
}
// fine brass lines catch the neon and draw the square of the model base
const trimMat = toon(0x9f865b);
box(23.05, 0.014, 0.028, trimMat, BASE_CX, 0.024, -11.43, baseGroup, false);
box(23.05, 0.014, 0.028, trimMat, BASE_CX, 0.024, 11.43, baseGroup, false);
box(0.028, 0.014, 22.86, trimMat, -13.36, 0.024, BASE_CZ, baseGroup, false);
box(0.028, 0.014, 22.86, trimMat, 9.56, 0.024, BASE_CZ, baseGroup, false);

registerAssembly(baseGroup, 0.05, { lift: 5.5, drift: 0, spin: 0, duration: 1.25, scaleFrom: 0.97 });

/* ---------------------------------- wet asphalt ---------------------------------- */

const groundGroup = new THREE.Group();
world.add(groundGroup);

const reflectOpts = {
  clipBias: 0.0035,
  textureWidth: 1024,
  textureHeight: 640,
  color: 0x1a2832,
};
const roadReflector = new Reflector(new THREE.PlaneGeometry(21.6, 21.6), reflectOpts);
roadReflector.rotation.x = -Math.PI / 2;
roadReflector.position.set(-1.9, 0.025, 0);
roadReflector.material.uniforms.uTime = { value: 0 };
roadReflector.material.uniforms.uReflectStrength = { value: 0.42 };
roadReflector.material.vertexShader = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec3 vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vUv = textureMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`;
roadReflector.material.fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec3 color;
  uniform float uTime;
  uniform float uReflectStrength;
  varying vec4 vUv;
  varying vec3 vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.54 * noise(p);
    v += 0.27 * noise(p * 2.03 + 9.3);
    v += 0.14 * noise(p * 4.12 + 2.7);
    return v;
  }

  void main() {
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec2 p = vWorldPosition.xz;
    float t = uTime;

    // fine, damp asphalt grain
    float grain = noise(p * 17.0);
    float broad = fbm(p * 0.68 + vec2(2.3, 7.9));
    vec3 asphalt = mix(vec3(0.010, 0.017, 0.023), vec3(0.034, 0.049, 0.056), grain * 0.55 + broad * 0.45);
    asphalt += step(0.935, hash21(floor(p * 42.0))) * 0.018;

    // wandering puddles and oily patches
    float puddleNoise = fbm(p * 0.27 + vec2(8.4, 1.3));
    float puddle = smoothstep(0.46, 0.68, puddleNoise);
    puddle *= smoothstep(0.30, 0.70, fbm(p * 1.22 + 19.0) * 0.6 + 0.32);

    // rain rings disturb the reflection
    float ringField = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 q = p * (1.2 + float(i) * 0.58) + vec2(float(i) * 4.1, float(i) * 1.7);
      vec2 cell = floor(q);
      vec2 f = fract(q) - 0.5;
      float phase = fract(hash21(cell) * 7.31 + t * (0.24 + float(i) * 0.05));
      float d = length(f);
      ringField += smoothstep(0.06, 0.0, abs(d - phase * 0.34)) * (1.0 - phase) * 0.55;
    }
    vec2 ripple = vec2(
      sin(p.y * 5.5 - t * 2.1 + broad * 8.0),
      cos(p.x * 4.7 - t * 1.8 + broad * 7.0)
    );
    ripple += vec2(ringField * sin(p.y * 40.0), ringField * cos(p.x * 38.0));
    float distort = mix(0.0016, 0.0058, puddle);

    vec4 proj = vUv;
    proj.xy += ripple * distort * proj.w;
    vec3 refl = texture2DProj(tDiffuse, proj).rgb;
    // a few cheap blur taps, so the wet street reads as rain-softened light
    vec2 blur = vec2(0.0028, 0.0014) * proj.w;
    refl += texture2DProj(tDiffuse, proj + vec4(blur.x, 0.0, 0.0, 0.0)).rgb * 0.4;
    refl += texture2DProj(tDiffuse, proj - vec4(blur.x, 0.0, 0.0, 0.0)).rgb * 0.4;
    refl += texture2DProj(tDiffuse, proj + vec4(0.0, blur.y, 0.0, 0.0)).rgb * 0.25;
    refl += texture2DProj(tDiffuse, proj - vec4(0.0, blur.y, 0.0, 0.0)).rgb * 0.25;
    refl /= 2.3;

    float fresnel = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.2);
    float wetMask = mix(0.26, 0.94, puddle);
    wetMask *= 0.76 + 0.24 * fresnel;
    vec3 wetTint = mix(vec3(0.55, 0.76, 0.86), vec3(1.0, 0.84, 0.64), smoothstep(-2.0, 9.0, p.x) * 0.25);
    vec3 col = asphalt;
    col += refl * wetMask * uReflectStrength * wetTint;
    col += vec3(0.018, 0.034, 0.042) * fresnel;

    // very faint long neon streaks on the asphalt
    float warmStreak = smoothstep(0.65, 0.0, abs(p.x + 1.6)) * smoothstep(6.0, 2.0, abs(p.y - 7.0));
    float coolStreak = smoothstep(0.55, 0.0, abs(p.x - 3.4)) * smoothstep(7.0, 3.0, abs(p.y - 7.6));
    col += vec3(0.12, 0.055, 0.018) * warmStreak * 0.12 * (0.4 + puddle);
    col += vec3(0.01, 0.09, 0.07) * coolStreak * 0.10 * (0.4 + puddle);

    gl_FragColor = vec4(col, 1.0);
    #include <logdepthbuf_fragment>
  }
`;
roadReflector.material.transparent = false;
roadReflector.material.uniforms.tDiffuse.value = roadReflector.getRenderTarget().texture;
roadReflector.material.uniforms.uReflectStrength.value = 0.68;
roadReflector.userData.noOutline = true;
roadReflector.userData.isReflector = true;
roadReflector.renderOrder = 0;
groundGroup.add(roadReflector);

const walkTextureMat = toon(0xffffff, { map: pavingTexture });
const walkSlab = box(17.9, 0.18, 15.35, walkTextureMat, -3.75, 0.09, -3.125, groundGroup);
walkSlab.receiveShadow = true;

// stone curb
const curbMat = toon(0x6d777b);
box(17.9, 0.16, 0.28, curbMat, -3.75, 0.26, 4.53, groundGroup);
box(0.28, 0.16, 15.35, curbMat, 5.24, 0.26, -3.125, groundGroup);
box(0.28, 0.16, 15.35, curbMat, -12.55, 0.26, -3.125, groundGroup);
box(17.9, 0.16, 0.28, curbMat, -3.75, 0.26, -10.55, groundGroup);

// tactile yellow guidance pads at the crossings
const tactileMat = new THREE.MeshBasicMaterial({ map: tactileTexture, color: 0xbfa553, toneMapped: true });
const tactilePad1 = groundPlane(2.5, 0.46, tactileMat, 3.55, 0.188, 4.15, groundGroup);
tactilePad1.rotation.z = 0;
markNoOutline(tactilePad1);
const tactileLineMat = new THREE.MeshBasicMaterial({ map: tactileLineTexture, color: 0xb89c4b, toneMapped: true });
const tactilePad2 = groundPlane(0.46, 2.5, tactileLineMat, 4.95, 0.188, 2.6, groundGroup);
markNoOutline(tactilePad2);

// the gutter that lines the curb, with a few iron grates
const gutterMat = toon(0x1c252a);
box(17.9, 0.035, 0.34, gutterMat, -3.75, 0.045, 4.74, groundGroup, false);
box(0.34, 0.035, 15.0, gutterMat, 5.47, 0.045, -3.3, groundGroup, false);
for (let x = -11.6; x < 4.0; x += 3.0) {
  const grate = groundPlane(1.0, 0.31, new THREE.MeshBasicMaterial({ map: grateTexture }), x, 0.066, 4.74, groundGroup);
  grate.userData.noOutline = true;
}
for (let z = -9.6; z < 3.4; z += 3.4) {
  const grate = groundPlane(0.31, 1.0, new THREE.MeshBasicMaterial({ map: grateTexture }), 5.47, 0.066, z, groundGroup);
  grate.userData.noOutline = true;
}
const cornerGrate = groundPlane(1.1, 1.1, new THREE.MeshBasicMaterial({ map: grateTexture }), 4.75, 0.069, 5.05, groundGroup);
cornerGrate.userData.noOutline = true;

// puddles on the sidewalk
function sidewalkPuddle(x, z, sx, sz, rot = 0) {
  const geo = new THREE.CircleGeometry(1, 26);
  const pos = geo.attributes.position;
  for (let i = 1; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const a = Math.atan2(vy, vx);
    const wobble = 0.78 + 0.17 * Math.sin(a * 3.1 + x) + 0.08 * Math.sin(a * 7.0 + z);
    pos.setXY(i, vx * wobble, vy * wobble);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, puddleMaterial);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rot;
  m.scale.set(sx, sz, 1);
  m.position.set(x, 0.191, z);
  m.userData.noOutline = true;
  m.renderOrder = 3;
  groundGroup.add(m);
  return m;
}
sidewalkPuddle(3.6, 3.35, 0.95, 0.58, 0.3);
sidewalkPuddle(-4.7, 2.95, 1.2, 0.4, -0.15);
sidewalkPuddle(0.8, 2.4, 0.65, 0.34, 0.1);
sidewalkPuddle(-8.0, 1.8, 0.5, 0.25, 0.2);

// a low service kerb between the alley paving and the shop
box(0.12, 0.1, 8.4, toon(0x4d5759), -8.62, 0.23, -3.15, groundGroup);

registerAssembly(groundGroup, 0.32, { lift: 3.1, drift: 0, spin: 0, duration: 1.1, scaleFrom: 0.96 });

/* ---------------------------------- road paint ---------------------------------- */

const paintGroup = new THREE.Group();
world.add(paintGroup);

const paintMat = new THREE.MeshBasicMaterial({
  map: crosswalkTexture,
  color: 0xdfe4d9,
  transparent: true,
  opacity: 0.64,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  toneMapped: true,
});

function roadDecal(w, d, x, z, map = null, opacity = 0.64, rot = 0) {
  const mat = map
    ? new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        opacity,
        depthWrite: false,
        color: 0xe0e5db,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        toneMapped: true,
      })
    : paintMat;
  const m = groundPlane(w, d, mat, x, 0.058, z, paintGroup);
  m.rotation.z = rot;
  m.userData.noOutline = true;
  m.renderOrder = 4;
  return m;
}

// zebra across the main road, in front of the corner
for (let i = 0; i < 6; i++) {
  roadDecal(2.65, 0.62, 3.45, 5.15 + i * 1.02, crosswalkTexture, 0.61);
}
// zebra across the side road
for (let i = 0; i < 4; i++) {
  roadDecal(0.52, 2.25, 5.72 + i * 0.84, 3.12, crosswalkTexture, 0.58);
}

// stop line and stop marking on the side street
roadDecal(3.35, 0.18, 7.05, 1.3, null, 0.52);
const stopMark = roadDecal(2.2, 1.1, 7.05, 0.22, stopMarkTexture, 0.5);
stopMark.rotation.z = 0;

// interrupted centre lines
const laneMat = new THREE.MeshBasicMaterial({ color: 0xcbd4ca, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: true });
function laneDash(w, d, x, z) {
  const m = groundPlane(w, d, laneMat, x, 0.052, z, paintGroup);
  m.userData.noOutline = true;
  m.renderOrder = 4;
}
for (let x = -12.2; x < 1.2; x += 3.5) laneDash(1.75, 0.1, x, 8.7);
for (let x = 5.8; x < 8.4; x += 3.1) laneDash(1.5, 0.1, x, 8.7);
for (let z = -10.0; z < -4.8; z += 3.4) laneDash(0.1, 1.6, 7.05, z);

// one neat parking bay on the quiet side of the main road
const bayMat = new THREE.MeshBasicMaterial({ color: 0xd4dbd1, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: true });
function bayLine(w, d, x, z) {
  const m = groundPlane(w, d, bayMat, x, 0.052, z, paintGroup);
  m.userData.noOutline = true;
  m.renderOrder = 4;
}
bayLine(0.12, 3.35, -11.35, 6.68);
bayLine(0.12, 3.35, -8.95, 6.68);
bayLine(2.5, 0.12, -10.15, 8.3);
bayLine(2.5, 0.12, -10.15, 5.05);
roadDecal(1.0, 1.55, -10.15, 6.7, parkingPTexture, 0.34);
const wheelStop = box(2.2, 0.12, 0.28, toon(0x77827f), -10.15, 0.08, 8.0, paintGroup);
wheelStop.castShadow = true;

// manhole, drain details
const manhole = groundPlane(1.12, 1.12, new THREE.MeshBasicMaterial({ map: manholeTexture }), 0.15, 0.061, 6.4, paintGroup);
manhole.userData.noOutline = true;
const manhole2 = groundPlane(0.82, 0.82, new THREE.MeshBasicMaterial({ map: manholeTexture }), 7.35, 0.061, -8.2, paintGroup);
manhole2.userData.noOutline = true;

registerAssembly(paintGroup, 0.94, { lift: 2.4, drift: 0, spin: 0, duration: 0.9, scaleFrom: 1 });

/* ---------------------------------- the convenience store ---------------------------------- */

const storeGroup = new THREE.Group();
storeGroup.position.set(-3.25, WALK_Y, -3.6);
world.add(storeGroup);

const STORE = {
  w: 10.5,
  d: 8.8,
  front: 4.4,
  back: -4.4,
  left: -5.25,
  right: 5.25,
  h: 4.95,
};

const matWall = toon(0xe9e3d3);
const matWallWarm = toon(0xf4eddd);
const matTeal = toon(0x205c5b);
const matTealDeep = toon(0x143f43);
const matCoral = toon(0xd76d5d);
const matAlu = toon(0x9ca8a8);
const matAluDark = toon(0x4a5558);
const matRoof = toon(0x42545a);
const matCeiling = toon(0xf1eadb);

const foundationGroup = new THREE.Group();
storeGroup.add(foundationGroup);

const storePlinth = box(10.88, 0.17, 9.18, matTealDeep, 0, 0.015, 0, foundationGroup);
storePlinth.receiveShadow = true;
box(10.12, 0.075, 8.48, toon(0xd8cfbc), 0, 0.11, 0, foundationGroup);
box(9.9, 0.035, 8.25, toon(0xf2e4c8), 0, 0.165, 0, foundationGroup);
// a narrow teal stripe running down the aisle of the shop floor
box(1.1, 0.012, 7.8, toon(0x7db5a6), 0.8, 0.186, 0, foundationGroup);
box(0.08, 0.015, 7.8, toon(0xcf9c52), 0.23, 0.188, 0, foundationGroup);
// entrance threshold and mat recess
box(2.55, 0.035, 0.55, toon(0x535a56), 3.7, 0.18, 4.62, foundationGroup);
const entryMatTexture = canvasTexture(768, 384, (ctx, w, h) => {
  ctx.fillStyle = '#273b3a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#a1997e';
  ctx.lineWidth = 7;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.strokeStyle = '#596d64';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(28, 42 + i * 22);
    ctx.lineTo(w - 28, 42 + i * 22);
    ctx.stroke();
  }
  ctx.fillStyle = '#ded1b2';
  ctx.font = '800 40px "Trebuchet MS", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '6px';
  ctx.fillText('WELCOME', w / 2, h / 2 + 2);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#cf8d63';
  ctx.fillRect(w / 2 - 80, h / 2 + 28, 160, 4);
});
const entryMat = new THREE.Mesh(
  new THREE.BoxGeometry(2.32, 0.035, 1.12),
  [
    toon(0x273b3a), toon(0x273b3a), new THREE.MeshBasicMaterial({ map: entryMatTexture }),
    toon(0x273b3a), toon(0x273b3a), toon(0x273b3a),
  ]
);
entryMat.position.set(3.7, 0.0175, 5.05);
entryMat.receiveShadow = true;
foundationGroup.add(entryMat);

registerAssembly(foundationGroup, 1.18, { lift: 4.1, drift: 0.25, spin: 0.03, duration: 0.9 });

const wallsGroup = new THREE.Group();
storeGroup.add(wallsGroup);

// main volume
const backWall = box(10.5, 4.8, 0.25, matWall, 0, 2.46, STORE.back + 0.12, wallsGroup);
const leftWall = box(0.25, 4.8, 8.8, matWall, STORE.left + 0.12, 2.46, 0, wallsGroup);
const rightWall = box(0.25, 4.8, 8.8, matWall, STORE.right - 0.12, 2.46, 0, wallsGroup);

// dark wainscot and pale panel joints
box(10.58, 0.58, 0.08, matTeal, 0, 0.43, STORE.back + 0.26, wallsGroup);
box(0.08, 0.58, 8.82, matTeal, STORE.left + 0.26, 0.43, 0, wallsGroup);
box(0.08, 0.58, 8.82, matTeal, STORE.right - 0.26, 0.43, 0, wallsGroup);
for (const xx of [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0]) {
  box(0.025, 4.0, 0.03, toon(0xcfc6b5), xx, 2.55, STORE.back + 0.252, wallsGroup);
}
for (const zz of [-3.2, -1.7, -0.2, 1.3, 2.8]) {
  box(0.03, 3.1, 0.022, toon(0xd5ccba), STORE.right - 0.252, 2.55, zz, wallsGroup);
}
box(10.55, 0.16, 0.14, matAluDark, 0, 4.86, STORE.back + 0.23, wallsGroup);
box(0.14, 0.16, 8.82, matAluDark, STORE.right - 0.23, 4.86, 0, wallsGroup);
box(0.14, 0.16, 8.82, matAluDark, STORE.left + 0.23, 4.86, 0, wallsGroup);

// front header and columns
const header = box(10.5, 1.82, 0.28, matTealDeep, 0, 4.03, STORE.front - 0.2, wallsGroup);
box(10.55, 0.16, 0.34, matAluDark, 0, 4.99, STORE.front - 0.18, wallsGroup);
for (const xx of [-5.14, 5.14]) {
  box(0.26, 4.9, 0.38, matTeal, xx, 2.55, STORE.front - 0.13, wallsGroup);
  box(0.34, 0.32, 0.46, matAluDark, xx, 0.3, STORE.front - 0.1, wallsGroup);
}
// eave shadow band
box(10.35, 0.18, 0.22, toon(0xb8ac97), 0, 3.19, STORE.front - 0.12, wallsGroup);

// small vents and pipes on the side wall
for (const zz of [-2.8, 1.6]) {
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), matAluDark);
  vent.rotation.z = Math.PI / 2;
  vent.position.set(STORE.right + 0.14, 3.5, zz);
  vent.castShadow = true;
  wallsGroup.add(vent);
  for (let i = 0; i < 4; i++) {
    const bar = box(0.02, 0.22, 0.015, matAlu, STORE.right + 0.18, 3.5, zz - 0.12 + i * 0.08, wallsGroup, false);
    bar.rotation.x = Math.PI / 2;
  }
}

// downspouts
for (const [xx, zz] of [[-5.15, 4.25], [5.15, 4.25], [-5.15, -4.24], [5.15, -4.24]]) {
  cyl(0.075, 0.075, 4.7, matAluDark, xx, 2.55, zz, 8, wallsGroup, false);
}
box(0.05, 0.7, 0.05, matAlu, 5.23, 2.4, 1.15, wallsGroup, false);

registerAssembly(wallsGroup, 1.36, { lift: 5.1, dx: 0.3, duration: 1.1 });

/* ------------------------------ store interior ------------------------------ */

const interiorGroup = new THREE.Group();
storeGroup.add(interiorGroup);

const interiorFloor = box(9.95, 0.06, 8.3, toon(0xf1e5ce), 0, 0.18, 0, interiorGroup);
interiorFloor.receiveShadow = true;
const ceiling = box(10.0, 0.08, 8.35, matCeiling, 0, 4.25, 0, interiorGroup);
const ceilingLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff8e5).multiplyScalar(1.35) });
box(9.8, 0.035, 0.15, ceilingLightMat, -0.2, 4.2, -1.1, interiorGroup, false);
box(9.8, 0.035, 0.15, ceilingLightMat, -0.2, 4.2, 1.4, interiorGroup, false);
box(9.8, 0.035, 0.15, ceilingLightMat, -0.2, 4.2, -3.2, interiorGroup, false);

// back wall colour band
box(9.9, 1.15, 0.03, toon(0x9fc8b9), 0, 3.82, STORE.back + 0.28, interiorGroup, false);

// refrigerated drinks wall
const coolerFrame = new THREE.Group();
coolerFrame.position.set(-1.75, 0.22, STORE.back + 0.31);
interiorGroup.add(coolerFrame);
box(6.35, 3.03, 0.3, matTealDeep, 0, 1.5, 0, coolerFrame);
box(6.55, 0.12, 0.45, matAluDark, 0, 3.07, 0.02, coolerFrame);
const coolerFace = plane(5.95, 2.62, new THREE.MeshBasicMaterial({ map: coolerTexture, toneMapped: true }), 0, 1.45, 0.17, coolerFrame);
markNoOutline(coolerFace);
for (let i = 0; i <= 4; i++) {
  box(0.06, 2.68, 0.06, matAluDark, -2.96 + i * 1.48, 1.46, 0.2, coolerFrame, false);
}
box(6.1, 0.055, 0.07, matAluDark, 0, 2.72, 0.2, coolerFrame, false);
box(6.1, 0.055, 0.07, matAluDark, 0, 2.16, 0.2, coolerFrame, false);
box(6.1, 0.055, 0.07, matAluDark, 0, 1.59, 0.2, coolerFrame, false);
box(6.1, 0.055, 0.07, matAluDark, 0, 1.02, 0.2, coolerFrame, false);
box(6.1, 0.055, 0.07, matAluDark, 0, 0.45, 0.2, coolerFrame, false);
glowSprite(0xc7fff5, 3.5, 0.17, 0, 1.55, 0.45, coolerFrame);

// product shelves, one near the window and one deeper in
function makeShelfUnit(x, z, width, depth, height, levels, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0.2, z);
  const matShelf = toon(0xd7d1c2);
  box(width, 0.09, depth, matShelf, 0, 0.045, 0, g);
  box(width, 0.11, 0.055, matTeal, 0, height, 0, g);
  for (const sx of [-width / 2 + 0.045, width / 2 - 0.045]) {
    box(0.09, height, depth, matShelf, sx, height / 2, 0, g);
  }
  for (let l = 0; l < levels; l++) {
    const yy = 0.22 + l * ((height - 0.25) / Math.max(1, levels - 1));
    box(width - 0.16, 0.045, depth - 0.08, matShelf, 0, yy, 0, g);
    const count = Math.max(4, Math.floor(width / 0.36));
    const prodGeo = new THREE.BoxGeometry(0.19, 0.24, 0.14);
    const prodMat = toon(0xffffff, { noCache: true });
    const inst = new THREE.InstancedMesh(prodGeo, prodMat, count);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const cols = [0xe6755e, 0xe9b458, 0x63a58c, 0x6e8faf, 0xd2d0ba, 0x9c769c, 0xd46f83, 0x7fa15f];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const px = -width / 2 + 0.27 + i * ((width - 0.55) / Math.max(1, count - 1));
      dummy.position.set(px, yy + 0.145, rand(depth / 2 - 0.2, -depth / 2 + 0.24));
      dummy.rotation.y = rand(0.09, -0.09);
      dummy.scale.set(rand(1.15, 0.82), rand(1.1, 0.82), 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, new THREE.Color(pick(cols)));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    g.add(inst);
    // tiny price strip
    box(width - 0.35, 0.028, 0.025, new THREE.MeshBasicMaterial({ color: 0xdce6db }), 0, yy - 0.01, depth / 2 - 0.02, g, false);
  }
  return g;
}

const shelfA = makeShelfUnit(-2.2, 0.35, 4.5, 0.9, 1.6, 3, 1);
const shelfB = makeShelfUnit(-2.7, -1.9, 4.0, 0.9, 1.9, 4, 2);
interiorGroup.add(shelfA, shelfB);

// magazine rack nearest the glass
const magGroup = new THREE.Group();
magGroup.position.set(-3.1, 0.2, 2.8);
interiorGroup.add(magGroup);
box(3.0, 0.1, 0.8, toon(0xd5cfc1), 0, 0.06, 0, magGroup);
for (let row = 0; row < 3; row++) {
  box(3.0, 0.05, 0.63, toon(0xd5cfc1), 0, 0.2 + row * 0.31, 0.03, magGroup);
  for (let i = 0; i < 9; i++) {
    const c = pick([0xe46f5d, 0xe5b252, 0x75a49a, 0x748ca8, 0xe6ddc2, 0xcb7f95]);
    const bx = box(0.24, 0.27, 0.035, toon(c), -1.28 + i * 0.32, 0.36 + row * 0.31, 0.25, magGroup, false);
    bx.rotation.x = -0.15;
    box(0.18, 0.02, 0.005, new THREE.MeshBasicMaterial({ color: 0xf7eedb }), -1.28 + i * 0.32, 0.44 + row * 0.31, 0.27, magGroup, false);
  }
}

// checkout counter and register
const counter = new THREE.Group();
counter.position.set(3.35, 0.2, -2.25);
interiorGroup.add(counter);
box(2.35, 1.05, 0.9, toon(0xe7e1d2), 0, 0.53, 0, counter);
box(2.35, 0.1, 0.96, matTeal, 0, 1.08, 0, counter);
box(2.1, 0.35, 0.04, matTeal, 0, 0.53, 0.462, counter, false);
box(1.0, 0.11, 0.7, matAluDark, 0.35, 1.14, 0.05, counter);
box(0.54, 0.34, 0.06, new THREE.MeshBasicMaterial({ color: 0xa5f0de }), 0.35, 1.38, 0.09, counter);
box(0.56, 0.39, 0.08, matAluDark, 0.35, 1.38, 0.04, counter);
box(0.65, 0.12, 0.45, matAlu, -0.55, 1.13, 0.12, counter);
box(0.16, 0.28, 0.12, toon(0xd8b35b), 0.98, 1.21, 0.26, counter);
box(2.1, 0.06, 0.03, new THREE.MeshBasicMaterial({ color: 0x9adacb }), 0, 0.78, 0.47, counter, false);

// small hanging promo cards near the glass
const promoMatList = [
  new THREE.MeshBasicMaterial({ color: 0xe0a54e }),
  new THREE.MeshBasicMaterial({ color: 0xd96e5d }),
  new THREE.MeshBasicMaterial({ color: 0x73b7a7 }),
];
for (let i = 0; i < 3; i++) {
  const card = plane(0.58, 0.8, promoMatList[i], -0.7 + i * 0.76, 2.95, 3.3, interiorGroup);
  card.userData.noOutline = true;
  const str = cyl(0.008, 0.008, 1.06, matAluDark, -0.7 + i * 0.76, 3.75, 3.3, 5, interiorGroup, false);
  str.rotation.z = 0;
}
glowSprite(0xffe8bd, 4.4, 0.12, 0, 3.15, 0.4, interiorGroup);

registerAssembly(interiorGroup, 1.58, { lift: 3.8, dx: 0.2, duration: 1.12 });

/* ------------------------------ glass shopfront ------------------------------ */

const glassGroup = new THREE.Group();
storeGroup.add(glassGroup);

// small neon "OPEN" hanging inside the window
const openNeonTexture = canvasTexture(768, 320, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = '#73f4dd';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = 'rgba(157,255,236,0.9)';
  ctx.lineWidth = 8;
  canvasRoundRect(ctx, 28, 30, w - 56, h - 60, 28);
  ctx.stroke();
  ctx.fillStyle = '#ebfff8';
  ctx.font = '900 140px "Trebuchet MS", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OPEN', w / 2, h / 2 - 1);
  ctx.shadowColor = '#ff7ea2';
  ctx.shadowBlur = 17;
  ctx.fillStyle = '#ff94ae';
  ctx.font = '800 55px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('24時間', w / 2, h - 65);
  ctx.restore();
});
const openNeon = plane(0.92, 0.38, new THREE.MeshBasicMaterial({
  map: openNeonTexture,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: true,
}), 1.16, 2.56, 4.18, glassGroup);
openNeon.userData.noOutline = true;
openNeon.renderOrder = 6;
tubeBetween(new THREE.Vector3(0.76, 3.12, 4.18), new THREE.Vector3(0.76, 2.75, 4.18), 0.006, matAluDark, glassGroup, 4);
tubeBetween(new THREE.Vector3(1.56, 3.12, 4.18), new THREE.Vector3(1.56, 2.75, 4.18), 0.006, matAluDark, glassGroup, 4);
glowSprite(0x8dffdf, 1.2, 0.15, 1.16, 2.58, 4.3, glassGroup);

// two warm fluorescent bars just inside the glass line
for (const [xx, yy, zz, ww] of [[-3.1, 3.02, 3.45, 4.8], [-3.0, 3.02, 1.85, 4.2]]) {
  box(ww, 0.035, 0.08, new THREE.MeshBasicMaterial({ color: 0xfff4d5 }), xx, yy, zz, glassGroup, false);
}

const glassFrontZ = STORE.front + 0.005;
const paneStart = -5.02;
const paneEnd = 2.25;
const paneSplits = [-5.02, -2.53, -0.04, 2.25];
for (let i = 0; i < paneSplits.length - 1; i++) {
  const a = paneSplits[i];
  const b = paneSplits[i + 1];
  const pane = plane(b - a - 0.08, 2.72, glassMaterial, (a + b) / 2, 1.73, glassFrontZ, glassGroup);
  pane.userData.noOutline = true;
  pane.renderOrder = 5;
}
// glass framing
box(7.3, 0.09, 0.09, matAluDark, (paneStart + paneEnd) / 2, 3.11, STORE.front, glassGroup, false);
box(7.3, 0.12, 0.12, matTeal, (paneStart + paneEnd) / 2, 0.32, STORE.front, glassGroup, false);
for (const xx of paneSplits) {
  box(0.085, 2.8, 0.1, matAluDark, xx, 1.72, STORE.front, glassGroup, false);
}
box(7.3, 0.16, 0.11, matTeal, (paneStart + paneEnd) / 2, 0.42, STORE.front + 0.01, glassGroup, false);

// automatic sliding doors
const doorLeft = 2.55;
const doorRight = 4.72;
box(0.1, 2.85, 0.1, matAluDark, doorLeft, 1.71, STORE.front, glassGroup, false);
box(0.1, 2.85, 0.1, matAluDark, doorRight, 1.71, STORE.front, glassGroup, false);
box(2.27, 0.1, 0.11, matAluDark, (doorLeft + doorRight) / 2, 3.11, STORE.front, glassGroup, false);
box(2.27, 0.12, 0.13, matTeal, (doorLeft + doorRight) / 2, 0.31, STORE.front, glassGroup, false);
for (const xx of [doorLeft, doorRight]) {
  const h = box(0.035, 0.52, 0.05, matAlu, xx + (xx === doorLeft ? 0.25 : -0.25), 1.16, STORE.front + 0.02, glassGroup, false);
  h.rotation.z = 0;
}
const doorCenter = (doorLeft + doorRight) / 2;
const doorPaneL = plane(1.0, 2.7, glassMaterial, doorCenter - 0.52, 1.7, glassFrontZ + 0.01, glassGroup);
const doorPaneR = plane(1.0, 2.7, glassMaterial, doorCenter + 0.52, 1.7, glassFrontZ + 0.01, glassGroup);
for (const p of [doorPaneL, doorPaneR]) { p.userData.noOutline = true; p.renderOrder = 5; }
box(0.035, 2.68, 0.055, matAlu, doorCenter, 1.7, STORE.front + 0.035, glassGroup, false);
// automatic door sensor
box(0.55, 0.12, 0.18, matAluDark, doorCenter, 3.15, STORE.front + 0.06, glassGroup);
const sensorEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe58d6e }));
sensorEye.position.set(doorCenter, 3.15, STORE.front + 0.16);
glassGroup.add(sensorEye);

const stickerMat = new THREE.MeshBasicMaterial({
  map: doorStickerTexture,
  transparent: true,
  depthWrite: false,
  toneMapped: true,
});
const doorStickers = plane(2.25, 1.13, stickerMat, doorCenter, 1.0, STORE.front + 0.04, glassGroup);
doorStickers.renderOrder = 6;
doorStickers.userData.noOutline = true;

const bannerMat = new THREE.MeshBasicMaterial({
  map: windowBannerTexture,
  transparent: true,
  depthWrite: false,
  toneMapped: true,
});
const windowBanner = plane(3.85, 0.62, bannerMat, -3.1, 1.22, STORE.front + 0.035, glassGroup);
windowBanner.renderOrder = 6;
windowBanner.userData.noOutline = true;

// window "OPEN" and small service stickers
const windowStickerTexture = canvasTexture(768, 320, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(240,232,211,0.93)';
  canvasRoundRect(ctx, 12, 20, 276, 146, 14);
  ctx.fill();
  ctx.fillStyle = '#1d5559';
  ctx.font = '900 60px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATM', 150, 92);
  ctx.font = '700 27px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('24時間', 150, 134);
  ctx.fillStyle = 'rgba(241,229,207,0.92)';
  canvasRoundRect(ctx, 316, 20, 420, 146, 14);
  ctx.fill();
  ctx.fillStyle = '#1d5559';
  ctx.font = '800 40px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('コピー・FAX', 525, 82);
  ctx.fillStyle = '#bf6653';
  ctx.font = '700 27px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('宅配便 受付中', 525, 128);
});
const windowSticker = plane(2.25, 0.95, new THREE.MeshBasicMaterial({
  map: windowStickerTexture, transparent: true, depthWrite: false, toneMapped: true,
}), -1.3, 2.56, STORE.front + 0.045, glassGroup);
windowSticker.userData.noOutline = true;
windowSticker.renderOrder = 6;

// a long, faint reflection slash across the glass
const glareTexture = canvasTexture(1024, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, h, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.38, 'rgba(219,255,246,0)');
  g.addColorStop(0.47, 'rgba(221,252,245,0.28)');
  g.addColorStop(0.53, 'rgba(229,255,250,0.15)');
  g.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(225,255,249,0.18)';
    ctx.lineWidth = rand(6, 2);
    ctx.beginPath();
    ctx.moveTo(-100 + i * 230, h);
    ctx.lineTo(500 + i * 230, 0);
    ctx.stroke();
  }
});
const glareMat = new THREE.MeshBasicMaterial({
  map: glareTexture,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  opacity: 0.26,
  side: THREE.DoubleSide,
  toneMapped: true,
});
const glare = plane(7.1, 2.6, glareMat, -1.35, 1.8, STORE.front + 0.07, glassGroup);
glare.userData.noOutline = true;
glare.renderOrder = 7;

// door decals under the glass
const doorLine = box(2.2, 0.02, 0.03, matAlu, doorCenter, 0.42, STORE.front + 0.05, glassGroup, false);

registerAssembly(glassGroup, 1.72, { lift: 3.6, dx: -0.2, duration: 1.05 });

/* ------------------------------ signs & canopy ------------------------------ */

const signGroup = new THREE.Group();
storeGroup.add(signGroup);

// fascia light box
box(9.65, 1.78, 0.18, toon(0xf2e8d4), 0, 4.0, STORE.front + 0.03, signGroup);
const mainSignMat = new THREE.MeshBasicMaterial({ map: mainSignTexture, toneMapped: true });
const mainSign = plane(9.34, 1.67, mainSignMat, 0, 4.0, STORE.front + 0.14, signGroup);
mainSign.userData.noOutline = false;
box(9.74, 0.07, 0.24, matTeal, 0, 4.92, STORE.front + 0.1, signGroup);
box(9.74, 0.07, 0.24, matTeal, 0, 3.08, STORE.front + 0.1, signGroup);
// a strip of fluorescent uplight under the fascia
box(9.4, 0.03, 0.06, new THREE.MeshBasicMaterial({ color: 0xffe8ba }), 0, 3.12, STORE.front + 0.18, signGroup, false);
glowSprite(0xffe3ae, 8.2, 0.18, 0, 4.05, STORE.front + 0.55, signGroup);
glowSprite(0x8cebda, 5.0, 0.08, 0, 3.12, STORE.front + 1.8, signGroup);

// side light box
const sideSign = new THREE.Group();
sideSign.position.set(STORE.right + 0.12, 3.3, 2.2);
sideSign.rotation.y = Math.PI / 2;
signGroup.add(sideSign);
box(3.2, 1.64, 0.14, matTealDeep, 0, 0, 0, sideSign);
const sideSignFace = plane(3.06, 1.51, new THREE.MeshBasicMaterial({ map: sideSignTexture, toneMapped: true }), 0, 0, 0.08, sideSign);
sideSignFace.userData.noOutline = false;
glowSprite(0xd8fff2, 1.8, 0.15, 0, 0.1, 0.5, sideSign);

// projecting 24h blade sign at the front corner
const blade = new THREE.Group();
blade.position.set(STORE.right + 0.62, 3.82, STORE.front + 0.28);
signGroup.add(blade);
box(0.12, 2.15, 0.92, matTealDeep, 0, 0, 0, blade);
const bladeFace = plane(0.82, 2.02, new THREE.MeshBasicMaterial({ map: bladeSignTexture, toneMapped: true }), 0.07, 0, 0, blade);
bladeFace.rotation.y = Math.PI / 2;
bladeFace.userData.noOutline = false;
const bladeFaceBack = plane(0.82, 2.02, new THREE.MeshBasicMaterial({ map: bladeSignTexture, toneMapped: true }), -0.07, 0, 0, blade);
bladeFaceBack.rotation.y = -Math.PI / 2;
box(0.12, 0.07, 1.25, matAluDark, -0.62, 0.74, 0, blade);
tubeBetween(new THREE.Vector3(-0.02, 0.75, 0), new THREE.Vector3(-0.7, 0.4, 0), 0.025, matAluDark, blade, 5);
glowSprite(0xffb9a3, 1.8, 0.25, 0, 0.1, 0.5, blade);

// canopy over the pavement
const canopy = new THREE.Group();
canopy.position.set(0, 0, 0);
signGroup.add(canopy);
const canopyBox = new THREE.Mesh(
  new RoundedBoxGeometry(11.15, 0.16, 1.95, 2, 0.05),
  new THREE.MeshStandardMaterial({ color: 0x274f50, roughness: 0.45, metalness: 0.15 })
);
canopyBox.position.set(0, 3.22, STORE.front + 0.98);
canopyBox.castShadow = true;
canopyBox.receiveShadow = true;
canopy.add(canopyBox);
const canopyTopMat = new THREE.MeshBasicMaterial({ map: awningStripeTexture, toneMapped: true });
const canopyTop = plane(11.0, 1.82, canopyTopMat, 0, 3.307, STORE.front + 0.98, canopy);
canopyTop.rotation.x = -Math.PI / 2;
markNoOutline(canopyTop);
const canopyFront = plane(11.0, 0.26, new THREE.MeshBasicMaterial({ map: awningStripeTexture, toneMapped: true }), 0, 3.23, STORE.front + 1.94, canopy);
canopyFront.userData.noOutline = true;
// shallow, hidden cantilever ribs under the canopy
for (const xx of [-4.8, 4.65]) {
  tubeBetween(new THREE.Vector3(xx, 3.26, STORE.front + 0.04), new THREE.Vector3(xx, 3.22, STORE.front + 1.78), 0.022, matAluDark, canopy, 5);
}
// warm downlights under the awning
const canopyLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0ce).multiplyScalar(1.18) });
for (const xx of [-4.25, -2.1, 0.2, 2.5, 4.35]) {
  cyl(0.05, 0.05, 0.025, canopyLightMat, xx, 3.13, STORE.front + 1.04, 10, canopy, false);
  glowSprite(0xffe0b2, 0.65, 0.35, xx, 3.08, STORE.front + 1.04, canopy);
}
box(10.7, 0.035, 0.05, canopyLightMat, 0, 3.12, STORE.front + 1.88, canopy, false);
const neonStripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7df2d7).multiplyScalar(2.0), toneMapped: true });
const warmLEDMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffdba8).multiplyScalar(1.8), toneMapped: true });
box(10.55, 0.026, 0.03, neonStripMat, 0, 3.14, STORE.front + 1.87, canopy, false);
for (const xx of [-5.12, 5.12]) {
  box(0.035, 2.55, 0.035, neonStripMat, xx, 1.7, STORE.front + 0.16, canopy, false);
}
box(7.1, 0.026, 0.035, neonStripMat, -1.36, 0.245, STORE.front + 0.19, signGroup, false);
box(9.6, 0.024, 0.03, warmLEDMat, 0, 4.9, STORE.front + 0.16, signGroup, false);
box(9.6, 0.024, 0.03, warmLEDMat, 0, 3.14, STORE.front + 0.16, signGroup, false);
box(0.025, 1.8, 0.03, neonStripMat, 4.78, 4.03, STORE.front + 0.16, signGroup, false);
box(0.025, 1.8, 0.03, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a73).multiplyScalar(1.75), toneMapped: true }), -4.78, 4.03, STORE.front + 0.16, signGroup, false);
glowSprite(0x6ff0d3, 5.0, 0.1, -1.35, 0.36, STORE.front + 0.45, signGroup);

registerAssembly(signGroup, 2.05, { lift: 4.2, dx: -0.25, duration: 1.15 });

/* ------------------------------ rooftop plant ------------------------------ */

const roofGroup = new THREE.Group();
storeGroup.add(roofGroup);
const roofSlab = box(10.86, 0.2, 9.14, matRoof, 0, 5.08, 0, roofGroup);
roofSlab.receiveShadow = true;
const roofSurface = plane(10.4, 8.7, new THREE.MeshStandardMaterial({
  color: 0x3f4d52, roughness: 0.49, metalness: 0.28,
}), 0, 5.185, 0, roofGroup);
roofSurface.rotation.x = -Math.PI / 2;
// low parapet edges
box(10.9, 0.26, 0.14, matAluDark, 0, 5.25, -4.5, roofGroup);
box(0.14, 0.26, 9.1, matAluDark, -5.36, 5.25, 0, roofGroup);
box(0.14, 0.26, 9.1, matAluDark, 5.36, 5.25, 0, roofGroup);
// roof access box and vent
box(1.65, 0.9, 1.15, toon(0x6b7779), 2.9, 5.61, -2.35, roofGroup);
box(1.72, 0.09, 1.22, toon(0x2d3e42), 2.9, 6.09, -2.35, roofGroup);
const roofFan = new THREE.Mesh(new THREE.CircleGeometry(0.31, 18), toon(0x1b282e));
roofFan.position.set(2.89, 5.61, -1.77);
roofGroup.add(roofFan);
for (let i = 0; i < 3; i++) box(0.5, 0.025, 0.035, matAlu, 2.9, 5.61, -1.75, roofGroup, false).rotation.z = (i * Math.PI) / 3;
box(1.35, 0.72, 1.0, toon(0x7b8787), -3.55, 5.5, -2.75, roofGroup);
box(1.42, 0.08, 1.06, toon(0x31434a), -3.55, 5.88, -2.75, roofGroup);
const roofFan2 = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), toon(0x26363b));
roofFan2.position.set(-3.55, 5.5, -2.24);
roofGroup.add(roofFan2);
for (const [x, z, h] of [[-4.3, -3.7, 0.85], [1.8, -3.5, 1.4], [4.0, 1.4, 0.6]]) {
  const p = cyl(0.08, 0.1, h, matAluDark, x, 5.2 + h / 2, z, 9, roofGroup, false);
  cyl(0.18, 0.18, 0.06, matAlu, x, 5.21 + h, z, 10, roofGroup, false);
}
const antennaMast = cyl(0.035, 0.04, 2.8, matAluDark, -1.0, 6.6, -3.35, 7, roofGroup, false);
box(1.55, 0.035, 0.035, matAlu, -1.0, 7.5, -3.35, roofGroup, false);
box(0.035, 0.035, 0.9, matAlu, -1.0, 7.16, -3.35, roofGroup, false);
// little roof puddle
const roofPuddle = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), puddleMaterial);
roofPuddle.rotation.x = -Math.PI / 2;
roofPuddle.scale.set(1.6, 0.45, 1);
roofPuddle.position.set(1.1, 5.19, 0.4);
roofPuddle.userData.noOutline = true;
roofGroup.add(roofPuddle);
roofGroup.position.y = 3.06;
registerAssembly(roofGroup, 2.72, { lift: 6.2, dz: 0.2, duration: 0.95 });

const roofDetailGroup = new THREE.Group();
storeGroup.add(roofDetailGroup);
// a little rooftop rail
for (let i = 0; i < 5; i++) {
  cyl(0.018, 0.018, 0.62, matAluDark, -4.8 + i * 1.3, 5.52, -4.56, 5, roofDetailGroup, false);
}
tubeBetween(new THREE.Vector3(-4.8, 5.8, -4.56), new THREE.Vector3(0.4, 5.8, -4.56), 0.02, matAluDark, roofDetailGroup, 5);
// satellite dish
const dish = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 10, 0, TAU, 0, Math.PI * 0.36), toon(0xb8c2c0));
dish.rotation.x = -0.8;
dish.rotation.z = 0.5;
dish.position.set(3.4, 5.8, 1.7);
roofDetailGroup.add(dish);
cyl(0.035, 0.035, 0.55, matAluDark, 3.4, 5.45, 1.7, 6, roofDetailGroup, false);
box(1.1, 0.08, 0.7, toon(0x5a6667), -3.2, 5.22, 2.2, roofDetailGroup);
roofDetailGroup.position.y = 3.06;
registerAssembly(roofDetailGroup, 2.86, { lift: 5.0, dx: 0.2, duration: 0.8 });

/* ------------------------------ store wall extras ------------------------------ */

const storeWallGroup = new THREE.Group();
storeGroup.add(storeWallGroup);

// side wall service panel and a humble side door
box(2.1, 2.5, 0.08, toon(0xd9d2c0), STORE.right + 0.14, 1.45, -2.55, storeWallGroup, false);
box(1.65, 2.16, 0.05, matTealDeep, STORE.right + 0.19, 1.3, -2.55, storeWallGroup, false);
box(1.2, 0.5, 0.04, new THREE.MeshBasicMaterial({ color: 0x436e6b }), STORE.right + 0.22, 1.95, -2.55, storeWallGroup, false);
box(0.2, 0.05, 0.05, matAlu, STORE.right + 0.26, 1.48, -2.1, storeWallGroup, false);
// small wall lamp above the service door
box(0.06, 0.2, 0.06, matAluDark, STORE.right + 0.24, 2.98, -2.55, storeWallGroup, false);
const wallLamp = box(0.22, 0.18, 0.32, new THREE.MeshBasicMaterial({ color: 0xffd79c }), STORE.right + 0.29, 2.84, -2.55, storeWallGroup, false);
glowSprite(0xffd092, 1.0, 0.3, STORE.right + 0.34, 2.84, -2.55, storeWallGroup);

// poster on the side wall
const sidePoster = plane(1.25, 1.75, new THREE.MeshBasicMaterial({ map: posterTexture, toneMapped: true }), STORE.right + 0.15, 2.15, 0.65, storeWallGroup);
sidePoster.rotation.y = Math.PI / 2;
markNoOutline(sidePoster);

// store wall lamp above side sign
box(0.18, 0.12, 0.7, matAluDark, STORE.right + 0.19, 4.45, 2.2, storeWallGroup, false);
const sideLamp = box(0.12, 0.05, 0.55, new THREE.MeshBasicMaterial({ color: 0xffe2b6 }), STORE.right + 0.26, 4.39, 2.2, storeWallGroup, false);
glowSprite(0xffd69e, 1.3, 0.25, STORE.right + 0.32, 4.35, 2.2, storeWallGroup);

// security camera, tucked under the front eave
const camGroup = new THREE.Group();
camGroup.position.set(STORE.right - 0.5, 3.03, STORE.front + 0.24);
storeWallGroup.add(camGroup);
box(0.24, 0.14, 0.32, toon(0xd9dcd4), 0, 0, 0, camGroup);
const camLens = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), new THREE.MeshBasicMaterial({ color: 0x6f141c }));
camLens.position.set(-0.13, 0, 0);
camLens.rotation.y = -Math.PI / 2;
camGroup.add(camLens);
box(0.04, 0.34, 0.04, matAluDark, 0.08, 0.2, 0, camGroup, false);

// stacked crates by the side door
for (let i = 0; i < 3; i++) {
  const crate = box(0.48, 0.28, 0.62, i === 2 ? toon(0x7d5a42) : toon(0xa88e69), STORE.right + 0.52, 0.34 + i * 0.285, -1.7, storeWallGroup);
  crate.rotation.y = rand(0.07, -0.07);
}
// service-side dressing on the alley wall
const leftService = new THREE.Group();
storeWallGroup.add(leftService);
box(0.08, 2.0, 0.94, matTealDeep, -5.28, 1.17, -3.05, leftService);
box(0.04, 1.8, 0.76, toon(0x4d6462), -5.33, 1.19, -3.05, leftService, false);
box(0.03, 0.4, 0.58, new THREE.MeshBasicMaterial({ color: 0x9bc3b6 }), -5.36, 1.79, -3.05, leftService, false);
box(0.5, 0.06, 0.06, matAlu, -5.38, 1.13, -2.72, leftService, false);
const staffSignTexture = canvasTexture(512, 192, (ctx, w, h) => {
  ctx.fillStyle = '#dce2d2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#3d5957';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = '#355452';
  ctx.font = '800 53px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STAFF ONLY', w / 2, h / 2 - 9);
  ctx.fillStyle = '#7b8e84';
  ctx.font = '600 27px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('関係者以外立入禁止', w / 2, h / 2 + 46);
});
const staffSign = plane(0.72, 0.27, new THREE.MeshBasicMaterial({ map: staffSignTexture, toneMapped: true }), -5.365, 1.53, -3.05, leftService);
staffSign.rotation.y = -Math.PI / 2;
staffSign.userData.noOutline = true;
// wall lamp over the alley door
box(0.2, 0.1, 0.1, matAluDark, -5.35, 2.98, -3.05, leftService, false);
box(0.1, 0.18, 0.24, new THREE.MeshBasicMaterial({ color: 0xffd6a1 }), -5.43, 2.84, -3.05, leftService, false);
glowSprite(0xffc98d, 1.4, 0.26, -5.5, 2.83, -3.05, leftService);
// service air-conditioner and its copper lines
const sideAC = new THREE.Group();
sideAC.position.set(-5.42, 1.7, -0.65);
storeWallGroup.add(sideAC);
roundedBox(0.38, 0.58, 0.92, 0.045, toon(0xaab2ad), 0, 0, 0, sideAC, 2);
const sideFan = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 5, 18), matAluDark);
sideFan.rotation.y = Math.PI / 2;
sideFan.position.set(-0.2, 0.02, 0.18);
sideAC.add(sideFan);
for (let i = 0; i < 4; i++) {
  box(0.015, 0.3, 0.015, matAluDark, -0.21, 0.02, 0.18, sideAC, false).rotation.z = (i * Math.PI) / 4;
}
for (let i = 0; i < 4; i++) box(0.02, 0.02, 0.54, matAluDark, -0.21, -0.2 + i * 0.035, -0.12, sideAC, false);
tubeBetween(new THREE.Vector3(-5.38, 1.38, -0.24), new THREE.Vector3(-5.38, 0.56, -0.1), 0.022, matAluDark, storeWallGroup, 5);
tubeBetween(new THREE.Vector3(-5.38, 1.38, -0.3), new THREE.Vector3(-5.38, 0.56, -0.18), 0.022, matAluDark, storeWallGroup, 5);
// conduit, meter box and old posters
cyl(0.03, 0.03, 3.4, matAluDark, -5.28, 2.25, 1.55, 6, storeWallGroup, false);
box(0.16, 0.42, 0.3, toon(0x8b948d), -5.34, 3.1, 1.55, storeWallGroup);
box(0.16, 0.22, 0.22, toon(0xabb1a8), -5.34, 2.35, 1.55, storeWallGroup);
const leftPoster = plane(0.72, 1.02, new THREE.MeshBasicMaterial({ map: posterTexture, toneMapped: true }), -5.365, 2.25, 0.35, storeWallGroup);
leftPoster.rotation.y = -Math.PI / 2;
markNoOutline(leftPoster);
glowSprite(0xffb989, 1.2, 0.12, -5.46, 1.9, -3.05, leftService);

registerAssembly(storeWallGroup, 2.15, { lift: 3.4, dz: -0.2, duration: 0.9 });

/* ---------------------------------- second-floor apartments ---------------------------------- */

const upperWindowTexture = canvasTexture(640, 480, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffe8b3');
  g.addColorStop(0.4, '#edc985');
  g.addColorStop(1, '#a77e54');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(68,50,38,0.72)';
  ctx.fillRect(0, 0, w, 25);
  ctx.fillStyle = 'rgba(75,65,55,0.35)';
  for (let i = 0; i < 9; i++) ctx.fillRect(0, 60 + i * 39, w, 7);
  // curtains
  ctx.fillStyle = 'rgba(222,209,183,0.78)';
  ctx.beginPath();
  ctx.moveTo(0, 25);
  ctx.bezierCurveTo(84, 100, 42, 230, 100, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 25);
  ctx.bezierCurveTo(w - 104, 98, w - 34, 240, w - 92, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(109,90,67,0.22)';
  ctx.lineWidth = 3;
  for (const xx of [w * 0.33, w * 0.66]) {
    ctx.beginPath();
    ctx.moveTo(xx, 0);
    ctx.lineTo(xx, h);
    ctx.stroke();
  }
  // silhouette of a little plant on the sill
  ctx.fillStyle = 'rgba(44,42,31,0.72)';
  ctx.fillRect(w - 136, h - 100, 88, 62);
  ctx.fillStyle = 'rgba(59,82,54,0.85)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(w - 118 + i * 21, h - 140 - (i % 2) * 20, 13, 37, 0.5 - i * 0.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,246,213,0.18)';
  ctx.fillRect(0, 0, w, h);
});

const upperGroup = new THREE.Group();
storeGroup.add(upperGroup);

// slab and a small eave that separates shop from apartments
box(10.68, 0.17, 8.95, matRoof, 0, 5.06, 0, upperGroup);
box(10.82, 0.14, 0.52, matTealDeep, 0, 5.1, STORE.front - 0.07, upperGroup);
box(10.25, 2.92, 8.18, toon(0x858477), 0, 6.58, -0.02, upperGroup);
// aged timber and plaster panelling on the apartments
for (const yy of [5.36, 7.69]) box(10.0, 0.1, 0.08, toon(0x5e4a39), 0, yy, 4.07, upperGroup);
box(9.9, 0.26, 0.08, toon(0x65513e), 0, 5.3, 4.07, upperGroup);
box(9.95, 0.04, 0.05, toon(0xc9bea7), 0, 5.56, 4.08, upperGroup, false);
for (const xx of [-4.82, -4.55, 4.55, 4.82]) {
  box(0.07, 2.8, 0.06, toon(0x4f3d31), xx, 6.58, 4.08, upperGroup);
}
const upperWinMat = new THREE.MeshBasicMaterial({ map: upperWindowTexture, color: 0xcdbfa7, toneMapped: true });
// windows and their deep timber frames
const windowPositions = [-3.15, -0.15, 2.85];
for (const [idx, wx] of windowPositions.entries()) {
  box(1.83, 1.36, 0.1, toon(0x3f2f26), wx, 6.55, 4.04, upperGroup);
  plane(1.65, 1.18, upperWinMat, wx, 6.55, 4.11, upperGroup);
  box(0.07, 1.26, 0.06, toon(0x3a2c23), wx, 6.55, 4.13, upperGroup, false);
  // little metal rain hood
  const hood = box(1.98, 0.075, 0.5, matTealDeep, wx, 7.31, 4.2, upperGroup);
  hood.rotation.x = 0.14;
  for (const bx of [-0.82, 0.82]) {
    tubeBetween(new THREE.Vector3(wx + bx, 7.16, 4.11), new THREE.Vector3(wx + bx, 7.25, 4.33), 0.023, matAluDark, upperGroup, 4);
  }
  // a shallow sill with a tiny planter on the middle window
  box(1.95, 0.1, 0.28, toon(0x8d8573), wx, 5.84, 4.16, upperGroup);
  if (idx === 1) {
    box(0.46, 0.26, 0.25, toon(0x6a5b49), wx + 0.42, 6.01, 4.24, upperGroup);
    const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), toon(0x4d7050));
    plant.position.set(wx + 0.42, 6.22, 4.24);
    plant.castShadow = true;
    upperGroup.add(plant);
  }
}
// side windows facing the street
for (const [zz, yy, ww, hh] of [[-0.95, 6.45, 1.2, 0.92], [-2.95, 6.4, 1.0, 0.8]]) {
  box(0.1, hh + 0.14, ww + 0.14, toon(0x3f2f26), 5.12, yy, zz, upperGroup);
  const f = plane(ww, hh, upperWinMat, 5.19, yy, zz, upperGroup);
  f.rotation.y = Math.PI / 2;
  box(0.04, 0.05, ww, toon(0x3a2c23), 5.21, yy, zz, upperGroup, false);
  box(0.5, 0.06, ww + 0.24, matTealDeep, 5.22, yy + 0.64, zz, upperGroup);
  box(0.25, 0.08, ww + 0.24, toon(0x8d8573), 5.2, yy - hh / 2 - 0.06, zz, upperGroup);
}

// a small wooden apartment sign
const apartmentPlateTexture = canvasTexture(512, 192, (ctx, w, h) => {
  ctx.fillStyle = '#5b4a39';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d7c8a7';
  ctx.lineWidth = 7;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.fillStyle = '#eadfc7';
  ctx.font = '800 74px "Yu Gothic", "Meiryo", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('月見荘', w / 2, h / 2 + 5);
});
const apartmentPlate = plane(0.9, 0.34, new THREE.MeshBasicMaterial({ map: apartmentPlateTexture, toneMapped: true }), -4.35, 5.62, 4.13, upperGroup);
// exterior wall AC on the right flank
const upperAC = new THREE.Group();
upperAC.position.set(5.33, 6.1, 1.5);
upperGroup.add(upperAC);
roundedBox(0.38, 0.64, 0.98, 0.045, toon(0x596661), 0, 0, 0, upperAC, 2);
const upperFan = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 5, 18), toon(0x222f31));
upperFan.position.set(0.195, 0.01, -0.14);
upperFan.rotation.y = Math.PI / 2;
upperAC.add(upperFan);
for (let i = 0; i < 4; i++) {
  const bar = box(0.015, 0.38, 0.015, toon(0x2a3738), 0.2, 0.01, -0.14, upperAC, false);
  bar.rotation.x = (i * Math.PI) / 4;
}
for (let i = 0; i < 4; i++) box(0.02, 0.02, 0.6, toon(0x2a3738), 0.2, -0.24 + i * 0.04, 0.12, upperAC, false);
cyl(0.025, 0.025, 0.55, matAluDark, 0.18, -0.4, -0.42, 6, upperAC, false);
const upperWarmLight = new THREE.PointLight(0xffbb82, 7, 5, 2);
upperWarmLight.position.set(-0.2, 6.8, 4.2);
upperGroup.add(upperWarmLight);
// downpipes and a warm wall light
cyl(0.045, 0.045, 2.85, matAluDark, 4.82, 6.55, 4.16, 6, upperGroup, false);
cyl(0.045, 0.045, 2.85, matAluDark, -4.82, 6.55, 4.16, 6, upperGroup, false);
box(0.18, 0.1, 0.12, matAluDark, -4.25, 7.3, 4.17, upperGroup, false);
box(0.12, 0.16, 0.06, new THREE.MeshBasicMaterial({ color: 0xffe0aa }), -4.25, 7.18, 4.23, upperGroup, false);
glowSprite(0xffcc8a, 1.15, 0.2, -4.25, 7.18, 4.35, upperGroup);
// rear apartment window, so the model still reads from the service side
box(1.55, 1.15, 0.09, toon(0x3f2f26), -1.3, 6.5, -4.1, upperGroup);
const rearWin = plane(1.4, 1.0, upperWinMat, -1.3, 6.5, -4.16, upperGroup);
rearWin.rotation.y = Math.PI;
box(1.7, 0.08, 0.4, matTealDeep, -1.3, 7.12, -4.18, upperGroup);

registerAssembly(upperGroup, 2.42, { lift: 5.0, dx: 0.15, duration: 1.05 });

/* ---------------------------------- little signs & props ---------------------------------- */

const lampBannerTexture = canvasTexture(256, 768, (ctx, w, h) => {
  ctx.fillStyle = '#e7e3cf';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#25565a';
  ctx.fillRect(0, 0, w, 91);
  ctx.fillStyle = '#e9b45f';
  ctx.fillRect(0, 91, w, 12);
  ctx.fillStyle = '#eef1e6';
  ctx.font = '900 55px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('月見町', w / 2, 65);
  ctx.fillStyle = '#25565a';
  ctx.font = '900 95px "Yu Gothic", "Meiryo", sans-serif';
  ['商', '店', '街'].forEach((c, i) => ctx.fillText(c, w / 2, 220 + i * 140));
  ctx.fillStyle = '#d46d5b';
  ctx.font = '700 27px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('TSUKIMI', w / 2, 700);
  ctx.fillStyle = '#8f8a78';
  ctx.font = '600 18px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('SHOPPING STREET', w / 2, 728);
});

const izakayaSignTexture = canvasTexture(384, 1024, (ctx, w, h) => {
  ctx.fillStyle = '#17242a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d9d0b7';
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.save();
  ctx.shadowColor = '#ff7991';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#ffe9d4';
  ctx.font = '900 88px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('酒', w / 2, 208);
  ctx.fillText('処', w / 2, 318);
  ctx.shadowColor = '#64e2cf';
  ctx.fillStyle = '#ff8fa0';
  ctx.fillText('ゆ', w / 2, 514);
  ctx.fillText('き', w / 2, 624);
  ctx.restore();
  ctx.fillStyle = '#73d1c1';
  ctx.fillRect(58, 720, w - 116, 5);
  ctx.fillStyle = '#f0e6cf';
  ctx.font = '700 32px "Trebuchet MS", "Arial", sans-serif';
  ctx.fillText('YUKI', w / 2, 792);
  ctx.fillStyle = '#c3b89e';
  ctx.font = '600 23px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('営業中', w / 2, 894);
});

const binLabelTexture = canvasTexture(512, 384, (ctx, w, h) => {
  ctx.fillStyle = '#e7e7dc';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#285e5d';
  ctx.fillRect(0, 0, w, 70);
  ctx.fillStyle = '#f2eddd';
  ctx.font = '800 36px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('資源ごみ', w / 2, 36);
  ctx.strokeStyle = '#5d7d78';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(w / 2, 177, 66, 0, TAU);
  ctx.stroke();
  ctx.font = '800 32px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('かん・びん', w / 2, 175);
  ctx.fillStyle = '#6d7f79';
  ctx.font = '600 24px "Yu Gothic", "Meiryo", sans-serif';
  ctx.fillText('空き缶・ペットボトル', w / 2, 298);
});

/* ---------------------------------- street lamp ---------------------------------- */

const lampGroup = new THREE.Group();
lampGroup.position.set(-7.75, 0.18, 3.92);
world.add(lampGroup);

const lampMetal = toon(0x243239);
cyl(0.31, 0.4, 0.34, lampMetal, 0, 0.17, 0, 12, lampGroup);
cyl(0.16, 0.29, 0.18, lampMetal, 0, 0.43, 0, 12, lampGroup);
cyl(0.075, 0.12, 6.25, lampMetal, 0, 3.4, 0, 12, lampGroup);
for (let i = 0; i < 3; i++) cyl(0.115, 0.115, 0.06, toon(0x48585c), 0, 0.72 + i * 1.65, 0, 10, lampGroup, false);
const lampCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(0, 6.5, 0),
  new THREE.Vector3(0.05, 6.98, 0.6),
  new THREE.Vector3(0.15, 6.86, 1.65)
);
const lampArm = new THREE.Mesh(new THREE.TubeGeometry(lampCurve, 16, 0.065, 7, false), lampMetal);
lampArm.castShadow = true;
lampGroup.add(lampArm);
const lampCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.42, 0.25, 16), lampMetal);
lampCap.position.set(0.15, 6.75, 1.67);
lampGroup.add(lampCap);
const lampGlass = new THREE.Mesh(
  new THREE.CylinderGeometry(0.34, 0.36, 0.46, 16),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffedc2).multiplyScalar(1.55), toneMapped: true })
);
lampGlass.position.set(0.15, 6.49, 1.67);
lampGroup.add(lampGlass);
cyl(0.025, 0.025, 0.17, lampMetal, 0.15, 6.79, 1.67, 6, lampGroup, false);
glowSprite(0xffd89b, 3.6, 0.6, 0.15, 6.47, 1.67, lampGroup);
glowSprite(0xffd79a, 1.2, 0.76, 0.15, 6.49, 1.67, lampGroup);
const lampLight = new THREE.PointLight(0xffc276, 48, 17, 2);
lampLight.position.set(0.15, 6.35, 1.67);
lampGroup.add(lampLight);

// a soft, painted shaft of warm light through the rain
const shaftTexture = canvasTexture(320, 640, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,236,192,0.54)');
  g.addColorStop(0.24, 'rgba(255,213,147,0.26)');
  g.addColorStop(0.72, 'rgba(255,190,112,0.08)');
  g.addColorStop(1, 'rgba(255,180,100,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.44, 0);
  ctx.lineTo(w * 0.56, 0);
  ctx.lineTo(w * 0.88, h);
  ctx.lineTo(w * 0.12, h);
  ctx.closePath();
  ctx.fill();
  ctx.filter = 'blur(16px)';
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.43, 8);
  ctx.lineTo(w * 0.57, 8);
  ctx.lineTo(w * 0.96, h);
  ctx.lineTo(w * 0.04, h);
  ctx.closePath();
  ctx.fill();
  ctx.filter = 'none';
});
const lampShaft = new THREE.Sprite(new THREE.SpriteMaterial({
  map: shaftTexture,
  color: 0xffc885,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: true,
}));
lampShaft.position.set(0.15, 3.22, 1.67);
lampShaft.scale.set(5.2, 6.4, 1);
lampShaft.material.userData.noOutline = true;
lampShaft.userData.noOutline = true;
lampShaft.renderOrder = 4;
lampGroup.add(lampShaft);

const banner = new THREE.Group();
banner.position.set(0.17, 4.15, 0);
lampGroup.add(banner);
box(0.03, 1.6, 0.54, matTealDeep, 0, 0, 0, banner, false);
const bannerFaceMat = new THREE.MeshBasicMaterial({ map: lampBannerTexture, side: THREE.DoubleSide, toneMapped: true });
const bannerFace = plane(0.48, 1.5, bannerFaceMat, 0, 0, 0.29, banner);
const bannerFace2 = plane(0.48, 1.5, bannerFaceMat, 0, 0, -0.29, banner);
bannerFace2.rotation.y = Math.PI;
box(0.5, 0.03, 0.03, matAluDark, 0, 0.77, 0, banner, false);
box(0.5, 0.03, 0.03, matAluDark, 0, -0.77, 0, banner, false);
markNoOutline(bannerFace);
markNoOutline(bannerFace2);

contactShadow(1.4, 1.0, 0, 0.013, 0, 0.35, lampGroup, 0.1);
registerAssembly(lampGroup, 2.55, { lift: 5.8, dx: -0.6, duration: 1.2 });

/* ---------------------------------- telephone pole, street signs ---------------------------------- */

const poleGroup = new THREE.Group();
poleGroup.position.set(4.9, 0.18, 3.22);
world.add(poleGroup);

const poleMat = toon(0x697575);
const poleMetal = toon(0x253239);
cyl(0.2, 0.31, 9.9, poleMat, 0, 4.95, 0, 12, poleGroup);
for (let i = 0; i < 7; i++) cyl(0.225 - i * 0.007, 0.228 - i * 0.007, 0.04, toon(0x8b9592), 0, 1.55 + i * 1.16, 0, 10, poleGroup, false);
const hazardTexture = canvasTexture(256, 512, (ctx, w, h) => {
  ctx.fillStyle = '#d4a63e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#20272b';
  for (let i = -2; i < 9; i++) {
    ctx.save();
    ctx.translate(0, i * 76);
    ctx.rotate(-0.48);
    ctx.fillRect(-80, 0, w + 160, 31);
    ctx.restore();
  }
});
const hazard = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.37, 1.25, 16), new THREE.MeshBasicMaterial({ map: hazardTexture, toneMapped: true }));
hazard.position.y = 0.95;
poleGroup.add(hazard);
for (let i = 0; i < 12; i++) {
  const peg = cyl(0.012, 0.012, 0.33, poleMetal, 0.32, 1.9 + i * 0.62, 0, 5, poleGroup, false);
  peg.rotation.z = -Math.PI / 2;
}
for (const yy of [7.9, 8.65]) {
  const arm = box(2.35, 0.1, 0.13, poleMetal, 0, yy, 0, poleGroup);
  arm.rotation.y = 0.09;
  for (const xx of [-0.94, -0.45, 0.45, 0.94]) {
    cyl(0.055, 0.045, 0.23, toon(0xa9b5ad), xx, yy + 0.15, 0, 8, poleGroup, false);
    cyl(0.05, 0.05, 0.06, toon(0x3d4e50), xx, yy + 0.29, 0, 8, poleGroup, false);
  }
}
cyl(0.34, 0.34, 1.02, toon(0x707b79), 0.42, 6.75, 0.31, 12, poleGroup);
cyl(0.37, 0.37, 0.06, poleMetal, 0.42, 7.27, 0.31, 12, poleGroup, false);
cyl(0.37, 0.37, 0.06, poleMetal, 0.42, 6.23, 0.31, 12, poleGroup, false);
box(0.48, 0.38, 0.28, toon(0x7f8985), -0.36, 5.9, 0.18, poleGroup);
box(0.3, 0.07, 0.22, poleMetal, -0.36, 5.88, 0.34, poleGroup, false);
for (let i = 0; i < 3; i++) {
  const cable = new THREE.Mesh(new THREE.TorusGeometry(0.36 + i * 0.02, 0.017, 4, 20, Math.PI), toon(0x1b252b));
  cable.position.set(0.04, 5.4, 0.2 + i * 0.03);
  cable.rotation.z = Math.PI;
  poleGroup.add(cable);
}

const streetSign = new THREE.Group();
streetSign.position.set(1.35, 4.4, 0.12);
streetSign.rotation.y = 0.25;
streetSign.scale.setScalar(0.82);
poleGroup.add(streetSign);
box(2.35, 0.58, 0.07, matTealDeep, 0, 0, 0, streetSign);
const streetSignMat = new THREE.MeshBasicMaterial({ map: streetSignTexture, toneMapped: true });
const streetFace = plane(2.22, 0.5, streetSignMat, 0, 0, 0.04, streetSign);
const streetFaceBack = plane(2.22, 0.5, streetSignMat, 0, 0, -0.04, streetSign);
streetFaceBack.rotation.y = Math.PI;
streetFace.userData.noOutline = true;
streetFaceBack.userData.noOutline = true;
box(0.9, 0.04, 0.04, poleMetal, 0.87, 0.31, 0, streetSign, false);

const mirror = new THREE.Group();
mirror.position.set(0.32, 3.35, 0.34);
mirror.rotation.y = -0.68;
mirror.rotation.x = -0.13;
mirror.scale.setScalar(0.7);
poleGroup.add(mirror);
box(0.06, 0.5, 0.06, poleMetal, 0, 0, 0, mirror, false);
const mirrorRim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 8, 32), toon(0xd58d42));
mirrorRim.position.set(0.02, 0.1, 0.12);
mirror.add(mirrorRim);
const mirrorFace = new THREE.Mesh(
  new THREE.CircleGeometry(0.45, 32),
  new THREE.MeshPhysicalMaterial({ color: 0x789097, metalness: 0.92, roughness: 0.15, envMapIntensity: 1.5 })
);
mirrorFace.position.set(0.02, 0.1, 0.13);
mirror.add(mirrorFace);

const noPark = plane(0.56, 0.56, new THREE.MeshBasicMaterial({ map: noParkingTexture, transparent: true, toneMapped: true }), 0, 2.52, 0.32, poleGroup);
const noParkPoster = plane(0.5, 0.72, new THREE.MeshBasicMaterial({ map: posterTexture, toneMapped: true }), 0.25, 1.85, 0.1, poleGroup);
noParkPoster.rotation.y = 0.1;
markNoOutline(noPark);
markNoOutline(noParkPoster);
box(0.03, 0.68, 0.03, poleMetal, 0.25, 2.34, 0.06, poleGroup, false);

const armCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(0, 8.15, 0),
  new THREE.Vector3(0.7, 8.55, 0.3),
  new THREE.Vector3(1.65, 8.32, 0.55)
);
const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.04, 6, false), poleMetal);
poleGroup.add(arm);
box(0.52, 0.1, 0.22, poleMetal, 1.68, 8.24, 0.58, poleGroup, false);
box(0.4, 0.03, 0.16, new THREE.MeshBasicMaterial({ color: 0xbce5e1 }), 1.68, 8.18, 0.58, poleGroup, false);
glowSprite(0xa7e6e1, 1.3, 0.22, 1.68, 8.14, 0.58, poleGroup);

contactShadow(1.25, 1.25, 0, 0.013, 0, 0.42, poleGroup, -0.1);
registerAssembly(poleGroup, 2.7, { lift: 7.1, dz: 0.4, duration: 1.25 });

/* ---------------------------------- overhead wires ---------------------------------- */

const wiresGroup = new THREE.Group();
world.add(wiresGroup);
const wireMat = new THREE.MeshBasicMaterial({ color: 0x394650, toneMapped: true });
const wirePositions = [
  [new THREE.Vector3(4.2, 9.15, 3.7), new THREE.Vector3(-11.9, 8.6, -9.3), 1.2],
  [new THREE.Vector3(4.35, 8.93, 3.7), new THREE.Vector3(-11.7, 8.37, -9.3), 1.35],
  [new THREE.Vector3(4.0, 8.7, 3.7), new THREE.Vector3(-11.5, 8.15, -9.3), 1.5],
  [new THREE.Vector3(4.15, 8.48, 3.7), new THREE.Vector3(-11.9, 7.94, -9.3), 1.6],
  [new THREE.Vector3(4.5, 9.4, 3.8), new THREE.Vector3(8.65, 8.15, 3.8), 0.7],
  [new THREE.Vector3(4.5, 9.16, 3.8), new THREE.Vector3(8.65, 7.95, 3.8), 0.82],
  [new THREE.Vector3(4.5, 8.94, 3.8), new THREE.Vector3(8.65, 7.74, 3.8), 0.92],
  [new THREE.Vector3(4.25, 8.62, 3.6), new THREE.Vector3(-3.0, 9.35, -9.8), 0.8],
  [new THREE.Vector3(4.3, 8.4, 3.7), new THREE.Vector3(-1.3, 6.3, -4.0), 0.45],
];
for (const [a, b, sag] of wirePositions) {
  a.x += 0.42;
  a.z -= 0.5;
  wire(a, b, sag, 0.022, wireMat, wiresGroup);
}
wire(new THREE.Vector3(-0.7, 6.3, -3.9), new THREE.Vector3(-1.1, 5.2, -3.45), 0.22, 0.022, wireMat, wiresGroup);
wire(new THREE.Vector3(4.67, 7.65, 3.22), new THREE.Vector3(2.5, 5.1, 1.2), 0.5, 0.018, wireMat, wiresGroup);
wire(new THREE.Vector3(4.67, 7.8, 3.22), new THREE.Vector3(-8.15, 5.5, 2.4), 0.65, 0.017, wireMat, wiresGroup);

// a little crow resting on the long diagonal
const crow = new THREE.Group();
crow.position.set(0.7, 8.15, -1.2);
wiresGroup.add(crow);
const crowMat = toon(0x13191d);
const crowBody = new THREE.Mesh(new THREE.SphereGeometry(0.18, 9, 6), crowMat);
crowBody.scale.set(1.5, 0.85, 0.8);
crowBody.rotation.z = -0.08;
crowBody.castShadow = true;
crow.add(crowBody);
sphere(0.105, crowMat, 0.27, 0.08, 0, crow, 9);
const crowBeak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.17, 5), toon(0x8d7436));
crowBeak.position.set(0.4, 0.07, 0);
crowBeak.rotation.z = -Math.PI / 2;
crow.add(crowBeak);
const crowTail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 5), crowMat);
crowTail.position.set(-0.31, -0.02, 0);
crowTail.rotation.z = Math.PI / 2;
crow.add(crowTail);

registerAssembly(wiresGroup, 3.08, { lift: 5.0, dx: 0, dz: 0, duration: 1.1, scaleFrom: 0.98 });

/* ---------------------------------- guardrails ---------------------------------- */

const guardGroup = new THREE.Group();
world.add(guardGroup);
const guardMat = toon(0xd9ddd0);
function makeGuardrail(length, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const segments = Math.max(1, Math.round(length / 1.95));
  for (let i = 0; i <= segments; i++) {
    const px = -length / 2 + (i * length) / segments;
    cyl(0.065, 0.075, 1.02, guardMat, px, 0.51, 0, 8, g);
    cyl(0.165, 0.2, 0.12, matAluDark, px, 0.06, 0, 8, g);
    box(0.12, 0.11, 0.12, matTeal, px, 1.06, 0, g, false);
  }
  tubeBetween(new THREE.Vector3(-length / 2, 0.88, 0), new THREE.Vector3(length / 2, 0.88, 0), 0.052, guardMat, g, 8);
  tubeBetween(new THREE.Vector3(-length / 2, 0.46, 0), new THREE.Vector3(length / 2, 0.46, 0), 0.035, guardMat, g, 8);
  for (let i = 0; i < segments; i++) {
    const px = -length / 2 + (i + 0.5) * (length / segments);
    box(0.34, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: 0xcfd6c9 }), px, 0.88, 0.058, g, false);
  }
  guardGroup.add(g);
  return g;
}
makeGuardrail(4.3, -9.85, 0.18, 4.36, 0);
makeGuardrail(5.3, -2.55, 0.18, 4.36, 0);
makeGuardrail(5.6, 5.07, 0.18, -3.85, Math.PI / 2);
const cornerGuard = new THREE.Group();
cornerGuard.position.set(4.86, 0.18, 4.17);
guardGroup.add(cornerGuard);
tubeBetween(new THREE.Vector3(0.6, 0.88, 0.3), new THREE.Vector3(0.25, 0.88, 0.65), 0.052, guardMat, cornerGuard, 8);
tubeBetween(new THREE.Vector3(0.6, 0.46, 0.3), new THREE.Vector3(0.25, 0.46, 0.65), 0.035, guardMat, cornerGuard, 8);
cyl(0.06, 0.075, 1.02, guardMat, 0.6, 0.51, 0.3, 8, cornerGuard);
cyl(0.06, 0.075, 1.02, guardMat, 0.25, 0.51, 0.65, 8, cornerGuard);
registerAssembly(guardGroup, 2.7, { lift: 2.3, dx: 0.3, spin: 0.015, duration: 1.0 });

/* ---------------------------------- community notice board ---------------------------------- */

const boardGroup = new THREE.Group();
boardGroup.position.set(-11.25, 0.18, 2.38);
boardGroup.rotation.y = 0.18;
world.add(boardGroup);
const boardWood = toon(0x5b4434);
for (const xx of [-0.85, 0.85]) {
  box(0.12, 2.05, 0.12, boardWood, xx, 1.02, 0, boardGroup);
  box(0.3, 0.09, 0.3, toon(0x9a8a71), xx, 0.045, 0, boardGroup);
}
box(2.02, 1.46, 0.12, toon(0x917659), 0, 1.6, 0, boardGroup);
const boardFace = plane(1.84, 1.3, new THREE.MeshBasicMaterial({ map: noticeBoardTexture, toneMapped: true }), 0, 1.6, 0.075, boardGroup);
boardFace.userData.noOutline = true;
box(2.2, 0.07, 0.22, matTealDeep, 0, 2.41, 0, boardGroup);
const boardRoof = box(2.1, 0.16, 0.64, matTealDeep, 0, 2.5, 0.06, boardGroup);
boardRoof.rotation.x = 0.15;
box(0.32, 0.06, 0.16, new THREE.MeshBasicMaterial({ color: 0xffe1a9 }), 0, 2.45, 0.24, boardGroup, false);
glowSprite(0xffdca8, 0.9, 0.22, 0, 2.4, 0.35, boardGroup);
contactShadow(2.5, 0.7, 0, 0.013, 0, 0.28, boardGroup, 0.18);
registerAssembly(boardGroup, 2.85, { lift: 3.0, dx: -0.5, duration: 1.0 });

/* ---------------------------------- the glowing vending machine ---------------------------------- */

const vendingGroup = new THREE.Group();
vendingGroup.position.set(2.44, 0.18, 1.35);
vendingGroup.rotation.y = Math.PI / 2 - 0.16;
world.add(vendingGroup);

const vendingBody = roundedBox(1.42, 2.08, 0.84, 0.07, toon(0xe8e6db), 0, 1.04, 0, vendingGroup, 3);
box(1.48, 0.09, 0.9, matTealDeep, 0, 2.11, 0, vendingGroup);
box(1.48, 0.045, 0.9, new THREE.MeshBasicMaterial({ color: 0xebd9b2 }), 0, 2.16, 0, vendingGroup, false);
const vendFace = plane(1.27, 1.94, new THREE.MeshBasicMaterial({ map: vendingTexture, toneMapped: true }), 0, 1.07, 0.428, vendingGroup);
vendFace.userData.noOutline = false;
// tactile details
box(0.98, 0.28, 0.08, matAluDark, 0, 0.34, 0.44, vendingGroup, false);
box(0.83, 0.18, 0.04, new THREE.MeshBasicMaterial({ color: 0x0b1012 }), 0, 0.34, 0.49, vendingGroup, false);
box(0.24, 0.1, 0.05, toon(0xbec3b8), 0.43, 0.88, 0.45, vendingGroup, false);
box(0.12, 0.03, 0.04, new THREE.MeshBasicMaterial({ color: 0xe08a68 }), 0.43, 0.95, 0.47, vendingGroup, false);
for (let i = 0; i < 5; i++) {
  const button = box(0.035, 0.055, 0.035, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x78d1c3 : 0xe4ebdc }), -0.48 + i * 0.09, 0.72, 0.46, vendingGroup, false);
}
box(0.06, 0.09, 0.035, new THREE.MeshBasicMaterial({ color: 0xe6c478 }), 0.53, 0.69, 0.45, vendingGroup, false);
glowSprite(0xc7fff2, 2.7, 0.3, 0, 1.2, 0.55, vendingGroup);
// little metal rain hood above the machine
const vendHood = box(1.72, 0.07, 1.04, matTealDeep, 0, 2.45, -0.06, vendingGroup);
vendHood.rotation.x = -0.09;
box(1.62, 0.03, 0.06, new THREE.MeshBasicMaterial({ color: 0xffe5b4 }), 0, 2.39, 0.43, vendingGroup, false);
const vendLight = new THREE.PointLight(0xb8fff1, 9, 7, 2);
vendLight.position.set(0, 1.3, 0.75);
vendingGroup.add(vendLight);
box(1.36, 0.026, 0.03, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x86ffe5).multiplyScalar(2.1) }), 0, 2.19, 0.43, vendingGroup, false);
contactShadow(1.9, 1.4, 0, 0.013, 0, 0.5, vendingGroup, Math.PI / 2);
registerAssembly(vendingGroup, 2.92, { lift: 3.2, dz: 0.35, dx: 0.2, duration: 1.0 });

/* ---------------------------------- recycling station ---------------------------------- */

const binGroup = new THREE.Group();
binGroup.position.set(-2.22, 0.18, 1.38);
binGroup.rotation.y = 0.04;
world.add(binGroup);
function recyclingBin(x, bodyColor, lidColor, label) {
  const g = new THREE.Group();
  g.position.set(x, 0, 0);
  binGroup.add(g);
  roundedBox(0.43, 0.76, 0.43, 0.04, toon(bodyColor), 0, 0.38, 0, g, 2);
  box(0.47, 0.09, 0.47, toon(lidColor), 0, 0.78, 0, g);
  box(0.25, 0.09, 0.24, matAluDark, 0, 0.8, 0.08, g, false);
  const lbl = plane(0.31, 0.3, new THREE.MeshBasicMaterial({ map: label, toneMapped: true }), 0, 0.52, 0.218, g);
  lbl.userData.noOutline = true;
  return g;
}
recyclingBin(-0.27, 0x76918d, 0x355a58, binLabelTexture);
recyclingBin(0.27, 0xd5d0bb, 0x53665f, binLabelTexture);
box(0.8, 0.03, 0.5, matAluDark, 0, 0.04, 0, binGroup);
contactShadow(1.1, 0.8, 0, 0.013, 0, 0.35, binGroup, 0);
registerAssembly(binGroup, 3.02, { lift: 2.0, dx: -0.25, duration: 0.9 });

/* ---------------------------------- umbrella stand ---------------------------------- */

const umbrellaGroup = new THREE.Group();
umbrellaGroup.position.set(-0.98, 0.18, 1.42);
umbrellaGroup.rotation.y = -0.1;
world.add(umbrellaGroup);
box(0.62, 0.08, 0.5, matAlu, 0, 0.06, 0, umbrellaGroup);
box(0.58, 0.03, 0.46, matAluDark, 0, 0.035, 0, umbrellaGroup, false);
for (const x of [-0.26, 0.26]) {
  tubeBetween(new THREE.Vector3(x, 0.06, -0.22), new THREE.Vector3(x, 0.92, -0.18), 0.018, matAluDark, umbrellaGroup, 5);
  tubeBetween(new THREE.Vector3(x, 0.06, 0.22), new THREE.Vector3(x, 0.92, 0.18), 0.018, matAluDark, umbrellaGroup, 5);
}
tubeBetween(new THREE.Vector3(-0.26, 0.92, -0.18), new THREE.Vector3(0.26, 0.92, -0.18), 0.018, matAluDark, umbrellaGroup, 5);
tubeBetween(new THREE.Vector3(-0.26, 0.92, 0.18), new THREE.Vector3(0.26, 0.92, 0.18), 0.018, matAluDark, umbrellaGroup, 5);
const umbCols = [0x244d63, 0xe4dfc9, 0xd3a64b, 0x73a29d];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  g.position.set(-0.19 + i * 0.13, 0.08, -0.11 + (i % 2) * 0.16);
  g.rotation.z = rand(0.13, -0.13);
  g.rotation.x = rand(0.09, -0.09);
  umbrellaGroup.add(g);
  const fabric = cyl(0.03, 0.095, 0.76, toon(umbCols[i]), 0, 0.48, 0, 8, g);
  cyl(0.012, 0.012, 0.16, matAluDark, 0, 0.04, 0, 6, g, false);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), matAluDark);
  hook.position.set(0.07, 0.93, 0);
  hook.rotation.z = Math.PI / 2;
  g.add(hook);
  cyl(0.012, 0.012, 0.13, matAluDark, 0, 0.87, 0, 5, g, false);
}
contactShadow(0.95, 0.7, 0, 0.013, 0, 0.38, umbrellaGroup, 0);
registerAssembly(umbrellaGroup, 2.98, { lift: 2.2, dx: 0.3, duration: 0.9 });

/* ---------------------------------- bicycle ---------------------------------- */

const bikeGroup = new THREE.Group();
bikeGroup.position.set(-5.35, 0.18, 2.92);
bikeGroup.rotation.y = -0.2;
world.add(bikeGroup);

const bikePaint = toon(0xe0b75d);
const bikePaintDark = toon(0xb88537);
const bikeTire = toon(0x1c2225);
const bikeChrome = toon(0xaeb7b3);
const wheelY = 0.43;
const wheelR = 0.41;
function bikeWheel(x) {
  const g = new THREE.Group();
  g.position.set(x, wheelY, 0);
  bikeGroup.add(g);
  const tire = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.038, 7, 24), bikeTire);
  tire.castShadow = true;
  g.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(wheelR - 0.045, 0.012, 5, 24), bikeChrome);
  g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 10), bikeChrome);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    tubeBetween(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * (wheelR - 0.055), Math.sin(a) * (wheelR - 0.055), 0),
      0.005,
      bikeChrome,
      g,
      3
    );
  }
  return g;
}
bikeWheel(-0.61);
bikeWheel(0.61);

const p = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const frame = new THREE.Group();
bikeGroup.add(frame);
const frameTubes = [
  [p(-0.61, wheelY), p(-0.2, 0.91)],
  [p(-0.61, wheelY), p(-0.02, 0.42)],
  [p(-0.2, 0.91), p(0.04, 0.42)],
  [p(-0.2, 0.91), p(0.42, 0.89)],
  [p(0.42, 0.89), p(0.04, 0.42)],
  [p(0.04, 0.42), p(0.61, wheelY)],
  [p(0.42, 0.89), p(0.58, 0.45)],
  [p(0.58, 0.45), p(0.61, wheelY)],
  [p(-0.02, 0.42), p(-0.61, wheelY)],
];
for (const [a, b] of frameTubes) tubeBetween(a, b, 0.027, bikePaint, frame, 6);
// rear rack
tubeBetween(p(-0.7, 0.76), p(-0.2, 0.76), 0.014, bikeChrome, frame, 5);
tubeBetween(p(-0.6, 0.44), p(-0.62, 0.75), 0.008, bikeChrome, frame, 4);
tubeBetween(p(-0.6, 0.44), p(-0.18, 0.75), 0.008, bikeChrome, frame, 4);
// seat post and seat
tubeBetween(p(-0.2, 0.9), p(-0.23, 1.02), 0.018, bikeChrome, frame, 5);
roundedBox(0.24, 0.07, 0.14, 0.025, toon(0x272c2d), -0.24, 1.05, 0, frame, 2);
// handle stem and bars
tubeBetween(p(0.42, 0.89), p(0.45, 1.07), 0.017, bikeChrome, frame, 5);
tubeBetween(p(0.45, 1.07, -0.22), p(0.45, 1.07, 0.22), 0.016, bikeChrome, frame, 5);
for (const zz of [-0.22, 0.22]) {
  const grip = cyl(0.026, 0.026, 0.12, bikeTire, 0.45, 1.07, zz, 6, frame, false);
  grip.rotation.x = Math.PI / 2;
}
// pedals and chainring
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.011, 5, 18), bikeChrome);
ring.position.set(0.04, 0.42, 0.055);
frame.add(ring);
for (const zz of [-0.12, 0.12]) {
  const pedal = box(0.19, 0.02, 0.055, bikeTire, 0.04, 0.42, zz, frame, false);
}
// front basket
const basket = new THREE.Group();
basket.position.set(0.61, 0.94, 0);
frame.add(basket);
for (let i = 0; i < 4; i++) {
  box(0.03, 0.28, 0.02, bikeChrome, -0.18 + i * 0.12, 0.03, 0.13, basket, false);
  box(0.03, 0.28, 0.02, bikeChrome, -0.18 + i * 0.12, 0.03, -0.13, basket, false);
  box(0.36, 0.02, 0.02, bikeChrome, 0, 0.06 + i * 0.075, 0.13, basket, false);
  box(0.36, 0.02, 0.02, bikeChrome, 0, 0.06 + i * 0.075, -0.13, basket, false);
}
box(0.36, 0.025, 0.28, bikeChrome, 0, -0.11, 0, basket);
box(0.1, 0.17, 0.06, toon(0x72968e), 0.06, 0.04, 0, basket);
box(0.14, 0.19, 0.1, toon(0xe4dfcc), -0.04, 0.045, 0, basket);
// front and rear fenders
for (const [x, sx] of [[-0.61, -1], [0.61, 1]]) {
  const fender = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.018, 4, 18, Math.PI * 0.92), bikePaintDark);
  fender.position.set(x, wheelY, 0);
  fender.rotation.z = Math.PI * 0.04;
  fender.rotation.y = 0;
  bikeGroup.add(fender);
}
// tiny headlamp and rear reflector
const bikeLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 9), bikeChrome);
bikeLamp.position.set(0.83, 0.76, 0);
bikeLamp.rotation.z = Math.PI / 2;
bikeGroup.add(bikeLamp);
const bikeReflector = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), new THREE.MeshBasicMaterial({ color: 0xe06b58 }));
bikeReflector.position.set(-0.69, 0.58, 0.06);
bikeGroup.add(bikeReflector);
// kickstand
tubeBetween(p(-0.25, 0.24, 0.05), p(-0.42, 0.02, 0.22), 0.012, bikeChrome, frame, 4);
contactShadow(1.75, 0.7, 0, 0.013, 0, 0.48, bikeGroup, 0.05);
registerAssembly(bikeGroup, 3.02, { lift: 2.4, dz: 0.25, duration: 1.05 });

/* ---------------------------------- wall air-conditioner ---------------------------------- */

const acGroup = new THREE.Group();
acGroup.position.set(2.17, 0.18, -1.35);
world.add(acGroup);
const acMat = toon(0xaeb7b4);
const acDark = toon(0x4a575b);
// two little wall brackets
for (const zz of [-0.34, 0.34]) {
  tubeBetween(new THREE.Vector3(-0.28, -0.6, zz), new THREE.Vector3(-0.02, -0.6, zz), 0.025, acDark, acGroup, 5);
  tubeBetween(new THREE.Vector3(-0.28, 0.5, zz), new THREE.Vector3(-0.28, -0.6, zz), 0.015, acDark, acGroup, 4);
}
roundedBox(0.4, 0.67, 1.0, 0.05, acMat, 0, 0.03, 0, acGroup, 2);
// fan grille faces +x
const acFan = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 6, 22), acDark);
acFan.rotation.y = Math.PI / 2;
acFan.position.set(0.205, 0.02, 0.12);
acGroup.add(acFan);
for (let i = 0; i < 4; i++) {
  const bar = box(0.02, 0.02, 0.42, acDark, 0.21, 0.02, 0.12, acGroup, false);
  bar.rotation.x = (i * Math.PI) / 4;
}
box(0.02, 0.02, 0.42, matAlu, 0.212, 0.02, 0.12, acGroup, false).rotation.x = Math.PI / 2;
for (let i = 0; i < 5; i++) box(0.02, 0.014, 0.65, acDark, 0.212, -0.25 + i * 0.035, 0.1, acGroup, false);
// refrigerant pipe
const pipeCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.1, 0.37, -0.38),
  new THREE.Vector3(0.22, 0.55, -0.48),
  new THREE.Vector3(0.17, 0.2, -0.53),
  new THREE.Vector3(0.15, -0.1, -0.5),
]);
const pipe = new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 18, 0.025, 6, false), acDark);
acGroup.add(pipe);
// drip puddle
sidewalkPuddle(2.4, -1.1, 0.45, 0.22, 0.2);
contactShadow(0.8, 1.2, 0, 0.013, 0, 0.22, acGroup, Math.PI / 2);
registerAssembly(acGroup, 2.66, { lift: 2.2, dx: 0.25, duration: 0.9 });

/* ---------------------------------- a cat, waiting out the rain ---------------------------------- */

const catGroup = new THREE.Group();
catGroup.position.set(-3.12, 0.18, 1.32);
catGroup.rotation.y = 0.48;
world.add(catGroup);
const catMat = toon(0x1d2527);
const catCream = toon(0xd9d3c0);
const catBody = sphere(0.18, catMat, 0, 0.27, 0, catGroup, 12);
catBody.scale.set(0.9, 1.2, 0.8);
sphere(0.14, catMat, 0.02, 0.52, 0.02, catGroup, 12);
const catChest = sphere(0.11, catCream, 0.06, 0.44, 0.1, catGroup, 10);
catChest.scale.set(0.75, 0.95, 0.45);
const catEarGeo = new THREE.ConeGeometry(0.055, 0.13, 4);
for (const [x, z] of [[-0.07, 0.04], [0.11, 0.04]]) {
  const ear = new THREE.Mesh(catEarGeo, catMat);
  ear.position.set(x, 0.64, z);
  catGroup.add(ear);
}
for (const [x, z] of [[-0.035, 0.14], [0.085, 0.14]]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 7, 5), new THREE.MeshBasicMaterial({ color: 0xd9bd65 }));
  eye.position.set(x, 0.54, z);
  catGroup.add(eye);
}
const catTail = new THREE.Group();
catTail.position.set(-0.13, 0.25, -0.03);
catTail.userData.dynamic = true;
catGroup.add(catTail);
const tailCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(-0.17, 0.08, -0.08),
  new THREE.Vector3(-0.23, 0.3, -0.15),
  new THREE.Vector3(-0.12, 0.38, -0.2),
]);
const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.028, 5, false), catMat);
catTail.add(tail);
for (const [x, z] of [[-0.11, 0.11], [0.14, 0.11]]) sphere(0.04, catCream, x, 0.02, z, catGroup, 7);
contactShadow(0.45, 0.34, 0, 0.013, 0, 0.4, catGroup, 0);
registerAssembly(catGroup, 3.35, { lift: 1.2, dx: 0.15, duration: 0.8 });

/* ---------------------------------- the alley & the old neighbour ---------------------------------- */

const lanternTexture = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#b9483d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d6c7a8';
  ctx.fillRect(0, 0, w, 42);
  ctx.fillRect(0, h - 42, w, 42);
  ctx.strokeStyle = 'rgba(90,34,28,0.46)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 12) * w, 42);
    ctx.lineTo((i / 12) * w, h - 42);
    ctx.stroke();
  }
  ctx.fillStyle = '#2b221c';
  ctx.font = '900 168px "Yu Gothic", "Meiryo", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('月', w / 2, h / 2 + 5);
  ctx.strokeStyle = 'rgba(50,25,21,0.42)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 120, 0, TAU);
  ctx.stroke();
});

const tileTexture = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#2b393d';
  ctx.fillRect(0, 0, w, h);
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    ctx.fillStyle = row % 2 ? '#344448' : '#303f43';
    ctx.fillRect(0, y, w, 60);
    ctx.strokeStyle = 'rgba(10,16,17,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y + 61);
    ctx.bezierCurveTo(w * 0.25, y + 52, w * 0.75, y + 70, w, y + 61);
    ctx.stroke();
    for (let col = 0; col < 6; col++) {
      ctx.strokeStyle = 'rgba(10,16,17,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(col * 92 + (row % 2) * 46, y);
      ctx.lineTo(col * 92 + (row % 2) * 46, y + 60);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, y + 4, w, 3);
  }
}, { repeat: [2, 6] });

const norenTexture = canvasTexture(900, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const panels = 4;
  for (let i = 0; i < panels; i++) {
    const px = 10 + i * (w / panels);
    const pw = w / panels - 14;
    ctx.fillStyle = '#283f4b';
    ctx.fillRect(px, 0, pw, h - 18);
    ctx.fillStyle = 'rgba(9,18,23,0.18)';
    for (let j = 0; j < 8; j++) ctx.fillRect(px, 50 + j * 54, pw, 2);
    ctx.fillStyle = 'rgba(234,226,205,0.84)';
    ctx.beginPath();
    ctx.arc(px + pw / 2, 160, 42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#283f4b';
    ctx.font = '900 48px "Yu Gothic", "Meiryo", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i % 2 ? '月' : '酒', px + pw / 2, 161);
    ctx.fillStyle = 'rgba(238,230,211,0.16)';
    ctx.fillRect(px + 8, 0, 3, h - 20);
  }
});

const alleyGroup = new THREE.Group();
alleyGroup.position.set(0, WALK_Y, 0);
world.add(alleyGroup);

const neighbourX0 = -12.72;
const neighbourX1 = -10.58;
const neighbourZ0 = -7.95;
const neighbourZ1 = 1.74;
const nbW = neighbourX1 - neighbourX0;
const nbD = neighbourZ1 - neighbourZ0;
const nbCX = (neighbourX0 + neighbourX1) / 2;
const nbCZ = (neighbourZ0 + neighbourZ1) / 2;
const oldWall = toon(0xb7a98e);
const oldWood = toon(0x4a3830);
const oldWoodDark = toon(0x2f2622);

box(nbW + 0.15, 0.25, nbD + 0.15, toon(0x5c5e57), nbCX, 0.12, nbCZ, alleyGroup);
box(nbW, 3.55, nbD, oldWall, nbCX, 1.92, nbCZ, alleyGroup);
// timber skeleton on the street-facing side
for (const xx of [neighbourX0 + 0.08, neighbourX1 - 0.08]) {
  box(0.13, 3.7, 0.13, oldWood, xx, 1.95, neighbourZ1 + 0.03, alleyGroup);
}
for (const yy of [0.32, 1.35, 2.72, 3.62]) {
  box(nbW, 0.12, 0.1, oldWood, nbCX, yy, neighbourZ1 + 0.03, alleyGroup);
}
// sliding entry and its little noren
box(0.95, 2.35, 0.06, oldWoodDark, -11.97, 1.37, neighbourZ1 + 0.07, alleyGroup);
box(0.75, 1.9, 0.035, new THREE.MeshBasicMaterial({ color: 0xdec58e }), -11.97, 1.32, neighbourZ1 + 0.11, alleyGroup, false);
for (const yy of [0.55, 1.05, 1.55, 2.05]) box(0.75, 0.035, 0.02, oldWoodDark, -11.97, yy, neighbourZ1 + 0.13, alleyGroup, false);
for (const xx of [-12.22, -11.97, -11.72]) box(0.02, 1.9, 0.02, oldWoodDark, xx, 1.32, neighbourZ1 + 0.13, alleyGroup, false);
box(1.35, 0.08, 0.6, oldWood, -11.97, 2.5, neighbourZ1 + 0.26, alleyGroup);
const norenMat = new THREE.MeshBasicMaterial({ map: norenTexture, transparent: true, side: THREE.DoubleSide, toneMapped: true });
const noren = plane(1.17, 0.66, norenMat, -11.97, 2.12, neighbourZ1 + 0.25, alleyGroup);
markNoOutline(noren);
const noren2 = plane(1.17, 0.66, norenMat, -11.97, 2.12, neighbourZ1 + 0.245, alleyGroup);
noren2.rotation.y = Math.PI;
markNoOutline(noren2);

// warm paper windows both on the street face and down the alley
function shojiWindow(x, y, z, w, h, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  alleyGroup.add(g);
  box(w + 0.12, h + 0.12, 0.08, oldWoodDark, 0, 0, 0, g);
  box(w, h, 0.03, new THREE.MeshBasicMaterial({ color: 0xd8b878 }), 0, 0, 0.05, g, false);
  for (let i = 0; i < 4; i++) box(0.025, h, 0.02, oldWood, -w / 2 + (i + 0.5) * (w / 4), 0, 0.07, g, false);
  for (let i = 0; i < 3; i++) box(w, 0.025, 0.02, oldWood, 0, -h / 2 + (i + 0.5) * (h / 3), 0.07, g, false);
  glowSprite(0xffcd88, 1.3, 0.17, 0, 0, 0.4, g);
  return g;
}
shojiWindow(-11.21, 2.64, neighbourZ1 + 0.06, 0.85, 0.78);
shojiWindow(neighbourX1 - 0.03, 1.95, -1.8, 1.8, 1.15, Math.PI / 2);
shojiWindow(neighbourX1 - 0.03, 1.95, -4.8, 1.2, 1.05, Math.PI / 2);
// vertical neon sign outside the izakaya
const izakaya = new THREE.Group();
izakaya.position.set(-12.23, 2.4, neighbourZ1 + 0.17);
alleyGroup.add(izakaya);
box(0.62, 2.02, 0.1, matTealDeep, 0, 0, 0, izakaya);
const izaFace = plane(0.52, 1.9, new THREE.MeshBasicMaterial({ map: izakayaSignTexture, toneMapped: true }), 0, 0, 0.06, izakaya);
markNoOutline(izaFace);
glowSprite(0xff7d94, 1.1, 0.25, 0, 0.1, 0.5, izakaya);
box(0.1, 0.08, 0.45, oldWoodDark, 0.36, 0.82, 0, izakaya);
// tiled roof
const roofTexMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTexture, roughness: 0.62, metalness: 0.08 });
const roofL = box(1.42, 0.13, nbD + 0.7, roofTexMat, -12.15, 4.02, nbCZ, alleyGroup);
roofL.rotation.z = 0.3;
const roofR = box(1.42, 0.13, nbD + 0.7, roofTexMat, -11.16, 4.02, nbCZ, alleyGroup);
roofR.rotation.z = -0.3;
const ridge = cyl(0.11, 0.11, nbD + 0.8, toon(0x1e2b2e), -11.65, 4.24, nbCZ, 8, alleyGroup);
ridge.rotation.x = Math.PI / 2;
// eave gutter and downpipe
box(0.1, 0.1, nbD + 0.7, matAluDark, -10.54, 3.65, nbCZ, alleyGroup, false);
cyl(0.05, 0.05, 3.45, matAluDark, -10.6, 1.97, 1.83, 7, alleyGroup, false);
// small clutter under the eave
for (let i = 0; i < 3; i++) {
  const pot = cyl(0.17, 0.13, 0.3, toon(0x5a605a), neighbourX1 + 0.25 + i * 0.08, 0.15, 0.9 - i * 0.22, 8, alleyGroup);
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 0), toon(i === 1 ? 0x59775e : 0x416d62, { flatShading: true }));
  bush.position.set(neighbourX1 + 0.25 + i * 0.08, 0.4, 0.9 - i * 0.22);
  bush.castShadow = true;
  alleyGroup.add(bush);
}
// alley mouth: beam, curtain, lantern and crates
box(2.05, 0.16, 0.18, oldWoodDark, -9.54, 2.58, 1.62, alleyGroup);
box(0.16, 2.6, 0.18, oldWood, -10.52, 1.3, 1.62, alleyGroup);
box(0.16, 2.6, 0.18, oldWood, -8.56, 1.3, 1.62, alleyGroup);
const mouthNorenMat = new THREE.MeshBasicMaterial({ map: norenTexture, transparent: true, side: THREE.DoubleSide, toneMapped: true, opacity: 0.9 });
const mouthNoren = plane(1.8, 0.62, mouthNorenMat, -9.55, 2.2, 1.63, alleyGroup);
markNoOutline(mouthNoren);
const lanternGroup = new THREE.Group();
lanternGroup.position.set(-9.22, 2.16, 1.62);
lanternGroup.scale.setScalar(1.08);
alleyGroup.add(lanternGroup);
cyl(0.3, 0.3, 0.045, toon(0x2f2620), 0, 0.27, 0, 10, lanternGroup, false);
cyl(0.3, 0.3, 0.045, toon(0x2f2620), 0, -0.27, 0, 10, lanternGroup, false);
const lanternBody = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ map: lanternTexture, toneMapped: true }));
lanternBody.scale.y = 1.32;
lanternGroup.add(lanternBody);
cyl(0.012, 0.012, 0.36, matAluDark, 0, 0.65, 0, 5, lanternGroup, false);
glowSprite(0xffb06d, 2.2, 0.5, 0, 0, 0, lanternGroup);
const lanternLight = new THREE.PointLight(0xff8f62, 6, 5, 2);
lanternGroup.add(lanternLight);
// crates and a tiny ground AC deeper in
for (let i = 0; i < 2; i++) {
  const crate = box(0.66, 0.42, 0.5, toon(i ? 0x806746 : 0x9b805a), -9.7, 0.22 + i * 0.42, -0.7, alleyGroup);
  crate.rotation.y = rand(0.22, -0.22);
}
box(0.7, 0.52, 0.36, toon(0xa2aaa6), -9.9, 0.27, -2.45, alleyGroup);
box(0.62, 0.09, 0.38, matAluDark, -9.9, 0.56, -2.45, alleyGroup);
const alleyAcFan = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 5, 18), matAluDark);
alleyAcFan.rotation.y = Math.PI / 2;
alleyAcFan.position.set(-9.54, 0.28, -2.45);
alleyGroup.add(alleyAcFan);
const alleyPuddle = sidewalkPuddle(-9.55, -0.15, 0.75, 0.22, 0.3);
const alleyLight2 = new THREE.PointLight(0xff6a86, 5, 9, 2);
alleyLight2.position.set(-9.5, 1.9, -2.6);
alleyGroup.add(alleyLight2);
const smallGlow = glowSprite(0xff7c92, 2.1, 0.22, -9.55, 1.2, -2.8, alleyGroup);

contactShadow(2.2, 0.5, -9.55, 0.013, 1.4, 0.32, alleyGroup, 0);
registerAssembly(alleyGroup, 2.32, { lift: 4.2, dx: -0.2, dz: -0.1, duration: 1.1 });

/* ---------------------------------- back gardens, tree & second pole ---------------------------------- */

const backGroup = new THREE.Group();
backGroup.position.set(0, WALK_Y, 0);
world.add(backGroup);

// old boundary wall behind the shop
const boundaryMat = toon(0x70756f);
box(10.6, 1.15, 0.3, boundaryMat, -5.95, 0.58, -10.56, backGroup);
box(10.7, 0.12, 0.38, toon(0x8e9288), -5.95, 1.2, -10.56, backGroup);
for (let i = 0; i < 7; i++) {
  box(0.03, 1.05, 0.02, toon(0x565b55), -10.9 + i * 1.35, 0.58, -10.4, backGroup, false);
}
for (let i = 0; i < 5; i++) {
  const vx = -10.3 + i * 1.85;
  for (let j = 0; j < 4; j++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.16), 0), toon(j % 2 ? 0x315e50 : 0x3e6d58, { flatShading: true }));
    leaf.position.set(vx + rand(0.25, -0.25), 0.32 + j * 0.24, -10.35);
    leaf.castShadow = true;
    backGroup.add(leaf);
  }
}
// little service door / utility box
box(1.1, 2.0, 0.25, toon(0x505e5d), 3.3, 1.0, -8.22, backGroup);
box(0.9, 0.8, 0.3, toon(0x7e8985), 4.25, 0.42, -8.5, backGroup);
// potted plants along the back lane
for (let i = 0; i < 4; i++) {
  const x = -6.9 + i * 0.75;
  cyl(0.2, 0.15, 0.35, toon(0x5c625b), x, 0.18, -8.65, 8, backGroup);
  const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.3, 0.2), 0), toon(i % 2 ? 0x436b58 : 0x527a64, { flatShading: true }));
  bush.position.set(x, 0.52, -8.65);
  bush.castShadow = true;
  backGroup.add(bush);
}
// a broad tree, just visible above the roof
const treeGroup = new THREE.Group();
treeGroup.position.set(-10.1, 0, -9.65);
treeGroup.scale.set(1.24, 1.36, 1.24);
backGroup.add(treeGroup);
const trunk = cyl(0.13, 0.28, 5.0, toon(0x4b4037), 0, 2.5, 0, 8, treeGroup);
trunk.rotation.z = -0.05;
const branchA = tubeBetween(new THREE.Vector3(0, 3.7, 0), new THREE.Vector3(-1.5, 5.4, 0.2), 0.11, toon(0x4b4037), treeGroup, 6);
const branchB = tubeBetween(new THREE.Vector3(0.02, 4.2, 0), new THREE.Vector3(1.35, 5.7, -0.4), 0.1, toon(0x4b4037), treeGroup, 6);
const branchC = tubeBetween(new THREE.Vector3(0.03, 4.7, 0), new THREE.Vector3(0.4, 6.6, 0.15), 0.085, toon(0x4b4037), treeGroup, 6);
const leafMats = [toon(0x1e3831), toon(0x28463b), toon(0x335342)];
const leafClusters = [
  [-1.8, 5.4, 0.2, 1.05, 0.62, 0.9],
  [1.45, 5.55, -0.4, 0.92, 0.56, 0.8],
  [0.38, 6.45, 0.22, 0.8, 0.5, 0.7],
  [-0.72, 5.95, 0.6, 0.86, 0.52, 0.7],
  [0.45, 5.15, -1.0, 0.75, 0.44, 0.68],
  [-2.4, 4.95, -0.35, 0.65, 0.36, 0.55],
  [-0.2, 5.8, -1.35, 0.72, 0.4, 0.55],
  [1.9, 5.05, 0.5, 0.58, 0.34, 0.5],
];
leafClusters.forEach(([x, y, z, sx, sy, sz], i) => {
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), leafMats[i % 3]);
  leaf.position.set(x, y, z);
  leaf.scale.set(sx, sy, sz);
  leaf.rotation.set(rand(1, 0), rand(TAU), rand(0.4, -0.4));
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  treeGroup.add(leaf);
});
contactShadow(3.4, 2.1, -10.1, 0.013, -9.65, 0.22, backGroup, 0.2);

// distant second pole, mostly a silhouette
const pole2 = new THREE.Group();
pole2.position.set(-12.1, 0, -9.05);
backGroup.add(pole2);
cyl(0.16, 0.25, 8.8, toon(0x5e6968), 0, 4.4, 0, 10, pole2);
for (const yy of [7.9, 8.35]) {
  box(1.9, 0.09, 0.1, toon(0x2a363a), 0, yy, 0, pole2);
  for (const xx of [-0.75, 0.75]) cyl(0.045, 0.045, 0.2, toon(0x9ca9a2), xx, yy + 0.13, 0, 7, pole2, false);
}
cyl(0.28, 0.28, 0.8, toon(0x77817e), 0.26, 6.6, 0, 10, pole2);
// add a few final wires that tie the two poles together
const localWires = new THREE.Group();
backGroup.add(localWires);
wire(new THREE.Vector3(-12.1, 8.55, -9.05), new THREE.Vector3(4.77, 8.93, 3.22), 1.35, 0.019, wireMat, localWires);
wire(new THREE.Vector3(-12.1, 8.18, -9.05), new THREE.Vector3(4.42, 8.7, 3.22), 1.5, 0.017, wireMat, localWires);
registerAssembly(backGroup, 2.4, { lift: 3.4, dx: 0, dz: 0, duration: 1.1 });

/* ---------------------------------- rain ---------------------------------- */

const rainGroup = new THREE.Group();
scene.add(rainGroup);
markNoOutline(rainGroup);

const RAIN_COUNT = 1250;
const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
const rainSpeed = new Float32Array(RAIN_COUNT * 2);
const rainPhase = new Float32Array(RAIN_COUNT * 2);
const rainLength = new Float32Array(RAIN_COUNT * 2);
const rainEnd = new Float32Array(RAIN_COUNT * 2);
for (let i = 0; i < RAIN_COUNT; i++) {
  const x = rand(9.3, -13.0);
  const z = rand(11.2, -11.1);
  const speed = rand(0.68, 0.37);
  const phase = Math.random();
  const len = rand(0.5, 0.16) + (Math.abs(x) + Math.abs(z)) * 0.0025;
  for (let j = 0; j < 2; j++) {
    const idx = (i * 2 + j);
    rainPositions[idx * 3 + 0] = x;
    rainPositions[idx * 3 + 1] = 0;
    rainPositions[idx * 3 + 2] = z;
    rainSpeed[idx] = speed;
    rainPhase[idx] = phase;
    rainLength[idx] = len;
    rainEnd[idx] = j;
  }
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
rainGeo.setAttribute('aSpeed', new THREE.BufferAttribute(rainSpeed, 1));
rainGeo.setAttribute('aPhase', new THREE.BufferAttribute(rainPhase, 1));
rainGeo.setAttribute('aLength', new THREE.BufferAttribute(rainLength, 1));
rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(rainEnd, 1));
const rainMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x9ebdd8) },
    uOpacity: { value: 0.145 },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    attribute float aSpeed;
    attribute float aPhase;
    attribute float aLength;
    attribute float aEnd;
    varying float vAlpha;
    void main() {
      float fall = fract(aPhase + uTime * aSpeed);
      float y = 17.2 - fall * 17.2;
      vec3 p = position;
      p.x += fall * 0.72;
      p.z += fall * 0.13;
      p.y = y;
      p.y -= aEnd * aLength;
      p.x -= aEnd * 0.11;
      p.z += aEnd * 0.018;
      float alpha = smoothstep(0.0, 0.55, y) * smoothstep(17.2, 13.8, y);
      alpha *= 0.64 + aEnd * 0.36;
      alpha *= 0.42 + 0.58 * fract(aPhase * 23.17);
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      alpha *= 1.0 - smoothstep(26.0, 56.0, -mvPosition.z) * 0.62;
      // keep the awning dry and the shop interior rain-free
      if (p.x > -8.62 && p.x < 2.07 && p.z > -8.08 && p.z < 0.86 && p.y < 5.22) alpha = 0.0;
      if (p.x > -12.82 && p.x < -10.5 && p.z > -8.0 && p.z < 1.82 && p.y < 4.4) alpha = 0.0;
      if (p.x > -8.95 && p.x < 2.4 && p.z > 0.8 && p.z < 3.38 && p.y < 3.28) alpha = 0.0;
      vAlpha = alpha;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
      gl_FragColor = vec4(uColor, uOpacity * vAlpha);
    }
  `,
});
const rain = new THREE.LineSegments(rainGeo, rainMaterial);
rain.frustumCulled = false;
rain.renderOrder = 8;
rainGroup.add(rain);

/* ---------------------------------- rain rings ---------------------------------- */

const splashGroup = new THREE.Group();
scene.add(splashGroup);
markNoOutline(splashGroup);
const splashes = [];
const splashGeo = new THREE.RingGeometry(0.09, 0.125, 18);
for (let i = 0; i < 27; i++) {
  let x, z, y;
  if (i < 20) {
    x = rand(8.6, -12.4);
    z = rand(10.5, 4.9);
    y = 0.071;
  } else {
    x = rand(4.7, -8.0);
    z = rand(3.9, 0.98);
    y = 0.198;
  }
  if (x < 5.2 && z < 4.55) y = 0.198;
  if (x > -8.55 && x < 2.05 && z > -8.05 && z < 0.86) y = 5.2;
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc3d9dd,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(splashGeo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.userData.noOutline = true;
  m.renderOrder = 6;
  splashGroup.add(m);
  splashes.push({ mesh: m, phase: Math.random(), speed: rand(0.95, 0.55), spread: rand(1.35, 0.75) });
}

/* ---------------------------------- puddle glints ---------------------------------- */

const puddleRingGroup = new THREE.Group();
world.add(puddleRingGroup);
markNoOutline(puddleRingGroup);
const sidewalkPuddleRings = [];
const puddleSpots = [
  [3.6, 3.35], [-4.7, 2.95], [0.8, 2.4],
];
for (const [x, z] of puddleSpots) {
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xb8d6db,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.105, 20), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x + rand(0.3, -0.3), 0.197, z + rand(0.18, -0.18));
    ring.userData.noOutline = true;
    ring.renderOrder = 5;
    puddleRingGroup.add(ring);
    sidewalkPuddleRings.push({ mesh: ring, phase: Math.random(), speed: rand(0.45, 0.26) });
  }
}

/* ---------------------------------- coloured light pools on the wet paving ---------------------------------- */

const spillGroup = new THREE.Group();
world.add(spillGroup);
markNoOutline(spillGroup);
function lightPool(x, z, w, d, color, opacity, rot = 0) {
  const mat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
  const m = groundPlane(w, d, mat, x, 0.203, z, spillGroup);
  m.rotation.z = rot;
  m.renderOrder = 3;
  m.userData.noOutline = true;
  return m;
}
lightPool(-3.3, 2.2, 11.2, 4.0, 0xffbc7a, 0.3, 0);
lightPool(3.35, 1.42, 2.8, 2.1, 0x83ffe4, 0.22, -0.2);
lightPool(-9.7, 0.7, 3.1, 2.4, 0xff6f92, 0.2, 0.2);
lightPool(-7.6, 3.8, 3.8, 2.5, 0xffcc84, 0.17, 0);
lightPool(0.4, 3.65, 3.4, 1.2, 0xffe2b4, 0.14, 0);
function roadGlow(x, z, w, d, color, opacity) {
  const mat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
  const m = groundPlane(w, d, mat, x, 0.081, z, spillGroup);
  m.renderOrder = 5;
  m.userData.noOutline = true;
  return m;
}
roadGlow(-2.6, 6.15, 7.8, 4.2, 0xffb56e, 0.075);
roadGlow(2.7, 6.25, 3.0, 3.0, 0x76f6dc, 0.07);
roadGlow(-9.0, 6.2, 2.8, 2.6, 0xff7397, 0.055);
registerAssembly(spillGroup, 2.2, { lift: 0.65, dx: 0, dz: 0, duration: 1.15, scaleFrom: 0.72 });

/* ---------------------------------- post processing ---------------------------------- */

const composerSize = new THREE.Vector2(window.innerWidth, window.innerHeight);
const renderTarget = new THREE.WebGLRenderTarget(
  Math.floor(window.innerWidth * DPR),
  Math.floor(window.innerHeight * DPR),
  {
    type: THREE.HalfFloatType,
    samples: 4,
    colorSpace: THREE.NoColorSpace,
  }
);
const composer = new EffectComposer(renderer, renderTarget);
composer.setPixelRatio(DPR);
composer.setSize(window.innerWidth, window.innerHeight);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const OUTLINE_SCALE = 1.0;
const normalRT = new THREE.WebGLRenderTarget(
  Math.floor(window.innerWidth * DPR * OUTLINE_SCALE),
  Math.floor(window.innerHeight * DPR * OUTLINE_SCALE),
  {
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    colorSpace: THREE.NoColorSpace,
  }
);

const normalMaterial = new THREE.ShaderMaterial({
  side: THREE.FrontSide,
  uniforms: {
    uFar: { value: camera.far },
  },
  vertexShader: /* glsl */ `
    uniform float uFar;
    varying vec3 vNormalView;
    varying float vDepth;
    void main() {
      vec4 localPosition = vec4(position, 1.0);
      vec3 n = normal;
      #ifdef USE_INSTANCING
        localPosition = instanceMatrix * localPosition;
        n = mat3(instanceMatrix) * n;
      #endif
      vec4 mvPosition = modelViewMatrix * localPosition;
      vNormalView = normalize(normalMatrix * n);
      vDepth = clamp(-mvPosition.z / uFar, 0.0, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vNormalView;
    varying float vDepth;
    void main() {
      gl_FragColor = vec4(normalize(vNormalView) * 0.5 + 0.5, vDepth);
    }
  `,
});

const outlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    uTexel: { value: new THREE.Vector2(1 / normalRT.width, 1 / normalRT.height) },
    uFar: { value: camera.far },
    uTime: { value: 0 },
    uDebugMode: { value: DEBUG_MODE === 'normal' ? 1 : DEBUG_MODE === 'edges' ? 2 : 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform vec2 uTexel;
    uniform float uFar;
    uniform float uTime;
    uniform float uDebugMode;
    varying vec2 vUv;

    vec3 readNormal(vec2 uv) {
      return texture2D(tNormal, uv).rgb * 2.0 - 1.0;
    }
    float readDepth(vec2 uv) {
      return texture2D(tNormal, uv).a * uFar;
    }
    float readMask(vec2 uv) {
      return step(0.00001, texture2D(tNormal, uv).a);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec4 center = texture2D(tNormal, vUv);
      float dc = center.a * uFar;
      vec3 nc = center.rgb * 2.0 - 1.0;
      float cMask = step(0.00001, center.a);

      float edge = 0.0;
      vec2 off[8];
      off[0] = vec2(1.0, 0.0);
      off[1] = vec2(-1.0, 0.0);
      off[2] = vec2(0.0, 1.0);
      off[3] = vec2(0.0, -1.0);
      off[4] = vec2(0.707, 0.707);
      off[5] = vec2(-0.707, 0.707);
      off[6] = vec2(0.707, -0.707);
      off[7] = vec2(-0.707, -0.707);

      for (int i = 0; i < 8; i++) {
        vec2 uv = vUv + off[i] * uTexel * 1.7;
        vec4 s = texture2D(tNormal, uv);
        float sm = step(0.00001, s.a);
        if (sm != cMask) edge = 1.0;
        if (sm > 0.5 && cMask > 0.5) {
          float ds = s.a * uFar;
          float depthDiff = abs(ds - dc) / max(min(ds, dc), 2.0);
          float normalDiff = 1.0 - dot(nc, s.rgb * 2.0 - 1.0);
          float depthEdge = smoothstep(0.018, 0.045, depthDiff);
          float normalEdge = smoothstep(0.19, 0.46, normalDiff);
          edge = max(edge, max(depthEdge, normalEdge) * 0.84);
        }
      }

      if (uDebugMode > 1.5) {
        gl_FragColor = vec4(vec3(edge, edge * 0.45, edge * 0.15), 1.0);
        return;
      }
      if (uDebugMode > 0.5) {
        gl_FragColor = vec4(center.rgb, 1.0);
        return;
      }
      if (edge > 0.001) {
        vec3 lineColor = vec3(0.006, 0.010, 0.019);
        float strength = smoothstep(0.08, 0.74, edge) * 0.92;
        color.rgb = mix(color.rgb, lineColor, strength);
      }
      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `,
};
outlineShader.uniforms.uTexel = { value: new THREE.Vector2(1 / normalRT.width, 1 / normalRT.height) };
const outlinePass = new ShaderPass(outlineShader);
outlinePass.material.uniforms.tNormal.value = normalRT.texture;
if (!NO_OUTLINE) composer.addPass(outlinePass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.52, 0.6, 1.04);
if (!NO_BLOOM) composer.addPass(bloomPass);

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      // a little more colour, with cold ink shadows and amber-allowed highlights
      c.rgb = mix(vec3(lum), c.rgb, 1.2);
      c.rgb = mix(c.rgb * vec3(0.83, 0.94, 1.12), c.rgb, smoothstep(0.015, 0.4, lum));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.055, 1.015, 0.94), smoothstep(0.4, 0.95, lum));
      vec2 p = vUv - 0.5;
      float vig = 1.0 - smoothstep(0.26, 0.78, length(p * vec2(1.24, 1.02)));
      c.rgb *= 0.75 + vig * 0.28;
      // a whisper of film grain, never enough to dirty the flat colours
      float grain = hash(vUv * uResolution + uTime * 26.0) - 0.5;
      c.rgb += grain * 0.007;
      // very slight cyan lift in the darkest values
      c.rgb += vec3(0.0015, 0.0030, 0.0055) * (1.0 - smoothstep(0.0, 0.16, lum));
      gl_FragColor = c;
    }
  `,
};
const gradePass = new ShaderPass(gradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());

/* ---------------------------------- static batch optimisation ---------------------------------- */

// Thousands of tiny props are lovely to author but cruel to the GPU. Every
// assembly group is rigid, so all opaque meshes sharing a material inside a
// group can be baked into one buffer. The screen is unchanged; the draw-call
// count drops dramatically.
function bakeStaticMeshes(assemblyList) {
  for (const item of assemblyList) {
    const root = item.obj;
    root.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const batches = new Map();
    const originals = [];

    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
      if (o.userData.noOutline || o.userData.dynamic || o.userData.isReflector) return;
      if (Array.isArray(o.material)) return;
      const mat = o.material;
      if (!mat || mat.transparent || mat.isShaderMaterial) return;
      let ancestor = o.parent;
      while (ancestor && ancestor !== root) {
        if (ancestor.userData.dynamic) return;
        ancestor = ancestor.parent;
      }
      if (!o.geometry?.attributes?.position) return;
      const attrs = Object.keys(o.geometry.attributes).sort().join(',');
      const key = [
        mat.uuid,
        o.castShadow ? 1 : 0,
        o.receiveShadow ? 1 : 0,
        o.renderOrder,
        o.geometry.index ? 'i' : 'n',
        attrs,
      ].join('|');
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(o);
    });

    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = [];
      for (const mesh of meshes) {
        const m = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
        const g = mesh.geometry.clone();
        g.applyMatrix4(m);
        if (!g.attributes.normal) g.computeVertexNormals();
        geometries.push(g);
      }
      const merged = mergeGeometries(geometries, false);
      if (!merged) continue;
      const first = meshes[0];
      const mesh = new THREE.Mesh(merged, first.material);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      root.add(mesh);
      originals.push(...meshes);
    }

    for (const mesh of originals) {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry?.dispose?.();
    }
  }
}
bakeStaticMeshes(assembly);

/* ---------------------------------- outline exclusions ---------------------------------- */

const outlineExcluded = [];
function buildOutlineExclusions() {
  outlineExcluded.length = 0;
  scene.traverse((o) => {
    if (o.isSprite || o.isLine || o.isLineSegments || o.isPoints) {
      outlineExcluded.push(o);
      return;
    }
    if (!o.isMesh) return;
    if (o.userData.noOutline || o.userData.isReflector) {
      outlineExcluded.push(o);
      return;
    }
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (materials.some((m) => m && m.transparent)) {
      outlineExcluded.push(o);
    }
  });
  const skyObject = sky;
  if (!outlineExcluded.includes(skyObject)) outlineExcluded.push(skyObject);
}
buildOutlineExclusions();

/* ---------------------------------- intro assembly ---------------------------------- */

let introElapsed = SKIP_INTRO ? 12 : 0;
let introReady = SKIP_INTRO;
let introCameraActive = !SKIP_INTRO;
const cameraIntroStart = new THREE.Vector3(24.8, 21.6, 36.6);
const cameraIntroTarget = new THREE.Vector3(-1.7, 0.9, 0.0);
const cameraIntroEnd = camera.position.clone();
const targetIntroEnd = controls.target.clone();
if (!SKIP_INTRO) {
  camera.position.copy(cameraIntroStart);
  controls.target.copy(cameraIntroTarget);
  controls.update();
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function updateAssembly(elapsed) {
  for (const item of assembly) {
    const local = clamp((elapsed - item.delay) / item.duration, 0, 1);
    if (local <= 0) {
      item.obj.visible = false;
      continue;
    }
    if (local >= 1) {
      if (!item.done) {
        item.obj.position.copy(item.finalPos);
        item.obj.rotation.copy(item.finalRot);
        item.obj.scale.copy(item.finalScale);
        item.done = true;
      }
      item.obj.visible = true;
      continue;
    }
    const e = easeOutQuint(local);
    const settle = easeOutCubic(local);
    item.obj.visible = true;
    item.obj.position.set(
      item.finalPos.x + item.drift.x * (1 - e),
      item.finalPos.y - item.lift * (1 - e),
      item.finalPos.z + item.drift.z * (1 - e)
    );
    item.obj.rotation.set(
      item.finalRot.x + item.spin * 0.3 * (1 - settle),
      item.finalRot.y + item.spin * 0.7 * (1 - settle),
      item.finalRot.z + item.spin * (1 - settle)
    );
    const s = item.scaleFrom + (1 - item.scaleFrom) * easeOutCubic(local);
    item.obj.scale.set(item.finalScale.x * s, item.finalScale.y * s, item.finalScale.z * s);
  }
}

function updateLightsForIntro(elapsed) {
  const warm = smoothstep(1.55, 2.55, elapsed);
  const night = smoothstep(0.2, 1.2, elapsed);
  shopLightA.intensity = 31 * warm;
  shopLightB.intensity = 19 * warm;
  canopyLight.intensity = 9 * warm;
  shopSpill.intensity = 16 * warm;
  alleyLight.intensity = 8 * night;
  sideLight.intensity = 5 * night;
}

function updateCameraIntro(elapsed) {
  if (!introCameraActive) return;
  const t = clamp(elapsed / 6.3, 0, 1);
  const e = easeInOut(t);
  camera.position.lerpVectors(cameraIntroStart, cameraIntroEnd, e);
  controls.target.lerpVectors(cameraIntroTarget, targetIntroEnd, e);
  if (t >= 1) introCameraActive = false;
}

controls.addEventListener('start', () => {
  introCameraActive = false;
  userHasInteracted = true;
});

function replayIntro() {
  introReady = true;
  introElapsed = 0;
  introCameraActive = true;
  userHasInteracted = false;
  for (const item of assembly) {
    item.done = false;
    item.obj.visible = false;
  }
  camera.position.copy(cameraIntroStart);
  controls.target.copy(cameraIntroTarget);
  controls.update();
  renderer.shadowMap.needsUpdate = true;
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) replayIntro();
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  renderer.shadowMap.needsUpdate = true;
});
renderer.domElement.addEventListener('pointerdown', () => document.body.classList.add('dragging'));
window.addEventListener('pointerup', () => document.body.classList.remove('dragging'));
window.addEventListener('pointercancel', () => document.body.classList.remove('dragging'));
window.addEventListener('blur', () => document.body.classList.remove('dragging'));
window.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------------------------------- resize ---------------------------------- */

function measureOutlineTarget() {
  const drawing = new THREE.Vector2();
  renderer.getDrawingBufferSize(drawing);
  normalRT.setSize(Math.max(2, Math.floor(drawing.x * OUTLINE_SCALE)), Math.max(2, Math.floor(drawing.y * OUTLINE_SCALE)));
  outlinePass.material.uniforms.uTexel.value.set(1 / normalRT.width, 1 / normalRT.height);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  if (!userHasInteracted) applyResponsiveFov();
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(DPR);
  renderer.setSize(w, h);
  composer.setPixelRatio(DPR);
  composer.setSize(w, h);
  measureOutlineTarget();
  gradePass.material.uniforms.uResolution.value.set(w, h);
}
window.addEventListener('resize', onResize);
measureOutlineTarget();

/* ---------------------------------- rendering ---------------------------------- */

const clock = new THREE.Clock();
let smoothFrame = 0;
const hiddenByPrepass = [];

function renderNormalPrepass() {
  const prevTarget = renderer.getRenderTarget();
  const prevBackground = scene.background;
  const prevFog = scene.fog;
  const prevOverride = scene.overrideMaterial;
  const prevClearColor = renderer.getClearColor(new THREE.Color());
  const prevClearAlpha = renderer.getClearAlpha();

  hiddenByPrepass.length = 0;
  for (const obj of outlineExcluded) {
    if (obj.visible) {
      hiddenByPrepass.push(obj);
      obj.visible = false;
    }
  }
  scene.background = null;
  scene.fog = null;
  scene.overrideMaterial = normalMaterial;
  renderer.setRenderTarget(normalRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);
  scene.overrideMaterial = prevOverride;
  scene.background = prevBackground;
  scene.fog = prevFog;
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClearColor, prevClearAlpha);
  for (const obj of hiddenByPrepass) obj.visible = true;
}

let last = performance.now() / 1000;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - last);
  last = now;
  const time = clock.getElapsedTime();

  // Compile the heavy post-process chain against an empty stage once. The
  // assembly then advances on rendered frame time, so a shader-compile stall,
  // a lost GPU context or a hidden tab can never swallow the opening beat.
  if (!introReady) {
    updateAssembly(-1);
    updateLightsForIntro(0);
    renderer.shadowMap.needsUpdate = true;
    rainMaterial.uniforms.uTime.value = time;
    roadReflector.material.uniforms.uTime.value = time;
    sky.material.uniforms.uTime.value = time;
    controls.update();
    renderNormalPrepass();
    composer.render();
    introReady = true;
    last = performance.now() / 1000;
    return;
  }

  if (!window.__TSUKIMI?.freezeIntro) introElapsed += Math.min(0.06, dt);
  const elapsed = introElapsed;
  // Shadows are static once the diorama has settled; bake them during the build.
  if (elapsed < 4.7) renderer.shadowMap.needsUpdate = true;

  updateAssembly(elapsed);
  updateCameraIntro(elapsed);
  updateLightsForIntro(elapsed);

  const flicker = 0.96 + 0.04 * Math.sin(time * 21.0) * Math.sin(time * 3.7);
  const warmPulse = 0.97 + 0.03 * Math.sin(time * 1.3 + 1.2);
  shopSpill.intensity = 16 * smoothstep(1.55, 2.55, elapsed) * warmPulse;
  if (alleyLight) alleyLight.intensity = 8 * smoothstep(0.2, 1.2, elapsed) * (0.82 + 0.18 * flicker);
  if (typeof sideLight !== 'undefined') sideLight.intensity = 8 * smoothstep(0.2, 1.2, elapsed);

  rainMaterial.uniforms.uTime.value = time;
  roadReflector.material.uniforms.uTime.value = time;
  sky.material.uniforms.uTime.value = time;
  outlinePass.material.uniforms.uTime.value = time;
  gradePass.material.uniforms.uTime.value = time;

  // rain rings on the ground
  for (const s of splashes) {
    const phase = (time * s.speed + s.phase) % 1;
    const sc = 0.22 + phase * s.spread;
    s.mesh.scale.set(sc, sc, sc);
    s.mesh.material.opacity = (1 - phase) * (1 - phase) * 0.34;
  }
  for (const s of sidewalkPuddleRings) {
    const phase = (time * s.speed + s.phase) % 1;
    const sc = 0.3 + phase * 2.1;
    s.mesh.scale.set(sc, sc, sc);
    s.mesh.material.opacity = (1 - phase) * 0.24;
  }

  if (catTail) catTail.rotation.z = Math.sin(time * 1.6) * 0.06 + Math.sin(time * 0.37) * 0.06;
  glareMat.opacity = 0.25 + Math.sin(time * 0.7) * 0.025;

  if (!introCameraActive) controls.update();
  else controls.update();

  renderNormalPrepass();
  composer.render();
}

// Pre-compile object materials while nothing is on stage, so the first pieces
// of the model appear without a hitch.
(function warmUpObjectShaders() {
  const revealed = [];
  for (const item of assembly) {
    if (!item.obj.visible) {
      item.obj.visible = true;
      revealed.push(item.obj);
    }
  }
  scene.updateMatrixWorld(true);
  renderer.compile(scene, camera);
  for (const obj of revealed) obj.visible = false;
})();

window.__TSUKIMI = {
  THREE,
  scene,
  camera,
  renderer,
  controls,
  roadReflector,
  glassMaterial,
  shopLightA,
  shopLightB,
  canopyLight,
  shopSpill,
  outlinePass,
  normalRT,
  hideGlass() {
    scene.traverse((o) => {
      if (o.isMesh && o.material === glassMaterial) o.visible = false;
    });
  },
  setReflection(v) {
    roadReflector.material.uniforms.uReflectStrength.value = v;
  },
  freezeIntro: false,
  getIntro() {
    return introElapsed;
  },
  setIntro(t) {
    introReady = true;
    introElapsed = t;
    introCameraActive = true;
  },
  replayIntro,
  setCamera(px, py, pz, tx, ty, tz, fov = camera.fov) {
    camera.position.set(px, py, pz);
    controls.target.set(tx, ty, tz);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controls.update();
  },
};

animate();

