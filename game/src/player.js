// Wowo on foot: the character figure, movement, and the figure's look.
// Wowo wears an orange jacket, dark trousers and a cap — readable at a glance.
import * as THREE from 'three';
import { TUNING } from './config.js';

export function makeWowoFigure() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xf2a541 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.35), dark);
  legs.position.y = 0.45;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.45), jacket);
  torso.position.y = 1.3;
  g.add(torso);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), jacket);
  armL.position.set(-0.52, 1.3, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), jacket);
  armR.position.set(0.52, 1.3, 0);
  g.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.0;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 12), new THREE.MeshLambertMaterial({ color: 0x1c2f4a }));
  cap.position.y = 2.26;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), new THREE.MeshLambertMaterial({ color: 0x1c2f4a }));
  brim.position.set(0, 2.2, 0.32);
  g.add(brim);
  return g;
}

export function createPlayer(scene) {
  const figure = makeWowoFigure();
  figure.position.set(0, 0, 30);
  scene.add(figure);
  return {
    figure,
    position: figure.position,
    heading: 0,
    health: 100,
    inCar: false,
    onFoot: true,
    jetpack: false,
    altitude: 0,
  };
}

export function updatePlayer(state, input, dt) {
  const p = state.player;
  if (p.inCar || p.jetpack) return;
  const speed = input.sprint() ? TUNING.runSpeed : TUNING.walkSpeed;
  const fwd = (input.forward() ? 1 : 0) - (input.back() ? 1 : 0);
  const strafe = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
  if (fwd === 0 && strafe === 0) return;
  const camYaw = state.cameraYaw || 0;
  const mx = Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
  const mz = Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
  const len = Math.hypot(mx, mz) || 1;
  p.position.x += (mx / len) * speed * dt;
  p.position.z += (mz / len) * speed * dt;
  p.position.x = Math.max(-205, Math.min(205, p.position.x));
  p.position.z = Math.max(-205, Math.min(205, p.position.z));
  p.heading = Math.atan2(mx, mz);
  p.figure.rotation.y = p.heading;
  // Walk bob.
  p.figure.position.y = Math.abs(Math.sin(performance.now() / 130)) * 0.08;
}

export function damagePlayer(state, amount) {
  const p = state.player;
  p.health = Math.max(0, p.health - amount);
  if (p.health <= 0) {
    state.hud.flashNotice('WOWO IS DOWN — press SPACE to get back up');
    p.health = 100;
    p.position.set(0, 0, 30);
  }
}
