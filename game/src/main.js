// Isla Dorada — boot, the one loop, the chase camera, and the mode machine.
// Screens: title, play, map, garage, paused, dead.
// ?seed=N fixes the world. ?shot=chase|title|combat|map (with &seed=N) stages that scene,
// paints it twice and sets window.__shotReady for a screenshot — the simulation stays frozen.
import * as THREE from 'three';
import { GAME, KEYS, MISSIONS, PALETTE, WORLD } from './config.js';
import { Input } from './input.js';
import { mulberry32 } from './random.js';
import { buildCity } from './city.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPlayer, updatePlayer } from './player.js';
import { initDriving, updateDriving, enterCar, exitCar } from './driving.js';
import { initPolice, updatePolice, setWanted } from './police.js';
import { initMissions, updateMissions, startMission } from './missions.js';
import { initCombat, updateCombat } from './combat.js';
import { initHUD, renderHUD, showDialogue, flashToast } from './hud.js';
import { initMinimap, renderMinimap } from './minimap.js';
import { initAudio, updateAudio } from './audio.js';
import { initGarage } from './garage.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { initMap } from './map.js';
import { initTitle, showTitle } from './title.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

// ---------------------------------------------------------------- the game state
const G = {
  three: THREE,
  seed,
  rng: mulberry32(seed),
  mode: 'title',           // title | play | map | garage | paused | dead
  prevMode: 'play',
  shotMode: false,
  time: 0,
  clock: null,
  scene: null,
  camera: null,
  renderer: null,
  city: null,              // city.js: roads, colliders, landmarks, districtAt
  traffic: null,           // traffic.js: cars[], peds[]
  player: null,            // player.js: mode, pos, heading, health, armour, money, mesh
  driving: null,           // driving.js: car, speed
  police: null,            // police.js: wanted, units[], heli
  missions: null,          // missions.js: index, stage, title, objective, timer
  combat: null,            // combat.js: weaponIndex, weapons, enemies[]
  audio: null,             // audio.js: ctx, radioIndex, engine
  garage: null,            // garage.js: upgrades owned
  stats: { carsStolen: 0, escapes: 0, playSeconds: 0, missionsDone: 0, shotsFired: 0 },
  camYaw: 0,
  camPitch: 0.32,
  camDist: 11,
};

function announce(message) {
  statusEl.textContent = message;
}

G.announce = announce;
G.setWanted = (n) => setWanted(G, n);
G.showDialogue = (speaker, text, ms) => showDialogue(G, speaker, text, ms);
G.flashToast = (text) => flashToast(G, text);
G.startMission = (i) => startMission(G, i);
G.enterCar = (car) => enterCar(G, car);
G.exitCar = () => exitCar(G);
G.saveGame = () => saveGame(G);

G.setMode = (mode) => {
  const hud = document.getElementById('hud');
  const show = (id, on) => document.getElementById(id).classList.toggle('hidden', !on);
  G.prevMode = G.mode === 'map' || G.mode === 'garage' ? G.prevMode : G.mode;
  G.mode = mode;
  show('hud', mode === 'play');
  show('title-screen', mode === 'title');
  show('map-screen', mode === 'map');
  show('garage-screen', mode === 'garage');
  show('pause-screen', mode === 'paused');
  show('dead-screen', mode === 'dead');
  if (mode === 'play') Input.unlockPointer();
  if (mode === 'title') showTitle(G);
  announce(`${GAME.shortTitle}. Mode ${mode}.`);
};

// ---------------------------------------------------------------- renderer + sky
function buildRenderer() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return renderer;
}

function buildSky(scene) {
  // Sunset gradient dome + low sun disc, all procedural (no textures, no network).
  const geo = new THREE.SphereGeometry(900, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-820, 120, -260);
  sun.lookAt(0, 60, 0);
  scene.add(sun);
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 900);
}

function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffc890, 0x4a3a5a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 2.2);
  sun.position.set(-260, 190, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -360; sun.shadow.camera.right = 360;
  sun.shadow.camera.top = 360; sun.shadow.camera.bottom = -360;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(sun.target);
}

