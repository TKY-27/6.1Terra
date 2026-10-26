import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

let server, Navigation, World;
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  ({ Navigation } = await server.ssrLoadModule("/src/navigation.ts"));
  ({ World } = await server.ssrLoadModule("/src/world.ts"));
});
after(async () => {
  await server.close();
});

test("navigation routes around a wall and reaches the destination", () => {
  const nav = new Navigation([{ x: 0, z: 0, w: 4, d: 20, h: 5, y: 0 }]);
  const path = nav.route(-10, 0, 10, 0);
  assert.ok(path.length > 0);
  assert.ok(path.some((p) => Math.abs(p.z) > 10));
  assert.deepEqual(path.at(-1), { x: 10, z: 0 });
  for (const p of path) assert.ok(!(Math.abs(p.x) < 3 && Math.abs(p.z) < 11));
});

test("raycast stops at a wall and at the terrain", () => {
  const world = {
    obstacles: [{ x: 0, z: 0, w: 2, d: 2, h: 10, y: 0 }],
    platforms: [],
  };
  const hit = World.prototype.raycast.call(
    world,
    new THREE.Vector3(-5, 5, 0),
    new THREE.Vector3(1, 0, 0),
    20,
  );
  assert.equal(hit, 4);
  const terrain = World.prototype.raycast.call(
    { obstacles: [], platforms: [] },
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(0, -1, 0),
    20,
  );
  assert.ok(Math.abs(terrain - 10) < 0.05);
});

test("upward movement detects an overhead platform only when crossed", () => {
  const world = {
    obstacles: [],
    platforms: [{ x: 0, z: 0, w: 4, d: 4, h: 0.4, y: 3 }],
  };
  assert.equal(World.prototype.ceiling.call(world, 0, 0, 2.8, 3.1), 3);
  assert.equal(World.prototype.ceiling.call(world, 5, 0, 2.8, 3.1), Infinity);
  assert.equal(World.prototype.ceiling.call(world, 0, 0, 3.5, 4), Infinity);
});
