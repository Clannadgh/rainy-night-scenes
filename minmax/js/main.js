/* ============================================================
   主程序：渲染器 / 相机 / 灯光 / 后处理 / 入场组装动画 / 主循环
   ============================================================ */
(function (D) {
  'use strict';
  const T = THREE, L = D.LIB;

  let renderer, scene, camera, controls, composer, bloomPass;
  let rainFx, rippleFx, clock;
  const parts = L.parts;
  let lastFrameMs = 16;
  let shadowDirty = true;          // 场景没变就别重画阴影贴图

  // 可选参数：
  //   ?dpr=0.5     降低渲染分辨率（软件渲染/低端机调试用）
  //   ?probe=1     页面标题显示帧率、可见部件数等运行状态
  //   ?still=9     固定时间点（截图对比用，跳过入场动画）
  //   ?rain=0      关闭雨
  //   ?shadow=always  每帧重算阴影贴图（默认只在场景变化时重算）
  const QS = new URLSearchParams(location.search);
  const DPR_OVERRIDE = parseFloat(QS.get('dpr'));
  const STILL = QS.has('still') ? parseFloat(QS.get('still')) : null;
  const USE_STILL = STILL !== null && !isNaN(STILL);
  const NO_RAIN = QS.get('rain') === '0';
  const SHADOW_ALWAYS = QS.get('shadow') === 'always';

  /* ---------------- 场景装配 ---------------- */
  function init() {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const basePR = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR_OVERRIDE > 0 ? DPR_OVERRIDE : basePR);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;   // 阴影贴图只在场景变化时重算

    scene = new T.Scene();
    // 夜空渐变背景
    const bg = L.canvasTex(8, 512, function (c, w, h) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#080d1c');
      g.addColorStop(0.4, '#101a30');
      g.addColorStop(0.72, '#1b2440');
      g.addColorStop(1, '#090d1a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    scene.background = bg;
    // 雾色同样要走线性空间：本管线末端有伽马校正，雾色若直接用 sRGB 数值
    // 会把远处压成一片发灰的蓝，破坏夜景对比。
    scene.fog = new T.Fog(L.linColor(0x121a2c), 32, 88);

    /* 相机：第三视角，可自由拖拽 / 旋转 / 缩放 */
    camera = new T.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.4, 260);
    const camFinal = new T.Vector3(-15.6, 11.4, 20.2);
    const tgtFinal = new T.Vector3(0.1, 1.9, -1.2);
    camera.position.copy(camFinal);
    camera.lookAt(tgtFinal);

    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.target.copy(tgtFinal);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.85;
    controls.panSpeed = 0.6;
    controls.minDistance = 7;
    controls.maxDistance = 72;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.47;
    controls.screenSpacePanning = false;
    controls.update();

    /* 灯光 */
    scene.add(new T.HemisphereLight(0x3a4f7a, 0x0a0d14, 0.4));
    scene.add(new T.AmbientLight(0x1d2740, 0.34));
    const moon = new T.DirectionalLight(0xa8c4ff, 0.45);
    moon.position.set(-16, 21, 15);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -15;
    moon.shadow.camera.right = 15;
    moon.shadow.camera.top = 15;
    moon.shadow.camera.bottom = -15;
    moon.shadow.camera.near = 4;
    moon.shadow.camera.far = 58;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.04;
    scene.add(moon);
    scene.add(moon.target);

    /* 内容 */
    D.buildWorld(scene);
    D.buildShop(scene);
    D.buildProps(scene);
    rainFx = D.buildRain(scene);
    rippleFx = D.buildRipples(scene);
    D.buildSmears(scene);
    if (NO_RAIN) { rainFx.mesh.visible = false; }

    setupShadows();

    /* 后处理：辉光 + 伽马校正 */
    composer = new T.EffectComposer(renderer);
    composer.addPass(new T.RenderPass(scene, camera));
    bloomPass = new T.UnrealBloomPass(
      new T.Vector2(window.innerWidth, window.innerHeight), 0.68, 0.66, 0.90);
    composer.addPass(bloomPass);
    const gammaPass = new T.ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec4 c = texture2D(tDiffuse, vUv);',
        '  gl_FragColor = vec4(pow(c.rgb, vec3(0.4545)), c.a);',
        '}'
      ].join('\n')
    });
    gammaPass.renderToScreen = true;
    composer.addPass(gammaPass);

    /* 入场动画初始状态 */
    const STEP = 0.125, DUR = 0.66;
    parts.forEach(function (p) {
      const b = p.userData.build;
      p.userData.baseY = p.position.y;
      p.userData.delay = b.order * STEP;
      p.userData.dur = DUR;
      p.visible = false;
    });

    clock = new T.Clock();
    window.addEventListener('resize', onResize);
    onResize();

    // 入场镜头（用户一交互即接管）
    intro.active = !USE_STILL;
    intro.t = 0;
    intro.t0 = clock.getElapsedTime();
    intro.camFrom = new T.Vector3(-23.5, 17.5, 29.5);
    intro.camTo = camFinal;
    intro.tgtFrom = new T.Vector3(-0.4, 2.6, -1.0);
    intro.tgtTo = tgtFinal;
    controls.addEventListener('start', function () { intro.active = false; });

    installProbe();
    // 开发/调试句柄
    window.__dio = {
      scene: scene, camera: camera, controls: controls, renderer: renderer,
      parts: parts, D: D, intro: intro,
      setCam: function (px, py, pz, tx, ty, tz) {
        intro.active = false;
        camera.position.set(px, py, pz);
        controls.target.set(tx, ty, tz);
        controls.update();
        shadowDirty = true;
      }
    };
    requestAnimationFrame(loop);
  }

  const intro = { active: false, t: 0, t0: 0, dur: 6.0, camFrom: null, camTo: null, tgtFrom: null, tgtTo: null };

  /* ---------------- 阴影 ---------------- */
  function hasFlag(o, key) {
    let p = o;
    while (p) {
      if (p.userData && p.userData[key]) return true;
      p = p.parent;
    }
    return false;
  }
  function setupShadows() {
    scene.traverse(function (o) {
      if (!o.isMesh) return;
      const m = o.material;
      if (!m) return;
      if (hasFlag(o, 'noShadow')) { o.castShadow = false; return; }
      if (m.isMeshBasicMaterial || m.isShaderMaterial) return;   // 描边 / 发光件 / 反射面不投影
      if (m.transparent) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere.radius > 0.2) o.castShadow = true;
    });
  }

  /* ---------------- 入场组装动画 ---------------- */
  function updateAssembly(t) {
    let animating = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const d = p.userData;
      const local = L.clamp01((t - d.delay) / d.dur);
      if (local <= 0) {
        if (p.visible) p.visible = false;
        continue;
      }
      if (!p.visible) p.visible = true;
      const up = L.easeOutCubic(local);
      const back = L.easeOutBack(local);
      if (d.build.mode === 'grow') {
        p.scale.set(0.94 + 0.06 * up, Math.max(0.02, back), 0.94 + 0.06 * up);
      } else {
        const s = Math.max(0.02, back);
        p.scale.set(s, s, s);
      }
      // 由上方轻轻落下就位
      p.position.y = d.baseY + (1 - up) * 0.55;
      if (local >= 1) {
        p.scale.set(1, 1, 1);
        p.position.y = d.baseY;
      } else {
        animating = true;
      }
    }
    return animating;
  }

  /* ---------------- 主循环 ---------------- */
  function loop() {
    requestAnimationFrame(loop);
    const t0 = performance.now();
    // 全部动画都直接由绝对时间驱动：低帧率机器上节奏也不会被拉长
    let time = clock.getElapsedTime();
    if (USE_STILL) time = STILL;         // 固定时间点：截图对比时结果可复现

    if (updateAssembly(time)) shadowDirty = true;

    if (intro.active) {
      // 用真实经过时间推进，避免低帧率机器上入场动画被拉长
      intro.t = time - intro.t0;
      const k = L.easeInOutCubic(L.clamp01(intro.t / intro.dur));
      camera.position.lerpVectors(intro.camFrom, intro.camTo, k);
      controls.target.lerpVectors(intro.tgtFrom, intro.tgtTo, k);
      if (intro.t >= intro.dur) intro.active = false;
    }

    D.updateFxs(time);
    rainFx.mat.uniforms.uTime.value = time;
    rippleFx.mat.uniforms.uTime.value = time;

    // 阴影贴图只在场景真的动了的时候重画（组装动画期间 / 首帧）
    if (shadowDirty || SHADOW_ALWAYS) {
      renderer.shadowMap.needsUpdate = true;
      shadowDirty = false;
    }
    controls.update();
    composer.render();
    lastFrameMs = performance.now() - t0;
    frameCount++;
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w * 0.5, h * 0.5);   // 辉光半分辨率，省性能
  }

  /* ---------------- 调试探针（URL 加 ?probe=1 开启） ---------------- */
  let frameCount = 0, fpsMark = 0, fps = 0;
  function installProbe() {
    if (QS.get('probe') !== '1') return;
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a';
    fpsMark = performance.now();
    setInterval(function () {
      const now = performance.now();
      fps = frameCount * 1000 / Math.max(1, now - fpsMark);
      frameCount = 0; fpsMark = now;
      let vis = 0, nan = 0;
      parts.forEach(function (p) {
        if (p.visible) vis++;
        if (isNaN(p.position.x) || isNaN(p.position.y) || isNaN(p.scale.x)) nan++;
      });
      document.title = 'DIAG fps=' + fps.toFixed(1) + ' vis=' + vis + '/' + parts.length + ' nan=' + nan +
        ' t=' + clock.getElapsedTime().toFixed(1) +
        ' ms=' + lastFrameMs.toFixed(0) +
        ' calls=' + renderer.info.render.calls +
        ' gpu=' + gpu;
    }, 500);
  }

  window.addEventListener('load', function () {
    try {
      init();
    } catch (err) {
      console.error(err);
      document.body.style.background = '#12060a';
    }
  });
})(window.DIORAMA);