// ---------------------------------------------------------------- chase camera
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function updateCamera(dt) {
  const p = G.player;
  if (!p) return;
  const target = p.mode === 'car' && G.driving.car ? G.driving.car.mesh.position : p.pos;
  const heading = p.mode === 'car' && G.driving.car ? G.driving.car.heading : p.heading;
  const speed = p.mode === 'car' ? Math.abs(G.driving.speed || 0) : Math.abs(p.speed || 0);
  camTarget.lerp(target, 1 - Math.pow(0.0001, dt));
  const dist = G.camDist + speed * 0.06;
  const pitch = G.camPitch;
  const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
  camPos.copy(camTarget).addScaledVector(back, dist);
  camPos.y = camTarget.y + dist * Math.sin(pitch) + 3.2;
  G.camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
  camLook.copy(camTarget).add(new THREE.Vector3(0, 2.2, 0));
  G.camera.lookAt(camLook);
  G.camera.fov = 62 + Math.min(10, speed * 0.14);
  G.camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- boot
function boot() {
  Input.init(canvas);
  G.clock = new THREE.Clock();
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  G.camera.position.set(-40, 26, 60);
  G.renderer = buildRenderer();
  buildSky(G.scene);
  buildLights(G.scene);

  buildCity(G);
  initTraffic(G);
  initPlayer(G);
  initDriving(G);
  initPolice(G);
  initMissions(G);
  initCombat(G);
  initHUD(G);
  initMinimap(G);
  initAudio(G);
  initGarage(G);
  initMap(G);
  initTitle(G);

  if (hasSave()) {
    document.getElementById('btn-continue').disabled = false;
  } else {
    document.getElementById('btn-continue').disabled = true;
    document.getElementById('btn-continue').textContent = 'CONTINUE — NO SAVE YET';
  }
  G.setMode('title');
}

// ---------------------------------------------------------------- main loop
let accumulator = 0;
let last = performance.now();

function stepPlay(dt) {
  G.time += dt;
  G.stats.playSeconds += dt;
  updatePlayer(G, dt);
  updateDriving(G, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateCombat(G, dt);
  updateAudio(G);
  updateCamera(dt);
  renderHUD(G);
  renderMinimap(G);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (G.shotMode) {
    G.renderer.render(G.scene, G.camera);
    return;
  }
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;

  if (G.mode === 'title') {
    // Slow orbit over the golden island behind the title screen.
    G.time += accumulator;
    const a = G.time * 0.02;
    G.camera.position.set(Math.sin(a) * 260, 110, Math.cos(a) * 260);
    G.camera.lookAt(0, 0, 0);
    accumulator = 0;
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (G.mode === 'play') {
    while (accumulator >= STEP) {
      // One-shot keys are consumed once per frame, not per step.
      stepPlay(STEP);
      accumulator -= STEP;
    }
    handlePlayKeys();
  } else {
    accumulator = 0;
  }
  G.renderer.render(G.scene, G.camera);
}

function handlePlayKeys() {
  if (Input.pressed(KEYS.map)) {
    G.setMode('map');
    return;
  }
  if (Input.pressed(KEYS.garage) && G.city.nearGarage && G.city.nearGarage(G.player.pos)) {
    G.setMode('garage');
    return;
  }
  if (Input.pressed(KEYS.pause)) {
    G.setMode('paused');
  }
}

// Pause / resume / quit buttons (wired once here, not in a module).
document.getElementById('btn-resume').addEventListener('click', () => G.setMode('play'));
document.getElementById('btn-quit-title').addEventListener('click', () => G.setMode('title'));
document.getElementById('btn-respawn').addEventListener('click', () => {
  G.player.health = 100;
  G.player.money = Math.max(0, Math.floor(G.player.money * 0.9));
  setWanted(G, 0);
  G.missions.index = Math.max(0, G.missions.index);
  startMission(G, G.missions.index);
  G.setMode('play');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'play') G.setMode('paused');
});

// ---------------------------------------------------------------- shot staging
function runShot(name) {
  G.shotMode = true;
  stageShot(name, G);
  let painted = 0;
  function paint() {
    G.renderer.render(G.scene, G.camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

boot();
if (shotName) runShot(shotName);
else requestAnimationFrame(frame);
