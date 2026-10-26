import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Navigation } from "./navigation";

export const MAP = 160;
export const ground = (x: number, z: number) =>
  1.4 * Math.sin(x * 0.026) * Math.cos(z * 0.031) +
  0.65 * Math.sin(x * 0.071 + z * 0.047) +
  0.22 * Math.sin(x * 0.14) * Math.cos(z * 0.12);
const mat = (c: number, roughness = 1, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color: c, roughness, metalness });
const materials = {
  ground: mat(0x697467),
  rock: mat(0x796e5e),
  dark: mat(0x263b3b),
  steel: mat(0x586763, 0.72, 0.5),
  light: mat(0x9caaa0, 0.8, 0.2),
  rust: mat(0xb45b38, 0.9, 0.2),
  yellow: mat(0xd8a556),
  leaf: mat(0x405e49),
  leaf2: mat(0x577457),
  trunk: mat(0x5a5040),
  glass: new THREE.MeshStandardMaterial({
    color: 0x60b9b3,
    emissive: 0x184e4a,
    metalness: 0.6,
    roughness: 0.25,
  }),
};
export interface Obstacle {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  y: number;
}
export interface Loot {
  mesh: THREE.Group;
  x: number;
  z: number;
  type: "ammo" | "shield" | "med" | "weapon";
  weapon: number;
  taken: boolean;
}
export class World {
  scene: THREE.Scene;
  obstacles: Obstacle[] = [];
  platforms: Obstacle[] = [];
  loot: Loot[] = [];
  ring: THREE.Mesh;
  navigation: Navigation;
  private seed = 41;
  rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    materials.light.map = this.makePanelTexture(false);
    materials.rust.map = this.makePanelTexture(true);
    const terrain = new THREE.PlaneGeometry(MAP * 2.8, MAP * 2.8, 110, 110);
    terrain.rotateX(-Math.PI / 2);
    const p = terrain.attributes.position;
    const colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        y = ground(x, z);
      p.setY(i, y);
      const n = this.rand() * 0.07;
      const c = new THREE.Color().setRGB(
        0.34 + n + y * 0.008,
        0.39 + n + y * 0.008,
        0.33 + n,
      );
      colors.push(c.r, c.g, c.b);
    }
    terrain.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    terrain.computeVertexNormals();
    const tm = materials.ground.clone();
    tm.vertexColors = true;
    tm.map = this.makeGroundTexture();
    const land = new THREE.Mesh(terrain, tm);
    land.receiveShadow = true;
    scene.add(land);
    // The outlying ridgeline creates a continuous silhouette around the play space.
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2,
        r = 190 + this.rand() * 38,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        h = 16 + this.rand() * 38;
      const geo = new THREE.ConeGeometry(17 + this.rand() * 15, h, 7, 3);
      const p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const v = p.getY(j) / h + 0.5,
          scale = 1 + (this.rand() - 0.5) * 0.23;
        p.setX(j, p.getX(j) * scale + v * v * h * 0.12);
        p.setZ(j, p.getZ(j) * scale);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, materials.rock);
      m.position.set(x, h / 2 - 5, z);
      m.rotation.y = this.rand() * 6;
      scene.add(m);
    }
    const sites = [
      [-70, -60],
      [0, -70],
      [70, -48],
      [-80, 22],
      [0, 0],
      [72, 30],
      [-45, 90],
      [48, 95],
    ];
    const nearSite = (x: number, z: number) =>
      sites.some(([sx, sz]) => Math.abs(x - sx) < 24 && Math.abs(z - sz) < 24);
    for (let i = 0; i < 330; i++) {
      const x = (this.rand() - 0.5) * 320,
        z = (this.rand() - 0.5) * 320;
      if (nearSite(x, z)) continue;
      this.tree(x, z, 2.5 + this.rand() * 3);
    }
    sites.forEach(([x, z], i) => this.facility(x, z, i));
    this.canyon();
    for (let i = 0; i < 48; i++) {
      const x = (this.rand() - 0.5) * 290,
        z = (this.rand() - 0.5) * 290;
      if (!nearSite(x, z)) this.rock(x, z);
    }
    this.navigation = new Navigation(this.obstacles);
    this.batchStatic();
    this.addGroundCover();
    for (let i = 0; i < 45; i++) {
      const site = sites[i % sites.length];
      let x = site[0],
        z = site[1];
      for (let tries = 0; tries < 30; tries++) {
        x = site[0] + (this.rand() - 0.5) * 38;
        z = site[1] + (this.rand() - 0.5) * 38;
        if (!this.collides(x, z, 1)) break;
      }
      this.makeLoot(
        x,
        z,
        (["ammo", "shield", "med", "weapon"] as const)[i % 4],
      );
    }
    for (const [x, z] of sites) this.makeLoot(x - 8, z - 2, "ammo");
    const ringGeo = new THREE.CylinderGeometry(1, 1, 24, 96, 1, true);
    this.ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xe0a35b,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.ring.position.y = 11;
    scene.add(this.ring);
  }
  makeGroundTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#a6a99a";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const x = this.rand() * 256,
        y = this.rand() * 256,
        shade = Math.floor(95 + this.rand() * 120),
        alpha = 0.025 + this.rand() * 0.12;
      c.fillStyle = `rgba(${shade},${shade},${Math.floor(shade * 0.82)},${alpha})`;
      c.fillRect(x, y, 1 + this.rand() * 3, 1 + this.rand() * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(70, 70);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  makePanelTexture(weathered: boolean) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d")!;
    c.fillStyle = weathered ? "#d5bfa7" : "#e2e5da";
    c.fillRect(0, 0, 256, 256);
    let seed = weathered ? 4277 : 7183;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 1800; i++) {
      const x = random() * 256,
        y = random() * 256;
      c.fillStyle = weathered ? "rgba(101,60,36,.045)" : "rgba(59,79,69,.035)";
      c.fillRect(x, y, 1 + random() * 5, 1 + random() * 3);
    }
    c.strokeStyle = "rgba(42,57,51,.3)";
    c.lineWidth = 1;
    for (let y = 0; y <= 256; y += 64) {
      c.beginPath();
      c.moveTo(0, y + 0.5);
      c.lineTo(256, y + 0.5);
      c.stroke();
      const offset = (y / 64) % 2 ? 32 : 0;
      for (let x = offset; x <= 256; x += 64) {
        c.beginPath();
        c.moveTo(x + 0.5, y);
        c.lineTo(x + 0.5, y + 64);
        c.stroke();
        c.fillStyle = "rgba(50,65,57,.38)";
        c.fillRect(x + 4, y + 4, 2, 2);
        c.fillRect(x + 58, y + 4, 2, 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 1.5);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  addGroundCover() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.07, 0, 0, 0.07, 0, 0, 0.05, 0.8, 0, 0, 0, -0.07, 0, 0, 0.07, 0,
          0.8, 0,
        ],
        3,
      ),
    );
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: 0x5a6c43,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const grass = new THREE.InstancedMesh(geometry, material, 5000);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < 5000; i++) {
      const x = (this.rand() - 0.5) * MAP * 2,
        z = (this.rand() - 0.5) * MAP * 2;
      dummy.position.set(x, ground(x, z) - 0.03, z);
      dummy.rotation.y = this.rand() * Math.PI;
      const scale = 0.35 + this.rand() * 0.7;
      dummy.scale.set(scale, scale * (0.7 + this.rand()), scale);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.19 + this.rand() * 0.05, 0.3, 0.42 + this.rand() * 0.16);
      grass.setColorAt(i, color);
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.frustumCulled = false;
    this.scene.add(grass);
  }
  batchStatic() {
    // Batch by material and spatial tile so the renderer can cull distant geometry.
    const groups = new Map<
      string,
      { material: THREE.Material; geometries: THREE.BufferGeometry[] }
    >();
    for (const child of [...this.scene.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material))
        continue;
      child.updateMatrix();
      let geometry = child.geometry.clone();
      if (geometry.index) {
        const indexed = geometry;
        geometry = geometry.toNonIndexed();
        indexed.dispose();
      }
      geometry.applyMatrix4(child.matrix);
      const key = `${child.material.id}:${Math.floor(child.position.x / 48)}:${Math.floor(child.position.z / 48)}`;
      let group = groups.get(key);
      if (!group) {
        group = { material: child.material, geometries: [] };
        groups.set(key, group);
      }
      group.geometries.push(geometry);
      this.scene.remove(child);
      child.geometry.dispose();
    }
    for (const { material, geometries } of groups.values()) {
      const merged = mergeGeometries(geometries);
      for (const g of geometries) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    shadow = true,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }
  obstacle(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    m: THREE.Material,
  ) {
    const y = ground(x, z);
    this.box(x, y + h / 2, z, w, h, d, m);
    this.obstacles.push({ x, z, w, d, h, y });
  }
  facility(x: number, z: number, index: number) {
    const y = ground(x, z); // cluster of modular buildings and cover
    this.box(x, y - 0.16, z, 36, 0.4, 28, materials.dark, false);
    // Four walls with a three-metre entry create a navigable interior.
    this.obstacle(x - 14, z - 3, 0.45, 9, 7, materials.light);
    this.obstacle(x - 2, z - 3, 0.45, 9, 7, materials.light);
    this.obstacle(x - 8, z - 7.5, 12, 0.45, 7, materials.light);
    this.obstacle(x - 12, z + 1.5, 4, 0.45, 7, materials.light);
    this.obstacle(x - 4, z + 1.5, 4, 0.45, 7, materials.light);
    this.box(x - 8, y + 5.8, z + 1.5, 4, 2.4, 0.45, materials.light);
    this.box(x - 8, y + 7.25, z - 3, 13, 0.5, 10, materials.dark);
    this.platforms.push({ x: x - 8, z: z - 3, w: 13, d: 10, h: 0.5, y: y + 7 });
    this.box(x - 8, y + 0.05, z - 3, 11.4, 0.12, 8.4, materials.steel, false);
    this.box(x - 11, y + 1, z - 6.5, 3, 2, 1, materials.dark);
    this.box(x - 5, y + 1, z - 6.5, 3, 2, 1, materials.rust);
    this.box(x - 8, y + 3, z + 1.56, 11, 0.25, 0.18, materials.rust);
    for (let q = 0; q < 5; q++)
      this.box(
        x - 13.5 + q * 2.7,
        y + 3.5,
        z + 1.58,
        0.13,
        6.5,
        0.15,
        materials.dark,
      );
    this.box(x - 8, y + 5.7, z + 1.57, 11, 0.18, 0.2, materials.dark);
    for (const wx of [x - 12, x - 4])
      this.box(wx, y + 4, z + 1.76, 1.5, 1, 0.12, materials.glass, false);
    this.obstacle(x + 9, z + 5, 10, 7, 4.2, materials.steel);
    this.box(x + 9, y + 4.4, z + 5, 11, 0.4, 8, materials.rust);
    this.platforms.push({
      x: x + 9,
      z: z + 5,
      w: 11,
      d: 8,
      h: 0.4,
      y: y + 4.2,
    });
    // Service stair, with low risers leading onto the annex roof.
    for (let step = 0; step < 7; step++)
      this.obstacle(
        x + 9,
        z + 16 - step * 1.2,
        3,
        1.18,
        (step + 1) * 0.6,
        materials.steel,
      );
    // A raised service walk links the annex roof to the main structure.
    this.box(x + 1, y + 4.5, z + 4.5, 8, 0.3, 2.2, materials.steel);
    this.platforms.push({
      x: x + 1,
      z: z + 4.5,
      w: 8,
      d: 2.2,
      h: 0.3,
      y: y + 4.35,
    });
    this.box(x + 1, y + 5, z + 3.45, 8, 0.08, 0.08, materials.yellow);
    this.box(x + 1, y + 5, z + 5.55, 8, 0.08, 0.08, materials.yellow);
    this.obstacle(x + 12, z - 9, 3, 3, 2.5, materials.rust);
    for (let q = 0; q < 4; q++)
      this.box(
        x + 10.6 + q * 0.9,
        y + 1.25,
        z - 7.48,
        0.12,
        2.3,
        0.08,
        materials.dark,
      );
    this.obstacle(x - 2, z + 10, 4, 2, 1.5, materials.dark);
    this.box(x + 2, y + 8, z - 8, 0.35, 16, 0.35, materials.dark);
    this.box(x + 2, y + 16, z - 8, 5, 0.4, 0.4, materials.yellow);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      materials.glass,
    );
    lamp.position.set(x + 4, y + 15.7, z - 8);
    this.scene.add(lamp);
    if (index % 2 === 0) {
      this.box(x - 8, y + 9, z - 3, 2, 4, 2, materials.dark);
      this.box(x - 8, y + 11, z - 3, 4, 0.4, 4, materials.yellow);
    }
    for (let k = 0; k < 4; k++) {
      this.box(
        x - 14 + k * 3,
        y + 0.06,
        z - 13,
        1.6,
        0.08,
        0.2,
        materials.yellow,
        false,
      );
    }
  }
  canyon() {
    // An eroded corridor along the eastern edge, with a gap in each wall for cross-map travel.
    for (const side of [-1, 1])
      for (let i = 0; i < 10; i++) {
        if (i === 4) continue;
        const x = 118 + side * (15 + this.rand() * 3),
          z = -119 + i * 25 + (this.rand() - 0.5) * 4;
        const h = 8 + this.rand() * 8,
          w = 10 + this.rand() * 5,
          d = 15 + this.rand() * 5,
          y = ground(x, z);
        const mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 1),
          materials.rock,
        );
        mesh.scale.set(w * 0.65, h * 0.7, d * 0.63);
        mesh.position.set(x, y + h * 0.35, z);
        mesh.rotation.set(0.1, this.rand() * 6, 0.12);
        this.scene.add(mesh);
        this.obstacles.push({ x, z, w: w * 0.8, d: d * 0.8, h: h * 0.8, y });
      }
  }
  tree(x: number, z: number, s: number) {
    const y = ground(x, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.32, s, 5),
      materials.trunk,
    );
    trunk.position.set(x, y + s / 2, z);
    this.scene.add(trunk);
    for (let j = 0; j < 3; j++) {
      const geometry = new THREE.ConeGeometry(
        s * (0.42 - j * 0.07),
        s * 0.8,
        7,
        2,
      );
      const vertices = geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const variation = 0.85 + this.rand() * 0.3;
        vertices.setX(i, vertices.getX(i) * variation);
        vertices.setZ(i, vertices.getZ(i) * variation);
      }
      geometry.computeVertexNormals();
      const leaves = new THREE.Mesh(
        geometry,
        j % 2 ? materials.leaf2 : materials.leaf,
      );
      leaves.rotation.y = this.rand() * Math.PI;
      leaves.position.set(x, y + s * 0.65 + j * s * 0.3, z);
      this.scene.add(leaves);
    }
  }
  rock(x: number, z: number) {
    const y = ground(x, z),
      s = 1 + this.rand() * 2.3;
    const m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0),
      materials.rock,
    );
    m.position.set(x, y + s * 0.35, z);
    m.scale.set(1.4, 0.6, 1);
    m.rotation.y = this.rand() * 6;
    m.castShadow = true;
    this.scene.add(m);
    this.obstacles.push({ x, z, w: s * 2, d: s * 1.5, h: s, y });
  }
  makeLoot(x: number, z: number, type: Loot["type"]) {
    const g = new THREE.Group();
    const color = {
      ammo: 0xe5bc63,
      shield: 0x6bd7ed,
      med: 0xe67565,
      weapon: 0xbca8ec,
    }[type];
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.28, 0.6),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.15,
        metalness: 0.3,
        roughness: 0.5,
      }),
    );
    base.position.y = 0.25;
    g.add(base);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
    );
    beam.position.y = 1.45;
    g.add(beam);
    g.position.set(x, ground(x, z), z);
    this.scene.add(g);
    this.loot.push({
      mesh: g,
      x,
      z,
      type,
      weapon: type === "weapon" ? 1 + Math.floor(this.rand() * 2) : 0,
      taken: false,
    });
  }
  collides(x: number, z: number, r = 0.55, y = -Infinity) {
    return this.obstacles.some(
      (o) =>
        y < o.y + o.h - 0.15 &&
        x > o.x - o.w / 2 - r &&
        x < o.x + o.w / 2 + r &&
        z > o.z - o.d / 2 - r &&
        z < o.z + o.d / 2 + r,
    );
  }
  surface(x: number, z: number, y: number) {
    let h = ground(x, z);
    for (const o of [...this.obstacles, ...this.platforms])
      if (
        x > o.x - o.w / 2 &&
        x < o.x + o.w / 2 &&
        z > o.z - o.d / 2 &&
        z < o.z + o.d / 2 &&
        y >= o.y + o.h - 0.7
      )
        h = Math.max(h, o.y + o.h);
    return h;
  }
  /** First overhead solid crossed by the top of a moving character. */
  ceiling(x: number, z: number, fromY: number, toY: number, radius = 0.3) {
    let nearest = Infinity;
    for (const o of [...this.obstacles, ...this.platforms]) {
      if (
        o.y >= fromY &&
        o.y <= toY &&
        o.y < nearest &&
        x > o.x - o.w / 2 - radius &&
        x < o.x + o.w / 2 + radius &&
        z > o.z - o.d / 2 - radius &&
        z < o.z + o.d / 2 + radius
      )
        nearest = o.y;
    }
    return nearest;
  }
  move(pos: THREE.Vector3, dx: number, dz: number, r = 0.55) {
    const x = THREE.MathUtils.clamp(pos.x + dx, -MAP, MAP),
      z = THREE.MathUtils.clamp(pos.z + dz, -MAP, MAP);
    const attempt = (nx: number, nz: number) => {
      if (!this.collides(nx, nz, r, pos.y)) {
        pos.x = nx;
        pos.z = nz;
        return;
      }
      let top = -Infinity;
      for (const o of this.obstacles)
        if (
          nx > o.x - o.w / 2 - r &&
          nx < o.x + o.w / 2 + r &&
          nz > o.z - o.d / 2 - r &&
          nz < o.z + o.d / 2 + r &&
          o.y + o.h > pos.y
        )
          top = Math.max(top, o.y + o.h);
      if (top > pos.y && top - pos.y <= 0.7 && !this.collides(nx, nz, r, top)) {
        pos.y = top;
        pos.x = nx;
        pos.z = nz;
      }
    };
    attempt(x, pos.z);
    attempt(pos.x, z);
  }
  /** Return the first solid impact along a normalized ray. */
  raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
  ) {
    let nearest = maxDistance;
    for (const o of [...this.obstacles, ...this.platforms]) {
      let near = 0,
        far = nearest;
      const axes: [
        [number, number, number, number],
        [number, number, number, number],
        [number, number, number, number],
      ] = [
        [origin.x, direction.x, o.x - o.w / 2, o.x + o.w / 2],
        [origin.y, direction.y, o.y, o.y + o.h],
        [origin.z, direction.z, o.z - o.d / 2, o.z + o.d / 2],
      ];
      for (const [value, delta, min, max] of axes) {
        if (Math.abs(delta) < 1e-8) {
          if (value < min || value > max) {
            near = Infinity;
            break;
          }
          continue;
        }
        const a = (min - value) / delta,
          b = (max - value) / delta;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) {
          near = Infinity;
          break;
        }
      }
      if (near < nearest) nearest = near;
    }
    // The ground is a height field rather than a set of boxes. Sample the ray
    // and refine the first crossing so shots cannot pass through a hillside.
    const heightAt = (distance: number) =>
      origin.y +
      direction.y * distance -
      ground(
        origin.x + direction.x * distance,
        origin.z + direction.z * distance,
      );
    if (Math.min(origin.y, origin.y + direction.y * nearest) <= 2.3) {
      let previous = 0;
      for (
        let t = Math.min(2, nearest);
        t <= nearest;
        t = Math.min(t + 2, nearest)
      ) {
        if (heightAt(t) <= 0) {
          let low = previous,
            high = t;
          for (let i = 0; i < 6; i++) {
            const middle = (low + high) / 2;
            if (heightAt(middle) <= 0) high = middle;
            else low = middle;
          }
          nearest = high;
          break;
        }
        if (t === nearest) break;
        previous = t;
      }
    }
    return nearest;
  }
  setRing(radius: number) {
    this.ring.scale.set(radius, 1, radius);
  }
}
