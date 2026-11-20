// Combat on foot: the six weapons, aiming and shooting, the jetpack with its
// tanks and flame and light, the bazooka with its rocket and blast, enemies
// that fall, damage numbers and explosions.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { makeWowoFigure } from './player.js';

export function createCombat(scene) {
  const enemies = [];
  for (let i = 0; i < 5; i++) {
    const e = makeWowoFigure();
    e.children.forEach((c) => { if (c.material) c.material = c.material.clone(); });
    e.traverse((c) => { if (c.isMesh) c.material.color?.set(0x5b7fa6); });
    e.position.set(-14 + i * 7, 0, -30 - i * 4);
    scene.add(e);
    enemies.push({ mesh: e, health: 100, alive: true, x: e.position.x, z: e.position.z });
  }
  return {
    enemies,
    weaponIndex: 2, // SMG
    jetpackOn: false,
    jetpackGroup: null,
    flame: null,
    rockets: [],
    blasts: [],
    damageNumbers: [],
    lastShotAt: 0,
  };
}

export function currentWeapon(combat) {
  return WEAPONS[combat.weaponIndex];
}

export function selectWeapon(combat, index) {
  if (index >= 0 && index < WEAPONS.length) combat.weaponIndex = index;
}

// The jetpack: twin tanks on Wowo's back, a flame cone under his boots, a warm
// light on him. Built as one group so the silhouette reads as one shape.
export function buildJetpack(state) {
  const c = state.combat;
  if (c.jetpackGroup) return c.jetpackGroup;
  const g = new THREE.Group();
  const tankMat = new THREE.MeshLambertMaterial({ color: 0xc9ced6 });
  for (const x of [-0.28, 0.28]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10), tankMat);
    tank.position.set(x, 1.35, -0.32);
    g.add(tank);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe5534b }));
    cap.position.set(x, 1.82, -0.32);
    g.add(cap);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.12), new THREE.MeshLambertMaterial({ color: 0x2e3a4a }));
  frame.position.set(0, 1.0, -0.32);
  g.add(frame);
  // Flame cone: short and fat, attached at the boots, one continuous shape.
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.5, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.95 }),
  );
  flame.rotation.x = Math.PI;
  flame.position.set(0, -0.75, 0);
  g.add(flame);
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.9, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  inner.rotation.x = Math.PI;
  inner.position.set(0, -0.45, 0);
  g.add(inner);
  const light = new THREE.PointLight(0xffa020, 3.5, 14);
  light.position.set(0, -0.5, 0.5);
  g.add(light);
  // Smoke puffs below the flame.
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 + i * 0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.55 - i * 0.12 }));
    puff.position.set((i % 2 ? 0.12 : -0.12), -1.7 - i * 0.45, 0);
    g.add(puff);
  }
  c.jetpackGroup = g;
  c.flame = flame;
  return g;
}

export function setJetpack(state, on) {
  const p = state.player;
  const c = state.combat;
  c.jetpackOn = on;
  p.jetpack = on;
  if (on) {
    const g = buildJetpack(state);
    g.position.copy(p.figure.position);
    g.position.y = p.altitude;
    state.scene.add(g);
    // The figure rides the jetpack group: the figure goes inside the group so
    // tanks + body + flame are one silhouette, and stays visible.
    p.figure.visible = true;
    g.add(p.figure);
    p.figure.position.set(0, 0, 0);
  } else if (c.jetpackGroup) {
    state.scene.add(p.figure);
    p.figure.position.copy(c.jetpackGroup.position);
    p.figure.position.y = 0;
    p.figure.visible = true;
    state.scene.remove(c.jetpackGroup);
    c.jetpackGroup = null;
  }
}

export function updateJetpack(state, input, dt) {
  const p = state.player;
  const c = state.combat;
  if (!c.jetpackOn || !c.jetpackGroup) return;
  const g = c.jetpackGroup;
  if (input.forward()) p.altitude += 4 * dt;
  if (input.back()) p.altitude -= 4 * dt;
  p.altitude = Math.max(2, Math.min(60, p.altitude));
  const speed = 10;
  g.position.x += Math.sin(p.heading) * (input.sprint() ? speed * 1.6 : speed * 0.4) * dt;
  g.position.z += Math.cos(p.heading) * (input.sprint() ? speed * 1.6 : speed * 0.4) * dt;
  g.position.y = p.altitude;
  g.rotation.y = p.heading;
  // Flame flicker.
  const s = 1 + Math.sin(performance.now() / 60) * 0.12;
  c.flame.scale.set(s, 1 + Math.sin(performance.now() / 45) * 0.18, s);
  p.position.copy(g.position);
}

// Fire the current weapon. Returns a damage number event for the HUD.
export function fireWeapon(state) {
  const c = state.combat;
  const w = currentWeapon(c);
  const now = performance.now();
  if (now - c.lastShotAt < (w.melee ? 350 : 140)) return null;
  c.lastShotAt = now;
  const p = state.player.position;
  let target = null;
  let bestD = 60;
  for (const e of c.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bestD) { bestD = d; target = e; }
  }
  if (!target) {
    state.hud.flashNotice(`${w.name} — no target in range`);
    return null;
  }
  if (w.name === 'Bazooka') {
    spawnBlast(state, target.x, target.z);
    target.health -= w.damage;
  } else {
    target.health -= w.damage;
  }
  const dmg = { x: target.x, z: target.z, text: `-${w.damage}`, color: w.name === 'Bazooka' ? '#ff5a3c' : '#ffd34d', born: now };
  c.damageNumbers.push(dmg);
  if (target.health <= 0) {
    target.alive = false;
    target.mesh.rotation.x = -Math.PI / 2;
    target.mesh.position.y = 0.4;
    state.hud.flashNotice('ENEMY DOWN +$250');
    state.money += 250;
    state.rep += 15;
  }
  state.audio.playShot(w.name);
  return dmg;
}

// A bazooka blast: one orange sphere + light, shrunk and placed at the target,
// never on top of the shooter.
export function spawnBlast(state, x, z) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.95 }));
  ball.position.y = 1.2;
  g.add(ball);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  core.position.y = 1.2;
  g.add(core);
  const light = new THREE.PointLight(0xff7a1e, 3, 22);
  light.position.y = 2;
  g.add(light);
  g.position.set(x, 0, z);
  state.scene.add(g);
  state.combat.blasts.push({ group: g, born: performance.now() });
  state.audio.playExplosion();
}

export function updateCombat(state, dt) {
  const now = performance.now();
  const c = state.combat;
  for (let i = c.blasts.length - 1; i >= 0; i--) {
    const b = c.blasts[i];
    const age = (now - b.born) / 1000;
    b.group.scale.setScalar(1 + age * 1.4);
    b.group.children[0].material.opacity = Math.max(0, 0.95 - age * 1.1);
    if (age > 0.9) {
      state.scene.remove(b.group);
      c.blasts.splice(i, 1);
    }
  }
  for (let i = c.damageNumbers.length - 1; i >= 0; i--) {
    if (now - c.damageNumbers[i].born > 1200) c.damageNumbers.splice(i, 1);
  }
}
