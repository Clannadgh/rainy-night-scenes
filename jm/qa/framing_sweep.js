const { camera, controls, THREE, scene } = window.__TSUKIMI;
const V = THREE.Vector3;
const save = {
  p: camera.position.clone(),
  t: controls.target.clone(),
  fov: camera.fov,
};
const baseCorners = [];
for (const x of [-13.65, 9.85]) for (const z of [-11.75, 11.75]) for (const y of [0.02, -1.84]) {
  baseCorners.push(new V(x, y, z));
}
const candidates = [
  { p: [18, 14.2, 26.8], t: [-1.9, 2, 0], f: 37.5 },
  { p: [18, 16.5, 27.5], t: [-1.9, 1.1, 0], f: 37.5 },
  { p: [19, 17.5, 29], t: [-1.9, 1.1, 0], f: 36 },
  { p: [18.5, 18.5, 28.5], t: [-1.9, 1.4, 0], f: 36 },
  { p: [19.5, 18, 29], t: [-1.9, 1.1, 0], f: 35 },
  { p: [20, 18, 30], t: [-1.9, 1.1, 0], f: 34 },
  { p: [21, 19, 31], t: [-1.9, 1.2, 0], f: 34 },
  { p: [20.5, 20.5, 30], t: [-1.9, 1.2, 0], f: 34 },
  { p: [19, 16.8, 28.3], t: [-1.9, 0.6, 0], f: 38 },
  { p: [19.5, 17, 29], t: [-1.9, 0.5, 0], f: 38 },
];
camera.updateMatrixWorld();
const results = [];
for (const c of candidates) {
  camera.position.set(...c.p);
  camera.fov = c.f;
  camera.updateProjectionMatrix();
  camera.lookAt(new V(...c.t));
  camera.updateMatrixWorld();
  let minx = 9, maxx = -9, miny = 9, maxy = -9;
  for (const corner of baseCorners) {
    const p = corner.clone().project(camera);
    minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
    miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
  }
  const top = new V(-1.3, 10.4, -1.0).project(camera);
  const roof = new V(-1.9, 8.3, 0.0).project(camera);
  results.push({
    cfg: c,
    base: [minx.toFixed(3), maxx.toFixed(3), miny.toFixed(3), maxy.toFixed(3)],
    topY: top.y.toFixed(3),
    roofY: roof.y.toFixed(3),
  });
}
camera.position.copy(save.p);
camera.fov = save.fov;
camera.updateProjectionMatrix();
camera.lookAt(save.t);
camera.updateMatrixWorld();
results;
