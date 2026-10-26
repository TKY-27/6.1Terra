import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
if (!existsSync(executablePath))
  throw new Error(
    "Set CHROMIUM_PATH to an installed Chromium or Chrome executable.",
  );
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "silent",
});
await server.listen();
const address = server.httpServer.address();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  await page.goto(`http://127.0.0.1:${address.port}/`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.terra, null, { timeout: 60000 });
  await page.waitForSelector("#boot", { state: "detached", timeout: 60000 });
  assert.ok(await page.locator("[data-ui=menu]").isVisible());
  await page.click("#start");
  assert.deepEqual(
    await page.evaluate(() => [window.terra.phase, window.terra.bots.length]),
    ["aircraft", 9],
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.ok(await page.locator("[data-ui=pause]").isVisible());
  await page.click("#resume");
  await page.waitForFunction(() => !window.terra.paused, null, {
    timeout: 15000,
  });
  await page.keyboard.press("Space");
  assert.equal(await page.evaluate(() => window.terra.phase), "drop");
  const landed = await page.evaluate(() => {
    const g = window.terra;
    g.paused = false;
    for (let i = 0; i < 100 && g.phase === "drop"; i++) g.update(0.05);
    return g.phase;
  });
  assert.equal(landed, "playing");
  await page.evaluate(() => {
    const g = window.terra;
    g.paused = false;
    g.player.pos.set(35, g.world.surface(35, 0, -100), 0);
    g.player.shield = 40;
    g.player.health = 60;
    g.player.medkits = 1;
    g.bots[0].pos.set(35, g.world.surface(35, -10, -100), -10);
    g.bots[0].drop = -1;
  });
  await page.keyboard.press("KeyQ");
  await page.keyboard.press("KeyH");
  await page.keyboard.press("KeyF");
  const abilities = await page.evaluate(() => {
    const g = window.terra;
    g.updateScan(0.01);
    return {
      shield: g.player.shield,
      health: g.player.health,
      medkits: g.player.medkits,
      scan: g.scanCooldown,
      marker: g.scanMarkers[0].visible,
    };
  });
  assert.ok(
    abilities.shield === 75 &&
      abilities.health === 95 &&
      abilities.medkits === 0 &&
      abilities.scan > 29 &&
      abilities.marker,
  );
  const pickup = await page.evaluate(() => {
    const g = window.terra,
      l = g.world.loot.find((item) => item.type === "weapon" && !item.taken);
    g.player.pos.set(l.x, g.world.surface(l.x, l.z, -100), l.z);
    const weapon = l.weapon;
    g.pickup();
    return {
      taken: l.taken,
      owned: g.player.loadout[weapon].owned,
      weapon: g.player.weapon,
      expected: weapon,
    };
  });
  assert.ok(pickup.taken && pickup.owned && pickup.weapon === pickup.expected);
  const stairs = await page.evaluate(() => {
    const g = window.terra,
      p = g.player;
    p.pos.set(9, g.world.surface(9, 18, -100), 18);
    g.yaw = 0;
    g.keys.add("KeyW");
    for (let i = 0; i < 100; i++) g.updatePlayer(0.02);
    g.keys.clear();
    return { y: p.pos.y, z: p.pos.z };
  });
  assert.ok(
    stairs.y > 4 && stairs.z < 9,
    `service stairs: ${JSON.stringify(stairs)}`,
  );
  await page.evaluate(() => {
    const g = window.terra;
    g.paused = false;
    g.player.pos.set(-2, g.world.surface(-2, 12.2, -100), 12.2);
    g.yaw = 0;
    g.grounded = true;
  });
  await page.keyboard.press("Space");
  const mantle = await page.evaluate(() => {
    const g = window.terra,
      started = !!g.mantle;
    for (let i = 0; i < 25; i++) g.updatePlayer(0.02);
    return {
      started,
      y: g.player.pos.y,
      z: g.player.pos.z,
      finished: !g.mantle,
    };
  });
  assert.ok(
    mantle.started && mantle.finished && mantle.y > 1 && mantle.z < 11,
    `mantle: ${JSON.stringify(mantle)}`,
  );
  const ceilingHeight = await page.evaluate(() => {
    const g = window.terra;
    let x = 40,
      z = 40;
    for (let i = -140; i <= 140; i += 10) {
      if (!g.world.collides(i, 40, 3, -100)) {
        x = i;
        break;
      }
    }
    const floor = g.world.surface(x, z, -100),
      top = floor + 2.5;
    g.world.platforms.push({ x, z, w: 6, d: 6, y: top, h: 0.3 });
    g.player.pos.set(x, floor, z);
    g.paused = false;
    g.grounded = true;
    g.yaw = 0;
    g.vertical = 0;
    return top;
  });
  await page.keyboard.press("Space");
  const highestHead = await page.evaluate(() => {
    const g = window.terra;
    let highest = -Infinity;
    for (let i = 0; i < 80; i++) {
      g.updatePlayer(0.02);
      highest = Math.max(highest, g.player.pos.y + 1.65);
    }
    g.world.platforms.pop();
    return highest;
  });
  assert.ok(
    highestHead <= ceilingHeight + 0.01,
    `head passed ceiling: ${highestHead} > ${ceilingHeight}`,
  );
  const explosive = await page.evaluate(() => {
    const g = window.terra;
    let location;
    for (let x = -140; x <= 140 && !location; x += 10)
      for (let z = -120; z <= 140; z += 10) {
        const y = g.world.surface(x, z, -100),
          ty = g.world.surface(x, z - 12, -100);
        if (Math.abs(y - ty) > 0.35) continue;
        let clear = true;
        for (let t = 0; t <= 14; t += 2)
          if (g.world.collides(x, z - t, 2, -100)) {
            clear = false;
            break;
          }
        if (clear) {
          location = { x, z, y, ty };
          break;
        }
      }
    if (!location) return null;
    const { x, z, y, ty } = location,
      p = g.player,
      b = g.bots[0];
    p.pos.set(x, y, z);
    p.charges = 2;
    p.throwCooldown = 0;
    g.camera.position.set(x, y + 1.65, z);
    g.yaw = 0;
    g.pitch = 0;
    g.paused = false;
    b.pos.set(x, ty, z - 12);
    b.alive = true;
    b.drop = -1;
    b.health = 100;
    b.shield = 50;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyG" }));
    const launched = g.projectiles.length,
      remaining = p.charges;
    for (let i = 0; i < 120 && g.projectiles.length; i++)
      g.updateProjectiles(0.02);
    return {
      launched,
      remaining,
      projectiles: g.projectiles.length,
      damage: 150 - b.health - b.shield,
    };
  });
  assert.ok(
    explosive &&
      explosive.launched === 1 &&
      explosive.remaining === 1 &&
      explosive.projectiles === 0 &&
      explosive.damage > 0,
    `charge: ${JSON.stringify(explosive)}`,
  );
  const ring = await page.evaluate(() => {
    const g = window.terra;
    g.matchTime = 80;
    g.update(0.05);
    return g.ringRadius;
  });
  assert.ok(ring < 145);
  await page.evaluate(() => {
    const g = window.terra;
    g.damage(g.player, 1000, g.bots[0]);
  });
  assert.ok(await page.locator("[data-ui=result]").isVisible());
  await page.click("#replay");
  assert.deepEqual(
    await page.evaluate(() => [
      window.terra.phase,
      window.terra.bots.length,
      window.terra.player.health,
    ]),
    ["aircraft", 9, 100],
  );
  await page.evaluate(() => {
    const g = window.terra;
    g.phase = "playing";
    for (const bot of g.bots) g.damage(bot, 1000, g.player);
  });
  assert.equal(
    await page.locator("[data-ui=resultTitle]").textContent(),
    "TERRA CHAMPION",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser smoke passed: menu, pause, deployment, abilities, charge, landing, pickup, traversal, ring, defeat, replay, forced victory.",
  );
} finally {
  await browser.close();
  await server.close();
}
