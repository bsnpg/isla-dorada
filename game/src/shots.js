// The shot staging: the four fixed stagings from the spec, the clock values
// for each shot, the wheel staging, and the shot selector that reads the page
// address and stages the requested shot deterministically.
//
// Shot 1 — chase, MORNING: low close camera, Aurea GT fills ~1/4 frame, BIG
// LOW morning sun with halo + flare, dark front-facing HAWK-1 with searchlight
// (never clipping a building), flipped police cars, fleeing pedestrians, wedge
// wheel with SMG selected, clock 09:48.
// Shot 2 — title, MORNING: big title, six portraits, continue line, clock 10:24.
// Shot 3 — combat, NIGHT: Wowo flying on the jetpack under the moon. The rules
// are: clear sky under his boots (he is raised well above the roof behind him
// and that roof is lowered), flame cone at his boots forming one continuous
// shape, short and fat, never touching the blast; the blast is shrunk and moved
// right and down away from him; full side profile so twin tanks + body + flame
// are one silhouette; he is ~1/5 of the frame height; the moon sits behind his
// head as a halo. MISSION PASSED banner, big bazooka damage number, a fallen
// gunman, police cars in the mid-ground, and the bottom half full of content.
// Shot 4 — map: the dense coloured diagram with the completion ring.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { setWanted } from './police.js';
import { startChaos } from './traffic.js';
import { setJetpack, spawnBlast, selectWeapon } from './combat.js';
import { refreshHud } from './hud.js';

export const SHOT_CLOCKS = {
  1: { hours: 9, minutes: 48, mood: 'morning' },
  2: { hours: 10, minutes: 24, mood: 'morning' },
  3: { hours: 22, minutes: 15, mood: 'night' },
  4: { hours: 10, minutes: 24, mood: 'morning' },
};

export function stageShot(state, num) {
  const shot = SHOT_CLOCKS[num] || SHOT_CLOCKS[1];
  state.clockHours = shot.hours;
  state.clockMinutes = shot.minutes;
  state.hud.hide();
  state.title.hide();
  state.mapScreen.hide();
  document.getElementById('pause-screen').classList.add('hidden');
  if (num === 1) stageChase(state);
  else if (num === 2) stageTitle(state);
  else if (num === 3) stageCombat(state);
  else stageMap(state);
  state.camera.updateProjectionMatrix();
  state.renderer.render(state.scene, state.camera);
  requestAnimationFrame(() => {
    state.renderer.render(state.scene, state.camera);
    window.__shotReady = true;
  });
}

function stageChase(state) {
  const d = state.driving;
  // Hero car on the road, heading toward the big low sun.
  d.hero.position.set(0, 0, 0);
  d.hero.rotation.y = Math.PI;
  d.heading = Math.PI;
  d.speed = TUNING.chaseSpeedKmh / 3.6;
  d.inCar = true;
  state.player.position.copy(d.hero.position);
  state.player.inCar = true;
  // Low, close chase camera: the car fills about a quarter of the frame.
  state.camera.position.set(4.5, 2.4, 11);
  state.camera.lookAt(0, 1.5, -15);
  state.cameraYaw = Math.PI;
  // The big low sun sits dead ahead, low on the horizon.
  state.sky.group.position.x = 150;
  // HAWK-1 dark and front-facing, high above the road, clear of buildings.
  const heli = state.police.heli;
  heli.visible = true;
  heli.position.set(-20, 18, -38);
  heli.lookAt(4.5, 2.4, 11);
  setWanted(state, 3);
  // Two police cars flipped / spinning on the road.
  const u0 = state.police.units[0];
  u0.active = true;
  u0.mesh.visible = true;
  u0.mesh.position.set(-6.5, 1.1, -14);
  u0.mesh.rotation.set(0, 0.6, Math.PI);
  const u1 = state.police.units[1];
  u1.active = true;
  u1.mesh.visible = true;
  u1.mesh.position.set(7.5, 0.9, -30);
  u1.mesh.rotation.set(0.3, -0.9, 2.6);
  const u2 = state.police.units[2];
  u2.active = true;
  u2.mesh.visible = true;
  u2.mesh.position.set(9, 0, -48);
  u2.mesh.lookAt(0, 0, 0);
  // Chaos: pedestrians fleeing in several directions, close to the road.
  startChaos(state, { x: 0, z: 0 });
  const near = state.traffic.peds.slice(0, 10);
  near.forEach((ped, i) => {
    const side = i % 2 ? 1 : -1;
    ped.position.set(side * (5 + (i % 4) * 2.5), Math.abs(Math.sin(i)) * 0.3, -8 - i * 2.2);
    ped.rotation.y = Math.atan2(ped.userData.fleeDir.x, ped.userData.fleeDir.z);
  });
  // Drops and pickups on the road ahead.
  state.drops.drops.slice(0, 4).forEach((drop, i) => {
    drop.mesh.position.set(-4 + i * 2.5, 0.8, -12 - i * 5);
    drop.mesh.visible = true;
  });
  // Dense HUD, wheel with SMG selected, speed 112.
  selectWeapon(state.combat, 2);
  state.hud.show();
  refreshHud(state);
  state.hud.setSpeed(112, 78);
  state.hud.setObjective('JOB 5/8 — Raid the weapons cache · IDPD closing in');
  state.hud.setDialogue('Wowo: "Hold on. The whole IDPD is behind us."');
  state.minimap.draw(state);
}

