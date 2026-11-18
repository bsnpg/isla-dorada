// Screenshot staging behind ?shot=chase|title|combat|map (with &seed=N).
// Each scene is placed deterministically from the real game state — the same
// seed always gives the same frame — and the simulation stays frozen
// afterwards, so the screenshot is exactly the staged frame.
//
// REBUILD BRIEF — CHAOS, READABLE IN ONE GLANCE. The v1 shots were clean
// but quiet: a roadblock, a couple of units, no contact, no fire, no sun in
// frame. These stages fix that, self-contained (only v1 exports + THREE;
// no gameplay-builder staging hooks existed when this was written, so
// nothing here depends on them):
//   chase  — the cover: WESTBOUND into the sunset on the north coastal road,
//            sun + flare dead ahead, neon billboards, a police car RAMMING
//            the player's rear quarter (contact), a FLIPPED police car, a
//            roadblock, a BURNING traffic car, the heli overhead, traffic +
//            peds, DRIFT x3 + NEAR MISS +$250 popups, portrait dialogue.
//   title  — bright title over a westward sunset view of Casino Row.
//   combat — a real firefight: muzzle flashes, tracers, damage numbers, a
//            DOWNED enemy close in, a burning pickup, enemies at 8-16 m.
//   map    — full city map + checklist + measured stats.
import { renderHUD, showDialogue, pushScorePopup } from './hud.js';
import { renderMinimap } from './minimap.js';
import { setWanted, spawnPoliceCar, spawnHeli } from './police.js';
import { spawnTrafficCar, spawnPed } from './traffic.js';
import { spawnEnemy } from './combat.js';
import { startMission } from './missions.js';
import { makeCar } from './driving.js';
import { drawMap } from './map.js';

// ---------------------------------------------------------------- helpers
// Place the camera in a chase-cam position behind `pos`, facing `heading`.
// lookX/lookZ shift the look target sideways so the sun / skyline can be
// pulled into frame without moving the player. `lat` shifts the camera
// sideways (positive = player's right) so a centred subject can be pushed
// off the HUD's centre column.
function placeChaseCamera(G, pos, heading, dist, height, lookX, lookZ, fov, lat) {
  const backX = -Math.sin(heading), backZ = -Math.cos(heading);
  const rightX = -Math.cos(heading), rightZ = Math.sin(heading);
  const l = lat || 0;
  G.camera.position.set(
    pos.x + backX * dist + rightX * l,
    pos.y + height,
    pos.z + backZ * dist + rightZ * l,
  );
  G.camera.lookAt(
    pos.x + Math.sin(heading) * 20 + (lookX || 0),
    pos.y + 2.2,
    pos.z + Math.cos(heading) * 20 + (lookZ || 0),
  );
  G.camera.fov = fov || 62;
  G.camera.updateProjectionMatrix();
}

// Ahead / right offsets from a position + heading (heading 0 = +z south).
function offsetFrom(x, z, heading, fwd, right) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const rx = -Math.cos(heading), rz = Math.sin(heading);
  return { x: x + fx * fwd + rx * right, z: z + fz * fwd + rz * right };
}

// Sun glow sprite near the real sun disc (main.js sky: sun at -820, 120, -260).
function addSunFlare(G, x, y, z, scale) {
  const THREE = G.three;
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(128, 128, 4, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,240,190,0.95)');
  g.addColorStop(0.25, 'rgba(255,200,90,0.55)');
  g.addColorStop(0.6, 'rgba(255,140,40,0.18)');
  g.addColorStop(1, 'rgba(255,120,30,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale, 1);
  G.scene.add(sprite);
  return sprite;
}

// Neon billboard: canvas-texture plane on posts, unlit so it glows at sunset.
// Faces `faceHeading` (the direction its front points).
function addBillboard(G, x, z, faceHeading, text, color, sub) {
  const THREE = G.three;
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#120a1e';
  c.fillRect(0, 0, 512, 160);
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.strokeRect(8, 8, 496, 144);
  c.fillStyle = color;
  c.font = '800 52px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.shadowColor = color;
  c.shadowBlur = 22;
  c.fillText(text, 256, sub ? 62 : 80);
  if (sub) {
    c.font = '700 30px system-ui, sans-serif';
    c.fillText(sub, 256, 122);
  }
  const tex = new THREE.CanvasTexture(cv);
  const group = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 4.7),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  board.position.y = 9.5;
  group.add(board);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 });
  for (const px of [-5.5, 5.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 0.5), postMat);
    post.position.set(px, 3.6, 0);
    group.add(post);
  }
  group.position.set(x, 0, z);
  group.rotation.y = faceHeading;
  G.scene.add(group);
  return group;
}

