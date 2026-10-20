/* ============================================================
   道具层：自行车 / 雨伞架 / 垃圾桶 / 停靠车辆 / 行道树 / 巷子杂物
   ============================================================ */
(function (D) {
  'use strict';
  const T = THREE, L = D.LIB, G = D.LAYOUT;

  // 两点之间的管件
  function tube(a, b, r, mat, seg) {
    const dir = new T.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new T.Mesh(new T.CylinderGeometry(r, r, len, seg || 7), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    return m;
  }
  function v(x, y, z) { return new T.Vector3(x, y, z); }

  /* ---------------- 自行车 ---------------- */
  function bicycle(color) {
    const g = new T.Group();
    const frame = L.toon(color);
    const dark = L.toon(0x2b313c);
    const tire = L.toon(0x1b1f27);
    const metal = L.toon(0xb6bfcc);
    const hub = v(-0.55, 0.33, 0), front = v(0.55, 0.33, 0);
    const bb = v(-0.05, 0.29, 0), seatTop = v(-0.26, 0.8, 0), headTop = v(0.34, 0.84, 0);
    // 轮
    [hub, front].forEach(function (c) {
      const w = new T.Mesh(new T.TorusGeometry(0.3, 0.045, 7, 20), tire);
      w.position.copy(c);
      w.rotation.y = Math.PI / 2;
      g.add(w);
      const rim = new T.Mesh(new T.TorusGeometry(0.27, 0.016, 6, 18), metal);
      rim.position.copy(c); rim.rotation.y = Math.PI / 2;
      g.add(rim);
      const h = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.1, 8), metal);
      h.position.copy(c); h.rotation.z = Math.PI / 2;
      g.add(h);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 4;
        g.add(tube(c, v(c.x, c.y + Math.sin(a) * 0.26, Math.cos(a) * 0.26), 0.007, metal, 4));
      }
    });
    // 车架
    g.add(tube(hub, bb, 0.028, frame));
    g.add(tube(bb, seatTop, 0.03, frame));
    g.add(tube(seatTop, hub, 0.028, frame));
    g.add(tube(bb, headTop, 0.03, frame));
    g.add(tube(seatTop, headTop, 0.026, frame));
    g.add(tube(headTop, front, 0.022, frame));
    g.add(tube(headTop, v(0.36, 0.99, 0), 0.022, metal));
    g.add(tube(v(0.36, 0.99, -0.2), v(0.36, 0.99, 0.2), 0.02, metal));
    g.add(tube(v(0.36, 0.99, -0.2), v(0.4, 1.0, -0.22), 0.022, dark));
    g.add(tube(v(0.36, 0.99, 0.2), v(0.4, 1.0, 0.22), 0.022, dark));
    // 座垫 + 车篮
    const seat = L.box(0.26, 0.07, 0.14, dark, -0.28, 0.87, 0);
    g.add(seat);
    const basket = L.box(0.3, 0.24, 0.3, L.toon(0x9aa3b2), 0.56, 0.74, 0);
    g.add(basket);
    g.add(L.box(0.24, 0.02, 0.26, L.toon(0x7d8695), 0.56, 0.87, 0));
    // 脚踏
    g.add(tube(v(-0.05, 0.29, 0), v(-0.05, 0.29, 0.17), 0.014, metal));
    g.add(tube(v(-0.05, 0.29, 0.17), v(-0.22, 0.29, 0.17), 0.012, metal));
    g.add(tube(v(-0.05, 0.29, 0), v(-0.05, 0.29, -0.17), 0.014, metal));
    // 挡泥板 + 车灯
    g.add(tube(v(-0.55, 0.52, 0.0), v(0.55, 0.52, 0.0), 0.02, frame));
    g.add(L.sph(0.055, L.glow(0xfff0c8, 1.3), 0.62, 0.95, 0, 8));
    g.add(L.sph(0.045, L.glow(0xff6a6a, 1.1), -0.66, 0.66, 0, 8));
    L.outlineAll(g, 0.016, 0x0d1017);
    return g;
  }

  /* ---------------- 行道树 ---------------- */
  function tree(leafColor) {
    const g = new T.Group();
    const trunk = L.cyl(0.13, 0.19, 2.3, L.toon(0x5a4536), 0, 1.15, 0, 9);
    g.add(trunk);
    L.outline(trunk, 0.02);
    const leaf = L.toon(leafColor);
    const blobs = [[0, 2.75, 0, 0.95, 0.72], [0.45, 2.45, 0.18, 0.62, 0.5], [-0.4, 2.5, -0.2, 0.6, 0.48], [0.1, 3.1, -0.1, 0.55, 0.42]];
    blobs.forEach(function (b) {
      const s = L.sph(b[3], leaf, b[0], b[1], b[2], 12);
      s.scale.y = b[4] / b[3];
      g.add(s);
    });
    g.add(L.cyl(0.03, 0.03, 1.0, L.toon(0x5a4536), 0.3, 2.5, 0.1, 5));
    // 树池
    g.add(L.box(1.1, 0.06, 1.1, L.toon(0x3f4654), 0, 0.03, 0));
    g.add(L.box(0.95, 0.04, 0.95, L.toon(0x2b3038), 0, 0.06, 0));
    return g;
  }

  /* ---------------- 轻卡（停靠在停车位） ---------------- */
  function keiTruck() {
    const g = new T.Group();
    const body = L.toon(0x39465e);
    const cab = L.toon(0x44536e);
    const glass = L.toon(0x1a2430, { transparent: true, opacity: 0.72 });
    const dark = L.toon(0x222833);
    const b = L.box(3.15, 0.62, 1.44, body, 0, 0.72, 0);
    g.add(b); L.outline(b, 0.03, 0x0b0e14);
    const deck = L.box(1.45, 0.5, 1.4, L.toon(0x2f3a4d), -0.82, 1.02, 0);
    g.add(deck);
    const cb = L.box(1.6, 0.72, 1.38, cab, 0.72, 1.36, 0);
    g.add(cb); L.outline(cb, 0.03, 0x0b0e14);
    const wind = L.box(0.06, 0.5, 1.22, glass, 1.5, 1.5, 0);
    g.add(wind);
    const sideL = L.box(1.2, 0.42, 0.06, glass, 0.7, 1.5, 0.7);
    const sideR = L.box(1.2, 0.42, 0.06, glass, 0.7, 1.5, -0.7);
    g.add(sideL); g.add(sideR);
    // 轮
    [[0.95, 0.72], [0.95, -0.72], [-0.95, 0.72], [-0.95, -0.72]].forEach(function (p) {
      const w = L.cyl(0.3, 0.3, 0.2, dark, p[0], 0.3, p[1], 14);
      w.rotation.x = Math.PI / 2;
      g.add(w);
      const hub = L.cyl(0.13, 0.13, 0.22, L.toon(0x9aa3b2), p[0], 0.3, p[1], 12);
      hub.rotation.x = Math.PI / 2;
      g.add(hub);
    });
    // 灯 / 保险杠 / 车牌
    g.add(L.box(0.08, 0.16, 0.26, L.glow(0xfff3d4, 1.2), 1.58, 0.86, 0.46));
    g.add(L.box(0.08, 0.16, 0.26, L.glow(0xfff3d4, 1.2), 1.58, 0.86, -0.46));
    g.add(L.box(0.1, 0.14, 0.24, L.glow(0xff5a4a, 1.1), -1.6, 0.86, 0.5));
    g.add(L.box(0.1, 0.14, 0.24, L.glow(0xff5a4a, 1.1), -1.6, 0.86, -0.5));
    g.add(L.box(0.08, 0.16, 0.42, L.toon(0xd8dde4), 1.56, 0.56, 0));
    g.add(L.box(0.1, 0.14, 1.4, L.toon(0x8e97a6), -1.62, 0.56, 0));
    return g;
  }

  /* ---------------- 主构建 ---------------- */
  function build(scene) {
    const root = new T.Group();
    scene.add(root);

    /* 自行车（靠店铺侧墙） */
    const bikeGrp = L.partGroup(-3.62, 0.2, 0.95, 32, 'pop');
    const b1 = bicycle(0x2f6fa8);
    b1.rotation.y = Math.PI / 2;
    b1.rotation.x = 0.13;
    bikeGrp.add(b1);
    root.add(bikeGrp);

    /* 自行车（巷子里） */
    const bikeGrp2 = L.partGroup(6.05, 0.2, 0.55, 33, 'pop');
    const b2 = bicycle(0xb5483c);
    b2.rotation.y = Math.PI * 0.42;
    b2.rotation.x = 0.1;
    bikeGrp2.add(b2);
    root.add(bikeGrp2);

    /* 雨伞架 —— 放在入口右侧，不能挡在自动门口（门扇要沿 x 方向滑动） */
    const umbGrp = L.partGroup(2.32, 0.19, 2.78, 34, 'pop');
    const holder = L.cyl(0.26, 0.28, 0.5, L.toon(0x4e5765), 0, 0.25, 0, 12);
    umbGrp.add(holder);
    L.outline(holder, 0.02);
    umbGrp.add(L.cyl(0.29, 0.29, 0.05, L.toon(0x39414f), 0, 0.52, 0, 12));
    const umbCols = [0x3f6fa8, 0x2c3a4c, 0xb5483c, 0x3d7f62, 0x6a5b9c];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const lean = 0.1 + (i % 3) * 0.05;
      const u = new T.Group();
      const shaft = L.cyl(0.022, 0.022, 0.92, L.toon(umbCols[i]), 0, 0.46, 0, 6);
      u.add(shaft);
      const tip = L.cyl(0.05, 0.03, 0.18, L.toon(umbCols[i]), 0, 0.96, 0, 6);
      u.add(tip);
      const handle = new T.Mesh(new T.TorusGeometry(0.06, 0.016, 5, 10, Math.PI * 1.3), L.toon(0x4a5260));
      handle.position.set(0, 0.98, 0.04);
      u.add(handle);
      u.position.set(Math.cos(a) * 0.1, 0.32, Math.sin(a) * 0.1);
      u.rotation.z = Math.cos(a) * lean;
      u.rotation.x = -Math.sin(a) * lean;
      umbGrp.add(u);
    }
    root.add(umbGrp);

    /* 垃圾桶（2个）—— 挪到巷口一侧，原来和贩卖机模型互相穿插 */
    const binGrp = L.partGroup(4.95, 0.19, 3.45, 35, 'pop');
    const bin1 = L.cyl(0.26, 0.22, 0.78, L.toon(0x3f4a5c), 0, 0.39, 0, 14);
    binGrp.add(bin1); L.outline(bin1, 0.022);
    binGrp.add(L.cyl(0.28, 0.28, 0.08, L.toon(0x2b323f), 0, 0.8, 0, 14));
    const bin2 = L.cyl(0.24, 0.2, 0.7, L.toon(0x2f5f7c), 0.62, 0.35, 0.1, 14);
    binGrp.add(bin2); L.outline(bin2, 0.022);
    binGrp.add(L.cyl(0.26, 0.26, 0.07, L.toon(0x24485e), 0.62, 0.72, 0.1, 14));
    root.add(binGrp);

    /* 停靠的轻卡 */
    const carGrp = L.partGroup(8.55, G.roadY, 5.85, 36, 'grow');
    const car = keiTruck();
    carGrp.add(car);
    root.add(carGrp);

    /* 行道树 */
    const treeGrp = L.partGroup(-4.15, 0.19, -4.6, 37, 'grow');
    treeGrp.add(tree(0x29503a));
    root.add(treeGrp);
    const treeGrp2 = L.partGroup(2.6, 0.19, -9.4, 37, 'grow');
    treeGrp2.add(tree(0x2d543d));
    root.add(treeGrp2);

    /* 停车位 P 牌 —— 立在人行道边上的路缘处，不能插在车行道中间 */
    const pGrp = L.partGroup(5.95, 0.19, 4.38, 38, 'grow');
    pGrp.add(L.cyl(0.045, 0.05, 2.0, L.toon(0x9aa3b0), 0, 1.0, 0, 8));
    const pTex = L.canvasTex(128, 128, function (c, w, h) {
      c.fillStyle = '#1b4f9c'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e8eef7'; c.lineWidth = 5; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#e8eef7';
      c.font = 'bold 78px ' + '"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('P', w / 2, h / 2);
    });
    const pSign = L.wall(0.46, 0.46, L.glowMap(pTex, 1.1), 0, 2.05, 0.03);
    pGrp.add(pSign);
    L.outline(pSign, 0.025, 0x0a0d14);
    root.add(pGrp);

    /* 巷口杂物：啤酒箱 + 托盘 + 空调管 */
    const junkGrp = L.partGroup(4.95, 0.196, -2.6, 39, 'pop');
    const crateCols = [0xc8562f, 0x2f6fa8, 0x3d7f62];
    for (let i = 0; i < 3; i++) {
      const c = L.box(0.52, 0.3, 0.38, L.toon(crateCols[i]), 0, 0.15 + i * 0.31, 0);
      junkGrp.add(c);
      L.outline(c, 0.02);
    }
    const pallet = L.box(0.9, 0.1, 0.7, L.toon(0x6b5a42), 0.1, 0.05, 0.4);
    junkGrp.add(pallet);
    root.add(junkGrp);

    /* 后场：排水沟 + 杂物 + 花盆 */
    const lotGrp = L.partGroup(0, 0, 0, 40, 'grow');
    const ditch = L.plane(9.0, 0.5, L.toon(0x232936), 0.5, 0.194, -6.9);
    lotGrp.add(ditch);
    const shed = L.box(2.2, 1.7, 1.7, L.toon(0x4b5361), -3.4, 1.05, -10.2);
    lotGrp.add(shed); L.outline(shed, 0.03, 0x0d1017);
    const shedRoof = L.box(2.4, 0.12, 1.9, L.toon(0x353c49), -3.4, 1.95, -10.2);
    lotGrp.add(shedRoof);
    const pot = L.cyl(0.3, 0.24, 0.42, L.toon(0xa8563a), 5.3, 0.4, -8.4, 12);
    lotGrp.add(pot);
    const plant = L.sph(0.42, L.toon(0x35604a), 5.3, 0.85, -8.4, 10);
    plant.scale.y = 0.7;
    lotGrp.add(plant);
    // 围栏
    const fenceMat = L.toon(0x6c7583);
    for (let i = 0; i < 16; i++) {
      lotGrp.add(L.box(0.05, 1.0, 0.05, fenceMat, -5.0 + i * 0.62, 0.68, -11.7));
    }
    lotGrp.add(L.box(9.9, 0.05, 0.05, fenceMat, -0.3, 1.12, -11.7));
    lotGrp.add(L.box(9.9, 0.05, 0.05, fenceMat, -0.3, 0.4, -11.7));
    root.add(lotGrp);

    /* 路侧小物件：交通锥 + 烟蒂桶 */
    const miscGrp = L.partGroup(-4.35, G.roadY, 7.4, 41, 'pop');
    const cone = L.cyl(0.04, 0.19, 0.5, L.toon(0xd8623a), 0, 0.25, 0, 10);
    miscGrp.add(cone);
    miscGrp.add(L.box(0.34, 0.04, 0.34, L.toon(0x30374a), 0, 0.02, 0));
    miscGrp.add(L.cyl(0.15, 0.17, 0.6, L.toon(0x50596a), 0.5, 0.3, 0.2, 12));
    miscGrp.add(L.cyl(0.18, 0.18, 0.06, L.toon(0x3b4351), 0.5, 0.62, 0.2, 12));
    root.add(miscGrp);

    return root;
  }

  D.buildProps = build;
})(window.DIORAMA);
