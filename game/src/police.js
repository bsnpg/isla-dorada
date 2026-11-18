// Isla Dorada — police pursuit (IDPD).
// Owns G.police: wanted level, pursuit units, roadblocks, helicopter, busted/decay.
import * as THREE from 'three';
import { POLICE } from './config.js';
import { clamp, angleLerp } from './random.js';

// Shared materials / geometries — built once, reused by every unit.
let MAT = null;
let GEO = null;

function sharedAssets() {
  if (MAT) return { MAT, GEO };
  MAT = {
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0x1a4fd9, roughness: 0.5 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd21f1f, emissive: 0xd21f1f, emissiveIntensity: 1 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x1a4fd9, emissive: 0x1a4fd9, emissiveIntensity: 1 }),
    heliBody: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.3 }),
    heliDark: new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6 }),
    rotor: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.4 }),
  };
  GEO = {
    body: new THREE.BoxGeometry(2.0, 0.55, 4.4),
    cabin: new THREE.BoxGeometry(1.7, 0.5, 2.2),
    hood: new THREE.BoxGeometry(1.9, 0.08, 1.1),
    wheel: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12),
    lightBar: new THREE.BoxGeometry(0.5, 0.16, 0.7),
    stripe: new THREE.BoxGeometry(2.02, 0.12, 4.42),
    heliBody: new THREE.BoxGeometry(2.2, 1.6, 3.6),
    heliTail: new THREE.BoxGeometry(0.5, 0.5, 4.2),
    heliRotor: new THREE.BoxGeometry(7.5, 0.08, 0.5),
    heliTailRotor: new THREE.BoxGeometry(0.08, 1.6, 0.4),
    heliSkid: new THREE.BoxGeometry(0.12, 0.12, 3.0),
  };
  return { MAT, GEO };
}

function makePoliceCarMesh() {
  const { MAT, GEO } = sharedAssets();
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(GEO.body, MAT.white);
  body.position.y = 0.55;
  body.castShadow = true;
  mesh.add(body);
  const stripe = new THREE.Mesh(GEO.stripe, MAT.stripe);
  stripe.position.y = 0.62;
  mesh.add(stripe);
  const hood = new THREE.Mesh(GEO.hood, MAT.black);
  hood.position.set(0, 0.84, 1.55);
  mesh.add(hood);
  const cabin = new THREE.Mesh(GEO.cabin, MAT.glass);
  cabin.position.set(0, 1.05, -0.3);
  cabin.castShadow = true;
  mesh.add(cabin);
  const lightRed = new THREE.Mesh(GEO.lightBar, MAT.red.clone());
  lightRed.position.set(-0.45, 1.36, -0.3);
  mesh.add(lightRed);
  const lightBlue = new THREE.Mesh(GEO.lightBar, MAT.blue.clone());
  lightBlue.position.set(0.45, 1.36, -0.3);
  mesh.add(lightBlue);
  const wheelGeo = GEO.wheel;
  const wheelPos = [[-0.95, 0.36, 1.45], [0.95, 0.36, 1.45], [-0.95, 0.36, -1.45], [0.95, 0.36, -1.45]];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, MAT.tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    mesh.add(w);
  }
  mesh.userData.lightRed = lightRed;
  mesh.userData.lightBlue = lightBlue;
  return mesh;
}

