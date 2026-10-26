import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { preview } from "vite";

const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
if (!existsSync(executablePath))
  throw new Error(
    "Set CHROMIUM_PATH to an installed Chromium or Chrome executable.",
  );
if (!existsSync("dist/index.html"))
  throw new Error("Run npm run build before profiling the production build.");
const server = await preview({
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "silent",
});
const address = server.httpServer.address();
const args = process.env.TERRA_HARDWARE_GPU
  ? []
  : ["--use-gl=angle", "--use-angle=swiftshader"];
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", ...args],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  await page.addInitScript(() => {
    window.terraFrameTimes = [];
    let last = performance.now();
    const sample = (now) => {
      window.terraFrameTimes.push(now - last);
      last = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto(`http://127.0.0.1:${address.port}/`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("#boot", { state: "detached", timeout: 60000 });
  await page.waitForTimeout(Number(process.env.TERRA_PERF_WARMUP_MS || 10000));
  await page.click("#start");
  await page.keyboard.press("Space");
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    window.terraFrameTimes = [];
  });
  await page.waitForTimeout(Number(process.env.TERRA_PERF_SAMPLE_MS || 8000));
  const result = await page.evaluate(() => {
    const values = window.terraFrameTimes
      .filter((x) => x > 0)
      .sort((a, b) => a - b);
    const canvas = document.querySelector("body > canvas");
    const gl = canvas.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = extension
      ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : "unavailable";
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      renderer,
      frames: values.length,
      meanMs: mean,
      p50Ms: values[Math.floor(values.length * 0.5)],
      p95Ms: values[Math.floor(values.length * 0.95)],
      fps: 1000 / mean,
    };
  });
  console.log(JSON.stringify({ viewport: "1280x720", ...result }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
