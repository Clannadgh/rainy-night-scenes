/* ============================================================
   世界层：展示底座 / 湿路面 / 人行道 / 街道设施 / 邻楼与小巷
   ============================================================ */
(function (D) {
  'use strict';
  const T = THREE, L = D.LIB, G = D.LAYOUT;
  const rr = L.rr, ri = L.ri;

  /* ---------------- 程序化贴图 ---------------- */

  // 湿柏油：底色 + 颗粒 + 积水(alpha 挖洞)
  function asphaltTexture() {
    const S = 1024;
    const base = document.createElement('canvas');
    base.width = base.height = S;
    const b = base.getContext('2d');
    b.fillStyle = '#2b3240';
    b.fillRect(0, 0, S, S);
    for (let i = 0; i < 30000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const s = Math.random() * 2.1 + 0.4;
      const v = Math.random() * 42 + 16;
      b.fillStyle = 'rgba(' + (v + 14) + ',' + (v + 22) + ',' + (v + 34) + ',0.55)';
      b.fillRect(x, y, s, s);
    }
    // 大面积色块
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 150;
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() > 0.5;
      g.addColorStop(0, dark ? 'rgba(24,29,40,0.45)' : 'rgba(60,70,88,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = g;
      b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
    }
    // 裂缝
    b.strokeStyle = 'rgba(18,22,30,0.5)';
    for (let i = 0; i < 26; i++) {
      b.lineWidth = Math.random() * 1.6 + 0.4;
      b.beginPath();
      let x = Math.random() * S, y = Math.random() * S;
      b.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; b.lineTo(x, y); }
      b.stroke();
    }
    // 油渍
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 18 + Math.random() * 40;
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(14,16,22,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = g; b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
    }

    // 输出带 alpha 的版本：整体半透（湿路面反光），积水处进一步挖空
    const out = document.createElement('canvas');
    out.width = out.height = S;
    const o = out.getContext('2d');
    o.globalAlpha = 0.84;
    o.drawImage(base, 0, 0);
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'destination-out';
    // [世界x, 世界z, 半径u, 半径v]  ->  u=(x+12)/24, v=(12-z)/24
    const puddles = [
      [-1.0, 7.6, 0.115, 0.042], [1.9, 9.4, 0.085, 0.030], [5.2, 8.6, 0.095, 0.036],
      [-7.1, 0.4, 0.075, 0.030], [-7.6, -4.2, 0.088, 0.034], [-3.2, 10.6, 0.070, 0.026],
      [-8.4, 5.6, 0.065, 0.026], [9.6, 8.0, 0.080, 0.030]
    ];
    puddles.forEach(function (p) {
      const cx = (p[0] + 12) / 24 * S, cy = (12 - p[1]) / 24 * S;
      const rx = p[2] * S, ry = p[3] * S;
      const g = o.createRadialGradient(cx, cy, 0, cx, cy, 1);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(0.72, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      o.save();
      o.translate(cx, cy); o.scale(1, ry / rx); o.translate(-cx, -cy);
      o.fillStyle = g; o.beginPath(); o.arc(cx, cy, rx, 0, Math.PI * 2); o.fill();
      o.restore();
    });
    o.globalCompositeOperation = 'source-over';

    const t = new T.CanvasTexture(out);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  // 人行道方砖
  function tileTexture() {
    return L.canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = '#8d95a8';
      c.fillRect(0, 0, w, h);
      const n = 4, s = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const v = 0.92 + Math.random() * 0.16;
          const g = Math.floor(141 * v), b = Math.floor(168 * v);
          c.fillStyle = 'rgb(' + g + ',' + g + ',' + b + ')';
          c.fillRect(i * s + 1.2, j * s + 1.2, s - 2.4, s - 2.4);
        }
      }
      c.strokeStyle = 'rgba(70,78,95,0.75)';
      c.lineWidth = 2.4;
      for (let i = 0; i <= n; i++) {
        c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.stroke();
        c.beginPath(); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke();
      }
      for (let i = 0; i < 2600; i++) {
        c.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')';
        c.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
      }
    }, { repeat: [7, 7], aniso: 8 });
  }

  // 点字ブロック（盲道）
  function tactileTexture() {
    return L.canvasTex(128, 128, function (c, w, h) {
      c.fillStyle = '#d8a72a';
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(150,110,20,0.55)';
      const n = 4, s = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          c.beginPath();
          c.arc((i + 0.5) * s, (j + 0.5) * s, s * 0.16, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.fillStyle = 'rgba(255,235,170,0.25)';
      c.fillRect(0, 0, w, 3);
    }, { repeat: [1, 1] });
  }

  // 排水沟箅子
  function grateTexture() {
    return L.canvasTex(64, 128, function (c, w, h) {
      c.fillStyle = '#1a1f2a';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#39414f';
      for (let i = 0; i < 8; i++) c.fillRect(0, i * 16 + 3, w, 9);
      c.fillStyle = 'rgba(120,132,150,0.5)';
      for (let i = 0; i < 8; i++) c.fillRect(0, i * 16 + 3, w, 2);
    }, { repeat: [1, 1] });
  }

  // 侧街 / 后巷水泥地
  function concreteTexture() {
    return L.canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = '#6c7383';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = Math.random() * 30;
        c.fillStyle = 'rgba(' + (108 + v) + ',' + (115 + v) + ',' + (131 + v) + ',0.5)';
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      c.strokeStyle = 'rgba(50,56,68,0.5)';
      c.lineWidth = 3;
      c.strokeRect(0, 0, w, h);
    }, { repeat: [6, 6] });
  }

  /* ---------------- 主构建 ---------------- */
  function build(scene) {
    const root = new T.Group();
    scene.add(root);

    /* ===== 1. 展示底座（正方形基座 + 倒角底唇 + 顶部发光边线） ===== */
    const plinth = L.partGroup(0, 0, 0, 0, 'grow');
    const plinthMat = L.toon(0x1d2230);
    const body = L.box(G.base, 1.05, G.base, plinthMat, 0, -0.545, 0);
    plinth.add(body);
    const lip = L.box(G.base + 0.55, 0.17, G.base + 0.55, L.toon(0x0e1119), 0, -1.15, 0);
    plinth.add(lip);
    L.outline(body, 0.05, 0x070910);
    L.outline(lip, 0.05, 0x070910);
    // 顶缘细光带（收藏模型感）
    const edgeMat = L.neon(0x2f7f96, 0.85);
    const eh = G.base / 2 - 0.02;
    const e1 = L.box(G.base, 0.035, 0.05, edgeMat, 0, 0.012, -eh);
    const e2 = L.box(G.base, 0.035, 0.05, edgeMat, 0, 0.012, eh);
    const e3 = L.box(0.05, 0.035, G.base, edgeMat, -eh, 0.012, 0);
    const e4 = L.box(0.05, 0.035, G.base, edgeMat, eh, 0.012, 0);
    plinth.add(e1); plinth.add(e2); plinth.add(e3); plinth.add(e4);
    root.add(plinth);

    /* ===== 2. 湿润路面（平面镜反射 + 湿柏油层） ===== */
    const roadGrp = L.partGroup(0, 0, 0, 1, 'grow');
    const reflGeo = new T.PlaneGeometry(G.base, G.base);
    const reflector = new T.Reflector(reflGeo, {
      clipBias: 0.0035,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x3c4658
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = 0.004;
    roadGrp.add(reflector);
    D.roadReflector = reflector;

    const roadTex = asphaltTexture();
    const road = L.plane(G.base, G.base, L.toon(0xffffff, {
      map: roadTex, transparent: true, depthWrite: false
    }), 0, 0.012, 0);
    road.renderOrder = 2;
    road.receiveShadow = true;
    roadGrp.add(road);
    D.roadMesh = road;
    root.add(roadGrp);

    /* ===== 3. 人行道（街角地块） ===== */
    const walkGrp = L.partGroup(0, 0, 0, 2, 'grow');
    const bw = G.blockMaxX - G.blockMinX, bd = G.blockMaxZ - G.blockMinZ;
    const bcx = (G.blockMinX + G.blockMaxX) / 2, bcz = (G.blockMinZ + G.blockMaxZ) / 2;
    const curbBody = L.box(bw, 0.15, bd, L.toon(0x6d7484), bcx, 0.075, bcz);
    walkGrp.add(curbBody);
    L.outline(curbBody, 0.03, 0x0c0f17);
    const curbTop = L.box(bw, 0.04, bd, L.toon(0x8b93a6), bcx, 0.17, bcz);
    walkGrp.add(curbTop);
    const tiles = L.plane(bw, bd, L.toon(0xffffff, { map: tileTexture() }), bcx, 0.193, bcz);
    tiles.receiveShadow = true;
    walkGrp.add(tiles);
    // 后场（店铺后方空地）用另一层水泥地——必须铺在方砖之上，否则会被方砖盖住
    const lotW = 7.0 - G.blockMinX, lotD = -6.2 - G.blockMinZ;
    const lot = L.plane(lotW, lotD, L.toon(0xffffff, { map: concreteTexture() }),
      (G.blockMinX + 7.0) / 2, 0.196, (G.blockMinZ - 6.2) / 2);
    lot.receiveShadow = true;
    walkGrp.add(lot);
    root.add(walkGrp);

    /* ===== 4. 路缘、盲道、排水沟 ===== */
    const edgeGrp = L.partGroup(0, 0, 0, 3, 'grow');
    // 盲道（街角 + 斑马线端头）
    const tact = L.toon(0xffffff, { map: tactileTexture() });
    const tactCorner = L.plane(1.6, 1.6, tact, -4.4, 0.198, 3.8);
    edgeGrp.add(tactCorner);
    const tactCross = L.plane(3.4, 0.62, tact, 1.85, 0.198, 4.24);
    edgeGrp.add(tactCross);
    // 排水沟（前后两条）
    const grate = L.toon(0xffffff, { map: grateTexture() });
    const g1 = L.plane(G.base - 6.8, 0.42, grate, 1.4, 0.020, 4.79);
    g1.rotation.z = 0;
    edgeGrp.add(g1);
    const g2 = L.plane(0.42, 16.6, grate, -5.41, 0.020, -3.7);
    edgeGrp.add(g2);
    // 路缘反光小标（沿左侧路缘一排，等间距）
    const curbDot = L.neon(0xd8c060, 0.9);
    for (let i = 0; i < 9; i++) {
      edgeGrp.add(L.box(0.09, 0.02, 0.16, curbDot, -5.14, 0.205, 3.6 - i * 0.9));
    }
    root.add(edgeGrp);

    /* ===== 5. 路面标线：斑马线、停车位、井盖 ===== */
    const markGrp = L.partGroup(0, 0, 0, 4, 'grow');
    const paint = L.basic(0xc4d4e6, { transparent: true, opacity: 0.6, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const s = L.plane(0.56, 4.2, paint, 0.45 + i * 0.9, 0.026, 7.1);
      s.renderOrder = 3;
      markGrp.add(s);
    }
    const lineMat = L.basic(0xcfdcea, { transparent: true, opacity: 0.6, depthWrite: false });
    const bayLine = L.plane(5.2, 0.14, lineMat, 8.6, 0.026, 6.52);
    bayLine.renderOrder = 3; markGrp.add(bayLine);
    const bayTick = L.plane(0.14, 1.6, lineMat, 6.06, 0.026, 5.72);
    bayTick.renderOrder = 3; markGrp.add(bayTick);
    // 井盖
    const manhole = L.cyl(0.42, 0.42, 0.03, L.toon(0x4a5262), -7.2, 0.026, 1.6, 18);
    markGrp.add(manhole);
    const manRim = L.cyl(0.48, 0.48, 0.02, L.toon(0x39404e), -7.2, 0.021, 1.6, 18);
    markGrp.add(manRim);
    root.add(markGrp);

    /* ===== 6. 背面/右侧围界（模型切边） ===== */
    const wallGrp = L.partGroup(0, 0, 0, 5, 'grow');
    const backWall = L.box(17.2, 1.0, 0.3, L.toon(0x555d6e), 3.4, 0.68, -11.85);
    wallGrp.add(backWall);
    L.outline(backWall, 0.03, 0x0c0f17);
    const cap = L.box(17.2, 0.07, 0.4, L.toon(0x6e7788), 3.4, 1.21, -11.85);
    wallGrp.add(cap);
    root.add(wallGrp);

    /* ===== 7. 右侧邻楼（旧式两层，卷帘门 + 二层窗） ===== */
    const bldgGrp = L.partGroup(0, 0, 0, 8, 'grow');
    const bw2 = G.bldgMaxX - G.bldgMinX, bd2 = G.bldgMaxZ - G.bldgMinZ;
    const bcx2 = (G.bldgMinX + G.bldgMaxX) / 2, bcz2 = (G.bldgMinZ + G.bldgMaxZ) / 2;
    const bWall = L.box(bw2, 5.6, bd2, L.toon(0x4b5468), bcx2, 0.18 + 2.8, bcz2);
    bldgGrp.add(bWall);
    L.outline(bWall, 0.045, 0x0a0d14);
    const bSlab = L.box(bw2 + 0.3, 0.22, bd2 + 0.3, L.toon(0x39404e), bcx2, 5.89, bcz2);
    bldgGrp.add(bSlab);
    L.outline(bSlab, 0.04, 0x0a0d14);
    // 一层卷帘门
    const shutterTex = L.canvasTex(128, 128, function (c, w, h) {
      for (let i = 0; i < 16; i++) {
        const g = Math.floor(74 + Math.random() * 22);
        c.fillStyle = 'rgb(' + g + ',' + (g + 6) + ',' + (g + 16) + ')';
        c.fillRect(0, i * 8, w, 7);
        c.fillStyle = 'rgba(20,24,32,0.55)';
        c.fillRect(0, i * 8 + 7, w, 1);
      }
    }, { repeat: [2, 3] });
    const shutter = L.wall(3.4, 2.7, L.toon(0xffffff, { map: shutterTex }), 8.9, 1.53, G.bldgMaxZ + 0.012);
    bldgGrp.add(shutter);
    L.outline(shutter, 0.04, 0x0a0d14);
    // 一层小屋门 + 灯
    const dDoor = L.box(0.9, 2.0, 0.1, L.toon(0x2a303c), 7.5, 1.18, G.bldgMaxZ + 0.02);
    bldgGrp.add(dDoor);
    const dLamp = L.box(0.34, 0.12, 0.16, L.glow(0xffcf8a, 1.25), 7.5, 2.34, G.bldgMaxZ + 0.12);
    bldgGrp.add(dLamp);
    const dLampLight = new T.PointLight(0xffc888, 1.3, 6.5, 1.6);
    dLampLight.position.set(7.5, 2.3, G.bldgMaxZ + 0.5);
    bldgGrp.add(dLampLight);
    // 二层窗
    const winFrame = L.toon(0x262c38);
    [[7.9, 4.2], [9.5, 4.2], [11.0, 4.2]].forEach(function (w, i) {
      const lit = i !== 1;
      const fr = L.box(1.05, 1.2, 0.1, winFrame, w[0], w[1], G.bldgMaxZ + 0.03);
      bldgGrp.add(fr);
      const glass = L.wall(0.85, 1.0, lit ? L.glow(0xffd9a0, 0.95) : L.glow(0x5a7fa8, 0.5), w[0], w[1], G.bldgMaxZ + 0.09);
      bldgGrp.add(glass);
      const bar = L.box(0.88, 0.05, 0.03, winFrame, w[0], w[1], G.bldgMaxZ + 0.12);
      bldgGrp.add(bar);
    });
    // 阳台栏杆
    const rail = L.toon(0x515a6b);
    const bal = L.box(4.2, 0.08, 0.08, rail, 9.4, 3.02, G.bldgMaxZ + 0.28);
    bldgGrp.add(bal);
    for (let i = 0; i < 10; i++) bldgGrp.add(L.box(0.05, 0.85, 0.05, rail, 7.45 + i * 0.43, 2.6, G.bldgMaxZ + 0.28));
    const balFloor = L.box(4.4, 0.1, 0.72, L.toon(0x464e5e), 9.4, 2.16, G.bldgMaxZ + 0.3);
    bldgGrp.add(balFloor);
    // 外挂空调外机
    bldgGrp.add(L.box(0.8, 0.55, 0.35, L.toon(0x7e8798), 11.0, 3.4, G.bldgMaxZ + 0.22));
    // 屋顶水箱 + 天线
    bldgGrp.add(L.cyl(0.55, 0.55, 0.9, L.toon(0x6a7384), 8.6, 6.5, -2.0, 12));
    bldgGrp.add(L.box(0.08, 2.2, 0.08, L.toon(0x8b93a3), 11.4, 7.0, -1.0));
    /* --- 背面细节（从模型背面看也不空 --- */
    const bBackZ = G.bldgMinZ - 0.02;
    // 两扇小窗 + 窗框
    for (let i = 0; i < 2; i++) {
      const x = 8.2 + i * 2.0;
      bldgGrp.add(L.box(1.0, 1.1, 0.1, L.toon(0x39414f), x, 4.1, bBackZ));
      bldgGrp.add(L.wall(0.8, 0.9, L.glow(0x6f93bd, 0.4), x, 4.1, bBackZ - 0.07));
    }
    // 竖向排水管
    bldgGrp.add(L.cyl(0.07, 0.07, 5.2, L.toon(0x555d6c), 11.6, 2.9, bBackZ - 0.08, 8));
    // 墙面配电箱 + 消防栓
    bldgGrp.add(L.box(0.5, 0.66, 0.24, L.toon(0x7e8798), 7.4, 1.7, bBackZ - 0.12));
    bldgGrp.add(L.box(0.22, 0.34, 0.16, L.toon(0xc0392b), 7.4, 0.95, bBackZ - 0.1));
    // 外挂空调
    bldgGrp.add(L.box(0.78, 0.56, 0.5, L.toon(0x8d95a4), 9.4, 1.5, bBackZ - 0.28));
    root.add(bldgGrp);

    /* ===== 8. 小巷（店铺与邻楼之间的通道） ===== */
    const alleyGrp = L.partGroup(0, 0, 0, 9, 'grow');
    const alleyFloor = L.plane(G.alleyMaxX - G.alleyMinX, 8.8,
      L.toon(0xffffff, { map: concreteTexture() }), 5.8, 0.196, -1.8);
    alleyGrp.add(alleyFloor);
    // 巷尾墙
    const alleyEnd = L.box(G.alleyMaxX - G.alleyMinX, 4.2, 0.25, L.toon(0x363d4b), 5.8, 2.1, -6.2);
    alleyGrp.add(alleyEnd);
    // 巷内小灯
    const alLamp = L.box(0.3, 0.14, 0.18, L.glow(0xffd79a, 1.1), 4.72, 2.5, 0.2);
    alleyGrp.add(alLamp);
    const alLight = new T.PointLight(0xffc98a, 0.55, 6, 1.8);
    alLight.position.set(4.95, 2.45, 0.2);
    alleyGrp.add(alLight);
    // 墙上管线
    const pipeMat = L.toon(0x2a3040);
    alleyGrp.add(L.cyl(0.07, 0.07, 8.4, pipeMat, 4.72, 2.3, -2.4, 8));
    for (let i = 0; i < 4; i++) alleyGrp.add(L.box(0.14, 0.1, 0.1, pipeMat, 4.72, 1.0 + i * 1.6, -2.4));
    // 墙上的空调外机（临巷）
    alleyGrp.add(L.box(0.7, 0.5, 0.85, L.toon(0x7e8798), 5.05, 2.0, -4.0));
    // 巷口水洼
    const apud = L.plane(1.5, 2.2, L.basic(0x101722, { transparent: true, opacity: 0.55, depthWrite: false }), 5.9, 0.199, 1.4);
    apud.renderOrder = 3;
    alleyGrp.add(apud);
    root.add(alleyGrp);

    /* ===== 9. 街角护栏（侧街路缘） ===== */
    const railGrp = L.partGroup(0, 0, 0, 10, 'grow');
    const railMat = L.toon(0xc3ccd9);
    const railX = -5.05;
    [-5.0, -3.15, -1.3, 0.55].forEach(function (z) {
      const p = L.box(0.1, 0.88, 0.1, railMat, railX, 0.62, z);
      railGrp.add(p);
      L.outline(p, 0.022);
    });
    const r1 = L.box(0.07, 0.09, 5.75, railMat, railX, 0.92, -2.23);
    const r2 = L.box(0.07, 0.07, 5.75, railMat, railX, 0.55, -2.23);
    railGrp.add(r1); railGrp.add(r2);
    L.outline(r1, 0.02); L.outline(r2, 0.02);
    root.add(railGrp);

    /* ===== 10. 电线杆 + 变压器 + 电线 ===== */
    const poleGrp = L.partGroup(-4.8, 0.19, 3.6, 11, 'grow');
    const poleMat = L.toon(0x9aa3b0);
    const pole = L.cyl(0.13, 0.16, 8.6, poleMat, 0, 4.3, 0, 12);
    poleGrp.add(pole);
    L.outline(pole, 0.022);
    // 横担
    const armMat = L.toon(0x6f7684);
    const arms = [[6.7, 1.75], [7.35, 1.55], [7.95, 1.4]];
    arms.forEach(function (a) {
      const arm = L.box(a[1], 0.09, 0.09, armMat, 0, a[0], 0);
      poleGrp.add(arm);
      const n = a[1] > 1.5 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const x = -a[1] / 2 + 0.22 + i * ((a[1] - 0.44) / Math.max(n - 1, 1));
        const ins = L.cyl(0.055, 0.065, 0.2, L.toon(0xcfd6e0), x, a[0] + 0.14, 0, 8);
        poleGrp.add(ins);
      }
    });
    // 变压器
    const tr = L.cyl(0.3, 0.3, 0.62, L.toon(0x5e6675), 0.2, 5.35, 0, 12);
    poleGrp.add(tr);
    poleGrp.add(L.box(0.5, 0.08, 0.5, L.toon(0x474e5c), 0.2, 5.7, 0));
    // 杆上小灯
    const poleLamp = L.box(0.3, 0.13, 0.2, L.glow(0xffe0b0, 1.15), 0.22, 4.95, 0.22);
    poleGrp.add(poleLamp);
    const pl = new T.PointLight(0xffd6a0, 0.45, 6, 1.8);
    pl.position.set(0.25, 4.9, 0.3);
    poleGrp.add(pl);
    // 杆号牌
    poleGrp.add(L.box(0.26, 0.3, 0.03, L.toon(0xe6e9ee), 0, 2.1, 0.14));
    root.add(poleGrp);

    // 第二根杆（后方）
    const pole2 = L.partGroup(-4.8, 0.196, -9.6, 11, 'grow');
    pole2.add(L.cyl(0.12, 0.15, 7.8, poleMat, 0, 3.9, 0, 12));
    pole2.add(L.box(1.5, 0.09, 0.09, armMat, 0, 6.6, 0));
    root.add(pole2);

    // 第三根杆（右前）
    const pole3 = L.partGroup(11.3, 0.19, 3.9, 11, 'grow');
    pole3.add(L.cyl(0.12, 0.15, 8.0, poleMat, 0, 4.0, 0, 12));
    pole3.add(L.box(1.5, 0.09, 0.09, armMat, 0, 6.8, 0));
    root.add(pole3);

    /* ===== 11. 电线（悬链线） ===== */
    const wireGrp = L.partGroup(0, 0, 0, 12, 'grow');
    const wireMat = L.toon(0x11151d);
    function wire(a, b, sag) {
      const m1 = a.clone().lerp(b, 0.34); m1.y -= sag * 0.8;
      const m2 = a.clone().lerp(b, 0.67); m2.y -= sag * 0.8;
      const curve = new T.CatmullRomCurve3([a, m1, m2, b]);
      const mesh = new T.Mesh(new T.TubeGeometry(curve, 26, 0.018, 5, false), wireMat);
      wireGrp.add(mesh);
    }
    const P = new T.Vector3(-4.8, 0.18, 3.6), P2 = new T.Vector3(-4.8, 0.18, -9.6), P3 = new T.Vector3(11.3, 0.18, 3.9);
    for (let i = 0; i < 3; i++) {
      const y = [6.95, 7.6, 8.2][i];
      wire(new T.Vector3(P.x - 0.5 + i * 0.5, y, P.z), new T.Vector3(P2.x - 0.5 + i * 0.5, y - 0.35, P2.z), 0.55);
      wire(new T.Vector3(P.x - 0.5 + i * 0.5, y, P.z), new T.Vector3(P3.x - 0.5 + i * 0.5, y - 0.3, P3.z), 0.9);
    }
    // 沿店面的引入线
    wire(new T.Vector3(-4.3, 6.7, 3.6), new T.Vector3(-0.5, 5.2, 2.1), 0.35);
    wire(new T.Vector3(-4.3, 6.95, 3.6), new T.Vector3(-0.5, 5.35, 2.1), 0.3);
    root.add(wireGrp);

    /* ===== 12. 路灯 ===== */
    const lampGrp = L.partGroup(-4.5, 0.19, -0.9, 13, 'grow');
    const lampMat = L.toon(0x7f8797);
    const lpost = L.cyl(0.075, 0.11, 5.0, lampMat, 0, 2.5, 0, 10);
    lampGrp.add(lpost);
    L.outline(lpost, 0.02);
    lampGrp.add(L.cyl(0.2, 0.26, 0.2, lampMat, 0, 0.1, 0, 12));
    // 弯臂
    const armCurve = new T.CatmullRomCurve3([
      new T.Vector3(0, 4.95, 0), new T.Vector3(-0.45, 5.18, 0),
      new T.Vector3(-1.0, 5.12, 0), new T.Vector3(-1.35, 4.88, 0)
    ]);
    const arm = new T.Mesh(new T.TubeGeometry(armCurve, 20, 0.055, 6, false), lampMat);
    lampGrp.add(arm);
    // 灯头
    const head = L.cyl(0.3, 0.16, 0.3, lampMat, -1.42, 4.78, 0, 14);
    lampGrp.add(head);
    L.outline(head, 0.022);
    const lens = L.cyl(0.26, 0.26, 0.05, L.glow(0xffe6b8, 1.3), -1.42, 4.61, 0, 14);
    lampGrp.add(lens);
    const lampLight = new T.PointLight(0xffdcae, 1.2, 13, 1.5);
    lampLight.position.set(-1.42, 4.5, 0);
    lampLight.userData.base = 1.2;
    lampGrp.add(lampLight);
    D.streetLamp = lampLight;
    root.add(lampGrp);

    /* ===== 13. 路牌 + 禁止停车牌 ===== */
    const signGrp = L.partGroup(-4.25, 0.19, 4.15, 14, 'grow');
    const sPost = L.cyl(0.045, 0.05, 2.9, L.toon(0x9aa3b0), 0, 1.45, 0, 8);
    signGrp.add(sPost);
    // 蓝色人行横道指示牌
    const blueSignTex = L.canvasTex(256, 128, function (c, w, h) {
      c.fillStyle = '#1b4f9c'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e8eef7'; c.lineWidth = 5; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#e8eef7';
      // 简单人形
      c.beginPath(); c.arc(74, 40, 11, 0, Math.PI * 2); c.fill();
      c.fillRect(68, 54, 12, 26);
      c.fillRect(60, 62, 8, 22);
      c.fillRect(80, 62, 8, 20);
      c.fillRect(68, 82, 11, 26);
      c.fillRect(80, 82, 11, 24);
      // 箭头
      c.beginPath(); c.moveTo(150, 64); c.lineTo(215, 64); c.lineTo(215, 48);
      c.lineTo(240, 72); c.lineTo(215, 96); c.lineTo(215, 80); c.lineTo(150, 80); c.closePath(); c.fill();
    });
    const blueSign = L.wall(1.0, 0.5, L.glowMap(blueSignTex, 1.15), 0, 2.55, 0.03);
    signGrp.add(blueSign);
    L.outline(blueSign, 0.03, 0x0a0d14);
    // 禁停牌
    const noTex = L.canvasTex(128, 128, function (c, w, h) {
      c.fillStyle = '#e9e4d8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c0392b'; c.lineWidth = 12;
      c.beginPath(); c.arc(w / 2, h / 2, 46, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 11; c.beginPath(); c.moveTo(24, 24); c.lineTo(104, 104); c.stroke();
    });
    const noSign = L.wall(0.52, 0.52, L.glowMap(noTex, 1.05), 0, 1.85, 0.03);
    signGrp.add(noSign);
    L.outline(noSign, 0.028, 0x0a0d14);
    root.add(signGrp);

    return root;
  }

  D.buildWorld = build;
})(window.DIORAMA);