function makeHeliMesh() {
  const { MAT, GEO } = sharedAssets();
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(GEO.heliBody, MAT.heliBody);
  body.position.y = 0;
  body.castShadow = true;
  mesh.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.0), MAT.glass);
  nose.position.set(0, -0.1, 2.0);
  mesh.add(nose);
  const tail = new THREE.Mesh(GEO.heliTail, MAT.heliBody);
  tail.position.set(0, 0.3, -3.6);
  mesh.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.8), MAT.heliDark);
  fin.position.set(0, 0.8, -5.5);
  mesh.add(fin);
  const rotor = new THREE.Mesh(GEO.heliRotor, MAT.rotor);
  rotor.position.y = 1.0;
  mesh.add(rotor);
  const tailRotor = new THREE.Mesh(GEO.heliTailRotor, MAT.rotor);
  tailRotor.position.set(0.35, 0.5, -5.4);
  mesh.add(tailRotor);
  const skidL = new THREE.Mesh(GEO.heliSkid, MAT.heliDark);
  skidL.position.set(-0.9, -1.0, 0);
  mesh.add(skidL);
  const skidR = new THREE.Mesh(GEO.heliSkid, MAT.heliDark);
  skidR.position.set(0.9, -1.0, 0);
  mesh.add(skidR);
  // Searchlight: spotlight + visible cone, aimed by updatePolice.
  const spot = new THREE.SpotLight(0xfff2b0, 900, 120, 0.28, 0.45, 1.2);
  spot.position.set(0, -0.8, 0.5);
  mesh.add(spot);
  mesh.add(spot.target);
  spot.target.position.set(0, -40, 0);
  mesh.userData.rotor = rotor;
  mesh.userData.tailRotor = tailRotor;
  mesh.userData.spot = spot;
  return mesh;
}

function nextUnitName(G) {
  const used = new Set(G.police.units.map((u) => u.name));
  for (const n of POLICE.unitNames) {
    if (n === 'HAWK-1') continue;
    if (!used.has(n)) return n;
  }
  return `UNIT ${10 + G.police.units.length}`;
}

function spawnPosNearPlayer(G) {
  const p = G.player.pos;
  if (G.city && typeof G.city.randomRoadPos === 'function') {
    try {
      const pos = G.city.randomRoadPos(G.rng);
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z)) {
        // Keep the spawn reasonably close so the unit can join the chase.
        const dx = pos.x - p.x, dz = pos.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 160) {
          const s = 120 / Math.max(d, 1);
          return { x: p.x + dx * s, z: p.z + dz * s };
        }
        return { x: pos.x, z: pos.z };
      }
    } catch (e) { /* fall through to the offset spawn */ }
  }
  const a = G.rng() * Math.PI * 2;
  const r = 60 + G.rng() * 40;
  return { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
}

export function initPolice(G) {
  G.police = { wanted: 0, units: [], heli: null, decayTimer: 0, bustTimer: 0 };
}

export function setWanted(G, n) {
  if (!G.police) initPolice(G);
  const v = clamp(Math.round(n) || 0, 0, 5);
  if (v !== G.police.wanted) {
    G.police.wanted = v;
    G.police.decayTimer = 0;
    G.police.bustTimer = 0;
  }
}

export function spawnPoliceCar(G, x, z, heading) {
  const mesh = makePoliceCarMesh();
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading || 0;
  G.scene.add(mesh);
  const unit = {
    mesh,
    kind: 'car',
    name: nextUnitName(G),
    status: 'EN ROUTE',
    dist: 0,
    speed: 0,
    heading: heading || 0,
    pos: mesh.position,
    roadblockTimer: 0,
    roadblockTarget: null,
    ramCooldown: 0,
  };
  G.police.units.push(unit);
  return unit;
}

export function spawnHeli(G, x, z, height) {
  // Remove any stale heli first so there is only ever one.
  if (G.police.heli) {
    const old = G.police.heli;
    const i = G.police.units.indexOf(old);
    if (i >= 0) G.police.units.splice(i, 1);
    if (old.mesh) G.scene.remove(old.mesh);
  }
  const mesh = makeHeliMesh();
  mesh.position.set(x, height || 40, z);
  G.scene.add(mesh);
  const heli = {
    mesh,
    kind: 'heli',
    name: 'HAWK-1',
    status: 'SEARCHLIGHT',
    dist: 0,
    speed: 0,
    heading: 0,
    pos: mesh.position,
  };
  G.police.heli = heli;
  G.police.units.push(heli);
  return heli;
}

