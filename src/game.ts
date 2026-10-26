import * as THREE from "three";
import { World, ground, MAP, type Loot } from "./world";
import { createSky } from "./sky";
import { WEAPONS } from "./weapons";
import { createBot, createAircraft, createGun } from "./models";
import { startAmbient, playSound } from "./audio";

type Phase = "menu" | "aircraft" | "drop" | "playing" | "ended";
const names = [
  "VEGA",
  "MORROW",
  "KITE",
  "SABLE",
  "NOVA",
  "ROOK",
  "ECHO",
  "FLINT",
  "VOSS",
];
interface Fighter {
  name: string;
  pos: THREE.Vector3;
  health: number;
  shield: number;
  alive: boolean;
  weapon: number;
  ammo: number;
  reserve: number;
  cooldown: number;
  reload: number;
  group: THREE.Group | null;
  target: THREE.Vector3;
  think: number;
  strafe: number;
  kills: number;
  drop: number;
  ability: number;
  medkits: number;
  loadout: { owned: boolean; ammo: number; reserve: number }[];
  path: { x: number; z: number }[];
  repath: number;
  pathGoal: THREE.Vector3;
  cover: THREE.Vector3;
  coverTime: number;
  coverCooldown: number;
  enemy: string;
  reaction: number;
  stepTimer: number;
  scanCooldown: number;
  charges: number;
  throwCooldown: number;
  recoil: number;
}
const clamp = THREE.MathUtils.clamp;
export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 650);
  world: World;
  sky: THREE.Mesh;
  phase: Phase = "menu";
  player: Fighter;
  bots: Fighter[] = [];
  keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  vel = new THREE.Vector3();
  vertical = 0;
  grounded = false;
  mantle: { start: THREE.Vector3; end: THREE.Vector3; elapsed: number } | null =
    null;
  slide = 0;
  slideReady = true;
  fire = false;
  aim = false;
  time = 0;
  matchTime = 0;
  ringRadius = 145;
  ringStage = 1;
  ringDamage = 0;
  aircraftX = -145;
  aircraft: THREE.Group;
  gun: THREE.Group;
  gunKick = 0;
  muzzleTime = 0;
  shake = 0;
  effects: {
    mesh: THREE.Object3D;
    life: number;
    max: number;
    velocity?: THREE.Vector3;
    expansion?: number;
  }[] = [];
  last = performance.now();
  sensitivity = 0.002;
  audio: AudioContext | null = null;
  foot = 0;
  ability = 0;
  scanCooldown = 0;
  scanActive = 0;
  scanMarkers: THREE.Sprite[] = [];
  projectiles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    fuse: number;
    owner: Fighter;
  }[] = [];
  messageTimer = 0;
  endedRank = 0;
  paused = false;
  skyLight: THREE.DirectionalLight;
  frameCount = 0;
  fps = 0;
  fpsTimer = 0;
  slowFrames = 0;
  fastFrames = 0;
  renderScale = 1;
  ui: { [key: string]: HTMLElement };
  mapBackground: HTMLCanvasElement;
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    document.body.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xa5bfc0);
    this.scene.fog = new THREE.FogExp2(0x9aafb0, 0.0036);
    this.scene.add(new THREE.HemisphereLight(0xdbece4, 0x4b4a3d, 2.1));
    this.skyLight = new THREE.DirectionalLight(0xffe2b4, 2.8);
    this.skyLight.position.set(-70, 110, 40);
    this.skyLight.castShadow = true;
    this.skyLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.skyLight.shadow.camera, {
      left: -80,
      right: 80,
      top: 80,
      bottom: -80,
      near: 1,
      far: 260,
    });
    this.skyLight.shadow.bias = -0.0003;
    this.scene.add(this.skyLight);
    this.scene.add(this.skyLight.target);
    this.world = new World(this.scene);
    this.sky = createSky();
    this.scene.add(this.sky);
    this.aircraft = createAircraft();
    this.scene.add(this.aircraft);
    this.gun = createGun();
    this.camera.add(this.gun);
    const gunLight = new THREE.PointLight(0xffe4be, 2, 3);
    gunLight.position.set(0.3, 0.15, -0.3);
    this.camera.add(gunLight);
    this.scene.add(this.camera);
    this.player = this.makeFighter("YOU", true);
    this.createScanMarkers();
    this.ui = {};
    document
      .querySelectorAll<HTMLElement>("[data-ui]")
      .forEach((e) => (this.ui[e.dataset.ui!] = e));
    this.mapBackground = this.createMapBackground();
    this.bind();
    this.camera.position.set(130, 65, 135);
    this.camera.lookAt(0, 4, 0);
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }
  makeFighter(name: string, human = false): Fighter {
    return {
      name,
      pos: new THREE.Vector3(),
      health: 100,
      shield: 50,
      alive: true,
      weapon: 0,
      ammo: 24,
      reserve: 120,
      cooldown: 0,
      reload: 0,
      group: human ? null : this.makeBot(),
      target: new THREE.Vector3(),
      think: 0,
      strafe: Math.random() < 0.5 ? -1 : 1,
      kills: 0,
      drop: 0,
      ability: 0,
      medkits: 1,
      path: [],
      repath: 0,
      pathGoal: new THREE.Vector3(),
      cover: new THREE.Vector3(),
      coverTime: 0,
      coverCooldown: 0,
      enemy: "",
      reaction: 0,
      stepTimer: 0,
      scanCooldown: human ? 0 : 8 + Math.random() * 12,
      charges: 2,
      throwCooldown: 0,
      recoil: 0,
      loadout: WEAPONS.map((w, i) => ({
        owned: i === 0,
        ammo: w.mag,
        reserve: w.reserve,
      })),
    };
  }
  makeBot() {
    const bot = createBot();
    this.scene.add(bot);
    return bot;
  }
  showWeapon(index: number) {
    this.gun.children.forEach((model, i) => {
      model.visible = i === index;
      const muzzle = model.getObjectByName("muzzleFlash");
      if (muzzle) muzzle.visible = false;
    });
    this.muzzleTime = 0;
  }

  bind() {
    window.addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    window.addEventListener("keydown", (e) => {
      if (this.paused || this.phase === "menu" || this.phase === "ended")
        return;
      if (["Space", "Tab", "ControlLeft"].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "Space" && this.phase === "aircraft") this.jump();
      else if (
        e.code === "Space" &&
        this.phase === "playing" &&
        this.grounded
      ) {
        if (!this.tryMantle()) this.vertical = 8.5;
        this.grounded = false;
        this.sound("jump");
      }
      if (e.code === "KeyR") this.reload(this.player);
      if (e.code === "KeyE") this.pickup();
      if (e.code === "Digit1") this.switchWeapon(0);
      if (e.code === "Digit2") this.switchWeapon(1);
      if (e.code === "Digit3") this.switchWeapon(2);
      if (e.code === "KeyQ") this.useAbility();
      if (e.code === "KeyF") this.scan();
      if (e.code === "KeyG" && this.phase === "playing")
        this.throwCharge(this.player);
      if (e.code === "KeyH") this.heal();
      if (e.code === "Tab") this.ui.inventory.classList.toggle("show");
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") this.ui.inventory.classList.remove("show");
    });
    window.addEventListener("mousemove", (e) => {
      if (
        document.pointerLockElement === this.renderer.domElement &&
        (this.phase === "playing" || this.phase === "drop")
      ) {
        this.yaw -= e.movementX * this.sensitivity;
        this.pitch = clamp(
          this.pitch - e.movementY * this.sensitivity,
          -1.35,
          1.35,
        );
      }
    });
    window.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).closest("button, input")) return;
      if (e.button === 0) {
        if (
          (this.phase === "playing" || this.phase === "drop") &&
          !document.pointerLockElement
        )
          this.lock();
        else this.fire = true;
      }
      if (e.button === 2) this.aim = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.aim = false;
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.fire = false;
      this.aim = false;
      this.ui.inventory.classList.remove("show");
      if (this.phase === "aircraft") {
        this.paused = true;
        this.ui.pause.classList.add("show");
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        (this.phase === "aircraft" ||
          this.phase === "playing" ||
          this.phase === "drop")
      ) {
        this.paused = true;
        this.keys.clear();
        this.fire = false;
        this.ui.pause.classList.add("show");
        if (document.pointerLockElement) document.exitPointerLock();
      }
    });
    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement) {
        this.fire = false;
        this.aim = false;
        this.keys.clear();
        this.ui.inventory.classList.remove("show");
        if (this.phase === "playing" || this.phase === "drop") {
          this.paused = true;
          this.ui.pause.classList.add("show");
        }
      } else {
        this.paused = false;
        this.ui.pause.classList.remove("show");
      }
    });
    document
      .getElementById("start")!
      .addEventListener("click", () => this.start());
    document
      .getElementById("replay")!
      .addEventListener("click", () => this.start());
    document
      .getElementById("resume")!
      .addEventListener("click", () => this.lock());
    (
      document.getElementById("sensitivity") as HTMLInputElement
    ).addEventListener("input", (e) => {
      this.sensitivity = Number((e.target as HTMLInputElement).value) / 10000;
    });
  }
  lock() {
    if (document.pointerLockElement === this.renderer.domElement) {
      this.paused = false;
      this.ui.pause.classList.remove("show");
      return;
    }
    const request = this.renderer.domElement.requestPointerLock();
    request?.catch(() => {
      if (
        this.phase === "aircraft" ||
        this.phase === "playing" ||
        this.phase === "drop"
      ) {
        this.paused = true;
        this.ui.pause.classList.add("show");
      }
    });
  }
  tryMantle() {
    const p = this.player.pos;
    const dx = -Math.sin(this.yaw),
      dz = -Math.cos(this.yaw);
    const aheadX = p.x + dx,
      aheadZ = p.z + dz;
    for (const o of this.world.obstacles) {
      const rise = o.y + o.h - p.y;
      if (
        rise < 0.5 ||
        rise > 2.4 ||
        aheadX < o.x - o.w / 2 - 0.4 ||
        aheadX > o.x + o.w / 2 + 0.4 ||
        aheadZ < o.z - o.d / 2 - 0.4 ||
        aheadZ > o.z + o.d / 2 + 0.4
      )
        continue;
      const end = new THREE.Vector3(
        clamp(p.x + dx * 1.3, o.x - o.w / 2 + 0.1, o.x + o.w / 2 - 0.1),
        o.y + o.h + 0.02,
        clamp(p.z + dz * 1.3, o.z - o.d / 2 + 0.1, o.z + o.d / 2 - 0.1),
      );
      if (
        this.world.collides(end.x, end.z, 0.35, end.y) ||
        Number.isFinite(this.world.ceiling(end.x, end.z, end.y, end.y + 1.65))
      )
        continue;
      this.mantle = { start: p.clone(), end, elapsed: 0 };
      this.vel.set(0, 0, 0);
      this.vertical = 0;
      return true;
    }
    return false;
  }
  start() {
    for (const projectile of this.projectiles) {
      projectile.mesh.removeFromParent();
      projectile.mesh.geometry.dispose();
      (projectile.mesh.material as THREE.Material).dispose();
    }
    this.projectiles = [];
    for (const b of this.bots)
      if (b.group) {
        this.scene.remove(b.group);
        b.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(
              (m) => m.dispose(),
            );
          }
        });
      }
    for (const e of this.effects) {
      e.mesh.removeFromParent();
      const mesh = e.mesh as THREE.Mesh;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        (m) => m.dispose(),
      );
    }
    this.effects = [];
    this.ui.feed.innerHTML = "";
    for (const l of this.world.loot) {
      l.taken = false;
      l.mesh.visible = true;
    }
    this.bots = names.map((n) => this.makeFighter(n));
    this.player = this.makeFighter("YOU", true);
    this.showWeapon(0);
    this.phase = "aircraft";
    this.matchTime = 0;
    this.ringDamage = 0;
    this.time = 0;
    this.aircraftX = -145;
    this.ringRadius = 145;
    this.world.setRing(this.ringRadius);
    this.ringStage = 1;
    this.ability = 0;
    this.scanCooldown = 0;
    this.scanActive = 0;
    this.scanMarkers.forEach((marker) => (marker.visible = false));
    this.vel.set(0, 0, 0);
    this.shake = 0;
    this.vertical = 0;
    this.mantle = null;
    this.grounded = false;
    this.slide = 0;
    this.slideReady = true;
    this.fire = false;
    this.aim = false;
    this.keys.clear();
    this.yaw = 0;
    this.pitch = -0.18;
    this.paused = false;
    this.ui.menu.classList.remove("show");
    this.ui.result.classList.remove("show");
    this.ui.pause.classList.remove("show");
    this.ui.inventory.classList.remove("show");
    this.ui.hud.classList.add("show");
    this.ui.drop.classList.add("show");
    this.ui.drop.innerHTML =
      "<span>DEPLOYMENT</span><strong>CHOOSE YOUR DROP</strong><small>Press SPACE to jump from the transport</small>";
    this.aircraft.visible = true;
    this.gun.visible = false;
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      b.drop = 2 + i * 2.1 + Math.random() * 0.6;
      b.pos.set(-145, 45, (Math.random() - 0.5) * 10);
      b.group!.visible = false;
    }
    if (this.audio) this.audio.close();
    this.audio = new AudioContext();
    startAmbient(this.audio);
    this.sound("ui");
  }
  jump() {
    if (this.phase !== "aircraft") return;
    this.phase = "drop";
    this.player.pos.set(this.aircraftX, 42, 0);
    this.yaw = 0;
    this.pitch = -0.4;
    this.ui.drop.innerHTML =
      "<span>INSERTION</span><strong>SKYDIVE</strong><small>W A S D to steer · land near the facilities</small>";
    this.lock();
    this.sound("jump");
  }
  reload(f: Fighter) {
    const w = WEAPONS[f.weapon];
    if (f.reload > 0 || f.ammo >= w.mag || f.reserve <= 0 || !f.alive) return;
    f.reload = w.reloadTime;
    if (f === this.player) {
      this.sound("reload");
      this.notify("RELOADING");
    }
  }
  equip(f: Fighter, i: number) {
    const old = f.loadout[f.weapon];
    old.ammo = f.ammo;
    old.reserve = f.reserve;
    f.weapon = i;
    f.ammo = f.loadout[i].ammo;
    f.reserve = f.loadout[i].reserve;
    f.reload = 0;
    if (f === this.player) this.showWeapon(i);
  }
  switchWeapon(i: number) {
    if (this.phase !== "playing" || !this.player.loadout[i].owned) return;
    this.equip(this.player, i);
    this.sound("ui");
    this.notify(WEAPONS[i].name);
  }
  pickup() {
    if (this.phase !== "playing") return;
    let best: Loot | undefined;
    let dist = 3;
    for (const l of this.world.loot) {
      const d = Math.hypot(
        l.x - this.player.pos.x,
        l.z - this.player.pos.z,
        ground(l.x, l.z) - this.player.pos.y,
      );
      if (!l.taken && this.canCollect(this.player, l) && d < dist) {
        best = l;
        dist = d;
      }
    }
    if (best) this.collect(this.player, best);
  }
  canCollect(f: Fighter, l: Loot) {
    return (
      l.type === "ammo" ||
      l.type === "weapon" ||
      (l.type === "shield" && f.shield < 100) ||
      (l.type === "med" && f.medkits < 4)
    );
  }
  collect(f: Fighter, l: Loot) {
    if (l.taken || !this.canCollect(f, l)) return;
    l.taken = true;
    l.mesh.visible = false;
    let msg = "";
    if (l.type === "ammo") {
      f.reserve += 48;
      msg = "AMMO +48";
    }
    if (l.type === "shield") {
      f.shield = Math.min(100, f.shield + 35);
      msg = "SHIELD +35";
    }
    if (l.type === "med") {
      f.medkits++;
      msg = "FIELD REPAIR +1";
    }
    if (l.type === "weapon") {
      if (f.loadout[l.weapon].owned) {
        if (f.weapon === l.weapon) f.reserve += 32;
        else f.loadout[l.weapon].reserve += 32;
        msg = WEAPONS[l.weapon].name + " AMMO +32";
      } else {
        f.loadout[l.weapon].owned = true;
        this.equip(f, l.weapon);
        msg = WEAPONS[l.weapon].name;
      }
    }
    if (f === this.player) {
      this.sound("pickup");
      this.notify(msg);
    }
  }

  useAbility() {
    if (
      this.phase !== "playing" ||
      this.ability > 0 ||
      this.player.shield >= 100
    )
      return;
    this.player.shield = Math.min(100, this.player.shield + 35);
    this.ability = 35;
    this.sound("pickup");
    this.notify("SURGE SHIELD · +35");
  }
  createScanMarkers() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#a0fff1";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 5);
    ctx.lineTo(59, 32);
    ctx.lineTo(32, 59);
    ctx.lineTo(5, 32);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#e3fff9";
    ctx.beginPath();
    ctx.arc(32, 32, 4, 0, Math.PI * 2);
    ctx.fill();
    const material = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    for (let i = 0; i < names.length; i++) {
      const marker = new THREE.Sprite(material);
      marker.scale.set(1.4, 1.4, 1);
      marker.visible = false;
      marker.renderOrder = 1000;
      this.scene.add(marker);
      this.scanMarkers.push(marker);
    }
  }
  scan() {
    if (this.phase !== "playing" || this.scanCooldown > 0) return;
    this.scanActive = 4;
    this.scanCooldown = 30;
    this.pulseEffect(this.player.pos);
    this.sound("scan");
    this.notify("RECON PULSE · 50M");
  }
  pulseEffect(position: THREE.Vector3) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 40),
      new THREE.MeshBasicMaterial({
        color: 0x8ae9de,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y += 0.15;
    this.scene.add(ring);
    this.effects.push({ mesh: ring, life: 0.6, max: 0.6, expansion: 12 });
  }
  updateScan(dt: number) {
    this.scanActive = Math.max(0, this.scanActive - dt);
    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    for (let i = 0; i < this.scanMarkers.length; i++) {
      const bot = this.bots[i],
        marker = this.scanMarkers[i];
      marker.visible =
        this.phase === "playing" &&
        this.scanActive > 0 &&
        !!bot &&
        bot.alive &&
        bot.drop <= 0 &&
        bot.pos.distanceTo(this.player.pos) <= 50;
      if (marker.visible)
        marker.position.copy(bot.pos).add(new THREE.Vector3(0, 2.5, 0));
    }
  }
  healFighter(f: Fighter) {
    if (f.health < 100 && f.medkits > 0) {
      f.medkits--;
      f.health = Math.min(100, f.health + 35);
      if (f === this.player) {
        this.notify("FIELD REPAIR +35");
        this.sound("pickup");
      }
    }
  }
  heal() {
    if (this.phase === "playing") this.healFighter(this.player);
  }
  notify(s: string) {
    this.ui.notice.textContent = s;
    this.messageTimer = 2.2;
  }
  sound(kind: string, position?: THREE.Vector3, variant = 0) {
    if (this.audio)
      playSound(this.audio, kind, this.player.pos, this.yaw, position, variant);
  }
  lineClear(a: THREE.Vector3, b: THREE.Vector3) {
    const delta = b.clone().sub(a),
      distance = delta.length();
    return (
      distance < 0.001 ||
      this.world.raycast(a, delta.multiplyScalar(1 / distance), distance) >=
        distance - 0.01
    );
  }

  shoot(f: Fighter, target?: Fighter) {
    const w = WEAPONS[f.weapon];
    if (
      f.cooldown > 0 ||
      f.reload > 0 ||
      !f.alive ||
      (f !== this.player && !target)
    )
      return;
    if (f.ammo <= 0) {
      this.reload(f);
      return;
    }
    f.ammo--;
    f.cooldown = w.rate;
    const origin =
      f === this.player
        ? this.camera.position.clone()
        : f.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
    let dir: THREE.Vector3;
    if (f === this.player) {
      dir = new THREE.Vector3(0, 0, -1).applyEuler(
        new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"),
      );
      dir.x += (Math.random() - 0.5) * w.spread * (this.aim ? 0.45 : 1);
      dir.y += (Math.random() - 0.5) * w.spread * (this.aim ? 0.45 : 1);
      dir.normalize();
      this.gunKick = 0.16;
      this.pitch = Math.min(1.3, this.pitch + w.recoil);
      this.muzzleTime = 0.07;
      const muzzle = this.gun.children[f.weapon].getObjectByName("muzzleFlash");
      if (muzzle) muzzle.visible = true;
      this.sound("shoot", undefined, f.weapon);
    } else {
      if (!target) return;
      dir = target.pos
        .clone()
        .add(new THREE.Vector3(0, 1.2, 0))
        .sub(origin)
        .normalize();
      dir.x += (Math.random() - 0.5) * 0.1;
      dir.z += (Math.random() - 0.5) * 0.1;
      dir.normalize();
      f.recoil = 0.12;
      this.sound("shoot", f.pos, f.weapon);
    }
    let hit: Fighter | null = null,
      dist = this.world.raycast(origin, dir, w.range);
    for (const other of [this.player, ...this.bots]) {
      if (other === f || !other.alive || other.drop > 0) continue;
      const center = other.pos.clone().add(new THREE.Vector3(0, 1.15, 0));
      const rel = center.clone().sub(origin),
        along = rel.dot(dir);
      if (
        along > 0 &&
        along < dist &&
        rel.clone().addScaledVector(dir, -along).length() < 0.85
      ) {
        hit = other;
        dist = along;
      }
    }
    const end = origin.clone().addScaledVector(dir, dist);
    this.tracer(origin, end, w.color);
    if (!hit && dist < w.range) this.impact(end);
    if (f !== this.player) {
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xffd18b, transparent: true }),
      );
      flash.position.copy(origin).addScaledVector(dir, 0.6);
      this.scene.add(flash);
      this.effects.push({ mesh: flash, life: 0.06, max: 0.06 });
    }
    if (hit) {
      this.damage(hit, w.damage, f);
      if (f === this.player) {
        this.ui.hit.classList.add("active");
        setTimeout(() => this.ui.hit.classList.remove("active"), 100);
        this.sound("hit");
      }
    }
  }
  impact(point: THREE.Vector3) {
    this.sound("impact", point);
    for (let i = 0; i < 4; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 5, 4),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xf2a75d : 0xffe8b3,
          transparent: true,
        }),
      );
      spark.position.copy(point);
      this.scene.add(spark);
      this.effects.push({
        mesh: spark,
        life: 0.18,
        max: 0.18,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 2,
          (Math.random() - 0.5) * 3,
        ),
      });
    }
  }
  throwCharge(f: Fighter, target?: Fighter) {
    if (!f.alive || f.charges <= 0 || f.throwCooldown > 0) return;
    const origin =
      f === this.player
        ? this.camera.position.clone()
        : f.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    let velocity: THREE.Vector3;
    if (target) {
      const dx = target.pos.x - origin.x,
        dz = target.pos.z - origin.z;
      const flight = clamp(Math.hypot(dx, dz) / 16, 0.4, 1.5);
      velocity = new THREE.Vector3(
        dx / flight,
        (target.pos.y + 0.3 - origin.y + 7 * flight * flight) / flight,
        dz / flight,
      );
    } else {
      velocity = new THREE.Vector3(0, 0, -1)
        .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"))
        .multiplyScalar(16);
      velocity.y += 4;
    }
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0x52695e,
        emissive: 0xe7783f,
        emissiveIntensity: 0.4,
        metalness: 0.55,
        roughness: 0.45,
      }),
    );
    mesh.position
      .copy(origin)
      .addScaledVector(velocity.clone().normalize(), 0.6);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, velocity, fuse: 2.2, owner: f });
    f.charges--;
    f.throwCooldown = 5;
    if (f === this.player) {
      this.notify("ARC CHARGE DEPLOYED");
      this.sound("reload");
    }
  }
  updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.fuse -= dt;
      projectile.velocity.y -= 14 * dt;
      const delta = projectile.velocity.clone().multiplyScalar(dt),
        distance = delta.length();
      const direction =
        distance > 0
          ? delta.multiplyScalar(1 / distance)
          : new THREE.Vector3(0, -1, 0);
      const hit = this.world.raycast(
        projectile.mesh.position,
        direction,
        distance,
      );
      const collided = hit < distance - 0.001;
      projectile.mesh.position.addScaledVector(
        direction,
        collided ? Math.max(0, hit - 0.05) : distance,
      );
      if (collided || projectile.fuse <= 0) {
        this.explode(projectile.mesh.position, projectile.owner);
        projectile.mesh.removeFromParent();
        projectile.mesh.geometry.dispose();
        (projectile.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }
  explode(point: THREE.Vector3, owner: Fighter) {
    this.sound("explosion", point);
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffb96a,
        transparent: true,
        depthWrite: false,
      }),
    );
    flash.position.copy(point);
    this.scene.add(flash);
    this.effects.push({ mesh: flash, life: 0.32, max: 0.32, expansion: 7 });
    for (let i = 0; i < 8; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 5, 4),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xffd99a : 0xf47742,
          transparent: true,
        }),
      );
      spark.position.copy(point);
      this.scene.add(spark);
      this.effects.push({
        mesh: spark,
        life: 0.5,
        max: 0.5,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          2 + Math.random() * 5,
          (Math.random() - 0.5) * 10,
        ),
      });
    }
    for (const fighter of [this.player, ...this.bots]) {
      if (!fighter.alive || fighter.drop > 0) continue;
      const center = fighter.pos.clone().add(new THREE.Vector3(0, 1, 0)),
        distance = point.distanceTo(center);
      if (distance < 7 && this.lineClear(point, center))
        this.damage(fighter, Math.ceil(65 * (1 - distance / 8)), owner);
    }
  }
  tracer(a: THREE.Vector3, b: THREE.Vector3, color: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.effects.push({ mesh: line, life: 0.09, max: 0.09 });
  }
  damage(v: Fighter, amount: number, attacker?: Fighter) {
    if (!v.alive) return;
    const absorbed = Math.min(v.shield, amount);
    v.shield -= absorbed;
    v.health -= amount - absorbed;
    if (v !== this.player && attacker && v.coverCooldown <= 0)
      this.findCover(v, attacker);
    if (v === this.player) {
      this.shake = 0.12;
      this.ui.damage.classList.add("active");
      setTimeout(() => this.ui.damage.classList.remove("active"), 220);
    }
    if (v.health <= 0) {
      v.alive = false;
      if (v.group) v.group.visible = false;
      if (attacker && attacker !== v) attacker.kills++;
      this.ui.feed.innerHTML =
        `<div><b>${attacker?.name || "THE RING"}</b> <span>✕</span> ${v.name}</div>` +
        this.ui.feed.innerHTML;
      while (this.ui.feed.children.length > 4)
        this.ui.feed.lastElementChild?.remove();
      if (v === this.player) this.end(false);
      else if (this.player.alive && this.bots.every((b) => !b.alive))
        this.end(true);
    }
  }
  findCover(f: Fighter, attacker: Fighter) {
    f.coverCooldown = 6;
    let best = Infinity;
    const origin = attacker.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
    for (const o of this.world.obstacles) {
      if (o.h < 1.3 || Math.hypot(o.x - f.pos.x, o.z - f.pos.z) > 20) continue;
      const candidates = [
        [o.x - o.w / 2 - 1, o.z],
        [o.x + o.w / 2 + 1, o.z],
        [o.x, o.z - o.d / 2 - 1],
        [o.x, o.z + o.d / 2 + 1],
      ];
      for (const [x, z] of candidates) {
        const d = Math.hypot(x - f.pos.x, z - f.pos.z);
        if (d > 16 || d >= best || this.world.collides(x, z, 0.6, ground(x, z)))
          continue;
        const point = new THREE.Vector3(x, ground(x, z) + 1.3, z);
        if (!this.lineClear(origin, point)) {
          best = d;
          f.cover.set(x, 0, z);
        }
      }
    }
    if (best < Infinity) {
      f.coverTime = 2.5;
      f.think = 0;
      f.repath = 0;
    }
  }
  end(win: boolean) {
    if (this.phase === "ended") return;
    this.phase = "ended";
    this.scanMarkers.forEach((marker) => (marker.visible = false));
    this.endedRank = win ? 1 : 1 + this.bots.filter((b) => b.alive).length;
    document.exitPointerLock?.();
    this.ui.pause.classList.remove("show");
    this.ui.hud.classList.remove("show");
    this.ui.drop.classList.remove("show");
    this.ui.result.classList.add("show");
    this.ui.resultTitle.textContent = win ? "TERRA CHAMPION" : "ELIMINATED";
    this.ui.resultSub.textContent = win
      ? "The frontier is yours."
      : "Your run ends here.";
    this.ui.rank.textContent = "#" + this.endedRank;
    this.ui.kills.textContent = String(this.player.kills);
    this.sound("ui");
  }
  updateFighter(f: Fighter, dt: number) {
    f.cooldown = Math.max(0, f.cooldown - dt);
    f.throwCooldown = Math.max(0, f.throwCooldown - dt);
    f.recoil = THREE.MathUtils.damp(f.recoil, 0, 12, dt);
    if (f.reload > 0) {
      f.reload -= dt;
      if (f.reload <= 0) {
        const n = Math.min(WEAPONS[f.weapon].mag - f.ammo, f.reserve);
        f.ammo += n;
        f.reserve -= n;
      }
    }
  }
  updateBot(b: Fighter, dt: number) {
    if (!b.alive) return;
    this.updateFighter(b, dt);
    b.ability = Math.max(0, b.ability - dt);
    b.scanCooldown = Math.max(0, b.scanCooldown - dt);
    b.coverTime = Math.max(0, b.coverTime - dt);
    b.coverCooldown = Math.max(0, b.coverCooldown - dt);
    b.reaction = Math.max(0, b.reaction - dt);
    if (b.health < 55 && b.medkits > 0) this.healFighter(b);
    if (b.shield < 25 && b.ability <= 0) {
      b.shield = Math.min(100, b.shield + 35);
      b.ability = 35;
    }
    if (b.drop > 0) {
      b.drop -= dt;
      if (b.drop <= 0) {
        b.pos.set(this.aircraftX, 42, (Math.random() - 0.5) * 5);
        b.target.set(
          clamp(this.aircraftX + (Math.random() - 0.5) * 45, -MAP + 5, MAP - 5),
          0,
          (Math.random() - 0.5) * 115,
        );
        b.group!.visible = true;
        b.group!.position.copy(b.pos);
      }
      return;
    }
    const gy = this.world.surface(b.pos.x, b.pos.z, b.pos.y);
    if (b.pos.y > gy + 0.1) {
      const dx = b.target.x - b.pos.x,
        dz = b.target.z - b.pos.z,
        d = Math.hypot(dx, dz);
      if (d > 1) {
        const distance = Math.min(d, 12 * dt);
        this.world.move(b.pos, (dx / d) * distance, (dz / d) * distance);
      }
      b.pos.y = Math.max(gy, b.pos.y - dt * 12);
      b.group!.position.copy(b.pos);
      b.group!.rotation.x = -0.3;
      b.group!.children[4].rotation.z = -0.6;
      b.group!.children[5].rotation.z = 0.6;
      return;
    }
    b.pos.y = gy;
    b.group!.rotation.x = 0;
    b.group!.children[4].rotation.z = 0;
    b.group!.children[5].rotation.z = 0;
    b.think -= dt;
    let target: Fighter | undefined;
    let nearest = 55;
    for (const f of [this.player, ...this.bots]) {
      if (
        f === b ||
        !f.alive ||
        (f === this.player && this.phase !== "playing") ||
        f.drop > 0 ||
        f.pos.y > this.world.surface(f.pos.x, f.pos.z, f.pos.y) + 0.4
      )
        continue;
      const d = b.pos.distanceTo(f.pos);
      if (
        d < nearest &&
        this.lineClear(
          b.pos.clone().add(new THREE.Vector3(0, 1.3, 0)),
          f.pos.clone().add(new THREE.Vector3(0, 1.3, 0)),
        )
      ) {
        nearest = d;
        target = f;
      }
    }
    if (
      !target &&
      b.think <= 0 &&
      b.scanCooldown <= 0 &&
      Math.hypot(b.pos.x, b.pos.z) < this.ringRadius - 10
    ) {
      let sensed: Fighter | undefined;
      let distance = 50;
      for (const f of [this.player, ...this.bots]) {
        if (
          f === b ||
          !f.alive ||
          f.drop > 0 ||
          (f === this.player && this.phase !== "playing")
        )
          continue;
        const d = b.pos.distanceTo(f.pos);
        if (
          d < distance &&
          f.pos.y <= this.world.surface(f.pos.x, f.pos.z, f.pos.y) + 0.4
        ) {
          sensed = f;
          distance = d;
        }
      }
      if (sensed) {
        b.target.copy(sensed.pos);
        b.think = 3;
        b.repath = 0;
        b.scanCooldown = 30;
        this.pulseEffect(b.pos);
        this.sound("scan", b.pos);
      }
    }
    if (b.think <= 0) {
      b.think = 0.7 + Math.random() * 0.7;
      if (Math.hypot(b.pos.x, b.pos.z) > this.ringRadius - 10)
        b.target.set(0, 0, 0);
      else if (b.coverTime > 0) b.target.copy(b.cover);
      else if (target) {
        const angle =
          Math.atan2(b.pos.z - target.pos.z, b.pos.x - target.pos.x) +
          b.strafe * 0.7;
        const desired = nearest < 14 ? 22 : nearest > 42 ? 25 : nearest;
        b.target.set(
          target.pos.x + Math.cos(angle) * desired,
          0,
          target.pos.z + Math.sin(angle) * desired,
        );
        if (Math.random() < 0.25) b.strafe *= -1;
      } else {
        let loot: Loot | undefined;
        let ld = 95;
        for (const l of this.world.loot) {
          const d = Math.hypot(l.x - b.pos.x, l.z - b.pos.z);
          if (!l.taken && this.canCollect(b, l) && d < ld) {
            ld = d;
            loot = l;
          }
        }
        if (loot) {
          b.target.set(loot.x, 0, loot.z);
          b.think = 3;
        } else
          b.target.set(
            clamp(b.pos.x + (Math.random() - 0.5) * 55, -MAP, MAP),
            0,
            clamp(b.pos.z + (Math.random() - 0.5) * 55, -MAP, MAP),
          );
      }
    }
    if (target?.name !== b.enemy) {
      b.enemy = target?.name || "";
      b.reaction = 0.5 + Math.random() * 0.5;
    }
    if (target && nearest < WEAPONS[b.weapon].range * 0.8) {
      if (
        nearest > 10 &&
        nearest < 26 &&
        b.charges > 0 &&
        b.throwCooldown <= 0 &&
        Math.random() < dt * 0.06
      )
        this.throwCharge(b, target);
      if (b.reaction <= 0 && b.cooldown <= 0 && Math.random() < dt * 1.5)
        this.shoot(b, target);
      b.group!.rotation.y = Math.atan2(
        b.pos.x - target.pos.x,
        b.pos.z - target.pos.z,
      );
    } else if (b.ammo < 3) this.reload(b);
    b.repath -= dt;
    if (b.repath <= 0 || b.pathGoal.distanceToSquared(b.target) > 100) {
      b.path = this.world.navigation.route(
        b.pos.x,
        b.pos.z,
        b.target.x,
        b.target.z,
      );
      b.pathGoal.copy(b.target);
      b.repath = 2.5;
    }
    while (
      b.path.length > 1 &&
      Math.hypot(b.path[0].x - b.pos.x, b.path[0].z - b.pos.z) < 0.25
    )
      b.path.shift();
    const waypoint = b.path[0] || b.target;
    const dx = waypoint.x - b.pos.x,
      dz = waypoint.z - b.pos.z,
      dist = Math.hypot(dx, dz);
    if (dist > (b.path.length > 1 ? 0.15 : 1.5)) {
      b.stepTimer -= dt;
      if (b.stepTimer <= 0) {
        b.stepTimer = 0.6;
        if (b.pos.distanceTo(this.player.pos) < 30) this.sound("step", b.pos);
      }
      const speed = target ? 4.2 : 6;
      const ox = b.pos.x,
        oz = b.pos.z;
      this.world.move(
        b.pos,
        (dx / dist) * speed * dt,
        (dz / dist) * speed * dt,
      );
      if (Math.hypot(b.pos.x - ox, b.pos.z - oz) < 0.01) {
        b.target.set(
          b.pos.x + (Math.random() - 0.5) * 30,
          0,
          b.pos.z + (Math.random() - 0.5) * 30,
        );
        b.think = 1;
        b.repath = 0;
      }
      if (!target) b.group!.rotation.y = Math.atan2(-dx, -dz);
    }
    for (const l of this.world.loot)
      if (
        !l.taken &&
        this.canCollect(b, l) &&
        Math.hypot(l.x - b.pos.x, l.z - b.pos.z, ground(l.x, l.z) - b.pos.y) < 2
      ) {
        this.collect(b, l);
        break;
      }
    b.group!.position.copy(b.pos);
    b.group!.children.forEach((m, i) => {
      if (i === 2 || i === 3)
        m.rotation.x =
          Math.sin(this.time * 9 + (i === 2 ? 0 : Math.PI)) *
          (dist > 2 ? 0.35 : 0);
    });
    const sway = dist > 2 ? Math.sin(this.time * 9) * 0.08 : 0;
    b.group!.children[4].rotation.x = 0.52 + sway;
    b.group!.children[5].rotation.x = 0.52 - sway - b.recoil * 1.2;
    b.group!.children[6].position.z = b.recoil * 0.5;
  }
  updatePlayer(dt: number) {
    const p = this.player;
    this.updateFighter(p, dt);
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    if (this.muzzleTime === 0) {
      const muzzle = this.gun.children[p.weapon].getObjectByName("muzzleFlash");
      if (muzzle) muzzle.visible = false;
    }
    if (this.phase === "drop") {
      const forward =
          (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
        side =
          (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
      this.world.move(
        p.pos,
        (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) * 15 * dt,
        (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side) * 15 * dt,
      );
      p.pos.y -= 12 * dt;
      const landing = this.world.surface(p.pos.x, p.pos.z, p.pos.y);
      if (p.pos.y <= landing + 1) {
        p.pos.y = landing;
        this.phase = "playing";
        this.ui.drop.classList.remove("show");
        this.gun.visible = true;
        this.notify("TOUCHDOWN · FIND YOUR ADVANTAGE");
        this.sound("land");
      }
      this.camera.position.copy(p.pos).add(new THREE.Vector3(0, 1.6, 0));
      return;
    }
    if (this.mantle) {
      const mantle = this.mantle;
      mantle.elapsed += dt;
      const t = Math.min(1, mantle.elapsed / 0.45);
      const lift = THREE.MathUtils.smoothstep(t, 0, 0.65);
      const forward = THREE.MathUtils.smoothstep(t, 0.25, 1);
      p.pos.set(
        THREE.MathUtils.lerp(mantle.start.x, mantle.end.x, forward),
        THREE.MathUtils.lerp(mantle.start.y, mantle.end.y, lift),
        THREE.MathUtils.lerp(mantle.start.z, mantle.end.z, forward),
      );
      this.camera.position.copy(p.pos).add(new THREE.Vector3(0, 1.65, 0));
      if (t >= 1) {
        this.mantle = null;
        this.grounded = true;
      }
      return;
    }
    let forward =
        (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
      side = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const len = Math.hypot(forward, side) || 1;
    forward /= len;
    side /= len;
    const sprint = this.keys.has("ShiftLeft") && forward > 0 && !this.aim;
    const crouch = this.keys.has("ControlLeft") || this.keys.has("KeyC");
    if (crouch && sprint && this.grounded && this.slideReady) {
      this.slide = 1;
      this.slideReady = false;
    }
    if (!crouch) this.slideReady = true;
    this.slide = Math.max(0, this.slide - dt);
    const speed =
      this.slide > 0 ? 11 : sprint ? 9 : crouch ? 3.5 : this.aim ? 4.3 : 6.2;
    const tx =
        (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) * speed,
      tz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side) * speed;
    this.vel.x = THREE.MathUtils.damp(
      this.vel.x,
      tx,
      this.slide > 0 ? 2 : 12,
      dt,
    );
    this.vel.z = THREE.MathUtils.damp(
      this.vel.z,
      tz,
      this.slide > 0 ? 2 : 12,
      dt,
    );
    this.world.move(p.pos, this.vel.x * dt, this.vel.z * dt);
    this.vertical -= 20 * dt;
    const nextY = p.pos.y + this.vertical * dt;
    const ceiling =
      this.vertical > 0
        ? this.world.ceiling(p.pos.x, p.pos.z, p.pos.y + 1.65, nextY + 1.65)
        : Infinity;
    if (Number.isFinite(ceiling)) {
      p.pos.y = ceiling - 1.66;
      this.vertical = 0;
    } else p.pos.y = nextY;
    const y = this.world.surface(p.pos.x, p.pos.z, p.pos.y);
    if (p.pos.y <= y) {
      p.pos.y = y;
      this.vertical = 0;
      this.grounded = true;
    }
    this.camera.position
      .copy(p.pos)
      .add(new THREE.Vector3(0, crouch ? 1.1 : 1.65, 0));
    if (this.grounded && Math.hypot(this.vel.x, this.vel.z) > 2) {
      this.foot -= dt;
      if (this.foot <= 0) {
        this.foot = sprint ? 0.32 : 0.48;
        this.sound("step");
      }
    }
    if (this.fire) this.shoot(p);
    this.ability = Math.max(0, this.ability - dt);
    this.gunKick = THREE.MathUtils.damp(this.gunKick, 0, 12, dt);
    const bob =
      Math.sin(this.time * 10) *
      Math.min(0.02, Math.hypot(this.vel.x, this.vel.z) * 0.002);
    this.gun.position.x = THREE.MathUtils.damp(
      this.gun.position.x,
      this.aim ? 0.13 : 0.36,
      12,
      dt,
    );
    this.gun.position.y =
      THREE.MathUtils.damp(
        this.gun.position.y,
        this.aim ? -0.22 : -0.3,
        12,
        dt,
      ) + bob;
    this.gun.position.z = -0.58 + this.gunKick;
    const reloadPose =
      p.reload > 0
        ? Math.sin((1 - p.reload / WEAPONS[p.weapon].reloadTime) * Math.PI)
        : 0;
    this.gun.rotation.z = -reloadPose * 0.5;
    this.gun.rotation.x = reloadPose * 0.18;
    this.gun.position.y -= reloadPose * 0.13;
    this.camera.fov = THREE.MathUtils.damp(
      this.camera.fov,
      this.aim ? 55 : sprint ? 78 : 72,
      8,
      dt,
    );
    this.camera.updateProjectionMatrix();
  }
  update(dt: number) {
    this.time += dt;
    if (this.phase === "menu") {
      this.camera.position.set(
        Math.cos(this.time * 0.025) * 145,
        65,
        Math.sin(this.time * 0.025) * 145,
      );
      this.camera.lookAt(0, 2, 0);
      this.aircraft.visible = false;
      this.gun.visible = false;
      return;
    }
    if (this.phase === "ended") return;
    if (this.paused) return;
    this.matchTime += dt;
    this.aircraftX += 13 * dt;
    this.aircraft.position.set(this.aircraftX, 46, 0);
    this.aircraft.rotation.y = 0;
    if (this.phase === "aircraft") {
      this.camera.position.set(this.aircraftX - 14, 51, 17);
      this.camera.lookAt(this.aircraft.position);
      if (this.aircraftX > 145) this.jump();
    } else {
      this.updatePlayer(dt);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.shake = THREE.MathUtils.damp(this.shake, 0, 12, dt);
      this.camera.rotation.z = Math.sin(this.time * 70) * this.shake * 0.06;
      this.aircraft.visible = this.aircraftX < 170;
    }
    for (const b of this.bots) this.updateBot(b, dt);
    this.updateScan(dt);
    if (this.player.alive && this.bots.some((bot) => bot.alive))
      this.updateProjectiles(dt);
    this.ringStage = Math.min(4, 1 + Math.floor(this.matchTime / 55));
    const next = Math.max(0, 145 - Math.max(0, this.matchTime - 25) * 0.68);
    this.ringRadius = next;
    this.world.setRing(next);
    if (this.matchTime > 25) {
      this.ringDamage += dt;
      if (this.ringDamage >= 1) {
        this.ringDamage = 0;
        for (const f of [this.player, ...this.bots])
          if (
            f.alive &&
            f.drop <= 0 &&
            Math.hypot(f.pos.x, f.pos.z) > this.ringRadius
          )
            this.damage(f, 4 + this.ringStage * 2);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const material = (e.mesh as THREE.Mesh).material as THREE.Material;
      material.opacity = Math.max(0, e.life / e.max);
      if (e.velocity) {
        e.mesh.position.addScaledVector(e.velocity, dt);
        e.velocity.y -= 8 * dt;
      }
      if (e.expansion)
        e.mesh.scale.setScalar(1 + (1 - e.life / e.max) * e.expansion);
      if (e.life <= 0) {
        e.mesh.removeFromParent();
        (e.mesh as THREE.Line).geometry.dispose();
        ((e.mesh as THREE.Line).material as THREE.Material).dispose();
        this.effects.splice(i, 1);
      }
    }
    this.skyLight.position.set(
      this.camera.position.x - 70,
      110,
      this.camera.position.z + 40,
    );
    this.skyLight.target.position.set(
      this.camera.position.x,
      0,
      this.camera.position.z,
    );
    this.skyLight.target.updateMatrixWorld();
  }
  createMapBackground() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#182d2b";
    ctx.fillRect(0, 0, 160, 160);
    ctx.strokeStyle = "#59746d";
    ctx.lineWidth = 1;
    for (let i = 0; i < 160; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 160);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(160, i);
      ctx.stroke();
    }
    ctx.strokeStyle = "#708078";
    ctx.lineWidth = 2;
    for (const road of this.world.roads) {
      ctx.beginPath();
      ctx.moveTo(80 + road.ax / 2, 80 + road.az / 2);
      ctx.lineTo(80 + road.bx / 2, 80 + road.bz / 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#8da29a";
    for (const o of this.world.obstacles) {
      if (o.w < 5) continue;
      ctx.fillRect(
        80 + o.x / 2 - o.w / 4,
        80 + o.z / 2 - o.d / 4,
        o.w / 2,
        o.d / 2,
      );
    }
    return canvas;
  }
  updateUI(dt: number) {
    const p = this.player,
      alive = [p, ...this.bots].filter((f) => f.alive).length;
    this.ui.alive.textContent = String(alive);
    this.ui.ring.textContent =
      this.matchTime < 25
        ? "CLOSING IN " + Math.ceil(25 - this.matchTime) + "s"
        : "RING " + this.ringStage + " · " + Math.ceil(this.ringRadius) + "m";
    this.ui.health.style.width = clamp(p.health, 0, 100) + "%";
    this.ui.shield.style.width = clamp(p.shield, 0, 100) + "%";
    this.ui.healthValue.textContent = String(Math.ceil(Math.max(0, p.health)));
    this.ui.shieldValue.textContent = String(Math.ceil(p.shield));
    this.ui.ammo.textContent = String(p.ammo).padStart(2, "0");
    this.ui.reserve.textContent = String(p.reserve);
    this.ui.weapon.textContent = WEAPONS[p.weapon].name;
    this.ui.ability.textContent =
      this.ability > 0 ? Math.ceil(this.ability) + "s" : "READY";
    this.ui.scan.textContent =
      this.scanCooldown > 0 ? Math.ceil(this.scanCooldown) + "s" : "READY";
    this.ui.charges.textContent = String(p.charges);
    this.ui.compass.textContent = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
      Math.round((((((-this.yaw * 180) / Math.PI) % 360) + 360) % 360) / 45) % 8
    ];
    this.ui.notice.style.opacity = this.messageTimer > 0 ? "1" : "0";
    this.messageTimer -= dt;
    let nearby: Loot | undefined;
    let dist = 3;
    for (const l of this.world.loot) {
      const d = Math.hypot(
        l.x - p.pos.x,
        l.z - p.pos.z,
        ground(l.x, l.z) - p.pos.y,
      );
      if (!l.taken && this.canCollect(p, l) && d < dist) {
        nearby = l;
        dist = d;
      }
    }
    this.ui.interact.textContent =
      nearby && this.phase === "playing"
        ? `[ E ]  PICK UP ${nearby.type === "weapon" ? WEAPONS[nearby.weapon].name : nearby.type.toUpperCase()}`
        : "";
    if (this.ui.inventory.classList.contains("show"))
      this.ui.inventoryInfo.innerHTML = `${p.loadout.map((slot, i) => `${i + 1} · ${WEAPONS[i].name} ${slot.owned ? (i === p.weapon ? " / EQUIPPED" : " / READY") : " / EMPTY"}`).join("<br>")}<br>${p.ammo} / ${p.reserve} ROUNDS<br><br>SHIELD ${Math.ceil(p.shield)} / 100<br>HEALTH ${Math.ceil(p.health)} / 100<br>FIELD REPAIRS ${p.medkits}<br><br>1 / 2 / 3 · SWITCH OWNED WEAPON<br>H · FIELD REPAIR`;
    const c = this.ui.map as HTMLCanvasElement,
      ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 160, 160);
    ctx.drawImage(this.mapBackground, 0, 0);
    ctx.strokeStyle = "#eeb774";
    ctx.beginPath();
    ctx.arc(80, 80, this.ringRadius / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(80 + p.pos.x / 2, 80 + p.pos.z / 2);
    ctx.rotate(-this.yaw);
    ctx.fillStyle = "#e9f6df";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-3, 4);
    ctx.lineTo(3, 4);
    ctx.fill();
    ctx.restore();
  }
  loop = (now: number) => {
    const rawElapsed = (now - this.last) / 1000;
    const elapsed = Math.min(rawElapsed, 0.2);
    this.last = now;
    this.frameCount++;
    this.fpsTimer += rawElapsed;
    if (this.fpsTimer >= 1) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (!document.hidden && this.fps < 35) this.slowFrames++;
      else this.slowFrames = 0;
      if (!document.hidden && this.fps > 55) this.fastFrames++;
      else this.fastFrames = 0;
      if (this.slowFrames >= 2) {
        if (this.renderScale > 0.6) {
          this.renderScale = Math.max(0.6, this.renderScale - 0.2);
          this.renderer.setPixelRatio(
            Math.min(devicePixelRatio, 1.5) * this.renderScale,
          );
        } else if (this.renderer.shadowMap.enabled)
          this.renderer.shadowMap.enabled = false;
        this.slowFrames = 0;
      }
      if (this.fastFrames >= 8) {
        if (this.renderScale < 1) {
          this.renderScale = Math.min(1, this.renderScale + 0.2);
          this.renderer.setPixelRatio(
            Math.min(devicePixelRatio, 1.5) * this.renderScale,
          );
        } else if (!this.renderer.shadowMap.enabled)
          this.renderer.shadowMap.enabled = true;
        this.fastFrames = 0;
      }
    }
    let remaining = elapsed;
    while (remaining > 0) {
      const dt = Math.min(remaining, 0.05);
      this.update(dt);
      remaining -= dt;
    }
    if (!this.paused && this.phase !== "menu" && this.phase !== "ended")
      this.updateUI(elapsed);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };
}
