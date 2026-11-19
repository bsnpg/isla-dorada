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
//            the getaway car (contact), a FLIPPED police car, a
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
import { spawnEnemy, spawnDownedEnemy, explodeAt, setJetpack, spawnDamageNumber } from './combat.js';
import { dropCash, dropWeapon } from './drops.js';
import { xpNextFor, nextUnlockFor, recomputeEffects } from './progression.js';
import { startMission } from './missions.js';
import { makeCar, spawnSmoke } from './driving.js';
import { drawMap } from './map.js';
import { saveGame } from './save.js';

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
// `air` lifts it into a mid-flip tumble in the air: { y, pitch, roll }.
function flipPoliceCar(G, x, z, heading, air) {
  const unit = spawnPoliceCar(G, x, z, heading);
  unit.mesh.position.y = air ? air.y : 1.05;
  unit.mesh.rotation.set(air ? (air.pitch || 0) : 0, heading, air ? air.roll : Math.PI * 0.92);
  unit.status = 'FLIPPED';
  addFire(G, x + 1.5, z + 1, air ? 0.7 : 0.45); // bigger smoke/fire when airborne
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
  G.player.mode = 'foot'; // V3-7: on foot, stealing the GT (prompt proves it)
  G.player.pos.set(PX - 1, 0, PZ - 3.5);
  G.player.heading = H;
  G.driving.parked.push(car); // GT is the steal target
  G.player.money = 38420;
  G.player.health = 100;
  G.player.armour = 50;
  // V3-6: nitro owned so the gauge reads NITRO READY, not NOT INSTALLED.
  if (!G.garage) G.garage = { owned: {} };
  if (!G.garage.owned) G.garage.owned = {};
  G.garage.owned.nitro = 1;

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
  const ram = spawnPoliceCar(G, PX - 6, PZ - 2, H + 2.8);
  ram.status = 'RAMMING';
  // V3-1: the flipped unit is the CENTRE of the cover — caught mid-flip in
  // the air directly ahead of the GT (not a background wreck).
  const flipped = flipPoliceCar(G, PX - 8, PZ + 1.5, H + 0.5, { y: 2.2, pitch: 0.35, roll: Math.PI * 0.65 });
  // V3 density: a SECOND flipped unit mid-tumble ahead-right, also airborne
  // and burning — the street reads as a pile-up, not a single stunt.
  const flipped2 = flipPoliceCar(G, PX - 26, PZ - 3.5, H + 0.4, { y: 1.8, pitch: 0.5, roll: Math.PI * 0.7 });
  const block = spawnPoliceCar(G, PX - 52, PZ - 1.5, -H);
  block.status = 'ROADBLOCK';
  const heli = spawnHeli(G, PX - 40, PZ - 18, 13); // V3-5: high, clear of billboards, rotor vs sky
  G.police.units = [
    { name: 'UNIT 23', dist: 5, status: 'RAMMING', mesh: ram.mesh },
    { name: 'UNIT 12', dist: 8, status: 'FLIPPED', mesh: flipped.mesh },
    { name: 'UNIT 41', dist: 26, status: 'FLIPPED', mesh: flipped2.mesh },
    { name: 'UNIT 07', dist: 52, status: 'ROADBLOCK', mesh: block.mesh },
    { name: 'HAWK-1', dist: 38, status: 'SEARCHLIGHT', mesh: heli.mesh },
    { name: 'UNIT 31', dist: 210, status: 'PURSUIT', mesh: null },
  ];

  // Enemy drops on the asphalt (recording #10): the flipped unit threw its
  // officer out — he is down on the north shoulder, his cash stack and his
  // SMG lying beside him, glowing green and gold. Kept on the road's north
  // edge, right of the popup stack and clear of the flipped car, so the loot
  // reads at a glance. The cover moment (the airborne flipped car over the
  // GT) is untouched.
  spawnDownedEnemy(G, PX - 10, PZ - 8.2, 'gunman');
  dropCash(G, PX - 8, PZ - 7.6, 250);
  dropWeapon(G, PX - 12.5, PZ - 7.8, 1); // SMG +30
  pushScorePopup(G, '+30', 'cash', 'SMG AMMO PICKED UP');

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
  // V3-4: one oncoming car + one ped close to the camera so the street reads alive.
  const t4 = spawnTrafficCar(G, PX - 16, PZ - 6, -H, 'Solano S');
  brightenCar(G, t4);
  // V3 density: fuller street — another westbound car past the roadblock,
  // another oncoming car far ahead, and a car crossing the x=-200 junction
  // so the cross street reads alive too.
  const t5 = spawnTrafficCar(G, PX - 108, PZ, H, 'Palma Cruiser');
  const t6 = spawnTrafficCar(G, PX - 120, PZ, -H, 'Solano S');
  const t7 = spawnTrafficCar(G, -200, -240, 0, 'Cayo Coupe');
  brightenCar(G, t5);
  brightenCar(G, t6);
  brightenCar(G, t7);
  spawnPed(G, PX - 14, PZ + 8);
  spawnPed(G, PX - 22, PZ - 8);
  spawnPed(G, PX - 44, PZ + 8);
  spawnPed(G, PX - 58, PZ - 8);
  spawnPed(G, PX - 10, PZ + 8);
  // V3 density: more peds on both sidewalks down the whole visible street.
  spawnPed(G, PX - 30, PZ + 8);
  spawnPed(G, PX - 36, PZ - 8);
  spawnPed(G, PX - 50, PZ + 8);
  spawnPed(G, PX - 70, PZ - 8);
  spawnPed(G, PX - 88, PZ + 8);
  spawnPed(G, PX - 6, PZ - 8);
  spawnPed(G, PX - 2, PZ - 7.5);
  spawnPed(G, PX - 18, PZ + 7.5);
  spawnPed(G, PX - 40, PZ - 7.5);

  // V3 density: a second downed officer on the south shoulder with his own
  // loot — the flipped units threw two men out, not one.
  spawnDownedEnemy(G, PX - 18, PZ + 7.6, 'heavy');
  dropCash(G, PX - 16, PZ + 7.0, 350);
  dropWeapon(G, PX - 20.5, PZ + 7.2, 3); // Rifle +30

  // Mission 4, stage 2, timer 2:06 — the long Causeway chase.
  startMission(G, 3);
  G.missions.stage = 2;
  G.missions.stageCount = 3;
  G.missions.timer = 126;
  G.missions.objective = 'Deliver the evidence across the Causeway — outrun the IDPD';
  G.combat.weaponIndex = 1; // SMG in the rack
  G.audio.radioIndex = 0;
  showDialogue(G, 'WOWO', 'They will never take me alive. Not on my island.', 60000);
  // Camera close at Wowo's shoulder: Wowo + GT big in the foreground, the
  // flipped units, roadblock, heli and sunset ahead, prompt on the steal.
  placeChaseCamera(G, G.player.pos, H, 10.5, 4.2, 0, -2, 62, 4.5);
  G.camera.lookAt(PX - 26, 0.8, PZ - 1);
  G.camera.updateProjectionMatrix();
  renderHUD(G);
  renderMinimap(G);
}