function removeUnit(G, unit) {
  const i = G.police.units.indexOf(unit);
  if (i >= 0) G.police.units.splice(i, 1);
  if (unit === G.police.heli) G.police.heli = null;
  if (unit.mesh) G.scene.remove(unit.mesh);
}

function playerSpeed(G) {
  if (G.player.mode === 'car') return Math.abs(G.driving.speed || 0);
  return Math.abs(G.player.speed || 0);
}

function playerTopSpeed(G) {
  if (G.player.mode === 'car' && G.driving.car) return G.driving.car.def.topSpeed || 50;
  return 8;
}

export function updatePolice(G, dt) {
  if (!G.police || G.mode !== 'play') return;
  const wanted = G.police.wanted;
  const p = G.player.pos;

  // ---- maintain unit count from wanted -------------------------------------
  const wantCars = wanted; // 1->1 ... 5->5
  const wantHeli = wanted >= 4;
  let cars = G.police.units.filter((u) => u.kind === 'car' && u.mesh);
  // Remove surplus cars (furthest first).
  while (cars.length > wantCars) {
    let far = cars[0];
    for (const c of cars) if (c.dist > far.dist) far = c;
    removeUnit(G, far);
    cars = G.police.units.filter((u) => u.kind === 'car' && u.mesh);
  }
  while (cars.length < wantCars) {
    const s = spawnPosNearPlayer(G);
    spawnPoliceCar(G, s.x, s.z, Math.atan2(p.x - s.x, p.z - s.z));
    cars = G.police.units.filter((u) => u.kind === 'car' && u.mesh);
  }
  if (wantHeli && !G.police.heli) spawnHeli(G, p.x, p.z, 42);
  if (!wantHeli && G.police.heli) removeUnit(G, G.police.heli);

  const topSpeed = 30 + wanted * 4; // slightly above the player's top speed at high wanted
  const pSpeed = playerSpeed(G);
  const pHeading = G.player.mode === 'car' && G.driving.car
    ? G.driving.car.heading : G.player.heading;
  const aheadX = p.x + Math.sin(pHeading) * 45;
  const aheadZ = p.z + Math.cos(pHeading) * 45;

  // ---- per-unit behaviour ---------------------------------------------------
  let anyNear = false;
  let anyBustClose = false;
  for (const u of [...G.police.units]) {
    if (!u.mesh || !u.pos) continue;
    const dx = p.x - u.pos.x;
    const dz = p.z - u.pos.z;
    const dist = Math.hypot(dx, dz);
    u.dist = dist;
    if (dist < 120) anyNear = true;

    if (u.kind === 'heli') {
      // Hover ~40 m above the player, searchlight pinned on them.
      const tx = p.x, tz = p.z;
      u.pos.x += (tx - u.pos.x) * Math.min(1, dt * 1.5);
      u.pos.z += (tz - u.pos.z) * Math.min(1, dt * 1.5);
      u.pos.y += (42 - u.pos.y) * Math.min(1, dt * 1.5);
      u.heading += dt * 0.4;
      u.mesh.rotation.y = u.heading;
      if (u.mesh.userData.rotor) u.mesh.userData.rotor.rotation.y += dt * 22;
      if (u.mesh.userData.tailRotor) u.mesh.userData.tailRotor.rotation.x += dt * 30;
      const spot = u.mesh.userData.spot;
      if (spot) {
        spot.target.position.set(p.x - u.pos.x, -u.pos.y, p.z - u.pos.z);
        spot.target.updateMatrixWorld();
      }
      u.status = 'SEARCHLIGHT';
      u.speed = 0;
      continue;
    }

    // Flashing light bar: red/blue alternate.
    const phase = Math.floor(G.time * 4) % 2;
    if (u.mesh.userData.lightRed) {
      u.mesh.userData.lightRed.material.emissiveIntensity = phase === 0 ? 2.2 : 0.15;
    }
    if (u.mesh.userData.lightBlue) {
      u.mesh.userData.lightBlue.material.emissiveIntensity = phase === 1 ? 2.2 : 0.15;
    }
    if (u.ramCooldown > 0) u.ramCooldown -= dt;

    // ---- roadblock: at wanted >= 3, the first 1-2 units cut ahead and stop --
    const rbIndex = cars.indexOf(u);
    const isBlocker = wanted >= 3 && rbIndex >= 0 && rbIndex < (wanted >= 5 ? 2 : 1);
    if (isBlocker && u.status !== 'ROADBLOCK') {
      if (!u.roadblockTarget) {
        u.roadblockTarget = { x: aheadX, z: aheadZ };
        u.status = 'EN ROUTE';
      }
      const bdx = u.roadblockTarget.x - u.pos.x;
      const bdz = u.roadblockTarget.z - u.pos.z;
      const bd = Math.hypot(bdx, bdz);
      if (bd < 10) {
        u.status = 'ROADBLOCK';
        u.roadblockTimer = 8;
        u.speed = 0;
      } else {
        const want = Math.atan2(bdx, bdz);
        u.heading = angleLerp(u.heading, want, Math.min(1, dt * 3));
        u.speed = Math.min(topSpeed, u.speed + 14 * dt);
        u.pos.x += Math.sin(u.heading) * u.speed * dt;
        u.pos.z += Math.cos(u.heading) * u.speed * dt;
      }
    } else if (u.status === 'ROADBLOCK') {
      u.roadblockTimer -= dt;
      u.speed = 0;
      // Resume pursuit once the player has passed or the timer elapses.
      const passed = dist > 25;
      if (u.roadblockTimer <= 0 || passed) {
        u.status = 'PURSUIT';
        u.roadblockTarget = null;
        u.roadblockTimer = 0;
      }
    } else {
      // ---- pursuit ---------------------------------------------------------
      u.status = dist < 6 ? 'RAMMING' : (dist < 25 ? 'BOXING IN' : 'PURSUIT');
      const want = Math.atan2(dx, dz);
      u.heading = angleLerp(u.heading, want, Math.min(1, dt * 2.6));
      const targetSpeed = Math.min(topSpeed, playerTopSpeed(G) + 2 + wanted);
      u.speed = Math.min(targetSpeed, u.speed + 12 * dt);
      u.pos.x += Math.sin(u.heading) * u.speed * dt;
      u.pos.z += Math.cos(u.heading) * u.speed * dt;
    }
    u.mesh.rotation.y = u.heading;

    // ---- ram on contact ------------------------------------------------------
    if (dist < 3.5 && u.ramCooldown <= 0) {
      u.ramCooldown = 1.0;
      G.player.health = Math.max(0, (G.player.health || 100) - 8);
      if (G.player.mode === 'car') G.driving.speed *= 0.6;
      else G.player.speed = (G.player.speed || 0) * 0.6;
      u.speed *= 0.7;
      u.status = 'RAMMING';
    }
    if (dist < 3) anyBustClose = true;
  }

  // ---- busted: slow + a unit within 3 m for 3 s ------------------------------
  if (wanted >= 1 && pSpeed < 1 && anyBustClose) {
    G.police.bustTimer += dt;
    if (G.police.bustTimer >= 3) {
      G.police.bustTimer = 0;
      G.setMode('dead');
      return;
    }
  } else {
    G.police.bustTimer = 0;
  }

  // ---- wanted decay: every unit > 120 m for 20 s, then -1 per 10 s ----------
  if (wanted > 0 && G.police.units.length > 0 && !anyNear) {
    G.police.decayTimer += dt;
    if (G.police.decayTimer >= 20) {
      setWanted(G, wanted - 1);
      G.police.decayTimer = 10; // next step after 10 more seconds clear
    }
  } else {
    G.police.decayTimer = 0;
  }
}
