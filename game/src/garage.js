// The 3D garage: car upgrades for engine, armor, brakes, nitro and paint.
// The garage view shows the Aurea GT on a turntable with upgrade rows.
import * as THREE from 'three';
import { GARAGE_UPGRADES } from './config.js';
import { makeHeroCar } from './driving.js';

export function createGarage(scene) {
  const group = new THREE.Group();
  group.visible = false;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.4, 24), new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
  floor.position.set(60, 0.2, 120);
  group.add(floor);
  const car = makeHeroCar();
  car.position.set(60, 0.4, 120);
  group.add(car);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 1), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  wall.position.set(60, 4, 108);
  group.add(wall);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.5), new THREE.MeshBasicMaterial({ color: 0xf2a541 }));
  sign.position.set(60, 6.5, 108.6);
  group.add(sign);
  scene.add(group);
  return {
    group, car,
    upgrades: GARAGE_UPGRADES.map((u) => ({ ...u })),
    open: false,
    spin: 0,
  };
}

export function buyUpgrade(state, name) {
  const g = state.garage;
  const u = g.upgrades.find((x) => x.name === name);
  if (!u) return false;
  if (u.level >= u.max) { state.hud.flashNotice(`${name} already maxed`); return false; }
  if (state.money < u.cost) { state.hud.flashNotice(`Need $${u.cost.toLocaleString()} for ${name}`); return false; }
  state.money -= u.cost;
  u.level += 1;
  state.hud.flashNotice(`${name} upgraded to Lv ${u.level} — $${u.cost.toLocaleString()}`);
  state.audio.playPickup();
  return true;
}

export function updateGarage(state, dt) {
  const g = state.garage;
  if (!g.open) return;
  g.spin += dt * 0.5;
  g.car.rotation.y = g.spin;
}

export function toggleGarage(state) {
  const g = state.garage;
  g.open = !g.open;
  g.group.visible = g.open;
  return g.open;
}

export function garageRows(state) {
  return state.garage.upgrades.map((u) =>
    `${u.name} Lv ${u.level}/${u.max} — $${u.cost.toLocaleString()}`).join(' · ');
}
