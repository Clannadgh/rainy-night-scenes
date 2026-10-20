/* ============================================================
   主体层：日式便利店（店面 / 橱窗 / 自动门 / 雨棚招牌 / 室内 / 屋顶）
   ============================================================ */
(function (D) {
  'use strict';
  const T = THREE, L = D.LIB, G = D.LAYOUT;

  const JPFONT = '"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","MS Gothic",sans-serif';

  /* ---------------- 贴图 ---------------- */

  // 便利店主招牌
  function signTexture() {
    return L.canvasTex(1024, 128, function (c, w, h) {
      c.fillStyle = '#e7e3d6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#00967f'; c.fillRect(0, 0, w, 16);
      c.fillStyle = '#e4552f'; c.fillRect(0, h - 14, w, 14);
      // logo
      c.fillStyle = '#f0a21c';
      c.beginPath(); c.arc(78, h / 2, 40, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.font = 'bold 46px ' + JPFONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('マ', 78, h / 2 + 2);
      // 主标题
      c.textAlign = 'left';
      c.fillStyle = '#1c2430';
      c.font = 'bold 72px ' + JPFONT;
      c.fillText('コンビニ', 146, h / 2 - 4);
      c.fillStyle = '#00967f';
      c.font = 'bold 34px ' + JPFONT;
      c.fillText('たばこ・ATM', 150, h / 2 + 36);
      // 24小时
      c.textAlign = 'right';
      c.fillStyle = '#e4552f';
      c.font = 'bold 58px ' + JPFONT;
      c.fillText('24H', w - 40, h / 2);
    });
  }

  // 侧挂袖看板（竖排）
  function bladeTexture() {
    return L.canvasTex(256, 640, function (c, w, h) {
      c.fillStyle = '#e9e5d8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#00967f'; c.fillRect(0, 0, w, 26);
      c.fillStyle = '#e4552f'; c.fillRect(0, h - 26, w, 26);
      c.fillStyle = '#f0a21c';
      c.beginPath(); c.arc(w / 2, 110, 46, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.font = 'bold 52px ' + JPFONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('マ', w / 2, 112);
      c.fillStyle = '#1c2430';
      c.font = 'bold 78px ' + JPFONT;
      c.fillText('た', w / 2, 220);
      c.fillText('ば', w / 2, 300);
      c.fillText('こ', w / 2, 380);
      c.fillStyle = '#00967f';
      c.font = 'bold 54px ' + JPFONT;
      c.fillText('お', w / 2, 470);
      c.fillText('酒', w / 2, 540);
    });
  }

  // 雨棚条纹
  function awningTexture() {
    return L.canvasTex(512, 128, function (c, w, h) {
      const n = 10, s = w / n;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i % 2 ? '#d0d4c6' : '#008f7c';
        c.fillRect(i * s, 0, s, h);
      }
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < n; i++) c.fillRect(i * s, 0, 3, h);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(0, 0, w, 10);
    });
  }

  // 橱窗玻璃反光条纹
  function glassStreakTexture() {
    return L.canvasTex(512, 512, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      c.save();
      c.translate(w * 0.5, h * 0.5); c.rotate(-0.42); c.translate(-w * 0.5, -h * 0.5);
      const g = c.createLinearGradient(0, -w * 0.4, 0, w * 0.4);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(214,236,255,0.34)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(-w, 0, w * 3, w);
      c.restore();
      const g2 = c.createLinearGradient(0, 0, w, h);
      g2.addColorStop(0, 'rgba(190,225,255,0.16)');
      g2.addColorStop(0.5, 'rgba(190,225,255,0)');
      g2.addColorStop(1, 'rgba(140,180,220,0.12)');
      c.fillStyle = g2; c.fillRect(0, 0, w, h);
    });
  }

  // 门口地垫
  function matTexture() {
    return L.canvasTex(256, 128, function (c, w, h) {
      c.fillStyle = '#2c3a4a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1d2733';
      for (let i = 0; i < 26; i++) c.fillRect(0, i * 5, w, 2.4);
      c.strokeStyle = '#7d8fa3'; c.lineWidth = 4;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#c9d6e4';
      c.font = 'bold 34px ' + JPFONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('いらっしゃいませ', w / 2, h / 2);
    });
  }

  // 公告栏 / 海报
  function boardTexture() {
    return L.canvasTex(256, 192, function (c, w, h) {
      c.fillStyle = '#8d94a4'; c.fillRect(0, 0, w, h);
      const papers = [[6, 6, 116, 84, '#f5e9d0'], [130, 12, 118, 96, '#f7d7e2'], [10, 100, 104, 84, '#d9e9f7'], [124, 118, 122, 66, '#fdf0c8']];
      papers.forEach(function (p) {
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(p[0] + 3, p[1] + 4, p[2], p[3]);
        c.fillStyle = p[4]; c.fillRect(p[0], p[1], p[2], p[3]);
        c.fillStyle = 'rgba(60,70,90,0.75)';
        for (let i = 0; i < 5; i++) c.fillRect(p[0] + 8, p[1] + 14 + i * 11, p[2] - 16 - (i % 2) * 22, 4);
      });
      c.fillStyle = '#e4552f'; c.fillRect(0, 0, w, 6);
    });
  }

  // 自动贩卖机正面
  function vendingTexture() {
    return L.canvasTex(256, 512, function (c, w, h) {
      c.fillStyle = '#dfe4ea'; c.fillRect(0, 0, w, h);
      // 顶部品牌条
      c.fillStyle = '#12408c'; c.fillRect(0, 0, w, 78);
      c.fillStyle = '#ffffff';
      c.font = 'bold 44px ' + JPFONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('つめたい', w / 2, 40);
      // 商品格
      const rows = 5, cols = 5;
      const colors = ['#e8452f', '#2f7fe8', '#f0a21c', '#39a55b', '#8e52d8', '#e6b32c', '#26b3b8'];
      for (let r = 0; r < rows; r++) {
        const y = 92 + r * 78;
        c.fillStyle = '#dde3ea'; c.fillRect(8, y, w - 16, 70);
        for (let i = 0; i < cols; i++) {
          const x = 14 + i * ((w - 28) / cols);
          c.fillStyle = colors[(r * cols + i) % colors.length];
          c.fillRect(x + 3, y + 6, (w - 28) / cols - 8, 44);
          c.fillStyle = 'rgba(255,255,255,0.55)';
          c.fillRect(x + 7, y + 10, 6, 36);
          c.fillStyle = '#f7fbff';
          c.fillRect(x + 3, y + 52, (w - 28) / cols - 8, 12);
        }
      }
      // 底部取货口
      c.fillStyle = '#2b3240'; c.fillRect(0, h - 62, w, 62);
      c.fillStyle = '#0d1118'; c.fillRect(30, h - 52, w - 60, 38);
      c.fillStyle = '#f0a21c'; c.fillRect(0, h - 70, w, 8);
    });
  }

  // 屋顶广告牌
  function roofSignTexture() {
    return L.canvasTex(512, 192, function (c, w, h) {
      c.fillStyle = '#101a2e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3fd2e8'; c.fillRect(0, 0, w, 10);
      c.fillStyle = '#f06fb0'; c.fillRect(0, h - 10, w, 10);
      c.fillStyle = '#ffffff';
      c.font = 'bold 78px ' + JPFONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('まちの灯', w / 2, h / 2 - 14);
      c.fillStyle = '#9fe8f5';
      c.font = 'bold 34px ' + JPFONT;
      c.fillText('NIGHT MART 24H', w / 2, h / 2 + 46);
    });
  }

  // 杂志封面
  function magTexture(seed) {
    return L.canvasTex(64, 96, function (c, w, h) {
      const cols = ['#e8452f', '#2f7fe8', '#f0a21c', '#39a55b', '#8e52d8'];
      c.fillStyle = cols[seed % cols.length]; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(6, 8, w - 12, 34);
      c.fillStyle = 'rgba(0,0,0,0.55)';
      for (let i = 0; i < 3; i++) c.fillRect(6, 52 + i * 10, w - 20 - i * 8, 5);
    });
  }

  // 登记可闪烁的自发光材质
  D.flickerMats = D.flickerMats || [];
  function flickMat(tex, k) {
    const m = L.glowMap(tex, k);
    m.userData.baseColor = m.color.clone();
    D.flickerMats.push(m);
    return m;
  }

  /* ---------------- 主构建 ---------------- */
  function build(scene) {
    const root = new T.Group();
    scene.add(root);

    const X0 = G.storeMinX, X1 = G.storeMaxX, Z0 = G.storeMinZ, Z1 = G.storeMaxZ;
    const W = X1 - X0, Dp = Z1 - Z0;
    const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
    const WT = G.wallTop, WY = G.walkTop;
    const wallMat = L.toon(0xc4bfb2);
    const wallMat2 = L.toon(0xb5afa1);

    /* ===== 墙体外壳 ===== */
    const shell = L.partGroup(0, 0, 0, 20, 'grow');
    const back = L.box(W, WT - WY, 0.22, wallMat, CX, (WY + WT) / 2, Z0 + 0.11);
    const left = L.box(0.22, WT - WY, Dp, wallMat2, X0 + 0.11, (WY + WT) / 2, CZ);
    const right = L.box(0.22, WT - WY, Dp, wallMat2, X1 - 0.11, (WY + WT) / 2, CZ);
    const pierL = L.box(0.6, WT - WY, 0.22, wallMat, X0 + 0.3, (WY + WT) / 2, Z1 - 0.11);
    const pierR = L.box(1.2, WT - WY, 0.22, wallMat, X1 - 0.6, (WY + WT) / 2, Z1 - 0.11);
    const header = L.box(W, 1.08, 0.22, wallMat, CX, 3.84, Z1 - 0.11);
    [back, left, right, pierL, pierR, header].forEach(function (m) {
      shell.add(m); L.outline(m, 0.035, 0x11141c);
    });
    // 正面饰带
    const bandF = L.box(W, 0.24, 0.06, L.toon(0x008f7c), CX, 0.56, Z1 - 0.005);
    shell.add(bandF);
    // 侧面饰带
    const bandL = L.box(0.06, 0.24, Dp, L.toon(0x008f7c), X0 - 0.005, 0.56, CZ);
    shell.add(bandL);
    const bandR = L.box(0.06, 0.24, Dp, L.toon(0x008f7c), X1 + 0.005, 0.56, CZ);
    shell.add(bandR);
    // 侧墙上的小窗
    const sideWin = L.box(0.08, 0.8, 1.1, L.toon(0x1e2430), X0 - 0.02, 2.6, -2.4);
    shell.add(sideWin);
    // 空调外机（侧墙）
    const acBody = L.box(0.9, 0.66, 0.78, L.toon(0xa8b0bd), X0 - 0.42, 2.15, -1.1);
    shell.add(acBody); L.outline(acBody, 0.03, 0x11141c);
    shell.add(L.box(0.95, 0.07, 0.84, L.toon(0x8d95a4), X0 - 0.44, 1.83, -1.1));
    const acGrill = L.cyl(0.26, 0.26, 0.06, L.toon(0x5f6775), X0 - 0.87, 2.15, -1.1, 14);
    acGrill.rotation.z = Math.PI / 2;
    shell.add(acGrill);
    // 排水管
    shell.add(L.cyl(0.05, 0.05, 2.6, L.toon(0x555d6c), X0 - 0.2, 0.9, -0.68, 8));

    /* --- 背面（转到模型背后也能看）--- */
    const backZ = Z0 - 0.02;
    // 背面横向饰带
    shell.add(L.box(W - 0.1, 0.2, 0.05, L.toon(0x008f7c), CX, 2.9, backZ));
    // 后门 + 门头小雨棚
    const backDoor = L.box(0.95, 2.05, 0.12, L.toon(0x3b424e), 2.6, 1.2, backZ - 0.06);
    shell.add(backDoor); L.outline(backDoor, 0.03, 0x11141c);
    shell.add(L.box(1.25, 0.08, 0.42, L.toon(0x5b6472), 2.6, 2.32, backZ - 0.16));
    const backLamp = L.box(0.26, 0.1, 0.14, L.glow(0xffd79a, 1.1), 2.6, 2.42, backZ - 0.14);
    shell.add(backLamp);
    const backLight = new T.PointLight(0xffc98a, 0.7, 5.5, 1.7);
    backLight.position.set(2.6, 2.35, backZ - 0.5);
    shell.add(backLight);
    // 背面小窗（两扇）
    for (let i = 0; i < 2; i++) {
      const x = -1.5 + i * 1.5;
      const fr = L.box(0.95, 0.95, 0.1, L.toon(0x59616f), x, 2.4, backZ - 0.05);
      shell.add(fr);
      const gl = L.wall(0.75, 0.75, L.glow(0x8fb4d8, 0.45), x, 2.4, backZ - 0.11);
      shell.add(gl);
    }
    // 背面竖向排水管 + 空调外机
    shell.add(L.cyl(0.06, 0.06, 3.6, L.toon(0x555d6c), X1 - 0.55, 1.9, backZ - 0.08, 8));
    shell.add(L.box(0.8, 0.58, 0.62, L.toon(0x8d95a4), X0 + 1.0, 1.4, backZ - 0.32));
    root.add(shell);

    /* ===== 橱窗玻璃 + 门 =====
       店面横向布局（世界坐标 X）：
         -2.4 ┬ 左侧橱窗 ┬ -0.1 ┃ 自动门开口 ┃ 1.7 ┬ 右侧橱窗 ┬ 3.4
       竖框下端必须落在下框上、上端落在上框上；门口不放固定玻璃，
       两扇门闭合时在 x=0.8 处正好对接。 */
    const glassGrp = L.partGroup(0, 0, 0, 22, 'grow');
    const frameMat = L.toon(0x39414f);
    const jambMat = L.toon(0x59616f);
    const glassMat = L.toon(0x8fc6de, { transparent: true, opacity: 0.17, depthWrite: false });
    const GX0 = -2.4, GX1 = 3.4;      // 整片店面玻璃的左右端
    const DX0 = -0.1, DX1 = 1.7;      // 自动门开口
    const WIN_BOT = 0.62, WIN_TOP = 3.28;   // 橱窗下框 / 上框标高
    const DOOR_TOP = 3.10;            // 门扇顶端（其上是门头横档 + 感应器）
    const DOOR_BASE = 0.24;           // 门扇落地的位置（室内地坪）
    const GLASS_Z = Z1 - 0.085;

    // 窗下墙裙（补上门槛到下框之间的空洞）
    glassGrp.add(L.box(GX1 - GX0, WIN_BOT - WY, 0.12, wallMat, (GX0 + GX1) / 2, (WY + WIN_BOT) / 2, Z1 - 0.09));
    // 上框（贯通）
    glassGrp.add(L.box(GX1 - GX0, 0.12, 0.16, frameMat, (GX0 + GX1) / 2, WIN_TOP, Z1 - 0.09));
    // 下框（分左右两段，中间留出门口）
    glassGrp.add(L.box(DX0 - GX0, 0.12, 0.16, frameMat, (GX0 + DX0) / 2, WIN_BOT, Z1 - 0.09));
    glassGrp.add(L.box(GX1 - DX1, 0.12, 0.16, frameMat, (DX1 + GX1) / 2, WIN_BOT, Z1 - 0.09));
    // 橱窗竖梃：只做在橱窗段上，高度 = 上框 − 下框
    [GX0, -1.25, 2.55, GX1].forEach(function (x) {
      glassGrp.add(L.box(0.1, WIN_TOP - WIN_BOT, 0.16, frameMat, x, (WIN_BOT + WIN_TOP) / 2, Z1 - 0.09));
    });
    // 门套立柱：从地坪一直顶到上框
    [DX0, DX1].forEach(function (x) {
      glassGrp.add(L.box(0.14, WIN_TOP - WY, 0.24, jambMat, x, (WY + WIN_TOP) / 2, Z1 - 0.11));
    });
    // 门头横档（门扇之上的过梁）
    glassGrp.add(L.box(DX1 - DX0, WIN_TOP - DOOR_TOP, 0.2, jambMat, (DX0 + DX1) / 2, (DOOR_TOP + WIN_TOP) / 2, Z1 - 0.07));
    // 固定玻璃：左右两片，门口留空
    const streakTex = glassStreakTexture();
    const streakMat = new T.MeshBasicMaterial({
      map: streakTex, transparent: true, opacity: 0.3, depthWrite: false, blending: T.AdditiveBlending
    });
    [[GX0, DX0], [DX1, GX1]].forEach(function (seg) {
      const w = seg[1] - seg[0], cx = (seg[0] + seg[1]) / 2;
      const pane = L.wall(w, WIN_TOP - WIN_BOT, glassMat, cx, (WIN_BOT + WIN_TOP) / 2, GLASS_Z);
      pane.renderOrder = 6;
      glassGrp.add(pane);
      const streak = L.wall(w, WIN_TOP - WIN_BOT, streakMat, cx, (WIN_BOT + WIN_TOP) / 2, GLASS_Z + 0.007);
      streak.renderOrder = 7;
      glassGrp.add(streak);
    });
    // 自动门感应器（吊装在门头外侧）
    const sensor = L.box(1.9, 0.12, 0.14, L.toon(0x2c333f), 0.8, 3.16, Z1 + 0.02);
    glassGrp.add(sensor);
    const sensorLed = L.box(0.2, 0.05, 0.05, L.neon(0x63e6a0, 1.3), 0.8, 3.12, Z1 + 0.10);
    glassGrp.add(sensorLed);
    root.add(glassGrp);

    // 自动门（两扇可滑动）
    const doorGrp = L.partGroup(0, 0, 0, 23, 'grow');
    doorGrp.userData.noShadow = true;     // 门会动，阴影贴图是静态的，不投影
    const doorFrame = L.toon(0x6c7583);
    const LEAF_W = 0.92, LEAF_H = DOOR_TOP - DOOR_BASE;
    function makeLeaf() {
      const leaf = new T.Group();
      const g = L.box(0.86, LEAF_H - 0.1, 0.06, L.toon(0x9ed4e6, { transparent: true, opacity: 0.26, depthWrite: false }), 0, LEAF_H / 2, 0);
      g.renderOrder = 8;
      leaf.add(g);
      leaf.add(L.box(LEAF_W, 0.09, 0.09, doorFrame, 0, LEAF_H - 0.045, 0));
      leaf.add(L.box(LEAF_W, 0.09, 0.09, doorFrame, 0, 0.045, 0));
      leaf.add(L.box(0.08, LEAF_H - 0.09, 0.09, doorFrame, -0.42, LEAF_H / 2, 0));
      leaf.add(L.box(0.08, LEAF_H - 0.09, 0.09, doorFrame, 0.42, LEAF_H / 2, 0));
      // 自動ドア 贴纸
      const st = L.canvasTex(128, 32, function (c, w, h) {
        c.fillStyle = '#f2d24a'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#23272f';
        c.font = 'bold 18px ' + JPFONT;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('自動ドア', w / 2, h / 2);
      });
      const stk = L.wall(0.8, 0.2, L.glowMap(st, 0.9), 0, 1.62, 0.048);
      leaf.add(stk);
      return leaf;
    }
    const leafL = makeLeaf();
    const leafR = makeLeaf();
    // 闭合时两扇在 x = 0.8 处对接，正好盖住 −0.1 ~ 1.7 的门口
    leafL.position.set(0.35, DOOR_BASE, Z1 - 0.04);
    leafR.position.set(1.25, DOOR_BASE, Z1 - 0.04);
    doorGrp.add(leafL); doorGrp.add(leafR);
    D.doorLeaves = { l: leafL, r: leafR, lx: 0.35, rx: 1.25, open: 0, slide: 0.9 };
    root.add(doorGrp);

    /* ===== 室内 ===== */
    const inside = L.partGroup(0, 0, 0, 24, 'grow');
    // 地面：一直铺到店门口，避免橱窗下沿露出空洞
    inside.add(L.box(W - 0.44, 0.08, Dp, L.toon(0xaeaa9f), CX, WY + 0.04, CZ));
    // 吊顶
    inside.add(L.box(W - 0.44, 0.06, Dp, L.toon(0xc4c1b7), CX, 3.26, CZ));
    // 后排货架
    const shelfFrame = L.toon(0x5b6270);
    // 背板要后退一点，否则商品会埋进背板里看不见
    const shelfBack = L.box(6.6, 2.0, 0.42, shelfFrame, CX, 1.3, Z0 + 0.55);
    inside.add(shelfBack);
    const prodCols = [0xe8452f, 0x2f7fe8, 0xf0a21c, 0x39a55b, 0x8e52d8, 0xef6fa8, 0x26b3b8, 0xe6e0d2];
    for (let r = 0; r < 4; r++) {
      const y = 0.55 + r * 0.45;
      inside.add(L.box(6.4, 0.06, 0.5, L.toon(0x8b93a2), CX, y, Z0 + 0.72));
      for (let i = 0; i < 22; i++) {
        const x = X0 + 0.6 + i * 0.28;
        const c = prodCols[(i + r * 3) % prodCols.length];
        inside.add(L.box(0.2, 0.3, 0.16, L.toon(c), x, y + 0.19, Z0 + 0.78));
      }
    }
    // 右侧冷柜
    const freezer = L.box(0.75, 1.95, 3.2, L.toon(0xc3cad3), X1 - 0.62, 1.2, -2.2);
    inside.add(freezer);
    for (let i = 0; i < 3; i++) {
      const fd = L.box(0.06, 1.5, 0.92, L.glow(0x9fd8ea, 0.85), X1 - 1.0, 1.35, -3.4 + i * 1.1);
      inside.add(fd);
      inside.add(L.box(0.07, 1.6, 0.06, L.toon(0x9aa3b1), X1 - 1.02, 1.35, -3.9 + i * 1.1));
    }
    // 收银台
    const counter = L.box(2.3, 0.95, 0.85, L.toon(0xcfccc0), 2.55, 0.63, 0.1);
    inside.add(counter);
    inside.add(L.box(2.4, 0.07, 0.95, L.toon(0x3b424e), 2.55, 1.13, 0.1));
    inside.add(L.box(0.42, 0.36, 0.32, L.toon(0x2f3542), 2.1, 1.34, 0.1));
    inside.add(L.box(0.36, 0.26, 0.03, L.glow(0x6fd7ff, 0.9), 2.1, 1.36, 0.28));
    // 面包保温柜
    const warm = L.box(1.7, 0.62, 0.85, L.toon(0xd9dde3), -0.1, 0.58, -0.6);
    inside.add(warm);
    const warmG = L.box(1.6, 0.42, 0.05, L.glow(0xffd79a, 0.9), -0.1, 0.62, -0.19);
    inside.add(warmG);
    for (let i = 0; i < 6; i++) {
      inside.add(L.sph(0.09, L.toon(0xe8b96a), -0.75 + i * 0.26, 0.6, -0.25, 8));
    }
    // 杂志架
    const rack = L.box(0.9, 0.06, 0.45, L.toon(0x6a7280), -1.75, 0.95, 1.15);
    inside.add(rack);
    for (let i = 0; i < 5; i++) {
      const m = L.box(0.16, 0.42, 0.02, L.glowMap(magTexture(i), 0.95), -2.05 + i * 0.16, 1.18, 1.12);
      m.rotation.x = -0.2;
      inside.add(m);
    }
    // 顶灯
    for (let i = 0; i < 3; i++) {
      inside.add(L.box(2.4, 0.05, 0.42, L.glow(0xfff6e2, 0.85), CX, 3.2, -0.2 - i * 2.2));
    }
    // 营业中吊牌
    const openTex = L.canvasTex(256, 96, function (c, w, h) {
      c.fillStyle = '#f5efe0'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e4552f'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = '#e4552f';
      c.font = 'bold 46px ' + JPFONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('営業中', w / 2, h / 2);
    });
    const openSign = L.wall(0.9, 0.34, flickMat(openTex, 0.95), -1.9, 2.75, 1.0);
    inside.add(openSign);
    // 室内灯光
    const inLight = new T.PointLight(0xfff0d8, 0.8, 7.5, 1.5);
    inLight.position.set(0.4, 2.7, -0.6);
    inside.add(inLight);
    const inLight2 = new T.PointLight(0xffe9c8, 0.55, 7, 1.6);
    inLight2.position.set(2.6, 2.5, -2.4);
    inside.add(inLight2);
    root.add(inside);

    /* ===== 雨棚 + 灯带 ===== */
    const awning = L.partGroup(0, 0, 0, 26, 'grow');
    const awTex = awningTexture();
    const canopy = L.box(7.95, 0.09, 1.75, L.toon(0xffffff, { map: awTex }), CX, 3.12, Z1 + 0.78);
    canopy.rotation.x = 0.235;
    awning.add(canopy);
    L.outline(canopy, 0.03, 0x11141c);
    // 波浪檐口
    const tabMat = L.toon(0x008f7c);
    for (let i = 0; i < 15; i++) {
      const x = CX - 3.75 + i * 0.53;
      awning.add(L.box(0.34, 0.16, 0.05, tabMat, x, 2.88, Z1 + 1.63));
    }
    // 棚下灯带
    const strip = L.box(6.9, 0.07, 0.12, L.glow(0xfff3dc, 1.2), CX, 2.96, Z1 + 1.1);
    awning.add(strip);
    const awningLight = new T.PointLight(0xffeccd, 0.6, 7.5, 1.6);
    awningLight.position.set(CX, 2.85, Z1 + 1.0);
    awning.add(awningLight);
    root.add(awning);

    /* ===== 招牌 + 袖看板 ===== */
    const signs = L.partGroup(0, 0, 0, 27, 'grow');
    const signBox = L.box(W - 0.1, 0.98, 0.14, flickMat(signTexture(), 1.0), CX, 3.85, Z1 + 0.06);
    signs.add(signBox);
    signs.add(L.box(W + 0.04, 0.1, 0.18, L.toon(0x3c434f), CX, 4.4, Z1 + 0.06));
    signs.add(L.box(W + 0.04, 0.1, 0.18, L.toon(0x3c434f), CX, 3.32, Z1 + 0.06));
    // 袖看板
    const blade = L.box(0.98, 2.45, 0.3, flickMat(bladeTexture(), 0.95), X0 + 0.34, 1.85, Z1 + 0.5);
    signs.add(blade);
    L.outline(blade, 0.035, 0x11141c);
    signs.add(L.box(0.16, 0.16, 0.55, L.toon(0x39414f), X0 + 0.34, 3.1, Z1 + 0.2));
    // 招牌在侧墙上的回光
    const sideBlade = L.box(0.3, 2.0, 0.85, flickMat(bladeTexture(), 0.8), X0 - 0.42, 1.9, Z1 - 0.6);
    signs.add(sideBlade);
    root.add(signs);

    /* ===== 屋顶 + 屋顶设备 + 广告牌 ===== */
    const roof = L.partGroup(0, 0, 0, 28, 'grow');
    const slab = L.box(W + 0.35, 0.26, Dp + 0.35, L.toon(0x4c5361), CX, WT + 0.13, CZ);
    roof.add(slab); L.outline(slab, 0.04, 0x0d1017);
    // 女儿墙
    roof.add(L.box(W + 0.35, 0.42, 0.16, L.toon(0x5a6270), CX, WT + 0.47, Z1 + 0.1));
    roof.add(L.box(W + 0.35, 0.42, 0.16, L.toon(0x5a6270), CX, WT + 0.47, Z0 - 0.1));
    roof.add(L.box(0.16, 0.42, Dp + 0.35, L.toon(0x5a6270), X0 - 0.1, WT + 0.47, CZ));
    roof.add(L.box(0.16, 0.42, Dp + 0.35, L.toon(0x5a6270), X1 + 0.1, WT + 0.47, CZ));
    // 屋顶空调外机
    for (let i = 0; i < 2; i++) {
      const ac = L.box(1.0, 0.7, 1.3, L.toon(0x9aa3b2), X0 + 1.2 + i * 1.4, WT + 0.61, Z0 + 1.2);
      roof.add(ac); L.outline(ac, 0.03, 0x0d1017);
      const grill = L.cyl(0.3, 0.3, 0.07, L.toon(0x646c7b), X0 + 1.2 + i * 1.4, WT + 0.97, Z0 + 1.2, 14);
      roof.add(grill);
    }
    // 水箱
    const tank = L.cyl(0.52, 0.52, 0.95, L.toon(0x6b7383), X1 - 1.2, WT + 1.3, Z0 + 1.4, 12);
    roof.add(tank);
    roof.add(L.box(1.2, 0.08, 1.2, L.toon(0x565e6d), X1 - 1.2, WT + 0.82, Z0 + 1.4));
    // 天线
    roof.add(L.cyl(0.035, 0.035, 2.6, L.toon(0x8b93a3), X1 - 2.3, WT + 1.5, Z0 + 0.7, 6));
    for (let i = 0; i < 4; i++) roof.add(L.box(0.9 - i * 0.18, 0.04, 0.04, L.toon(0x8b93a3), X1 - 2.3, WT + 1.7 + i * 0.35, Z0 + 0.7));
    // 屋顶广告牌
    const rsFrame = L.box(3.6, 1.45, 0.16, L.glowMap(roofSignTexture(), 1.1), CX + 1.5, WT + 1.35, Z0 + 3.4);
    roof.add(rsFrame);
    L.outline(rsFrame, 0.035, 0x0d1017);
    roof.add(L.box(0.12, 1.3, 0.12, L.toon(0x4a525f), CX - 0.1, WT + 0.85, Z0 + 3.4));
    roof.add(L.box(0.12, 1.3, 0.12, L.toon(0x4a525f), CX + 3.1, WT + 0.85, Z0 + 3.4));
    root.add(roof);

    /* ===== 门口地垫 ===== */
    const mat = L.partGroup(0, 0, 0, 25, 'grow');
    // 用平面而不是盒子：BoxGeometry 顶面的 UV 是横着的，贴图会转 90°，字就看不懂了
    const doormat = L.plane(1.55, 0.85, L.toon(0xffffff, { map: matTexture() }), 0.8, WY + 0.02, Z1 + 0.62);
    mat.add(doormat);
    root.add(mat);

    /* ===== 自动贩卖机 ===== */
    const vend = L.partGroup(3.55, 0.19, 3.05, 30, 'grow');
    const vBody = L.box(1.18, 1.98, 0.82, L.toon(0xdadfe6), 0, 0.99, 0);
    vend.add(vBody); L.outline(vBody, 0.035, 0x11141c);
    const vFront = L.wall(1.06, 1.86, L.glowMap(vendingTexture(), 0.92), 0, 1.02, 0.42);
    vend.add(vFront);
    vend.add(L.box(1.22, 0.12, 0.88, L.toon(0x2a303c), 0, 2.03, 0));
    // 侧面
    const vSide = L.box(0.06, 1.9, 0.78, L.glow(0xdfe6ef, 0.75), 0.62, 1.0, 0);
    vend.add(vSide);
    // 底座
    vend.add(L.box(1.2, 0.1, 0.84, L.toon(0x3d4553), 0, 0.05, 0));
    const vLight = new T.PointLight(0xbfe6ff, 0.85, 6.5, 1.7);
    vLight.position.set(0, 1.5, 0.65);
    vLight.userData.base = 0.85;
    vend.add(vLight);
    D.vendLight = vLight;
    root.add(vend);

    /* ===== 公告栏 / 海报栏 ===== */
    const board = L.partGroup(4.0, 2.15, Z1 + 0.03, 31, 'grow');
    const bBoard = L.box(1.02, 0.74, 0.08, L.toon(0xffffff, { map: boardTexture() }), 0, 0, 0);
    board.add(bBoard);
    L.outline(bBoard, 0.025, 0x11141c);
    board.add(L.box(1.12, 0.08, 0.12, L.toon(0x424a58), 0, 0.42, 0.01));
    board.add(L.box(1.12, 0.08, 0.12, L.toon(0x424a58), 0, -0.42, 0.01));
    // 顶部小射灯
    const bl = L.box(0.5, 0.07, 0.1, L.glow(0xffeec8, 1.2), 0, 0.5, 0.14);
    board.add(bl);
    root.add(board);

    return root;
  }

  D.buildShop = build;
})(window.DIORAMA);
