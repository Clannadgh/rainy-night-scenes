/* ============================================================
   氛围层：雨 / 积水涟漪 / 霓虹倒影拖影 + 待机动画（自动门、灯牌闪烁）
   ============================================================ */
(function (D) {
  'use strict';
  const T = THREE, L = D.LIB, G = D.LAYOUT;

  /* ---------------- 雨 ---------------- */
  function buildRain(scene) {
    const COUNT = 1200;
    const H = 17;
    const pos = new Float32Array(COUNT * 2 * 3);
    const off = new Float32Array(COUNT * 2 * 3);
    const spd = new Float32Array(COUNT * 2);
    const len = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 25.5;
      const z = (Math.random() - 0.5) * 25.5;
      const y = Math.random() * H;
      const s = 7.5 + Math.random() * 6.5;
      const l = 0.45 + Math.random() * 0.65;
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k);
        pos[o * 3] = 0; pos[o * 3 + 1] = k; pos[o * 3 + 2] = 0;
        off[o * 3] = x; off[o * 3 + 1] = y; off[o * 3 + 2] = z;
        spd[o] = s; len[o] = l;
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aOffset', new T.BufferAttribute(off, 3));
    geo.setAttribute('aSpeed', new T.BufferAttribute(spd, 1));
    geo.setAttribute('aLen', new T.BufferAttribute(len, 1));
    geo.boundingSphere = new T.Sphere(new T.Vector3(0, H / 2, 0), 22);

    const mat = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: H },
        uWind: { value: new T.Vector2(0.24, -0.06) },   // 风：雨丝斜着落
        uColor: { value: L.linColor(0xc4dcf4) }
      },
      vertexShader: [
        'uniform float uTime;',
        'uniform float uHeight;',
        'uniform vec2 uWind;',
        'attribute vec3 aOffset;',
        'attribute float aSpeed;',
        'attribute float aLen;',
        'varying float vFade;',
        // 遮雨棚：算出该点在正下方能落到的遮挡物高度，低于它就说明落在屋檐里
        'float shelterAt(float wx, float wz) {',
        // 便利店主体（含屋顶）
        '  if (wx > -3.35 && wx < 4.85 && wz > -6.35 && wz < 2.05) return 4.75;',
        // 雨棚（斜面，从檐口往上抬）
        '  if (wx > -3.25 && wx < 4.85 && wz >= 2.05 && wz < 3.70) return 3.12 - (wz - 2.78) * 0.2398;',
        // 右侧旧楼
        '  if (wx > 6.85 && wx < 12.15 && wz > -9.15 && wz < 2.75) return 6.05;',
        '  return -100.0;',
        '}',
        'void main() {',
        '  float y = mod(aOffset.y - uTime * aSpeed, uHeight) - 1.0;',
        '  float w = position.y;',            // 0 = 雨丝下端, 1 = 上端
        '  vec3 world = vec3(',
        '    aOffset.x + position.x * 0.12 + w * aLen * uWind.x,',
        '    y + w * aLen,',
        '    aOffset.z + position.z * 0.12 + w * aLen * uWind.y',
        '  );',
        '  float ex = 1.0 - smoothstep(9.5, 12.6, abs(aOffset.x));',
        '  float ez = 1.0 - smoothstep(9.5, 12.6, abs(aOffset.z));',
        '  float sy = shelterAt(world.x, world.z);',
        '  // 落到屋檐/屋顶以下的雨丝直接淡出，避免下到店里',
        '  vFade = ex * ez * step(sy, world.y);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'varying float vFade;',
        'void main() {',
        '  gl_FragColor = vec4(uColor, 0.22 * vFade);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      fog: false
    });

    const mesh = new T.LineSegments(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    scene.add(mesh);
    return { mesh: mesh, mat: mat };
  }

  /* ---------------- 积水涟漪 ---------------- */
  function buildRipples(scene) {
    // 与柏油贴图里的积水位置一一对应，涟漪才会落在水洼里
    const centers = [
      [-1.0, 7.6], [1.9, 9.4], [5.2, 8.6],
      [-7.1, 0.4], [-7.6, -4.2], [-3.2, 10.6],
      [-8.4, 5.6], [9.6, 8.0]
    ];
    const cArr = [];
    centers.forEach(function (c) { cArr.push(new T.Vector2(c[0], c[1])); });
    const mat = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCenters: { value: cArr },
        uColor: { value: L.linColor(0xa9c9e8) }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform vec2 uCenters[8];',
        'uniform vec3 uColor;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec2 p = vec2((vUv.x - 0.5) * 24.0, (0.5 - vUv.y) * 24.0);',
        '  float acc = 0.0;',
        '  for (int i = 0; i < 8; i++) {',
        '    float t = fract(uTime * 0.8 + float(i) * 0.37);',
        '    float r = t * 0.7;',
        '    float d = distance(p, uCenters[i]);',
        '    float w = 0.035 + t * 0.07;',
        '    acc += (1.0 - smoothstep(0.0, w, abs(d - r))) * (1.0 - t) * (1.0 - t) * step(d, 0.8);',
        '  }',
        '  gl_FragColor = vec4(uColor, acc * 0.26);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      fog: false
    });
    const mesh = L.plane(G.base, G.base, mat, 0, 0.034, 0);
    mesh.renderOrder = 12;
    scene.add(mesh);
    return { mesh: mesh, mat: mat };
  }

  /* ---------------- 霓虹倒影拖影 ---------------- */
  function smearTexture() {
    return L.canvasTex(256, 256, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
  }
  function buildSmears(scene) {
    const tex = smearTexture();
    const grp = new T.Group();
    const defs = [
      [0.8, 5.6, 6.0, 3.4, 0x7fe6d8, 0.26],  // 店招在湿路面上的青白拖影
      [5.4, 4.6, 2.2, 3.0, 0x9fd8ff, 0.34],  // 贩卖机冷光
      [-6.4, -0.9, 2.8, 4.0, 0xffd9a0, 0.30], // 路灯暖光
      [-0.6, 6.9, 3.4, 2.6, 0xff9a70, 0.16],  // 招牌暖色余光
      [9.0, 6.0, 3.4, 2.4, 0xffe0b0, 0.18],  // 车灯
      [-7.2, 4.4, 3.0, 2.6, 0x8fd8ff, 0.16],  // 侧街冷光
      [3.0, 7.6, 3.6, 2.4, 0x9ff0e0, 0.12]
    ];
    defs.forEach(function (d) {
      const m = L.plane(d[2], d[3], new T.MeshBasicMaterial({
        map: tex, color: L.linColor(d[4]), transparent: true, opacity: d[5],
        blending: T.AdditiveBlending, depthWrite: false, fog: false
      }), d[0], 0.038, d[1]);
      m.renderOrder = 13;
      grp.add(m);
    });
    scene.add(grp);
    return grp;
  }

  /* ---------------- 待机动画 ---------------- */
  // 自动门周期（秒）：开门 4.5s，其余时间关门。用纯函数求门开度，
  // 这样任何时刻的画面都可复现（截图对比、回归检查）。
  const DOOR_CYCLE = 11.0, DOOR_AT = 3.0, DOOR_LEN = 4.5, DOOR_RAMP = 1.0;
  function doorOpenAmount(time) {
    const p = ((time % DOOR_CYCLE) + DOOR_CYCLE) % DOOR_CYCLE;
    if (p < DOOR_AT || p > DOOR_AT + DOOR_LEN) return 0;
    const u = p - DOOR_AT;
    if (u < DOOR_RAMP) return L.easeInOutCubic(u / DOOR_RAMP);
    if (u < DOOR_LEN - DOOR_RAMP) return 1;
    return L.easeInOutCubic(1 - (u - (DOOR_LEN - DOOR_RAMP)) / DOOR_RAMP);
  }
  function updateFxs(time) {
    // 自动门
    const d = D.doorLeaves;
    if (d) {
      const e = doorOpenAmount(time);
      d.open = e;
      const s = d.slide === undefined ? 0.9 : d.slide;
      d.l.position.x = d.lx - e * s;
      d.r.position.x = d.rx + e * s;
    }
    // 招牌轻微闪烁
    const fm = D.flickerMats;
    if (fm) {
      const n = Math.sin(time * 7.3) * Math.sin(time * 2.1) * Math.sin(time * 0.77);
      const k = 1 + n * 0.06;
      for (let i = 0; i < fm.length; i++) {
        const base = fm[i].userData.baseColor;
        if (base) fm[i].color.copy(base).multiplyScalar(k);
      }
    }
    // 贩卖机灯与路灯轻微呼吸（围绕各自的基准强度，不会突然跳变）
    if (D.vendLight) D.vendLight.intensity = D.vendLight.userData.base + Math.sin(time * 3.1) * 0.08;
    if (D.streetLamp) D.streetLamp.intensity = D.streetLamp.userData.base + Math.sin(time * 1.7) * 0.06;
  }

  D.buildRain = buildRain;
  D.buildRipples = buildRipples;
  D.buildSmears = buildSmears;
  D.updateFxs = updateFxs;
})(window.DIORAMA);
