// Screenshot staging behind ?shot=chase|title|combat|map (with &seed=N).
// Each scene is placed deterministically from the real game state — the same seed
// always gives the same frame — and the simulation stays frozen afterwards, so the
// screenshot is exactly the staged frame. The chase shot guarantees police in frame:
// a roadblock ahead, a unit alongside, and the helicopter overhead.
import { MISSIONS } from './config.js';
import { renderHUD, showDialogue } from './hud.js';
import { renderMinimap } from './minimap.js';
import { setWanted, spawnPoliceCar, spawnHeli } from './police.js';
import { spawnTrafficCar, spawnPed } from './traffic.js';
import { spawnEnemy } from './combat.js';
import { startMission } from './missions.js';
import { makeCar } from './driving.js';
import { drawMap } from './map.js';

// Place the camera in a chase-cam position behind `pos`, facing `heading`.
function placeChaseCamera(G, pos, heading, dist, height) {
  const backX = -Math.sin(heading), backZ = -Math.cos(heading);
  G.camera.position.set(pos.x + backX * dist, pos.y + height, pos.z + backZ * dist);
  G.camera.lookAt(pos.x + Math.sin(heading) * 20, pos.y + 2.2, pos.z + Math.cos(heading) * 20);
  G.camera.fov = 62;
  G.camera.updateProjectionMatrix();
}

function stageChase(G) {
  G.setMode('play');
  const L = G.city.landmarks;
  void L;
  // Player in the gold Aurea GT, northbound ON the Beachfront coastal road (x=-280),
  // beach and sea to the left, city to the right.
  const car = makeCar(G, 'Aurea GT', -280, 60, Math.PI);
  G.player.mode = 'car';
  G.player.pos.set(-280, 0, 60);
  G.player.heading = Math.PI;
  G.driving.car = car;
  G.driving.speed = 38; // ~137 km/h
  G.player.money = 38420;
  G.player.health = 100;
  G.player.armour = 50;

  // IDPD in frame: two units blocking the road ahead, one alongside on the right,
  // heli overhead in the sky ahead.
  setWanted(G, 4);
  const u1 = spawnPoliceCar(G, -280, 30, Math.PI + 0.5);
  const u2 = spawnPoliceCar(G, -276, 22, Math.PI - 0.4);
  const u3 = spawnPoliceCar(G, -272, 46, Math.PI);
  const heli = spawnHeli(G, -280, 20, 24);
  G.police.units = [
    { name: 'UNIT 12', dist: 30, status: 'ROADBLOCK', mesh: u1.mesh },
    { name: 'UNIT 07', dist: 38, status: 'ROADBLOCK', mesh: u2.mesh },
    { name: 'UNIT 23', dist: 14, status: 'RAMMING', mesh: u3.mesh },
    { name: 'HAWK-1', dist: 42, status: 'SEARCHLIGHT', mesh: heli.mesh },
    { name: 'UNIT 31', dist: 210, status: 'PURSUIT', mesh: null },
  ];

  // Traffic ahead on the same road, pedestrians on the beach sidewalk.
  spawnTrafficCar(G, -280, -20, Math.PI, 'Palma Cruiser');
  spawnTrafficCar(G, -280, -70, Math.PI, 'Solano S');
  spawnTrafficCar(G, -280, 130, 0, 'Marina Taxi');
  spawnPed(G, -287, 30);
  spawnPed(G, -287, 10);
  spawnPed(G, -286, 55);

  // Mission 4, stage 2, timer 2:06 — the long Causeway chase.
  startMission(G, 3);
  G.missions.stage = 2;
  G.missions.stageCount = 3;
  G.missions.timer = 126;
  G.missions.objective = 'Deliver the evidence across the Causeway — outrun the IDPD';
  G.combat.weaponIndex = 1; // SMG in the rack
  G.audio.radioIndex = 0;
  showDialogue(G, 'WOWO', 'They will never take me alive. Not on my island.', 60000);
  placeChaseCamera(G, G.player.pos, Math.PI, 8, 3.5);
  renderHUD(G);
  renderMinimap(G);
}

function stageTitle(G) {
  G.setMode('title');
  // Fixed orbit vantage: Casino Row and the beach under the sunset.
  G.camera.position.set(-180, 90, 260);
  G.camera.lookAt(-120, 10, -40);
  G.camera.fov = 58;
  G.camera.updateProjectionMatrix();
  G.renderer.render(G.scene, G.camera);
}

function stageCombat(G) {
  G.setMode('play');
  const w = G.city.landmarks.warehouse;
  G.player.mode = 'foot';
  G.player.pos.set(w.x - 18, 0, w.z + 24);
  G.player.heading = Math.atan2(w.x - G.player.pos.x, w.z - G.player.pos.z);
  G.player.health = 82;
  G.player.armour = 40;
  G.player.money = 12500;
  setWanted(G, 2);
  G.police.units = [
    { name: 'UNIT 07', dist: 120, status: 'PURSUIT', mesh: null },
    { name: 'UNIT 18', dist: 240, status: 'EN ROUTE', mesh: null },
  ];
  startMission(G, 4);
  G.missions.stage = 1;
  G.missions.stageCount = 3;
  G.missions.timer = 0;
  G.combat.weaponIndex = 1;
  G.combat.weapons[1].ammo = 120;
  spawnEnemy(G, w.x - 6, w.z + 6, 'gunman');
  spawnEnemy(G, w.x + 8, w.z - 2, 'gunman');
  spawnEnemy(G, w.x + 2, w.z + 14, 'heavy');
  showDialogue(G, 'WOWO', 'Three of them. The cache is behind that wall. Move.', 60000);
  placeChaseCamera(G, G.player.pos, G.player.heading, 7, 4.5);
  renderHUD(G);
  renderMinimap(G);
}

function stageMap(G) {
  G.stats.carsStolen = 38;
  G.stats.escapes = 13;
  G.stats.playSeconds = 7420;
  G.stats.missionsDone = 5;
  G.player.money = 48250;
  startMission(G, 5);
  G.setMode('map');
  drawMap(G);
}

// Set `G` to the named scene. Any unknown name stages the chase (the cover).
export function stageShot(name, G) {
  if (name === 'title') stageTitle(G);
  else if (name === 'combat') stageCombat(G);
  else if (name === 'map') stageMap(G);
  else stageChase(G);
  void MISSIONS;
}
