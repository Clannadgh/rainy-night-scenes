/* 场景自检：在 Node 中构建场景并检查对象可见性 / 缩放 / 位置
   用法: node tools/inspect.js            */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* ---- 极简 canvas 2D 桩 ---- */
function makeCtx() {
  const grad = { addColorStop() {} };
  const target = {
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => null,
    measureText: (s) => ({ width: (s || '').length * 8 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
    drawImage() {},
    save() {}, restore() {},
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return function () {};
    },
    set() { return true; }
  });
}
function makeCanvas() {
  return { width: 1, height: 1, style: {}, getContext: () => makeCtx(), toDataURL: () => '' };
}
global.document = {
  createElement(tag) {
    if (tag === 'canvas') return makeCanvas();
    return { style: {}, appendChild() {} };
  },
  body: { appendChild() {}, style: {} },
  addEventListener() {}
};
global.window = global;
global.self = global;
global.navigator = { userAgent: 'node' };
global.devicePixelRatio = 1;
global.innerWidth = 1280;
global.innerHeight = 720;
global.addEventListener = () => {};

const THREE = require(path.join(ROOT, 'node_modules', 'three', 'build', 'three.js'));
global.THREE = THREE;

['vendor/Reflector.js', 'js/lib.js', 'js/world.js', 'js/shop.js', 'js/props.js', 'js/rain.js'].forEach(function (f) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInThisContext(code, { filename: f });
});

const D = global.DIORAMA;
const scene = new THREE.Scene();
D.buildWorld(scene);
D.buildShop(scene);
D.buildProps(scene);

console.log('parts registered:', D.LIB.parts.length);
console.log('scene children:', scene.children.length);

let meshes = 0, visible = 0;
scene.traverse(o => { if (o.isMesh) meshes++; });
console.log('meshes:', meshes);

const STEP = 0.125, DUR = 0.66;
function stateAt(t) {
  D.LIB.parts.forEach(p => {
    const local = Math.min(1, Math.max(0, (t - p.userData.build.order * STEP) / DUR));
    p.visible = local > 0;
  });
}
stateAt(20);
D.LIB.parts.forEach(function (p, i) {
  const b = p.userData.build;
  console.log(
    String(i).padStart(2), 'order=' + String(b.order).padStart(2),
    'mode=' + b.mode,
    'visible=' + p.visible,
    'pos=(' + p.position.x.toFixed(2) + ',' + p.position.y.toFixed(2) + ',' + p.position.z.toFixed(2) + ')',
    'children=' + p.children.length
  );
});
