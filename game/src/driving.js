// Driving: the hero car and traffic cars, nitro boost, handbrake turns,
// collisions, stealing a car, entering and exiting cars.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { makeCarMesh } from './traffic.js';

export function makeHeroCar() {
  // The Aurea GT: a low orange sports car, hero-size and detailed.
  const g = makeCarMesh(0xf2641e);
  g.scale.set(1.35, 1, 1.35);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.4), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
  spoiler.position.set(0, 1.0, -2.1);
  g.add(spoiler);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 4.4), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
  stripe.position.set(0, 0.92, 0);
  g.add(stripe);
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.15), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  headlight.position.set(0, 0.6, 2.25);
  g.add(headlight);
  return g;
}

export function createDriving(scene) {
  const hero = makeHeroCar();
  hero.position.set(0, 0, 38);
  scene.add(hero);
  const parked = [];
  for (const [x, z, color] of [[-8, 40, 0x3fa7d6], [10, -20, 0xf2c94c], [-30, -80, 0x5da85d], [24, 90, 0xe5539e]]) {
    const c = makeCarMesh(color);
    c.position.set(x, 0, z);
    c.rotation.y = Math.PI / 2;
    c.userData.parked = true;
    scene.add(c);
    parked.push(c);
  }
  return {
    hero, parked,
    speed: 0, // m/s
    heading: 0,
    nitro: 100,
    inCar: false,
    nearestParked: null,
  };
}

export function speedKmh(driving) {
  return Math.round(Math.abs(driving.speed) * 3.6);
}

export function updateDriving(state, input, dt) {
  const d = state.driving;
  if (!d.inCar) return;
  const boost = input.sprint() && d.nitro > 0 ? TUNING.nitroBoost : 1;
  if (input.sprint() && input.forward()) d.nitro = Math.max(0, d.nitro - 22 * dt);
  else d.nitro = Math.min(100, d.nitro + 6 * dt);
  if (input.forward()) d.speed += TUNING.carAccel * boost * dt;
  else if (input.back()) d.speed -= TUNING.carBrake * dt;
  else d.speed *= Math.max(0, 1 - 0.8 * dt);
  const top = (TUNING.topSpeedKmh / 3.6) * boost;
  d.speed = Math.max(-12, Math.min(top, d.speed));
  const steer = (input.left() ? 1 : 0) - (input.right() ? 1 : 0);
  const turnRate = TUNING.carTurn * (d.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(d.speed) / 12);
  d.heading += steer * turnRate * dt * (input.back() && !input.forward() ? -1 : 1);
  // Handbrake turn: sharp yaw while slowing.
  if (input.sprint() && steer !== 0 && Math.abs(d.speed) > 8) {
    d.heading += steer * 1.6 * dt;
    d.speed *= Math.max(0, 1 - 1.4 * dt);
  }
  d.hero.position.x += Math.sin(d.heading) * d.speed * dt;
  d.hero.position.z += Math.cos(d.heading) * d.speed * dt;
  d.hero.rotation.y = d.heading;
  d.hero.position.x = Math.max(-205, Math.min(205, d.hero.position.x));
  d.hero.position.z = Math.max(-205, Math.min(205, d.hero.position.z));
  // Soft collision with traffic cars: bounce and slow.
  for (const car of state.traffic.cars) {
    const dx = car.position.x - d.hero.position.x;
    const dz = car.position.z - d.hero.position.z;
    if (Math.abs(dx) < 3 && Math.abs(dz) < 3.5 && Math.abs(d.speed) > 2) {
      d.speed *= -0.25;
      state.hud.flashNotice('CRASH — watch the traffic!');
    }
  }
  state.player.position.copy(d.hero.position);
  state.player.heading = d.heading;
}

export function nearestStealable(state) {
  const p = state.player.position;
  let best = null;
  let bestD = 6;
  for (const car of state.driving.parked) {
    if (!car.visible) continue;
    const dist = Math.hypot(car.position.x - p.x, car.position.z - p.z);
    if (dist < bestD) { bestD = dist; best = car; }
  }
  const heroDist = Math.hypot(state.driving.hero.position.x - p.x, state.driving.hero.position.z - p.z);
  if (heroDist < bestD) return state.driving.hero;
  return best;
}

export function enterCar(state, car) {
  const isHero = car === state.driving.hero;
  state.driving.inCar = true;
  state.driving.hero = car;
  state.player.inCar = true;
  if (!isHero) {
    // Stealing a parked car raises the wanted level.
    state.police.wanted = Math.max(state.police.wanted, 1);
  }
  state.hud.flashNotice(isHero ? 'AUREA GT — yours to drive' : 'Car stolen — IDPD alerted!');
}

export function exitCar(state) {
  state.driving.inCar = false;
  state.player.inCar = false;
  state.player.position.set(
    state.driving.hero.position.x + 3,
    0,
    state.driving.hero.position.z + 2,
  );
}