// ---------------------------------------------------------------- title
function stageTitle(G) {
  // V3-2: stage a REAL save first so Continue shows genuine progress
  // (JOB 5/8 · $48,250 · 63%) instead of "NO SAVE YET".
  G.stats.carsStolen = 38;
  G.stats.escapes = 13;
  G.stats.playSeconds = 7420;
  G.stats.missionsDone = 5;
  G.player.money = 48250;
  G.player.health = 100;
  G.player.armour = 50;
  startMission(G, 5); // Job 6 Konfrontasi — 5 jobs done
  saveGame(G); // writes the real save; showTitle reads it via saveSummary()
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
// V3 MONEY SHOT — jetpack + bazooka, one frame, three systems at once:
// Wowo ON the jetpack mid-air firing the bazooka; a REAL explosion frozen
// mid-blast (explodeAt: fireball + smoke column + shockwave ring + debris +
// scorch); a CAR thrown through the air by the blast; a BODY frozen mid-air
// at the peak of the blast; drops scattered below. Order matters because
// the shot is frozen: explodeAt runs FIRST (before any enemy/car is placed
// in its radius, so nothing gets teleported or flipped by it afterwards),
// then every staged object is posed directly on its mesh.
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
  // Bazooka is weapon slot 5 (index 4): 1 in the mag, 12 in reserve.
  G.combat.weaponIndex = 4;
  G.combat.weapons[4].mag = 1;
  G.combat.weapons[4].reserve = 12;
  // The staged save owns nitro — the speedometer must never read
  // "NITRO — NOT INSTALLED" in this shot (same as the chase staging).
  if (!G.garage) G.garage = { owned: {} };
  if (!G.garage.owned) G.garage.owned = {};
  G.garage.owned.nitro = 1;

  const THREE = G.three;
  // Wowo ON the jetpack, mid-air: setJetpack lights the flame and lifts
  // him to 2.5 m; raise him further so he reads clearly above the blast
  // (and above the dialogue box, which covers the bottom-centre of frame),
  // and grow the jetpack flame so the thrust reads at a glance.
  setJetpack(G, true);
  G.player.pos.y = 5.0;
  const jpFlame = G.player.mesh && G.player.mesh.userData
    ? G.player.mesh.userData.jetpackFlame : null;
  if (jpFlame) jpFlame.scale.setScalar(1.8);
  // Jetpack smoke trail below Wowo — the rising puffs are what sells
  // "he flew up here" at a glance (kept >8 m from the blast point so the
  // smoke-dimming below never touches them).
  spawnSmoke(G, PX, 4.2, PZ, 1.2);
  spawnSmoke(G, PX, 3.2, PZ, 1.0);
  spawnSmoke(G, PX, 2.2, PZ, 0.9);
  // Warm key light on Wowo from the CAMERA side (behind-above him): he
  // faces away from the western sun, so his front reads near-black without
  // it — the light lifts his jacket, skin and the jetpack tanks out of the
  // dark sunset sky. Placed toward the camera so his BACK (tanks + flame,
  // what the camera sees) is lit, not just his front.
  const wowoLight = new THREE.PointLight(0xffc27a, 150, 16, 1.6);
  wowoLight.position.set(PX - Math.sin(H) * 3, 7, PZ - Math.cos(H) * 3);
  G.scene.add(wowoLight);

  // --- the blast itself, 14 m ahead of Wowo, dead centre of the frame ---
  const bp = offsetFrom(PX, PZ, H, 14, 0);
  explodeAt(G, bp.x, 1.5, bp.z, 14);
  // The stock fireball is ~5 m across — scale it up slightly so the blast
  // reads IMPACTFUL, not a small orange flash, and add two tall basic-
  // material flame columns (MeshBasic orange reads vivid at sunset; the
  // standard-material fireball alone blows out to cream under the sun, so
  // its emissive is cooled to 1.0 to keep it orange instead of white-hot).
  // explodeAt also throws white smoke sprites over the blast — dim the ones
  // at the blast point, or their white wash turns the fireball cream.
  for (const ex of G.combat._explosions) {
    if (ex.kind === 'fireball' && ex.group) {
      ex.group.scale.setScalar(1.15);
      for (const m of ex.mats || []) m.emissiveIntensity = 1.0;
    }
  }
  if (G.driving && G.driving.fx && Array.isArray(G.driving.fx.smoke)) {
    for (const s of G.driving.fx.smoke) {
      if (!s.sprite || !s.sprite.visible) continue;
      const p = s.sprite.position;
      if (Math.hypot(p.x - bp.x, p.z - bp.z) < 8 && s.sprite.material) {
        s.sprite.material.opacity = 0.12;
      }
    }
  }
  addFire(G, bp.x, bp.z, 2.6);
  addFire(G, bp.x - 2, bp.z + 1.5, 1.8);
  spawnDamageNumber(G, bp.x, 5.5, bp.z, '-220', '#ff8a3a');

  // --- a CAR thrown through the air by the blast (posed directly) ---
  // Heading-relative placement (offsetFrom): 11 m screen-RIGHT of the blast
  // core so it clears the fireball instead of hiding inside/behind it (the
  // old raw x/z offset landed it at the fireball's right edge, unreadable).
  // A yellow Marina Taxi, so the flying car reads at a glance instead of
  // vanishing into the dark buildings like a dark coupe did. Raised to 5.5 m
  // so it is clearly ABOVE the ground, tumbling, nose-down, mid-air.
  const taxiP = offsetFrom(bp.x, bp.z, H, 2, 11);
  const thrown = makeCar(G, 'Marina Taxi', taxiP.x, taxiP.z, H + 0.9);
  brightenCar(G, thrown);
  thrown.mesh.position.y = 5.5;
  thrown.mesh.rotation.set(0.5, H + 0.9, 1.1); // tumbling, nose-down, mid-air
  addFire(G, taxiP.x, taxiP.z, 0.9);

  // --- a BODY frozen mid-air at the peak of the blast ---
  // A heavy (1.25x bulk, bigger silhouette), 9 m screen-LEFT of the blast
  // core and 4 m back toward the camera (so he reads BIG, not a speck),
  // raised to 7.0 m so he silhouettes against the SKY, not the orange
  // fireball. Bright IDPD-blue uniform (cloned material, so no other
  // heavy is recolored) so the tumbling figure reads at a glance.
  const flyP = offsetFrom(bp.x, bp.z, H, -4, -9);
  const flyer = spawnEnemy(G, flyP.x, flyP.z, 'heavy');
  flyer.mesh.position.y = 7.0;
  flyer.mesh.rotation.set(-0.5, 1.2, 0.4); // thrown, tumbling — more upright so he reads
  flyer.mesh.traverse((o) => {
    const m = o.material;
    if (m && m.color && m.color.getHex() === 0x5a5f66) {
      o.material = m.clone();
      o.material.color.setHex(0x4f8ff7);
      o.material.emissive.setHex(0x1a3a6a);
      o.material.emissiveIntensity = 1;
    }
  });

  // Enemies CLOSE (8-19 m, inside the frame): two gunmen firing, one heavy
  // centre behind the blast, one DOWNED gunman flat on the ground near the
  // camera.
  const e1p = offsetFrom(PX, PZ, H, 11, 7.5);
  const e2p = offsetFrom(PX, PZ, H, 12, -8);
  const e3p = offsetFrom(PX, PZ, H, 19, 1.5);
  const downP = offsetFrom(PX, PZ, H, 8, -2.5);
  const e1 = spawnEnemy(G, e1p.x, e1p.z, 'gunman');
  const e2 = spawnEnemy(G, e2p.x, e2p.z, 'gunman');
  const e3 = spawnEnemy(G, e3p.x, e3p.z, 'heavy');
  const down = spawnEnemy(G, downP.x, downP.z, 'gunman');
  down.state = 'dying';
  down.fallTimer = 0.9;
  down.mesh.rotation.x = -Math.PI / 2; // flat on his back
  down.mesh.position.y = 0.25;

  // Enemy drops (recording #10): the downed gunman already dropped his loot
  // — a green cash stack beside his body and his pistol on the asphalt with
  // a floating "PISTOL +24" label, both glowing so they read in the frame.
  dropCash(G, downP.x + 1.4, downP.z + 1.2, 250);
  dropWeapon(G, downP.x - 1.2, downP.z + 1.8, 0); // Pistol +24
  // (No +$250 popup here — the centre stack stays two lines so it never
  // covers the blast; the cash stack itself carries the $250 label.)

  // Blast loot scattered BELOW the explosion: cash + weapons with labels,
  // spread WIDE with heading-relative offsets so the labels never stack on
  // each other (the old tight cluster overlapped "RIFLE +30" and "$250").
  const d1 = offsetFrom(bp.x, bp.z, H, 4, 6);
  dropCash(G, d1.x, d1.z, 350);
  const d2 = offsetFrom(bp.x, bp.z, H, 5, -6);
  dropWeapon(G, d2.x, d2.z, 3); // Rifle +30
  const d3 = offsetFrom(bp.x, bp.z, H, -2, -8);
  dropCash(G, d3.x, d3.z, 250);
  const d4 = offsetFrom(bp.x, bp.z, H, -1, 8);
  dropWeapon(G, d4.x, d4.z, 1); // SMG +30

  // A burning pickup on the right flank, flames + smoke in frame.
  const burnP = offsetFrom(PX, PZ, H, 14, 9);
  const pickup = makeCar(G, 'Faro Pickup', burnP.x, burnP.z, H + 0.5);
  brightenCar(G, pickup);
  igniteCar(G, pickup, 1.1);

  // Live fire, frozen mid-burst: muzzle flashes + tracers from both gunmen
  // toward the player, and the BAZOOKA shot itself — a bright tracer from
  // Wowo's gun to the heart of the blast, plus a rocket frozen mid-flight
  // halfway there.
  const pPos = new THREE.Vector3(PX, 5.0, PZ);
  for (const e of [e1, e2]) {
    const from = new THREE.Vector3(e.pos.x, 1.35, e.pos.z);
    const to = new THREE.Vector3(pPos.x + (G.rng() - 0.5) * 1.2, 5.0, pPos.z + (G.rng() - 0.5) * 1.2);
    fireBurst(G, from, to);
  }
  const gunFrom = new THREE.Vector3(
    pPos.x + Math.sin(H) * 0.6, 6.0, pPos.z + Math.cos(H) * 0.6,
  );
  const blastTop = new THREE.Vector3(bp.x, 2.5, bp.z);
  fireBurst(G, gunFrom, blastTop);
  // Rocket mid-flight: dark tube + orange nose + flame cone, halfway down
  // the gun-to-blast line, nose-first toward the explosion.
  const rocket = new THREE.Group();
  const rBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.85, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.4, metalness: 0.7 }),
  );
  rBody.rotation.x = Math.PI / 2;
  rocket.add(rBody);
  const rNose = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: 0xd86a20, roughness: 0.5 }),
  );
  rNose.rotation.x = Math.PI / 2;
  rNose.position.z = 0.57;
  rocket.add(rNose);
  const rFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.6, 8),
    new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  rFlame.rotation.x = -Math.PI / 2;
  rFlame.position.z = -0.7;
  rocket.add(rFlame);
  const mid = gunFrom.clone().lerp(blastTop, 0.45);
  rocket.position.copy(mid);
  rocket.lookAt(blastTop.x, blastTop.y, blastTop.z);
  rocket.scale.setScalar(1.5); // read at 20+ m, not a speck
  G.scene.add(rocket);

  showDialogue(G, 'WOWO', 'Three of them. The cache is behind that wall. Move.', 60000);
  pushScorePopup(G, '-220', 'damage', 'BAZOOKA HIT');
  pushScorePopup(G, '-34', 'damage', 'GUNMAN DOWN');
  const banner = document.createElement('div');
  banner.id = 'mission-passed-banner';
  banner.style.cssText = 'position:absolute;left:59%;top:5%;transform:translateX(-50%);text-align:center;'
    + 'background:rgba(10,14,22,0.88);border:2px solid #f2c230;border-radius:8px;'
    + 'padding:10px 28px;z-index:7;pointer-events:none;'
    + 'font-family:system-ui,sans-serif;color:#f5efe0;';
  banner.innerHTML = '<div style="font:800 26px system-ui,sans-serif;color:#f2c230;letter-spacing:3px;">★ MISSION PASSED ★</div>'
    + '<div style="font:700 15px system-ui,sans-serif;margin-top:4px;">JOB 5 — GUDANG SENJATA</div>'
    + '<div style="font:800 16px ui-monospace,Menlo,monospace;color:#8fe388;margin-top:4px;">+$4,500 &nbsp;·&nbsp; +500 REP</div>'
    + '<div style="font:700 13px system-ui,sans-serif;color:#7ec8e8;margin-top:3px;">UNLOCKED: JOB 6 — KONFRONTASI</div>';
  const hudEl = document.getElementById('hud');
  if (hudEl) hudEl.appendChild(banner);
  // Camera: closer (dist 5.5) and a touch higher than the old low angle
  // (y ~3.5, still below Wowo's 5.0 so he silhouettes against the sky,
  // not the ground) — a full top-down angle foreshortens him and hides
  // him behind the fireball. Aim AT the blast, y 4.0, so the drops on
  // the ground read below it. Wowo stays large, left of the banner.
  placeChaseCamera(G, G.player.pos, H, 5.5, -1.5, 0, 0, 64, 4);
  G.camera.lookAt(bp.x, 4.0, bp.z);
  G.camera.updateProjectionMatrix();
  const popLayer = document.getElementById('score-popups');
  if (popLayer) popLayer.style.top = '20%';
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
  // Player at the (40, 200) road junction by the garage, not on top of the
  // Marina job — so the map shows the dashed gold route to JOB 6.
  G.player.pos.set(40, 0, 200);
  G.player.heading = Math.PI;
  startMission(G, 5);
  // V3: stage real progression state so the map's new panels read at a
  // glance instead of showing fresh-save zeros — 7/20 idols, REP LV 3,
  // skills with pips, one property owned, garage upgrades installed — and
  // a real car, so the GARAGE section names one instead of "NO CAR".
  const car = makeCar(G, 'Aurea GT', 52, 212, Math.PI);
  brightenCar(G, car);
  G.driving.car = car;
  if (!G.garage) G.garage = { owned: {} };
  if (!G.garage.owned) G.garage.owned = {};
  G.garage.owned.engine = 2;
  G.garage.owned.armor = 1;
  G.garage.owned.nitro = 1;
  G.garage.owned.paint = 1;
  const pr = G.progression;
  if (pr) {
    pr.collectibles.found = 7;
    pr.idols.slice(0, 7).forEach((idol) => {
      idol.collected = true;
      if (idol.mesh) G.scene.remove(idol.mesh);
    });
    pr.rep.level = 3;
    pr.rep.xp = 850;
    pr.rep.xpNext = xpNextFor(3);
    pr.rep.nextUnlock = nextUnlockFor(3);
    pr.skills = { driving: 3, aim: 2, influence: 1, stamina: 2, stealth: 1, street: 2 };
    if (pr.properties && pr.properties[0]) pr.properties[0].owned = true;
    recomputeEffects(G);
  }
  G.setMode('map');
  drawMap(G);
  // The side-job legend entries (TAXI STAND / DELIVERY PICKUP / STREET
  // RACE) load via a dynamic import in map.js and nothing re-draws the
  // legend once it resolves — force one more drawMap after the import so
  // the entries are in the frame before the screenshot (~600 ms later).
  import('./sidejobs.js').then(() => drawMap(G)).catch(() => {});
  // V3: the side panel is ~1,450 px tall in one column — centred in a
  // 720 px frame, CURRENT JOB is cut off the top and GARAGE off the bottom.
  // Staging-only reflow (live game untouched): two columns, so every panel
  // — CURRENT JOB, checklist, stats, legend, progression, garage — fits
  // in the one screenshot frame.
  const side = document.getElementById('map-side');
  if (side) {
    side.style.width = '600px';
    side.style.columnCount = '2';
    side.style.columnGap = '14px';
    // Both columns run ~730 px tall; scale the whole panel to 0.87 so it
    // fits the 720 px frame top-to-bottom (text stays ~11 px, still legible).
    side.style.transform = 'scale(0.87)';
    side.style.transformOrigin = 'center center';
    for (const child of side.children) child.style.breakInside = 'avoid';
  }
}

// Set `G` to the named scene. Any unknown name stages the chase (the cover).
export function stageShot(name, G) {
  if (name === 'title') stageTitle(G);
  else if (name === 'combat') stageCombat(G);
  else if (name === 'map') stageMap(G);
  else stageChase(G);
}
