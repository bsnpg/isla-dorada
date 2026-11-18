// Isla Dorada — on-foot combat: weapon rack, shooting, enemy AI.
// Fires only on foot in play mode. Ray is the camera centre; hits are sphere
// tests against enemies (radius 1.2 m). Every shot reads as a fight: a muzzle
// flash at the gun, a bright tracer to the hit point, impact sparks, and a
// floating damage number ("-45") over the enemy. Enemies that die fall and
// STAY DOWN (G.combat.downed) instead of vanishing. Enemy fire is visible too
// — tracers and flashes coming back at Wowo.
// Staging hooks at the bottom (stageChaosScene etc.) let shots.js build the
// chaotic combat cover: flipped police car + burning car + firing enemies +
// a ramming unit, all in one call.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { Input } from './input.js';
import { clamp, lerp } from './random.js';
import { makeCar, setCarOnFire, spawnFire, spawnSmoke, spawnSparks } from './driving.js';
import { setWanted, spawnFlippedPoliceCar, spawnPoliceCar, spawnRammingPolice } from './police.js';

const TRACER_POOL = 16;
const TRACER_LIFE = 0.09;
const FLASH_POOL = 4;
const FLASH_LIFE = 0.06;
const DMG_POOL = 10;
const DMG_LIFE = 0.9;

let tracerGeo = null;
let flashTex = null;

function getFlashTexture() {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.35, 'rgba(255,200,80,0.9)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  // Star spikes so the flash reads at a glance, not as a soft blob.
  ctx.strokeStyle = 'rgba(255,240,180,0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(32, 2); ctx.lineTo(32, 62);
  ctx.moveTo(2, 32); ctx.lineTo(62, 32);
  ctx.moveTo(11, 11); ctx.lineTo(53, 53);
  ctx.moveTo(53, 11); ctx.lineTo(11, 53);
  ctx.stroke();
  flashTex = new THREE.CanvasTexture(c);
  return flashTex;
}

function makeHumanoid(kind) {
  const isHeavy = kind === 'heavy';
  const s = isHeavy ? 1.25 : 1.0;
  const bodyColor = isHeavy ? 0x5a5f66 : 0x8a2a2a; // bulky grey / dark red
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62 * s, 0.75 * s, 0.34 * s), bodyMat);
  torso.position.y = 1.15 * s;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.34 * s, 0.34 * s), skinMat);
  head.position.y = 1.72 * s;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.7 * s, 0.24 * s), darkMat);
  legL.position.set(-0.17 * s, 0.35 * s, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.7 * s, 0.24 * s), darkMat);
  legR.position.set(0.17 * s, 0.35 * s, 0);
  group.add(legR);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.55 * s, 0.18 * s), bodyMat);
  armR.position.set(0.4 * s, 1.2 * s, 0.18 * s);
  armR.rotation.x = -Math.PI / 2.4; // raised, holding a gun
  group.add(armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.55), darkMat);
  gun.position.set(0.4 * s, 1.32 * s, 0.45 * s);
  group.add(gun);
  return group;
}

export function initCombat(G) {
  G.combat = {
    weaponIndex: 0,
    weapons: WEAPONS.map((w) => ({ ...w })), // deep copy of the rack
    enemies: [],
    downed: [], // bodies that fell and stay down (visible, not active targets)
    _fireTimer: 0,
    _tracers: [],
    _tracerIdx: 0,
    _flashes: [],
    _flashIdx: 0,
    _flashLight: null,
    _dmgNums: [],
    _dmgIdx: 0,
  };
  // One shared flash light: parked at the latest muzzle, decays fast.
  const light = new THREE.PointLight(0xffc860, 0, 18, 1.8);
  G.scene.add(light);
  G.combat._flashLight = light;
  const tex = getFlashTexture();
  for (let i = 0; i < FLASH_POOL; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    sprite.visible = false;
    G.scene.add(sprite);
    G.combat._flashes.push({ sprite, life: 0 });
  }
  for (let i = 0; i < DMG_POOL; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 80;
    const tex2 = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex2, transparent: true, opacity: 0, depthWrite: false,
    }));
    sprite.scale.set(2.2, 1.1, 1);
    sprite.visible = false;
    G.scene.add(sprite);
    G.combat._dmgNums.push({ sprite, canvas, tex: tex2, life: 0 });
  }
}

