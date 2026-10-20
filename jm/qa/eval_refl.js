const r = window.__TSUKIMI.roadReflector;
r.material.fragmentShader = [
  'uniform sampler2D tDiffuse;',
  'varying vec4 vUv;',
  'void main(){ vec4 c=texture2DProj(tDiffuse, vUv); gl_FragColor=vec4(c.rgb,1.0); }',
].join('\n');
r.material.needsUpdate = true;
window.__TSUKIMI.hideGlass();
window.__TSUKIMI.setCamera(18, 14, 27, -1, 2, 0.3, 34);
'raw refl';
