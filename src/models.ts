import * as THREE from "three";

export function createBot() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({
    color: 0x263530,
    roughness: 0.85,
  });
  const armor = new THREE.MeshStandardMaterial({
    color: [0xa35c42, 0x607b70, 0x8d896b][Math.floor(Math.random() * 3)],
    roughness: 0.7,
    metalness: 0.25,
  });
  const light = new THREE.MeshStandardMaterial({
    color: 0xbfcac0,
    roughness: 0.65,
    metalness: 0.15,
  });
  const visor = new THREE.MeshStandardMaterial({
    color: 0x508b88,
    metalness: 0.7,
    roughness: 0.22,
    emissive: 0x102a28,
  });
  const part = (
    parent: THREE.Group,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const body = new THREE.Group();
  g.add(body);
  part(body, new THREE.CapsuleGeometry(0.25, 0.38, 4, 8), dark, 0, 1.27, 0);
  part(body, new THREE.BoxGeometry(0.55, 0.56, 0.27), armor, 0, 1.3, -0.13);
  part(body, new THREE.BoxGeometry(0.43, 0.12, 0.08), light, 0, 1.48, -0.29);
  part(body, new THREE.BoxGeometry(0.35, 0.35, 0.17), dark, 0, 1.34, 0.25);
  const head = new THREE.Group();
  g.add(head);
  const helmet = part(
    head,
    new THREE.SphereGeometry(0.22, 10, 8),
    light,
    0,
    1.87,
    0,
  );
  helmet.scale.set(0.9, 1.12, 0.93);
  part(head, new THREE.BoxGeometry(0.32, 0.105, 0.08), visor, 0, 1.91, -0.19);
  part(head, new THREE.BoxGeometry(0.13, 0.1, 0.1), dark, 0.19, 1.85, 0);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.19, 0.89, 0);
    g.add(leg);
    part(leg, new THREE.CapsuleGeometry(0.12, 0.28, 4, 8), dark, 0, -0.2, 0);
    part(leg, new THREE.BoxGeometry(0.21, 0.22, 0.19), armor, 0, -0.35, -0.04);
    part(leg, new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), dark, 0, -0.58, 0);
    part(leg, new THREE.BoxGeometry(0.22, 0.14, 0.34), dark, 0, -0.79, -0.06);
  }
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, 1.53, 0);
    g.add(arm);
    const shoulder = part(
      arm,
      new THREE.SphereGeometry(0.16, 8, 6),
      armor,
      0,
      0,
      0,
    );
    shoulder.scale.set(1, 0.75, 1);
    part(
      arm,
      new THREE.CapsuleGeometry(0.09, 0.28, 4, 8),
      dark,
      side * 0.04,
      -0.22,
      0,
    );
    part(
      arm,
      new THREE.BoxGeometry(0.17, 0.26, 0.19),
      armor,
      side * 0.04,
      -0.37,
      -0.02,
    );
    part(
      arm,
      new THREE.SphereGeometry(0.1, 8, 6),
      dark,
      side * 0.04,
      -0.5,
      -0.08,
    );
  }
  const weapon = new THREE.Group();
  g.add(weapon);
  part(
    weapon,
    new THREE.BoxGeometry(0.13, 0.14, 0.55),
    dark,
    0.29,
    1.16,
    -0.35,
  );
  part(
    weapon,
    new THREE.BoxGeometry(0.12, 0.06, 0.28),
    light,
    0.29,
    1.24,
    -0.29,
  );
  return g;
}
export function createAircraft() {
  const g = new THREE.Group(),
    m = new THREE.MeshStandardMaterial({
      color: 0x344f50,
      metalness: 0.6,
      roughness: 0.5,
    }),
    accent = new THREE.MeshStandardMaterial({
      color: 0xc67748,
      metalness: 0.3,
      roughness: 0.65,
    });
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat = m,
  ) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z);
    g.add(b);
  };
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 10, 6, 12), m);
  hull.rotation.z = Math.PI / 2;
  hull.scale.z = 1.12;
  g.add(hull);
  box(4, 0.45, 17, -0.5, -0.15, 0);
  box(2.5, 0.3, 8, -5, 1.1, 0, accent);
  box(2.8, 2.2, 0.35, -5.2, 1.9, 0, accent);
  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshStandardMaterial({
      color: 0x74a5a0,
      metalness: 0.7,
      roughness: 0.2,
    }),
  );
  cockpit.scale.set(2, 0.55, 1.1);
  cockpit.position.set(4.5, 1.45, 0);
  g.add(cockpit);
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 4, 12),
      m,
    );
    engine.rotation.z = Math.PI / 2;
    engine.position.set(-2, -0.45, side * 6);
    g.add(engine);
    const exhaust = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 12),
      new THREE.MeshBasicMaterial({ color: 0x85d9ce }),
    );
    exhaust.rotation.y = -Math.PI / 2;
    exhaust.position.set(-4.05, -0.45, side * 6);
    g.add(exhaust);
    box(2, 0.12, 1.2, 1, 0.15, side * 7.5, accent);
  }
  return g;
}
export function createGun() {
  const holder = new THREE.Group();
  holder.position.set(0.36, -0.31, -0.58);
  const metal = new THREE.MeshStandardMaterial({
    color: 0x52615d,
    metalness: 0.7,
    roughness: 0.36,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x273632,
    metalness: 0.4,
    roughness: 0.48,
  });
  const grip = new THREE.MeshStandardMaterial({
    color: 0x26302c,
    roughness: 0.95,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: 0x777666,
    roughness: 0.95,
  });
  const accents = [0xd59c5e, 0x77b8ac, 0xd8b58c].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.5,
        roughness: 0.42,
      }),
  );
  const glow = new THREE.MeshBasicMaterial({ color: 0x7cd5c7 });
  const flashCanvas = document.createElement("canvas");
  flashCanvas.width = flashCanvas.height = 64;
  const flashContext = flashCanvas.getContext("2d")!;
  const flashGradient = flashContext.createRadialGradient(
    32,
    32,
    1,
    32,
    32,
    30,
  );
  flashGradient.addColorStop(0, "rgba(255,255,238,1)");
  flashGradient.addColorStop(0.25, "rgba(255,205,112,.85)");
  flashGradient.addColorStop(1, "rgba(255,132,46,0)");
  flashContext.fillStyle = flashGradient;
  flashContext.fillRect(0, 0, 64, 64);
  const flashMaterial = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(flashCanvas),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  for (let index = 0; index < 3; index++) {
    const model = new THREE.Group(),
      accent = accents[index];
    const length = index === 1 ? 0.48 : index === 2 ? 0.9 : 0.68;
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
      angle = 0,
    ) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      part.position.set(x, y, z);
      part.rotation.x = angle;
      model.add(part);
      return part;
    };
    const tube = (
      radius: number,
      len: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
    ) => {
      const part = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, len, 10),
        m,
      );
      part.rotation.x = Math.PI / 2;
      part.position.set(x, y, z);
      model.add(part);
    };
    // Layered receiver, bolt, rail, forward shroud, barrel, and a visible magazine.
    box(0.24, 0.22, length, 0, 0, -0.04, metal);
    box(0.26, 0.08, length * 0.7, 0, 0.13, -0.03, accent);
    box(0.16, 0.08, length * 0.85, 0, 0.2, -0.06, dark);
    box(0.19, 0.14, length * 0.45, 0, -0.03, -length * 0.57, dark);
    tube(
      index === 2 ? 0.025 : 0.035,
      index === 2 ? 0.58 : 0.36,
      0,
      0.015,
      -length * 0.82,
      dark,
    );
    tube(index === 2 ? 0.055 : 0.06, 0.1, 0, 0.015, -length * 1.12, dark);
    box(0.08, 0.12, 0.18, 0, 0.24, -0.1, dark);
    box(0.11, 0.26, 0.14, 0, -0.2, 0.13, grip, -0.2);
    box(0.14, index === 1 ? 0.3 : 0.23, 0.17, 0, -0.22, -0.12, dark, 0.12);
    box(0.08, 0.05, 0.27, 0.14, -0.02, -0.12, accent);
    box(0.03, 0.015, 0.19, 0.155, 0.03, -0.12, glow);
    for (let j = 0; j < 4; j++)
      box(0.025, 0.02, 0.03, 0.14, 0.075, -0.25 + j * 0.08, dark);
    if (index === 2) {
      tube(0.08, 0.32, 0, 0.25, -0.13, dark);
      tube(0.085, 0.06, 0, 0.25, -0.29, metal);
      box(0.13, 0.09, 0.18, 0, 0.17, 0.16, dark);
    } else {
      box(0.12, 0.12, 0.12, 0, 0.19, 0.15, dark);
      box(0.18, 0.04, 0.13, 0, 0.27, 0.15, metal);
    }
    // Sleeves and gloves keep the weapon grounded in the first-person view.
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.105, 0.42, 4, 8),
      cloth,
    );
    arm.rotation.set(0.9, 0, -0.5);
    arm.position.set(0.15, -0.43, 0.22);
    model.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), grip);
    hand.scale.set(0.8, 1.1, 1.3);
    hand.position.set(0.08, -0.22, 0.12);
    model.add(hand);
    const other = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, 0.35, 4, 8),
      cloth,
    );
    other.rotation.set(0.9, 0, 0.65);
    other.position.set(-0.16, -0.38, -0.34);
    model.add(other);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), grip);
    glove.position.set(-0.1, -0.18, -0.34);
    model.add(glove);
    const muzzle = new THREE.Sprite(flashMaterial);
    muzzle.name = "muzzleFlash";
    muzzle.visible = false;
    muzzle.position.set(0, 0.015, -length * 1.12 - 0.08);
    muzzle.scale.set(0.27, 0.27, 1);
    model.add(muzzle);
    model.visible = index === 0;
    holder.add(model);
  }
  return holder;
}
