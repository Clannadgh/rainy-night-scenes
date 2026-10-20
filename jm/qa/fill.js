const s = window.__TSUKIMI;
s.scene.traverse((o) => {
  if (o.isHemisphereLight) o.intensity = 0.94;
  if (o.isAmbientLight) o.intensity = 0.38;
  if (o.isDirectionalLight) o.intensity *= 1.28;
});
'fill';