export function spawnEnemy(G, x, z, kind) {
  const k = kind === 'heavy' ? 'heavy' : 'gunman';
  const mesh = makeHumanoid(k);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const enemy = {
    mesh,
    kind: k,
    hp: k === 'heavy' ? 160 : 60,
    maxHp: k === 'heavy' ? 160 : 60,
    pos: mesh.position,
    shootTimer: 0.6 + G.rng() * 0.8,
    strafeTimer: 1 + G.rng(),
    strafeDir: G.rng() < 0.5 ? -1 : 1,
    state: 'alive',
    flashTimer: 0,
    fallTimer: 0,
  };
  G.combat.enemies.push(enemy);
  return enemy;
}

// An enemy that opens fire immediately — used by the chaos staging.
export function spawnFiringEnemy(G, x, z, kind) {
  const e = spawnEnemy(G, x, z, kind);
  e.shootTimer = 0.1;
  return e;
}

// A body that is already down: lying flat, staying in the scene as a
// downed enemy. Not an active target, not counted by mission combat stages.
export function spawnDownedEnemy(G, x, z, kind) {
  const k = kind === 'heavy' ? 'heavy' : 'gunman';
  const mesh = makeHumanoid(k);
  mesh.position.set(x, 0.15, z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.y = G.rng() * Math.PI * 2;
  G.scene.add(mesh);
  const enemy = {
    mesh, kind: k, hp: 0, maxHp: k === 'heavy' ? 160 : 60,
    pos: mesh.position, shootTimer: 0, strafeTimer: 0, strafeDir: 1,
    state: 'downed', flashTimer: 0, fallTimer: 1,
  };
  G.combat.downed.push(enemy);
  return enemy;
}

// Remove all downed bodies from the scene (stage change / mission start).
export function clearDowned(G) {
  if (!G.combat) return;
  for (const e of G.combat.downed) G.scene.remove(e.mesh);
  G.combat.downed.length = 0;
}

function getTracer(G) {
  const c = G.combat;
  if (!tracerGeo) tracerGeo = new THREE.BufferGeometry();
  let t = c._tracers[c._tracerIdx];
  c._tracerIdx = (c._tracerIdx + 1) % TRACER_POOL;
  if (!t) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 });
    t = { line: new THREE.Line(geo, mat), life: 0 };
    G.scene.add(t.line);
    c._tracers.push(t);
  }
  return t;
}

function fireTracer(G, from, to, color) {
  const t = getTracer(G);
  if (color !== undefined) t.line.material.color.setHex(color);
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.line.material.opacity = 0.95;
  t.life = TRACER_LIFE;
}

// Bright star-burst at the muzzle + a hot point light that dies in 60 ms.
function flashMuzzle(G, at, scale) {
  const c = G.combat;
  const f = c._flashes[c._flashIdx];
  c._flashIdx = (c._flashIdx + 1) % FLASH_POOL;
  f.sprite.position.copy(at);
  f.sprite.scale.setScalar((scale || 1) * (0.9 + G.rng() * 0.4));
  f.sprite.material.opacity = 1;
  f.sprite.material.rotation = G.rng() * Math.PI;
  f.sprite.visible = true;
  f.life = FLASH_LIFE;
  if (c._flashLight) {
    c._flashLight.position.copy(at);
    c._flashLight.intensity = 60;
  }
}