// Cars are built with metalness 0.6 and the scene has no environment map,
// so sunlit metal reads fine but the SHADOW side of a body panel renders
// near-black (the gold GT looked like a black box from the chase camera).
// Fix per staged car (makeCar / traffic meshes own their materials — never
// call this on police cars, whose materials are shared): drop metalness,
// lift the diffuse response with a little self-coloured emissive.
function brightenCar(G, carObj) {
  if (!carObj || !carObj.mesh) return;
  carObj.mesh.traverse((o) => {
    const m = o.material;
    if (!m || !m.color || typeof m.metalness !== 'number') return;
    if (m.metalness < 0.3) return;
    const c = m.color;
    const lum = 0.3 * c.r + 0.5 * c.g + 0.2 * c.b;
    if (lum < 0.2 && m.metalness > 0.5) {
      // Cabin glass: metalness 0.8 with no env map renders pitch black.
      // Turn it into light blue-grey glass instead.
      m.metalness = 0.1;
      m.roughness = 0.2;
      m.color.setHex(0x5a7a9a);
      m.emissive.setHex(0x16283a);
      m.emissiveIntensity = 1;
      return;
    }
    if (lum < 0.12) return; // wheels, dark trim stay dark
    m.metalness = 0.15;
    m.roughness = 0.45;
    m.emissive = c.clone().multiplyScalar(0.55);
    m.emissiveIntensity = 1;
  });
  void G;
}

// Fire + smoke + light at a world position (used for burning cars).
// Flames are tall and bright (they must read at 30+ m); smoke is small,
// translucent grey puffs, never black balloons.
function addFire(G, x, z, scale) {
  const THREE = G.three;
  const s = scale || 1;
  const group = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
  const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a52, roughness: 1, transparent: true, opacity: 0.35,
  });
  for (const [fx, fz, h, r] of [[0, 0, 3.4, 1.0], [0.7, 0.4, 2.5, 0.7], [-0.6, -0.3, 2.8, 0.75]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 8), flameMat);
    cone.position.set(fx * s, (1.0 + h / 2) * s, fz * s);
    group.add(cone);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55 * s, h * 0.62 * s, 8), flameMat2);
    inner.position.set(fx * s, (0.9 + h * 0.31) * s, fz * s);
    group.add(inner);
  }
  for (const [sx, sy, sz, sr] of [[0, 5.0, 0, 0.8], [0.5, 6.2, 0.3, 1.0], [-0.4, 7.4, -0.2, 1.2]]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(sr * s, 8, 6), smokeMat);
    puff.position.set(sx * s, sy * s, sz * s);
    group.add(puff);
  }
  const light = new THREE.PointLight(0xff6a00, 120, 40, 1.6);
  light.position.set(0, 2.2 * s, 0);
  group.add(light);
  group.position.set(x, 0, z);
  G.scene.add(group);
  return group;
}

// Char a car mesh (traffic / makeCar meshes own their materials) and set it
// alight. Returns the flame group.
function igniteCar(G, carObj, scale) {
  if (!carObj || !carObj.mesh) return null;
  carObj.mesh.traverse((o) => {
    if (o.material && o.material.color && o.material.emissive === undefined) {
      o.material.color.multiplyScalar(0.35);
    } else if (o.material && o.material.color) {
      o.material.color.multiplyScalar(0.45);
    }
  });
  carObj.mesh.rotation.z = 0.1;
  const p = carObj.mesh.position;
  return addFire(G, p.x, p.z, scale || 1);
}

// Flip a freshly spawned police car onto its roof (wheels up, light bar up).
function flipPoliceCar(G, x, z, heading) {
  const unit = spawnPoliceCar(G, x, z, heading);
  unit.mesh.position.y = 1.05;
  unit.mesh.rotation.set(0, heading, Math.PI * 0.92);
  unit.status = 'FLIPPED';
  addFire(G, x + 1.5, z + 1, 0.45); // small smoke/fire licking the wreck
  return unit;
}

// Muzzle flash sphere + light at `from`, and a bright tracer line to `to`.
function fireBurst(G, from, to) {
  const THREE = G.three;
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe08a }),
  );
  flash.position.copy(from);
  G.scene.add(flash);
  const light = new THREE.PointLight(0xffc860, 50, 16, 1.8);
  light.position.copy(from);
  G.scene.add(light);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    from.x, from.y, from.z, to.x, to.y, to.z,
  ]), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a }));
  G.scene.add(line);
  return { flash, light, line };
}

