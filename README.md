# 6.1Terra

6.1Terra is a browser battle royale built with Three.js. The map, character and weapon geometry, textures, effects, and synthesized audio are generated locally at runtime. The game makes no requests to external asset or game services.

## Play locally

```sh
npm install
npm run dev
```

Open Vite's local URL in a modern desktop browser. Select **Enter the Match** and press **Space** to leave the transport. The game requests pointer lock on deployment.

- **WASD** move and steer; **Shift** sprint; **Ctrl** or **C** crouch/slide; **Space** jump or climb low cover
- **Mouse** look; **left click** fire; **right click** aim; **R** reload
- **E** collect nearby loot; **Q** activate shield surge; **F** reveal nearby competitors briefly; **G** throw an arc charge; **H** use a field repair; **Tab** view inventory
- **1–3** switch owned weapons; **Esc** releases pointer lock and pauses. Look sensitivity is in the pause menu.

The ring begins closing after 25 seconds and continues toward the center. The last competitor standing wins. A weapon pickup unlocks the indicated weapon; another copy supplies ammunition. Field repairs and shields are limited resources, and shield surge recharges over time.

The renderer reduces resolution and then disables shadows if it repeatedly detects low frame rates. This helps weaker devices but is not a guarantee of any particular frame rate.

## Verify

```sh
npm test
npm run test:browser
npm run test:simulation
npm run build
npm run profile:browser
```

The browser smoke test requires an installed Chromium or Chrome at `/usr/bin/chromium`; set `CHROMIUM_PATH` to use another executable. It uses a software WebGL renderer and drives several game states programmatically, including a forced victory. It is not a performance benchmark or a substitute for a human playthrough. The seeded simulation drives a player through the match without forcing eliminations; set `TERRA_SIM_SEED` to vary the run. The profiling command samples production frame times; set `TERRA_HARDWARE_GPU=1` to omit the software-renderer flags when an appropriate GPU is available.

## Build and deploy

```sh
npm run build
npm run preview
npm run deploy
```

`npm run deploy` builds the static site and deploys it with Wrangler and `wrangler.jsonc` to Cloudflare Workers Static Assets. Log in to Wrangler and select a Cloudflare account first. Cloudflare Pages can alternatively deploy the `dist` directory with build command `npm run build`.
