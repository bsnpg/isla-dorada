// Isla Dorada — Wowo on foot: movement, mouse look, walk swing, car entry.
// When the player is in a car, driving.js owns movement and this module only
// keeps the on-foot mesh hidden.
import * as THREE from 'three';
import { KEYS } from './config.js';
import { Input } from './input.js';
import { angleLerp, clamp } from './random.js';

const START = { x: -120, z: 240 }; // Marina

function buildWowoMesh() {
  const jacket = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.95 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
  const tags = new THREE.MeshStandardMaterial({ color: 0xc0c0c8, roughness: 0.3, metalness: 0.9 });

  const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.24);
  legGeo.translate(0, -0.375, 0);
  const armGeo = new THREE.BoxGeometry(0.16, 0.65, 0.18);
  armGeo.translate(0, -0.3, 0);

  const g = new THREE.Group();
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.78, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.78, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), jacket);
  torso.position.y = 1.13;
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.4, 1.42, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.4, 1.42, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
  head.position.y = 1.66;
  const hairBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), hair);
  hairBox.position.y = 1.85;
  const dogTags = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.02), tags);
  dogTags.position.set(0, 1.25, 0.19);
  for (const part of [legL, legR, torso, armL, armR, head, hairBox, dogTags]) {
    part.castShadow = true;
    g.add(part);
  }
  g.userData = { legL, legR, armL, armR };
  return g;
}

function nearestCar(G, pos, maxD) {
  let best = null, bestD = maxD * maxD;
  const lists = [];
  if (G.driving && G.driving.parked) lists.push(G.driving.parked);
  if (G.traffic && G.traffic.cars) lists.push(G.traffic.cars);
  for (const list of lists) {
    for (const car of list) {
      const dx = car.mesh.position.x - pos.x;
      const dz = car.mesh.position.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= bestD) { bestD = d2; best = car; }
    }
  }
  return best;
}

export function initPlayer(G) {
  const mesh = buildWowoMesh();
  mesh.position.set(START.x, 0, START.z);
  mesh.rotation.y = Math.PI; // facing north, into the city
  G.scene.add(mesh);
  G.player = {
    mode: 'foot',
    pos: mesh.position,
    heading: Math.PI,
    speed: 0,
    health: 100,
    armour: 0,
    money: 1250,
    mesh,
    vehicle: null,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (!p) return;
  if (p.mode === 'car') {
    p.mesh.visible = false;
    return;
  }
  p.mesh.visible = true;

  // Mouse look (only while the pointer is locked); click the canvas to lock it.
  const { dx } = Input.consumeMouse();
  if (Input.pointerLocked && dx) p.heading += dx * 0.0028;
  if (Input.consumeClick()) Input.lockPointer(G.renderer.domElement);

  // WASD, relative to facing; Shift runs.
  // With the pointer locked, A/D strafe and the mouse turns the heading.
  // Without it, A/D turn the heading directly (keyboard-only steering) — the
  // heading never follows the strafe direction, which spun the player in a loop.
  const fwd = (Input.down(...KEYS.forward) ? 1 : 0) - (Input.down(...KEYS.back) ? 1 : 0);
  const str = (Input.down(...KEYS.right) ? 1 : 0) - (Input.down(...KEYS.left) ? 1 : 0);
  const speed = Input.down('ShiftLeft', 'ShiftRight') ? 9 : 6;
  let mx = 0, mz = 0;
  if (Input.pointerLocked) {
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const rx = -Math.cos(p.heading), rz = Math.sin(p.heading);
    mx = fx * fwd + rx * str;
    mz = fz * fwd + rz * str;
  } else {
    p.heading += -str * 1.9 * dt; // A turns left, D turns right
    mx = Math.sin(p.heading) * fwd;
    mz = Math.cos(p.heading) * fwd;
  }
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.speed = speed;
  } else {
    p.speed = 0;
  }

  // Building / palm colliders: circle push-out.
  if (G.city) {
    for (const c of G.city.colliders) {
      const dx = p.pos.x - c.x;
      const dz = p.pos.z - c.z;
      const r = c.r + 0.5;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.pos.x = c.x + (dx / d) * r;
        p.pos.z = c.z + (dz / d) * r;
      }
    }
  }
  p.pos.x = clamp(p.pos.x, -318, 318);
  p.pos.z = clamp(p.pos.z, -318, 318);
  p.mesh.rotation.y = p.heading;

  // Walk swing.
  const u = p.mesh.userData;
  const swing = p.speed > 0 ? Math.sin(G.time * 10) * 0.55 : 0;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;

  // E near a car: steal it (5 m radius, forgiving for a first-time player).
  if (Input.pressed(KEYS.interact)) {
    const car = nearestCar(G, p.pos, 5);
    if (car) {
      G.enterCar(car);
      G.stats.carsStolen++;
      if (G.police) G.setWanted(Math.max(G.police.wanted, 1));
    }
  }
}
