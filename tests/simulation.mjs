import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
if (!existsSync(executablePath))
  throw new Error("Set CHROMIUM_PATH to Chromium or Chrome.");
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "silent",
});
await server.listen();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.terra, null, { timeout: 60000 });
  await page.waitForSelector("#boot", { state: "detached", timeout: 60000 });
  const seed = Number(process.env.TERRA_SIM_SEED || 1);
  const result = await page.evaluate((seed) => {
    let n = seed >>> 0;
    Math.random = () => {
      n = (n * 1664525 + 1013904223) >>> 0;
      return n / 4294967296;
    };
    const g = window.terra,
      fired = {},
      looted = {},
      kills = {};
    g.start();
    g.audio?.close();
    g.audio = null;
    const shoot = g.shoot.bind(g),
      collect = g.collect.bind(g),
      damage = g.damage.bind(g);
    g.shoot = (f, t) => {
      const ammo = f.ammo;
      shoot(f, t);
      if (f !== g.player && f.ammo < ammo)
        fired[f.name] = (fired[f.name] || 0) + 1;
    };
    g.collect = (f, l) => {
      const taken = l.taken;
      collect(f, l);
      if (f !== g.player && !taken && l.taken)
        looted[f.name] = (looted[f.name] || 0) + 1;
    };
    g.damage = (f, n, a) => {
      const alive = f.alive;
      damage(f, n, a);
      if (alive && !f.alive && a) kills[a.name] = (kills[a.name] || 0) + 1;
    };
    for (let i = 0; i < 160; i++) g.update(0.05);
    g.jump();
    g.paused = false;
    let tick = 0,
      path = [],
      repath = 0;
    while (g.phase !== "ended" && tick < 6500) {
      const p = g.player;
      g.paused = false;
      g.keys.clear();
      g.fire = false;
      if (g.phase === "playing") {
        if (p.health < 70 && p.medkits) g.heal();
        if (p.shield < 35 && g.ability <= 0) g.useAbility();
        let target,
          range = 70;
        for (const bot of g.bots) {
          if (!bot.alive || bot.drop > 0) continue;
          const distance = p.pos.distanceTo(bot.pos),
            a = p.pos.clone(),
            b = bot.pos.clone();
          a.y += 1.5;
          b.y += 1.2;
          if (distance < range && g.lineClear(a, b)) {
            target = bot;
            range = distance;
          }
        }
        if (target) {
          const dx = target.pos.x - p.pos.x,
            dz = target.pos.z - p.pos.z;
          g.yaw = Math.atan2(-dx, -dz);
          g.pitch = Math.atan2(-0.35, Math.hypot(dx, dz));
          g.fire = true;
          g.keys.add(tick % 120 < 60 ? "KeyA" : "KeyD");
          if (p.ammo === 0) g.reload(p);
        } else {
          let destination = { x: 0, z: 0 };
          if (Math.hypot(p.pos.x, p.pos.z) < g.ringRadius - 20) {
            const nearby = g.world.loot
              .filter((l) => !l.taken && g.canCollect(p, l))
              .sort(
                (a, b) =>
                  Math.hypot(a.x - p.pos.x, a.z - p.pos.z) -
                  Math.hypot(b.x - p.pos.x, b.z - p.pos.z),
              )[0];
            if (
              nearby &&
              Math.hypot(nearby.x - p.pos.x, nearby.z - p.pos.z) < 65
            ) {
              destination = { x: nearby.x, z: nearby.z };
              if (Math.hypot(nearby.x - p.pos.x, nearby.z - p.pos.z) < 2.5)
                g.pickup();
            }
          }
          if (--repath <= 0) {
            path = g.world.navigation.route(
              p.pos.x,
              p.pos.z,
              destination.x,
              destination.z,
            );
            repath = 40;
          }
          while (
            path.length > 1 &&
            Math.hypot(path[0].x - p.pos.x, path[0].z - p.pos.z) < 0.4
          )
            path.shift();
          const goal = path[0] || destination,
            dx = goal.x - p.pos.x,
            dz = goal.z - p.pos.z;
          if (Math.hypot(dx, dz) > 1.5) {
            g.yaw = Math.atan2(-dx, -dz);
            g.keys.add("KeyW");
            g.keys.add("ShiftLeft");
          }
        }
      }
      g.update(0.05);
      tick++;
    }
    return {
      phase: g.phase,
      rank: g.endedRank,
      title: g.ui.resultTitle.textContent,
      seconds: tick * 0.05,
      fired,
      looted,
      kills,
      remaining: g.bots.filter((b) => b.alive).length,
      health: g.player.health,
      ring: g.ringRadius,
    };
  }, seed);
  assert.equal(
    result.phase,
    "ended",
    "match must terminate without forcing health or eliminations",
  );
  assert.ok(result.rank >= 1 && result.rank <= 10);
  assert.equal(
    result.title,
    result.rank === 1 ? "TERRA CHAMPION" : "ELIMINATED",
  );
  if (process.env.TERRA_EXPECT === "win") assert.equal(result.rank, 1);
  if (process.env.TERRA_EXPECT === "defeat") assert.ok(result.rank > 1);
  if (process.env.TERRA_REQUIRE_ALL_BOTS)
    assert.equal(Object.keys(result.fired).length, 9);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ seed, ...result }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
