// Isla Dorada — cars and arcade driving.
// Car forward is +z at heading 0; mesh.rotation.y = heading everywhere.
import * as THREE from 'three';
import { KEYS, VEHICLES } from './config.js';
import { Input } from './input.js';
import { clamp } from './random.js';

const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.15, metalness: 0.8 });
const lightFrontMat = new THREE.MeshStandardMaterial({ color: 0xfff8dd, emissive: 0xfff2b0, emissiveIntensity: 2.5 });
const lightRearMat = new THREE.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0xff2a2a, emissiveIntensity: 1.8 });
const signMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0xc89000, emissiveIntensity: 0.8 });

export function makeCarMesh(G, def, colorOverride) {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorOverride ?? def.color, roughness: 0.35, metalness: 0.6,
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  if (def.kind === 'pickup') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.3), glassMat);
    cabin.position.set(0, 1.1, -0.9);
    cabin.castShadow = true;
    group.add(cabin);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 1.7), bodyMat);
    bed.position.set(0, 0.95, 1.15);
    group.add(bed);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.2), glassMat);
    cabin.position.set(0, 1.1, -0.2);
    cabin.castShadow = true;
    group.add(cabin);
  }
  if (def.kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), signMat);
    sign.position.set(0, 1.45, -0.2);
    group.add(sign);
  }

  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    wheel.castShadow = true;
    group.add(wheel);
  }
  for (const lx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), lightFrontMat);
    head.position.set(lx, 0.62, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), lightRearMat);
    tail.position.set(lx, 0.62, -2.21);
    group.add(tail);
  }
  return group;
}

export function makeCar(G, defName, x, z, heading) {
  const def = VEHICLES.find((v) => v.name === defName) || VEHICLES[0];
  const mesh = makeCarMesh(G, def);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  return {
    mesh,
    def,
    heading,
    speed: 0,
    health: 100,
    pos: mesh.position,
    name: def.name,
    stolen: false,
    nitroTimer: 0,
    nitroCooldown: 0,
    crashCooldown: 0,
  };
}

export function initDriving(G) {
  G.driving = { car: null, speed: 0, parked: [] };
  // Parked cars around the city, including the gold Aurea GT by the Marina start.
  const spots = [
    ['Aurea GT', -124, 232, Math.PI],
    ['Solano S', 36, 116, 0],
    ['Palma Cruiser', -116, -193, Math.PI / 2],
    ['Faro Pickup', 116, 236, 0],
    ['Cayo Coupe', 44, -196, Math.PI / 2],
    ['Marina Taxi', -116, 44, 0],
  ];
  for (const [name, x, z, h] of spots) {
    G.driving.parked.push(makeCar(G, name, x, z, h));
  }
}

export function enterCar(G, car) {
  if (!car) return;
  const pi = G.driving.parked.indexOf(car);
  if (pi >= 0) G.driving.parked.splice(pi, 1);
  if (G.traffic && G.traffic.cars) {
    const ti = G.traffic.cars.indexOf(car);
    if (ti >= 0) G.traffic.cars.splice(ti, 1);
  }
  car.stolen = true;
  G.player.mode = 'car';
  G.player.heading = car.heading;
  G.player.mesh.visible = false;
  G.player.pos.copy(car.mesh.position);
  G.player.vehicle = car;
  G.driving.car = car;
  G.driving.speed = car.speed || 0;
}

export function exitCar(G) {
  const car = G.driving.car;
  if (!car) return;
  const h = car.heading;
  // Step out on the right side of the car.
  const rx = -Math.cos(h), rz = Math.sin(h);
  G.player.pos.set(car.mesh.position.x + rx * 2.5, 0, car.mesh.position.z + rz * 2.5);
  G.player.heading = h;
  G.player.mode = 'foot';
  G.player.mesh.visible = true;
  G.player.mesh.rotation.y = h;
  G.player.vehicle = null;
  car.speed = 0;
  G.driving.car = null;
  G.driving.speed = 0;
  if (!G.driving.parked.includes(car)) G.driving.parked.push(car);
}

