/* ============================================================
   雨夜便利店街角 — 公共工具层
   三渲二（cel/toon）材质、描边、程序化贴图、场景骨架
   ============================================================ */
window.DIORAMA = window.DIORAMA || {};

(function (D) {
  'use strict';
  const T = THREE;

  /* ------------------- 赛璐璐色阶 ------------------- */
  const gradientMap = (function () {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 1;
    const ctx = c.getContext('2d');
    const steps = [58, 124, 192, 255];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgb(' + steps[i] + ',' + steps[i] + ',' + steps[i] + ')';
      ctx.fillRect(i, 0, 1, 1);
    }
    const t = new T.CanvasTexture(c);
    t.minFilter = T.NearestFilter;
    t.magFilter = T.NearestFilter;
    t.generateMipmaps = false;
    return t;
  })();

  /* ------------------- 确定性随机 ------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20261019);
  function rr(a, b) { return a + rand() * (b - a); }
  function ri(a, b) { return Math.floor(rr(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }

  /* ------------------- 色彩管线 -------------------
     three r128 处于 legacy 模式：材质颜色不自动做 sRGB→Linear 转换，
     而最终输出又要做 Linear→sRGB 还原。这里统一把 sRGB 十六进制色
     转换到线性空间，保证「代码里写的颜色 = 屏幕上的颜色」。 */
  function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linColor(hex) {
    const c = new T.Color(hex);
    c.r = srgbToLinear(c.r);
    c.g = srgbToLinear(c.g);
    c.b = srgbToLinear(c.b);
    return c;
  }

  /* ------------------- 材质工厂 ------------------- */
  function toon(color, opts) {
    return new T.MeshToonMaterial(Object.assign({ color: linColor(color), gradientMap: gradientMap }, opts || {}));
  }
  function basic(color, opts) {
    return new T.MeshBasicMaterial(Object.assign({ color: linColor(color) }, opts || {}));
  }
  // 自发光（不参与光照，直接进 bloom）
  function glow(color, k) {
    const c = linColor(color);
    c.multiplyScalar(k === undefined ? 1.5 : k);
    return new T.MeshBasicMaterial({ color: c, fog: false });
  }
  function glowMap(tex, k) {
    const s = k === undefined ? 1.35 : k;
    return new T.MeshBasicMaterial({ map: tex, color: new T.Color().setRGB(s, s, s), fog: false });
  }
  function neon(hex, k) {
    const c = linColor(hex);
    c.multiplyScalar(k === undefined ? 2.0 : k);
    return new T.MeshBasicMaterial({ color: c, fog: false });
  }

  /* ------------------- 几何体快捷函数 ------------------- */
  function box(w, h, d, mat, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, seg) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function sph(r, mat, x, y, z, seg) {
    const m = new T.Mesh(new T.SphereGeometry(r, seg || 14, seg ? Math.max(6, seg / 2) : 9), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function plane(w, d, mat, x, y, z) {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function wall(w, h, mat, x, y, z) {
    // 立面墙：贴图朝 +Z
    const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  /* ------------------- 反向外扩描边（动画线条） ------------------- */
  function outline(mesh, thickness, color) {
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const s = new T.Vector3();
    g.boundingBox.getSize(s);
    const o = new T.Mesh(g, new T.MeshBasicMaterial({
      color: linColor(color === undefined ? 0x0c0f17 : color),
      side: T.BackSide,
      fog: false
    }));
    o.scale.set(
      1 + thickness / Math.max(s.x, 0.02),
      1 + thickness / Math.max(s.y, 0.02),
      1 + thickness / Math.max(s.z, 0.02)
    );
    o.renderOrder = -1;
    o.castShadow = false;
    o.receiveShadow = false;
    mesh.add(o);
    return o;
  }
  // 判断某个材质是否应该跳过描边。
  // 注意：MeshToonMaterial 本身带 emissive 属性，所以不能用「有 emissive 就跳过」
  // 这种写法——那样会把所有卡通材质全部排除掉，描边就完全失效了。
  function skipOutline(mat) {
    if (!mat) return true;
    if (Array.isArray(mat)) return mat.some(skipOutline);
    if (mat.transparent) return true;                       // 半透明件（玻璃/贴图）不描边
    if (mat.isMeshBasicMaterial || mat.isShaderMaterial) return true;  // 发光件 / 反射面 / 描边壳
    if (mat.emissive && mat.emissive.getHex() !== 0) return true;      // 真正带自发光的件
    return false;
  }
  // 给一组网格批量描边（可跳过透明/自发光件）
  function outlineAll(root, thickness, color, skip) {
    const targets = [];
    root.traverse(function (o) {
      if (!o.isMesh || o.userData.noOutline) return;
      if (skipOutline(o.material)) return;
      targets.push(o);
    });
    targets.forEach(function (o) { outline(o, thickness, color); });
    return root;
  }

  /* ------------------- 程序化贴图 ------------------- */
  function canvasTex(w, h, draw, opts) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    if (opts && opts.repeat) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    if (opts && opts.anisotropy) t.anisotropy = opts.anisotropy;
    t.needsUpdate = true;
    return t;
  }

  /* ------------------- 场景骨架登记（供入场动画使用） ------------------- */
  const parts = [];
  function part(obj, order, mode) {
    obj.userData.build = { order: order, mode: mode || 'grow' };
    parts.push(obj);
    return obj;
  }
  function partGroup(x, y, z, order, mode) {
    const g = new T.Group();
    g.position.set(x || 0, y || 0, z || 0);
    return part(g, order, mode);
  }

  /* ------------------- 缓动 ------------------- */
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function easeOutCubic(t) { const p = 1 - t; return 1 - p * p * p; }
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ------------------- 布局常量 ------------------- */
  const LAYOUT = {
    base: 24,              // 底座边长（正方形）
    plinthTop: 0,          // 路面标高
    roadY: 0.012,          // 湿柏油路面层标高（放在路面上的物件要压到这个高度）
    walkTop: 0.18,         // 人行道（路缘石体）标高
    walkY: 0.193,          // 人行道面层（方砖 / 水泥地）标高
    blockMinX: -5.2, blockMaxX: 12,
    blockMinZ: -12, blockMaxZ: 4.6,
    storeMinX: -3.0, storeMaxX: 4.6,
    storeMinZ: -6.2, storeMaxZ: 2.0,
    wallTop: 4.38,
    alleyMinX: 4.6, alleyMaxX: 7.0,
    bldgMinX: 7.0, bldgMaxX: 12,
    bldgMinZ: -9.0, bldgMaxZ: 2.6
  };

  D.LIB = {
    T: T, gradientMap: gradientMap, rand: rand, rr: rr, ri: ri, pick: pick,
    toon: toon, basic: basic, glow: glow, glowMap: glowMap, neon: neon,
    linColor: linColor, srgbToLinear: srgbToLinear,
    box: box, cyl: cyl, sph: sph, plane: plane, wall: wall,
    outline: outline, outlineAll: outlineAll,
    canvasTex: canvasTex,
    parts: parts, part: part, partGroup: partGroup,
    clamp01: clamp01, easeOutCubic: easeOutCubic, easeOutBack: easeOutBack, easeInOutCubic: easeInOutCubic
  };
  D.LAYOUT = LAYOUT;
})(window.DIORAMA);
