const { camera } = window.__TSUKIMI;
const V = camera.position.constructor;
const xs = [-13.65, 9.85];
const zs = [-11.75, 11.75];
const ys = [0.02, -1.84];
const out = [];
for (const x of xs) for (const z of zs) for (const y of ys) {
  const p = new V(x, y, z).project(camera);
  out.push({ x, y, z, sx: +p.x.toFixed(3), sy: +p.y.toFixed(3) });
}
const poleTop = new V(4.9, 10.1, 3.2).project(camera);
const buildingTop = new V(-1.9, 10.6, 0).project(camera);
({ corners: out, poleTop: { x: +poleTop.x.toFixed(2), y: +poleTop.y.toFixed(2) }, buildingTop: { x: +buildingTop.x.toFixed(2), y: +buildingTop.y.toFixed(2) } });
