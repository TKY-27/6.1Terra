import * as THREE from "three";

/** Generate a soft sky and cloud layer without network assets. */
export function createSky(): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  const sky = c.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#5a858e");
  sky.addColorStop(0.45, "#9fb9b5");
  sky.addColorStop(0.53, "#c5c9b5");
  sky.addColorStop(1, "#687b74");
  c.fillStyle = sky;
  c.fillRect(0, 0, 1024, 512);
  const sun = c.createRadialGradient(750, 155, 1, 750, 155, 105);
  sun.addColorStop(0, "rgba(255,245,217,.9)");
  sun.addColorStop(0.08, "rgba(255,235,197,.5)");
  sun.addColorStop(1, "rgba(255,229,187,0)");
  c.fillStyle = sun;
  c.fillRect(645, 50, 210, 210);
  let seed = 9235;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 95; i++) {
    const x = random() * 1024,
      y = 76 + random() * 150;
    const rx = 25 + random() * 75,
      ry = 3 + random() * 11;
    for (const offset of [-1024, 0, 1024]) {
      c.save();
      c.translate(x + offset, y);
      c.scale(1, ry / rx);
      const cloud = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      cloud.addColorStop(0, "rgba(239,238,220,.13)");
      cloud.addColorStop(1, "rgba(239,238,220,0)");
      c.fillStyle = cloud;
      c.beginPath();
      c.arc(0, 0, rx, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -1000;
  return skyMesh;
}