// Floating damage number ("-45") that rises and fades over 0.9 s.
export function spawnDamageNumber(G, x, y, z, text, color) {
  const c = G.combat;
  if (!c || !c._dmgNums.length) return;
  const d = c._dmgNums[c._dmgIdx];
  c._dmgIdx = (c._dmgIdx + 1) % DMG_POOL;
  const ctx = d.canvas.getContext('2d');
  ctx.clearRect(0, 0, 160, 80);
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, 80, 42);
  ctx.fillStyle = color || '#ffd94a';
  ctx.fillText(text, 80, 42);
  d.tex.needsUpdate = true;
  d.sprite.position.set(x, y, z);
  d.sprite.material.opacity = 1;
  d.sprite.visible = true;
  d.life = DMG_LIFE;
}

function damagePlayer(G, amount) {
  const p = G.player;
  if (!p) return;
  let left = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, left);
    p.armour -= absorbed;
    left -= absorbed;
  }
  if (left > 0) p.health = Math.max(0, p.health - left);
  if (left > 0) spawnDamageNumber(G, p.pos.x, 2.4, p.pos.z, `-${left}`, '#ff5a4a');
}

function tryFire(G) {
  const c = G.combat;
  const w = c.weapons[c.weaponIndex];
  if (!w || w.ammo <= 0) return;
  w.ammo -= 1;
  G.stats.shotsFired += 1;

  // Gun position: just in front of the player at chest height.
  const p = G.player.pos;
  const h = G.player.heading;
  const from = new THREE.Vector3(
    p.x + Math.sin(h) * 0.6, 1.4, p.z + Math.cos(h) * 0.6,
  );
  // Ray through the screen centre.
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const origin = G.camera.position;

  // Sphere test (radius 1.2 m) against every live enemy; take the nearest.
  let best = null;
  let bestT = Infinity;
  const toCentre = new THREE.Vector3();
  for (const e of c.enemies) {
    if (e.state !== 'alive') continue;
    const cx = e.pos.x, cy = e.pos.y + 1.2, cz = e.pos.z;
    toCentre.set(cx - origin.x, cy - origin.y, cz - origin.z);
    const t = toCentre.dot(dir);
    if (t < 0 || t > w.range) continue;
    const px = origin.x + dir.x * t - cx;
    const py = origin.y + dir.y * t - cy;
    const pz = origin.z + dir.z * t - cz;
    if (px * px + py * py + pz * pz < 1.2 * 1.2 && t < bestT) {
      best = e;
      bestT = t;
    }
  }
  const hitPoint = best
    ? new THREE.Vector3(origin.x + dir.x * bestT, origin.y + dir.y * bestT, origin.z + dir.z * bestT)
    : new THREE.Vector3(origin.x + dir.x * w.range, origin.y + dir.y * w.range, origin.z + dir.z * w.range);
  flashMuzzle(G, from, w.flash || 1);
  fireTracer(G, from, hitPoint, w.tracer);

  if (best) {
    best.hp -= w.damage;
    best.flashTimer = 0.12; // emissive flash + scale pulse, handled in update
    spawnDamageNumber(G, best.pos.x, best.pos.y + 2.3, best.pos.z, `-${w.damage}`, '#ffd94a');
    spawnSparks(G, hitPoint.x, hitPoint.y, hitPoint.z, 6);
    if (best.hp <= 0) {
      best.state = 'falling';
      best.fallTimer = 0;
      G.player.money += 50;
    }
  } else {
    // Miss: the round still hits something — sparks where the tracer ends.
    spawnSparks(G, hitPoint.x, Math.max(0.3, hitPoint.y), hitPoint.z, 4);
  }
}

