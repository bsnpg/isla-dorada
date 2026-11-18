// Isla Dorada — on-foot combat: weapon rack, shooting, enemy AI.
// Fires only on foot in play mode. Ray is the camera centre; hits are sphere
// tests against enemies (radius 1.2 m). Tracers come from a small reused pool.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { Input } from './input.js';
import { clamp, lerp } from './random.js';

const TRACER_POOL = 8;
const TRACER_LIFE = 0.08;

let tracerGeo = null;

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
    _fireTimer: 0,
    _tracers: [],
    _tracerIdx: 0,
  };
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
    pos: mesh.position,
    shootTimer: 0.6 + G.rng() * 0.8,
    state: 'alive',
    flashTimer: 0,
    fallTimer: 0,
  };
  G.combat.enemies.push(enemy);
  return enemy;
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

function fireTracer(G, from, to) {
  const t = getTracer(G);
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.line.material.opacity = 0.95;
  t.life = TRACER_LIFE;
}

function damagePlayer(G, amount) {
  let left = amount;
  if (G.player.armour > 0) {
    const absorbed = Math.min(G.player.armour, left);
    G.player.armour -= absorbed;
    left -= absorbed;
  }
  if (left > 0) G.player.health = Math.max(0, G.player.health - left);
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
  fireTracer(G, from, hitPoint);

  if (best) {
    best.hp -= w.damage;
    best.flashTimer = 0.12; // emissive flash + scale pulse, handled in update
    if (best.hp <= 0) {
      best.state = 'dying';
      best.fallTimer = 0;
      best.mesh.rotation.x = -Math.PI / 2; // falls flat
      G.player.money += 50;
    }
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

  if (e.state === 'dying') {
    e.fallTimer += dt;
    e.mesh.position.y -= dt * 0.6; // sinks, then removed below
    if (e.fallTimer >= 1) {
      G.scene.remove(e.mesh);
      const i = G.combat.enemies.indexOf(e);
      if (i >= 0) G.combat.enemies.splice(i, 1);
    }
    return;
  }

  // Face the player and close to shooting range (stop at 12 m).
  e.mesh.rotation.y = Math.atan2(dx, dz);
  const speed = e.kind === 'heavy' ? 2.5 : 4;
  if (dist > 12) {
    const step = Math.min(speed * dt, dist - 12);
    e.pos.x += (dx / dist) * step;
    e.pos.z += (dz / dist) * step;
  }

  // Shoot when in range (line of sight assumed).
  e.shootTimer -= dt;
  if (e.shootTimer <= 0) {
    if (e.kind === 'heavy') {
      if (dist <= 15) {
        damagePlayer(G, Math.round(lerp(22, 15, clamp(dist / 15, 0, 1)) + G.rng() * 2 - 1));
      }
      e.shootTimer = 1.6;
    } else {
      if (dist <= 40) {
        // 6-10 damage, harder up close.
        damagePlayer(G, Math.round(lerp(10, 6, clamp(dist / 40, 0, 1)) + G.rng() * 2 - 1));
      }
      e.shootTimer = 1.2;
    }
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

  // Enemies act even while the player is in a car (they keep closing in).
  for (const e of [...c.enemies]) updateEnemy(G, e, dt);

  if (G.mode !== 'play') return;

  // Weapon switching: keys 1-4.
  for (let i = 0; i < 4; i++) {
    if (Input.pressed(`Digit${i + 1}`)) c.weaponIndex = i;
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