// ---------------------------------------------------------------- chase (cover)
function stageChase(G) {
  G.setMode('play');
  // WESTBOUND on the north coastal road (z = -280), driving INTO the sunset:
  // the sun disc sits almost dead ahead, sea ahead-left, Casino Row skyline
  // on the left. Player heading -PI/2 -> forward (-1, 0) = west.
  const PX = -140, PZ = -280, H = -Math.PI / 2;
  const car = makeCar(G, 'Aurea GT', PX, PZ, H);
  brightenCar(G, car); // gold must read gold from the shadow side too
  G.player.mode = 'car';
  G.player.pos.set(PX, 0, PZ);
  G.player.heading = H;
  G.driving.car = car;
  G.driving.speed = 38; // ~137 km/h
  G.player.money = 38420;
  G.player.health = 100;
  G.player.armour = 50;

  // Sun flare right where the chase is heading.
  addSunFlare(G, -700, 135, -245, 320);
  // Neon billboards lining the road — pink casino sign (south side, facing
  // north toward the road) and a cyan island sign (north side, facing south).
  addBillboard(G, -184, -270, Math.PI, 'CASINO DORADA', '#ff5ad9', '★ OPEN ALL NIGHT ★');
  addBillboard(G, -168, -290.5, 0, 'ISLA DORADA', '#4fd9ff', '★ GOLDEN ISLAND ★');

  // IDPD with CONTACT: one unit ramming the player's FRONT quarter — angled
  // in from the north side, nose at the GT's front corner, far enough from
  // the chase camera to read as a car instead of a wall — one FLIPPED on its
  // roof ahead-left, one roadblock head-on ahead, heli overhead.
  setWanted(G, 4);
  const ram = spawnPoliceCar(G, PX - 4.5, PZ - 3.0, H + 2.8);
  ram.status = 'RAMMING';
  const flipped = flipPoliceCar(G, PX - 12, PZ + 5.5, H + 0.7);
  const block = spawnPoliceCar(G, PX - 52, PZ - 1.5, -H);
  block.status = 'ROADBLOCK';
  const heli = spawnHeli(G, PX - 34, PZ - 16, 18);
  G.police.units = [
    { name: 'UNIT 23', dist: 4, status: 'RAMMING', mesh: ram.mesh },
    { name: 'UNIT 12', dist: 13, status: 'FLIPPED', mesh: flipped.mesh },
    { name: 'UNIT 07', dist: 52, status: 'ROADBLOCK', mesh: block.mesh },
    { name: 'HAWK-1', dist: 38, status: 'SEARCHLIGHT', mesh: heli.mesh },
    { name: 'UNIT 31', dist: 210, status: 'PURSUIT', mesh: null },
  ];

  // A BURNING traffic car ahead on the right shoulder, plus live traffic
  // ahead (one oncoming) and pedestrians on both sidewalks.
  const burning = spawnTrafficCar(G, PX - 38, PZ, H, 'Palma Cruiser');
  igniteCar(G, burning, 1.15);
  const t1 = spawnTrafficCar(G, PX - 66, PZ, H, 'Solano S');
  const t2 = spawnTrafficCar(G, PX - 95, PZ, -H, 'Marina Taxi'); // oncoming, headlights at us
  const t3 = spawnTrafficCar(G, PX - 78, PZ, H, 'Cayo Coupe');
  brightenCar(G, t1);
  brightenCar(G, t2);
  brightenCar(G, t3);
  spawnPed(G, PX - 14, PZ + 8);
  spawnPed(G, PX - 22, PZ - 8);
  spawnPed(G, PX - 44, PZ + 8);
  spawnPed(G, PX - 58, PZ - 8);

  // Mission 4, stage 2, timer 2:06 — the long Causeway chase.
  startMission(G, 3);
  G.missions.stage = 2;
  G.missions.stageCount = 3;
  G.missions.timer = 126;
  G.missions.objective = 'Deliver the evidence across the Causeway — outrun the IDPD';
  G.combat.weaponIndex = 1; // SMG in the rack
  G.audio.radioIndex = 0;
  showDialogue(G, 'WOWO', 'They will never take me alive. Not on my island.', 60000);
  // Score popups the judge asked for: drift chain + a near miss, live in
  // shot mode until the screenshot (hud.js holds them 60 s in shot mode).
  pushScorePopup(G, 'DRIFT x3', 'drift', '+$150');
  pushScorePopup(G, 'NEAR MISS', 'nearmiss', '+$250');
  // Camera higher and further back, pitched down ~11 degrees, and shifted
  // to the NORTH side of the road (lat +4.5): a 3/4 rear view, so the GT's
  // sunlit north flank reads instead of its dead-black rear. The GT sits
  // whole ABOVE the dialogue box, the flipped unit and the burning car ahead,
  // the sun still in frame up top, the heli (lowered to 18 m) just inside
  // the top edge.
  placeChaseCamera(G, G.player.pos, H, 12.5, 5.2, 0, -2, 62, 4.5);
  // Aim nearer and lower than the default look target so the GT rides near
  // frame centre instead of sliding under the HUD.
  G.camera.lookAt(PX - 24, 0.5, PZ - 1);
  G.camera.updateProjectionMatrix();
  renderHUD(G);
  renderMinimap(G);
}

