import "./style.css";
import { Game } from "./game";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<div class="menu screen show" data-ui="menu"><div class="menu-shade"></div><header><div class="brand"><span class="brand-mark">◈</span> 6.1<span>TERRA</span></div><div class="topline">SEASON 01 <i></i> THE FRONTIER</div><div class="build">SYSTEMS ONLINE <span>●</span></div></header><main class="hero"><div class="hero-index">01 / THE OUTLANDS</div><h1>THE FRONTIER<br><em>IS CALLING.</em></h1><p>Ten enter the basin. One makes it out.<br>Drop in, gear up, and claim your place.</p><button id="start" class="primary"><span>ENTER THE MATCH</span><b>↗</b></button><div class="hero-foot"><span>◆</span> SOLO BATTLE ROYALE <i></i> 10 COMPETITORS</div></main><aside class="menu-side"><div class="side-number">01</div><div class="side-line"></div><div>THE BASIN<br><strong>AN UNFORGIVING<br>NEW WORLD</strong></div></aside><footer><div>6.1TERRA <span> / </span> ORIGINAL BATTLE ROYALE</div><div>WASD MOVE &nbsp; · &nbsp; MOUSE AIM &nbsp; · &nbsp; SHIFT SPRINT &nbsp; · &nbsp; CTRL SLIDE</div></footer></div>
<div class="hud" data-ui="hud"><div class="hud-top"><div class="ring-box"><div class="small-label">◷ &nbsp; ZONE STATUS</div><strong data-ui="ring">CLOSING IN 25s</strong></div><div class="compass"><div class="ticks">| &nbsp; · &nbsp; | &nbsp; · &nbsp; | &nbsp; · &nbsp; |</div><strong data-ui="compass">N</strong><div class="compass-triangle">▼</div></div><div class="alive-box"><strong data-ui="alive">10</strong><span>COMPETITORS<br>REMAINING</span></div></div><div class="map-wrap"><canvas width="160" height="160" data-ui="map"></canvas><div class="map-label">THE BASIN <span>◈</span></div></div><div class="feed" data-ui="feed"></div><div class="crosshair"><i></i><i></i><i></i><i></i><span data-ui="hit">×</span></div><div class="interact" data-ui="interact"></div><div class="notice" data-ui="notice"></div><div class="hud-bottom"><div class="vitals"><div class="operator"><div class="portrait">◈</div><div><small>OPERATOR</small><b>YOU</b></div></div><div class="bar-row"><span>SHIELD</span><div class="bar"><i class="shield" data-ui="shield"></i></div><b data-ui="shieldValue">50</b></div><div class="bar-row"><span>HEALTH</span><div class="bar"><i class="health" data-ui="health"></i></div><b data-ui="healthValue">100</b></div></div><div class="ability"><div class="key">Q</div><div><small>SURGE SHIELD</small><b data-ui="ability">READY</b></div></div><div class="ability"><div class="key">F</div><div><small>RECON PULSE</small><b data-ui="scan">READY</b></div></div><div class="ability"><div class="key">G</div><div><small>ARC CHARGES</small><b data-ui="charges">2</b></div></div><div class="weapon"><div class="weapon-name" data-ui="weapon">AR-06 CARBINE</div><div><strong data-ui="ammo">24</strong><span> / <b data-ui="reserve">120</b></span></div><small>R RELOAD &nbsp; · &nbsp; 1–3 SWITCH</small></div></div></div><div class="damage" data-ui="damage"></div>
<div class="drop" data-ui="drop"></div><div class="inventory" data-ui="inventory"><div class="small-label">FIELD INVENTORY</div><h2>YOUR LOADOUT</h2><div data-ui="inventoryInfo"></div></div>
<div class="pause overlay" data-ui="pause"><div class="panel"><div class="small-label">MATCH PAUSED</div><h2>TAKE A BREATH.</h2><p>Click resume to return to the frontier.</p><label>LOOK SENSITIVITY <input id="sensitivity" type="range" min="5" max="45" value="20"></label><button id="resume" class="primary">RESUME MATCH <b>↗</b></button><div class="controls">WASD MOVE · SHIFT SPRINT · CTRL SLIDE<br>SPACE JUMP · MOUSE FIRE / AIM · E LOOT<br>R RELOAD · Q SHIELD · F SCAN · G CHARGE<br>H REPAIR · TAB INVENTORY</div></div></div>
<div class="result overlay" data-ui="result"><div class="panel result-panel"><div class="small-label">MATCH COMPLETE / THE BASIN</div><h2 data-ui="resultTitle">SQUAD ELIMINATED</h2><p data-ui="resultSub">Your run ends here.</p><div class="result-stats"><div><small>PLACEMENT</small><strong data-ui="rank">#10</strong></div><div><small>ELIMINATIONS</small><strong data-ui="kills">0</strong></div></div><button id="replay" class="primary">PLAY AGAIN <b>↗</b></button></div></div>`;
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    const boot = document.getElementById("boot")!;
    try {
      const game = new Game();
      if (import.meta.env.DEV)
        (window as unknown as { terra: Game }).terra = game;
      requestAnimationFrame(() => {
        boot.classList.add("ready");
        setTimeout(() => boot.remove(), 500);
      });
    } catch (error) {
      console.error(error);
      boot.querySelector(".boot-label")!.textContent =
        "Unable to start WebGL. Please use a compatible desktop browser.";
    }
  }),
);
