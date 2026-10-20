const { camera, controls, THREE } = window.__TSUKIMI;
const V = THREE.Vector3;
const save = { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov };
const topCorners = [];
const botCorners = [];
for (const x of [-13.65, 9.85]) for (const z of [-11.75, 11.75]) {
  topCorners.push(new V(x, 0.02, z));
  botCorners.push(new V(x, -1.84, z));
}
const candidates = [
  { p: [19.5, 17, 29], t: [-1.9, 0.5, 0], f: 38 },
  { p: [19.5, 17, 29], t: [-1.9, 0.0, 0], f: 38 },
  { p: [19, 16.5, 28.5], t: [-1.9, 0.1, 0], f: 38 },
  { p: [20, 17.5, 30], t: [-1.9, 0.2, 0], f: 37 },
  { p: [19.5, 17.5, 29.5], t: [-1.9, 0.2, 0], f: 37 },
  { p: [20, 18, 30], t: [-1.9, 0.0, 0], f: 37 },
  { p: [20, 19, 30.5], t: [-1.9, 0.2, 0], f: 36 },
  { p: [20.5, 19.5, 31], t: [-1.9, 0.2, 0], f: 36 },
  { p: [19, 16, 28.8], t: [-1.9, 0.0, 0], f: 40 },
  { p: [20.5, 18.5, 30.5], t: [-1.9, -0.2, 0], f: 37 },
];
const proj = (v) => v.clone().project(camera);
const results = [];
for (const c of candidates) {
  camera.position.set(...c.p);
  camera.fov = c.f;
  camera.updateProjectionMatrix();
  camera.lookAt(new V(...c.t));
  camera.updateMatrixWorld();
  let tx0 = 9, tx1 = -9, ty0 = 9, ty1 = -9, by0 = 9, by1 = -9;
  for (let i = 0; i < 4; i++) {
    const a = proj(topCorners[i]);
    const b = proj(botCorners[i]);
    tx0 = Math.min(tx0, a.x); tx1 = Math.max(tx1, a.x);
    ty0 = Math.min(ty0, a.y); ty1 = Math.max(ty1, a.y);
    by0 = Math.min(by0, b.y); by1 = Math.max(by1, b.y);
  }
  const topModel = proj(new V(-1.3, 10.4, -1.0));
  const storeTop = proj(new V(-3.25, 8.4, 4.0));
  results.push({
    cfg: c,
    topSquare: [tx0.toFixed(3), tx1.toFixed(3), ty0.toFixed(3), ty1.toFixed(3)],
    baseBottom: [by0.toFixed(3), by1.toFixed(3)],
    modelTopY: topModel.y.toFixed(3),
    storeTopY: storeTop.y.toFixed(3),
  });
}
camera.position.copy(save.p);
camera.fov = save.fov;
camera.updateProjectionMatrix();
camera.lookAt(save.t);
camera.updateMatrixWorld();
results;