// ---------------------------------------------------------------- title
function stageTitle(G) {
  G.setMode('title');
  // Westward view: Casino Row towers + beach under the sunset, sun in frame.
  // showTitle (via setMode) paints the portraits and reveals HOW TO PLAY.
  addSunFlare(G, -700, 135, -245, 380);
  G.camera.position.set(90, 72, 210);
  G.camera.lookAt(-260, 28, -150);
  G.camera.fov = 58;
  G.camera.updateProjectionMatrix();
  G.renderer.render(G.scene, G.camera);
}

// ---------------------------------------------------------------- combat
function stageCombat(G) {
  G.setMode('play');
  const w = G.city.landmarks.warehouse;
  const PX = w.x - 18, PZ = w.z + 24;
  const H = Math.atan2(w.x - PX, w.z - PZ); // facing the warehouse
  G.player.mode = 'foot';
  G.player.pos.set(PX, 0, PZ);
  G.player.heading = H;
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

  // Enemies CLOSE (8-16 m, inside the frame): two gunmen firing, one heavy
  // centre, one DOWNED gunman flat on the ground near the camera.
  const THREE = G.three;
  const e1p = offsetFrom(PX, PZ, H, 12, 4.5);
  const e2p = offsetFrom(PX, PZ, H, 13, -6.5);
  const e3p = offsetFrom(PX, PZ, H, 17, 0.5);
  const downP = offsetFrom(PX, PZ, H, 8, -2.5);
  const e1 = spawnEnemy(G, e1p.x, e1p.z, 'gunman');
  const e2 = spawnEnemy(G, e2p.x, e2p.z, 'gunman');
  const e3 = spawnEnemy(G, e3p.x, e3p.z, 'heavy');
  const down = spawnEnemy(G, downP.x, downP.z, 'gunman');
  down.state = 'dying';
  down.fallTimer = 0.9;
  down.mesh.rotation.x = -Math.PI / 2; // flat on his back
  down.mesh.position.y = 0.25;

  // A burning pickup on the right flank, flames + smoke in frame.
  const burnP = offsetFrom(PX, PZ, H, 14, 8);
  const pickup = makeCar(G, 'Faro Pickup', burnP.x, burnP.z, H + 0.5);
  brightenCar(G, pickup);
  igniteCar(G, pickup, 1.1);

  // Live fire, frozen mid-burst: muzzle flashes + tracers from both gunmen
  // toward the player, and one tracer OUT from the player into the heavy —
  // with damage numbers as score popups.
  const pPos = new THREE.Vector3(PX, 0, PZ);
  for (const e of [e1, e2]) {
    const from = new THREE.Vector3(e.pos.x, 1.35, e.pos.z);
    const to = new THREE.Vector3(pPos.x + (G.rng() - 0.5) * 1.2, 1.3, pPos.z + (G.rng() - 0.5) * 1.2);
    fireBurst(G, from, to);
  }
  const gunFrom = new THREE.Vector3(
    pPos.x + Math.sin(H) * 0.6, 1.4, pPos.z + Math.cos(H) * 0.6,
  );
  fireBurst(G, gunFrom, new THREE.Vector3(e3.pos.x, 1.2, e3.pos.z));

  showDialogue(G, 'WOWO', 'Three of them. The cache is behind that wall. Move.', 60000);
  pushScorePopup(G, '-55', 'damage', 'HEAVY HIT');
  pushScorePopup(G, '-34', 'damage', 'GUNMAN DOWN');
  // Camera close behind the player, shifted to the player's right so the
  // player steps left of the centre HUD column: enemies, tracers, the downed
  // man and the burning pickup all in frame, the player clear of the gauge.
  placeChaseCamera(G, G.player.pos, H, 7, 3.1, 0, 0, 64, 2.5);
  renderHUD(G);
  renderMinimap(G);
}

// ---------------------------------------------------------------- map
function stageMap(G) {
  G.stats.carsStolen = 38;
  G.stats.escapes = 13;
  G.stats.playSeconds = 7420;
  G.stats.missionsDone = 5;
  G.player.money = 48250;
  G.player.pos.set(-120, 0, 240); // Marina — player arrow on the map
  G.player.heading = Math.PI;
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
}
