// Traffic cars on the roads and pedestrians on the sidewalks, including the
// fleeing-pedestrian chaos that starts when a chase starts: many people running
// away in several directions, not standing still.
import * as THREE from 'three';
import { range, pick, chance } from './random.js';

const CAR_COLORS = [0xd94f3d, 0x3fa7d6, 0xf2c94c, 0x5da85d, 0xe8e8e8, 0x8e6cc8, 0x2e3a4a, 0xe5539e];
const PED_COLORS = [0xf2a541, 0x3fa7d6, 0xe5539e, 0x5da85d, 0xe8e0d0, 0xd98e4a, 0x8e6cc8, 0x7fb069];
const ROADS = [-180, -120, -60, 0, 60, 120, 180];

export function makeCarMesh(color, police = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0x1c2f4a : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: 0x22303f }));
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [x, z] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    bar.position.set(0, 1.6, -0.2);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0x2e7fff }));
    bar2.position.set(0.8, 1.6, -0.2);
    g.add(bar2);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    door.position.set(1.06, 0.6, 0);
    door.rotation.y = Math.PI / 2;
    g.add(door);
  }
  return g;
}

export function makePedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.1, 8), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.75;
  g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x2e3a4a }));
  legs.position.y = 0.25;
  g.add(legs);
  return g;
}

export function createTraffic(scene, rng) {
  const cars = [];
  const peds = [];
  for (let i = 0; i < 16; i++) {
    const horizontal = chance(rng, 0.5);
    const road = pick(rng, ROADS);
    const lane = range(rng, -3, 3);
    const car = makeCarMesh(pick(rng, CAR_COLORS));
    car.position.set(horizontal ? range(rng, -190, 190) : road + lane, 0, horizontal ? road + lane : range(rng, -190, 190));
    car.rotation.y = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI);
    car.userData = { horizontal, road, lane, speed: range(rng, 8, 16) * (chance(rng, 0.5) ? 1 : -1), baseSpeed: 12 };
    scene.add(car);
    cars.push(car);
  }
  for (let i = 0; i < 34; i++) {
    const ped = makePedMesh(pick(rng, PED_COLORS));
    const road = pick(rng, ROADS);
    const horizontal = chance(rng, 0.5);
    ped.position.set(horizontal ? range(rng, -190, 190) : road + range(rng, 9, 12) * (chance(rng, 0.5) ? 1 : -1), 0, horizontal ? road + range(rng, 9, 12) * (chance(rng, 0.5) ? 1 : -1) : range(rng, -190, 190));
    ped.userData = { walkDir: chance(rng, 0.5) ? 1 : -1, horizontal, speed: range(rng, 1.2, 2.4), fleeing: false, fleeDir: { x: 0, z: 0 } };
    scene.add(ped);
    peds.push(ped);
  }
  return { cars, peds };
}

export function updateTraffic(state, dt) {
  for (const car of state.traffic.cars) {
    const u = car.userData;
    if (u.horizontal) {
      car.position.x += u.speed * dt;
      if (car.position.x > 205) car.position.x = -205;
      if (car.position.x < -205) car.position.x = 205;
    } else {
      car.position.z += u.speed * dt;
      if (car.position.z > 205) car.position.z = -205;
      if (car.position.z < -205) car.position.z = 205;
    }
  }
  for (const ped of state.traffic.peds) {
    const u = ped.userData;
    if (u.fleeing) {
      ped.position.x += u.fleeDir.x * 6.5 * dt;
      ped.position.z += u.fleeDir.z * 6.5 * dt;
      ped.position.y = Math.abs(Math.sin(performance.now() / 90 + ped.position.x)) * 0.25;
      if (Math.abs(ped.position.x) > 205) ped.position.x = -Math.sign(ped.position.x) * 205;
      if (Math.abs(ped.position.z) > 205) ped.position.z = -Math.sign(ped.position.z) * 205;
      continue;
    }
    if (u.horizontal) {
      ped.position.x += u.walkDir * u.speed * dt;
      if (ped.position.x > 200) ped.position.x = -200;
      if (ped.position.x < -200) ped.position.x = 200;
    } else {
      ped.position.z += u.walkDir * u.speed * dt;
      if (ped.position.z > 200) ped.position.z = -200;
      if (ped.position.z < -200) ped.position.z = 200;
    }
  }
}

// The chaos effect: every pedestrian near the chase runs away in a random
// direction. Called when a chase starts and in the chase shot staging.
export function startChaos(state, centre) {
  for (const ped of state.traffic.peds) {
    const dx = ped.position.x - centre.x;
    const dz = ped.position.z - centre.z;
    const len = Math.hypot(dx, dz) || 1;
    const jitter = (Math.random() - 0.5) * 1.2;
    const ang = Math.atan2(dz, dx) + jitter;
    ped.userData.fleeing = true;
    ped.userData.fleeDir = { x: Math.cos(ang), z: Math.sin(ang) };
  }
}