function stageTitle(state) {
  state.camera.position.set(0, 42, 95);
  state.camera.lookAt(0, 4, -45);
  state.title.show();
  state.sky.group.position.x = 150;
}

function stageCombat(state) {
  // Night mood: swap the sky to night lighting and hide the sun.
  state.sky.setMood('night');
  state.sky.group.position.x = 0;
  // Lower every roof in the cone behind Wowo so a band of sky sits under his boots.
  for (const b of state.city.buildings) {
    if (b.position.z < -35 && b.position.x < 20 && b.position.x > -70) {
      b.scale.y = 0.3;
      b.position.y = (b.geometry.parameters.height * 0.3) / 2;
    }
    // Hide the buildings right by the camera: they would fill the frame as a
    // dark wall and hide the flying figure.
    if (Math.hypot(b.position.x - 0, b.position.z + 16) < 45) b.visible = false;
  }
  // Wowo on the jetpack, full side profile, big in frame (~1/5 frame height),
  // high above the lowered roofs, clear sky under his boots.
  const p = state.player;
  p.position.set(-8, 27, -30);
  p.altitude = 27;
  p.heading = 2.16;
  setJetpack(state, true);
  const g = state.combat.jetpackGroup;
  g.position.set(-8, 27, -30);
  g.rotation.y = 2.16; // side profile: twin tanks + body + flame, one silhouette
  // A warm light on him so he reads bright against the night, not a dark speck,
  // plus a cool rim light from the moon's direction.
  const warm = new THREE.PointLight(0xffc080, 8, 40);
  warm.position.set(-6, 28, -27);
  state.scene.add(warm);
  // Moon behind his head as a halo: on the camera→Wowo ray, far away, lifted
  // just above his head so the disc halos him instead of swallowing him.
  const moon = state.sky.moonMesh;
  if (moon) {
    moon.position.set(-65.6, 13.4, -130.8);
    moon.scale.setScalar(0.85);
    moon.visible = true;
  }
  const rim = new THREE.PointLight(0xdde6ff, 6, 220);
  rim.position.set(-65.6, 13.4, -130.8);
  state.scene.add(rim);
  // Camera close and slightly above him, looking a little down: sky fills the
  // frame behind him and the street shows in the bottom third.
  state.camera.position.set(0, 30, -16);
  state.camera.lookAt(-8, 27, -30);
  state.cameraYaw = Math.PI / 2;
  // The blast: shrunk, moved right and down away from him — never overlapping.
  spawnBlast(state, -1.5, -34.3);
  const blast = state.combat.blasts[state.combat.blasts.length - 1];
  blast.group.scale.setScalar(0.55);
  blast.group.position.set(-1.5, 22.1, -34.3);
  // A fallen gunman on the ground far below him, near the horizon line.
  const gunman = state.combat.enemies[0];
  gunman.alive = false;
  gunman.mesh.rotation.x = -Math.PI / 2;
  gunman.mesh.position.set(-12, 0.4, -80);
  gunman.mesh.visible = true;
  // Police cars with light bars in the mid-ground, real cars not dots.
  const u0 = state.police.units[0];
  u0.active = true; u0.mesh.visible = true;
  u0.mesh.position.set(-18, 0, -70);
  u0.mesh.lookAt(-8, 0, -30);
  const u1 = state.police.units[1];
  u1.active = true; u1.mesh.visible = true;
  u1.mesh.position.set(12, 0, -75);
  u1.mesh.lookAt(-8, 0, -30);
  // Bottom half content: a crate, a pickup, fleeing pedestrians, a police car,
  // and fires on the street — never a big empty field.
  const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
  crate.position.set(16, 1.5, -62);
  state.scene.add(crate);
  state.drops.drops[0].mesh.position.set(-16, 0.8, -65);
  state.drops.drops[0].mesh.visible = true;
  const ped = state.traffic.peds[0];
  ped.position.set(18, 0, -65);
  ped.visible = true;
  const ped2 = state.traffic.peds[1];
  ped2.position.set(-20, 0, -60);
  ped2.visible = true;
  // Fires on the street.
  const fire = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xff7a1e }));
  fire.position.set(14, 1.2, -70);
  state.scene.add(fire);
  const fire2 = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.0, 8), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
  fire2.position.set(-22, 1.0, -78);
  state.scene.add(fire2);
  // HUD: wheel with Bazooka, wanted 4, big damage number, MISSION PASSED.
  setWanted(state, 4);
  selectWeapon(state.combat, 5);
  state.hud.show();
  refreshHud(state);
  state.hud.setObjective('JOB 5/8 — Gudang Senjata · Raid complete');
  // MISSION PASSED banner, pinned on for the shot (the normal auto-hide would
  // fade it before a slow first render is screenshotted).
  const mp = document.getElementById('mission-passed');
  if (mp) {
    mp.innerHTML = '<div class="mp-title">MISSION PASSED</div><div class="mp-name">Gudang Senjata — Weapons Warehouse</div><div class="mp-pay">+$10,000</div>';
    mp.classList.add('show');
  }
  const dmg = document.getElementById('damage-big');
  if (dmg) {
    dmg.textContent = '-300';
    dmg.classList.remove('hidden');
  }
  state.minimap.draw(state);
}

function stageMap(state) {
  state.camera.position.set(0, 120, 120);
  state.camera.lookAt(0, 0, 0);
  state.mapScreen.show();
}