function updateEnemy(G, e, dt) {
  const p = G.player.pos;
  const dx = p.x - e.pos.x;
  const dz = p.z - e.pos.z;
  const dist = Math.hypot(dx, dz);

  if (e.flashTimer > 0) {
    e.flashTimer -= dt;
    const pulse = 1 + 0.18 * Math.max(0, e.flashTimer / 0.12);
    e.mesh.scale.setScalar(pulse);
  } else if (e.state === 'alive') {
    e.mesh.scale.setScalar(1.0); // geometry already carries the heavy's 1.25x bulk
  }

  // Falling: rotate flat over ~0.35 s, then the body stays down.
  if (e.state === 'falling') {
    e.fallTimer += dt;
    const f = Math.min(1, e.fallTimer / 0.35);
    e.mesh.rotation.x = -Math.PI / 2 * f;
    e.mesh.position.y = 0.15 * f;
    if (e.fallTimer >= 0.9) {
      e.state = 'downed';
      G.combat.downed.push(e);
      const i = G.combat.enemies.indexOf(e);
      if (i >= 0) G.combat.enemies.splice(i, 1);
    }
    return;
  }
  if (e.state !== 'alive') return;

  // Face the player, close to shooting range (stop at 12 m), strafe sideways
  // while firing so the fight moves instead of standing still.
  e.mesh.rotation.y = Math.atan2(dx, dz);
  const speed = e.kind === 'heavy' ? 2.5 : 4;
  if (dist > 12) {
    const step = Math.min(speed * dt, dist - 12);
    e.pos.x += (dx / dist) * step;
    e.pos.z += (dz / dist) * step;
  } else {
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = 1 + G.rng() * 1.5;
      e.strafeDir = G.rng() < 0.5 ? -1 : 1;
    }
    const sx = -Math.cos(e.mesh.rotation.y) * e.strafeDir;
    const sz = Math.sin(e.mesh.rotation.y) * e.strafeDir;
    e.pos.x += sx * 2 * dt;
    e.pos.z += sz * 2 * dt;
  }

  // Shoot when in range: visible tracer + muzzle flash from the enemy gun.
  // A miss still sparks the ground next to Wowo so the shot reads.
  e.shootTimer -= dt;
  if (e.shootTimer <= 0) {
    const gun = new THREE.Vector3(e.pos.x, e.pos.y + 1.35, e.pos.z);
    flashMuzzle(G, gun, 0.8);
    const spread = e.kind === 'heavy' ? 1.6 : 2.2;
    const hitChance = clamp(0.75 - dist / 60, 0.25, 0.75);
    if (G.rng() < hitChance && dist <= (e.kind === 'heavy' ? 15 : 40)) {
      const dmg = e.kind === 'heavy'
        ? Math.round(lerp(22, 15, clamp(dist / 15, 0, 1)) + G.rng() * 2 - 1)
        : Math.round(lerp(10, 6, clamp(dist / 40, 0, 1)) + G.rng() * 2 - 1);
      fireTracer(G, gun, new THREE.Vector3(p.x, 1.2, p.z), 0xffb347);
      damagePlayer(G, dmg);
      spawnSparks(G, p.x, 1.2, p.z, 5);
    } else {
      const miss = new THREE.Vector3(
        p.x + (G.rng() - 0.5) * spread * 2, 0.4, p.z + (G.rng() - 0.5) * spread * 2,
      );
      fireTracer(G, gun, miss, 0xffb347);
      spawnSparks(G, miss.x, 0.4, miss.z, 4);
    }
    e.shootTimer = e.kind === 'heavy' ? 1.6 : 1.2;
  }
}