export function updateDriving(G, dt) {
  const car = G.driving.car;
  if (!car || G.player.mode !== 'car') return;
  const def = car.def;
  const owned = (G.garage && G.garage.owned) || {};
  const topSpeed = def.topSpeed * (1 + 0.25 * (owned.engine || 0));
  const brakeMul = 1 + 0.15 * (owned.brakes || 0);
  car.nitroCooldown = Math.max(0, car.nitroCooldown - dt);
  car.nitroTimer = Math.max(0, car.nitroTimer - dt);
  car.crashCooldown = Math.max(0, car.crashCooldown - dt);

  const fwd = Input.down(...KEYS.forward);
  const back = Input.down(...KEYS.back);
  const handbrake = Input.down(KEYS.handbrake);
  const steer = (Input.down(...KEYS.right) ? 1 : 0) - (Input.down(...KEYS.left) ? 1 : 0);

  let accel = 0;
  if (fwd) accel += def.accel;
  if (back) {
    if (car.speed > 0.5) accel -= def.accel * 1.4 * brakeMul; // braking
    else accel -= def.accel * 0.6; // reverse
  }
  if (car.nitroTimer > 0) accel += def.accel * 1.6;
  if (Input.down(KEYS.nitro) && (owned.nitro || 0) > 0 && car.nitroCooldown <= 0 && car.speed > 1) {
    car.nitroTimer = 1.5;
    car.nitroCooldown = 4.5;
  }
  car.speed += accel * dt;
  car.speed -= car.speed * 0.35 * dt; // drag
  if (!fwd && !back) car.speed -= car.speed * 0.6 * dt; // coast-down
  if (handbrake) car.speed -= car.speed * 2.5 * dt;
  const maxFwd = car.nitroTimer > 0 ? topSpeed * 1.45 : topSpeed;
  car.speed = clamp(car.speed, -12, maxFwd);
  if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;

  // Steering scales with speed; stronger with the handbrake, reversed in reverse.
  const spdF = clamp(Math.abs(car.speed) / 12, 0, 1);
  const steerRate = 2.3 * (handbrake ? 1.6 : 1) * (1 + 0.1 * (owned.brakes || 0));
  car.heading += steer * steerRate * spdF * dt * Math.sign(car.speed || 1);

  car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
  car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;

  // Building / palm colliders: circle push-out, speed halved, damage on hard hits.
  if (G.city) {
    for (const c of G.city.colliders) {
      const dx = car.mesh.position.x - c.x;
      const dz = car.mesh.position.z - c.z;
      const r = c.r + 1.3;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const impact = Math.abs(car.speed);
        car.mesh.position.x = c.x + (dx / d) * r;
        car.mesh.position.z = c.z + (dz / d) * r;
        if (impact > 4 && car.crashCooldown <= 0) {
          car.health -= 5;
          car.crashCooldown = 0.5;
        }
        car.speed *= 0.5;
      }
    }
  }

  // Traffic cars: simple push-apart, both slow down.
  if (G.traffic) {
    for (const t of G.traffic.cars) {
      const dx = car.mesh.position.x - t.mesh.position.x;
      const dz = car.mesh.position.z - t.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 3.4 * 3.4 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (3.4 - d) / 2;
        const nx = dx / d, nz = dz / d;
        car.mesh.position.x += nx * push;
        car.mesh.position.z += nz * push;
        t.kickX = (t.kickX || 0) - nx * push;
        t.kickZ = (t.kickZ || 0) - nz * push;
        if (Math.abs(car.speed) > 5 && car.crashCooldown <= 0) {
          car.health -= 3;
          car.crashCooldown = 0.4;
        }
        car.speed *= 0.7;
        t.speed *= 0.6;
      }
    }
  }

  car.mesh.position.x = clamp(car.mesh.position.x, -318, 318);
  car.mesh.position.z = clamp(car.mesh.position.z, -318, 318);
  car.mesh.rotation.y = car.heading;

  // Wrecked: no drive, E steps out.
  if (car.health <= 0) {
    car.health = 0;
    car.speed = 0;
    if (Input.pressed(KEYS.interact)) exitCar(G);
  }

  G.player.pos.copy(car.mesh.position);
  G.player.heading = car.heading;
  G.player.speed = car.speed;
  G.driving.speed = car.speed;
}