export function updateCombat(G, dt) {
  if (!G.combat) return;
  const c = G.combat;

  // Tracer fade.
  for (const t of c._tracers) {
    if (t.life > 0) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / TRACER_LIFE) * 0.95;
    }
  }
  // Muzzle-flash fade + flash-light decay.
  for (const f of c._flashes) {
    if (f.life > 0) {
      f.life -= dt;
      f.sprite.material.opacity = Math.max(0, f.life / FLASH_LIFE);
      if (f.life <= 0) f.sprite.visible = false;
    }
  }
  if (c._flashLight && c._flashLight.intensity > 0) {
    c._flashLight.intensity = Math.max(0, c._flashLight.intensity - dt * 1000);
  }
  // Damage numbers rise and fade.
  for (const d of c._dmgNums) {
    if (d.life > 0) {
      d.life -= dt;
      d.sprite.position.y += dt * 1.4;
      d.sprite.material.opacity = Math.max(0, d.life / DMG_LIFE);
      if (d.life <= 0) d.sprite.visible = false;
    }
  }

  // Enemies act even while the player is in a car (they keep closing in).
  for (const e of [...c.enemies]) updateEnemy(G, e, dt);

  if (G.mode !== 'play') return;

  // Weapon switching: keys 1-4, or mouse wheel cycles the rack.
  for (let i = 0; i < 4; i++) {
    if (Input.pressed(`Digit${i + 1}`)) c.weaponIndex = i;
  }
  const wheel = Input.consumeWheel();
  if (wheel !== 0) {
    c.weaponIndex = (c.weaponIndex + (wheel > 0 ? 1 : 3)) % 4;
  }
  // R reloads the current weapon from infinite reserve.
  if (Input.pressed('KeyR')) {
    c.weapons[c.weaponIndex].ammo = WEAPONS[c.weaponIndex].ammo;
  }

  // Fire only on foot.
  if (G.player.mode !== 'foot') return;
  c._fireTimer -= dt;
  if (Input.mouseDown && c._fireTimer <= 0) {
    const w = c.weapons[c.weaponIndex];
    if (w && w.ammo > 0) {
      c._fireTimer = w.rate;
      tryFire(G);
    }
  }
  Input.consumeClick();
}

// ---------------------------------------------------------------- chaos staging
// A car already burning (fire + smoke every frame, health draining) — used by
// Job 5's warehouse fight and by the combat screenshot.
export function spawnBurningCar(G, x, z, heading, defName) {
  const car = makeCar(G, defName || 'Faro Pickup', x, z, heading || 0);
  setCarOnFire(G, car);
  if (!G.driving.parked.includes(car)) G.driving.parked.push(car);
  return car;
}

// One-call chaotic scene for the screenshot staging (shots.js calls this).
// Places, around (x, z): a flipped IDPD car (wheels up, smoking), a burning
// car (fire + smoke), `enemies` gunmen already firing at the player, one
// police unit in RAMMING mode bearing down on the player, and `downed`
// already-down bodies on the ground. Returns every placed object.
//   opts: { x, z, heading?, enemies=3, policeCar=true, flipped=true,
//           burning=true, downed=1, wanted=2, rammer=true }
export function stageChaosScene(G, opts) {
  const o = opts || {};
  const x = o.x || 0, z = o.z || 0;
  const heading = o.heading || 0;
  const out = { flipped: null, burning: null, enemies: [], rammer: null, downed: [] };
  if (o.flipped !== false) {
    out.flipped = spawnFlippedPoliceCar(G, x + 6, z - 4, heading + 0.6);
  }
  if (o.burning !== false) {
    out.burning = spawnBurningCar(G, x - 8, z + 6, heading + 1.2, 'Cayo Coupe');
    // Extra fire so the blaze reads in a frozen frame.
    spawnFire(G, x - 8, 1, z + 6, 12);
    spawnSmoke(G, x - 8, 2.5, z + 6, 2.0);
  }
  const n = typeof o.enemies === 'number' ? o.enemies : 3;
  const spots = [
    { x: x - 5, z: z - 8 }, { x: x + 7, z: z - 6 }, { x: x + 4, z: z + 9 },
    { x: x - 9, z: z + 2 }, { x: x + 10, z: z + 3 },
  ];
  for (let i = 0; i < n; i++) {
    const s = spots[i % spots.length];
    out.enemies.push(spawnFiringEnemy(G, s.x, s.z, i === 2 ? 'heavy' : 'gunman'));
  }
  const nd = typeof o.downed === 'number' ? o.downed : 1;
  for (let i = 0; i < nd; i++) {
    out.downed.push(spawnDownedEnemy(G, x - 3 + i * 2.5, z + 2, 'gunman'));
  }
  if (o.rammer !== false && o.policeCar !== false) {
    out.rammer = spawnRammingPolice(G, x, z - 18, heading);
  } else if (o.policeCar !== false) {
    out.rammer = spawnPoliceCar(G, x + 12, z - 10, heading + Math.PI);
  }
  setWanted(G, typeof o.wanted === 'number' ? o.wanted : 2);
  return out;
}
