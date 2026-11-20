// The island itself: seven districts, buildings with window grids and signs,
// roads with double yellow lines, lane dashes, sidewalks and crossings, landmarks,
// palms, planters and the sea. Also provides the district data the map screen needs.
import * as THREE from 'three';
import { CITY_SIZE, ROAD_STEP, ROAD_WIDTH, DISTRICTS, LANDMARKS } from './config.js';
import { createRandom, range, pick } from './random.js';

const BUILDING_COLORS = ['#e8b48a', '#d9a05b', '#c98f7a', '#a8c4d4', '#e6d5b8', '#b8a88a', '#d4a0a0', '#9fb8a0'];
const SIGN_TEXTS = ['CASINO', 'HOTEL', 'MARINA', 'MARKET', 'GARAGE', 'BANK', 'CAFE', 'CLUB', 'PIER', 'SHOP'];

function windowTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 128, 10);
  for (let y = 24; y < 240; y += 34) {
    for (let x = 12; x < 112; x += 28) {
      g.fillStyle = rng() < 0.25 ? '#ffe9a0' : '#2e4a63';
      g.fillRect(x, y, 18, 22);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, bg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff';
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const buildings = [];

  // Ground: sand island on blue sea.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0x2e7fb8 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.4;
  group.add(sea);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE + 60, CITY_SIZE + 60), new THREE.MeshLambertMaterial({ color: 0xd9c9a0 }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Roads: dark strips on a grid, with double yellow centre lines and dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xf2c94c });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const roadLines = [-180, -120, -60, 0, 60, 120, 180];
  for (const p of roadLines) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, ROAD_WIDTH), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) { road.position.set(0, 0.05, p); }
      else { road.rotation.z = Math.PI / 2; road.position.set(p, 0.05, 0); }
      group.add(road);
      // Double yellow centre lines.
      for (const off of [-0.35, 0.35]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, 0.28), yellowMat);
        line.rotation.x = -Math.PI / 2;
        if (horizontal) line.position.set(0, 0.08, p + off);
        else { line.rotation.z = Math.PI / 2; line.position.set(p + off, 0.08, 0); }
        group.add(line);
      }
      // Lane dashes.
      for (let d = -CITY_SIZE / 2 + 12; d < CITY_SIZE / 2; d += 18) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.3), whiteMat);
        dash.rotation.x = -Math.PI / 2;
        if (horizontal) dash.position.set(d, 0.08, p + 4.5);
        else { dash.rotation.z = Math.PI / 2; dash.position.set(p + 4.5, 0.08, d); }
        group.add(dash);
      }
      // Sidewalks.
      for (const s of [-ROAD_WIDTH / 2 - 2.5, ROAD_WIDTH / 2 + 2.5]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, 5), walkMat);
        walk.rotation.x = -Math.PI / 2;
        if (horizontal) walk.position.set(0, 0.06, p + s);
        else { walk.rotation.z = Math.PI / 2; walk.position.set(p + s, 0.06, 0); }
        group.add(walk);
      }
    }
  }

  // Buildings: detailed boxes with window grids, signs, awnings and roof shapes.
  const districtOf = (x, z) => {
    if (z > 120) return DISTRICTS[0];
    if (x < -60 && z > 0) return DISTRICTS[2];
    if (x > 60 && z < -60) return DISTRICTS[4];
    if (Math.abs(x) < 90 && Math.abs(z) < 90) return DISTRICTS[1];
    if (x > 60 && z > 60) return DISTRICTS[6];
    if (x < -60 && z < -60) return DISTRICTS[5];
    return DISTRICTS[3];
  };
  for (let bx = -150; bx <= 150; bx += ROAD_STEP) {
    for (let bz = -150; bz <= 150; bz += ROAD_STEP) {
      if (rng() < 0.18) continue;
      const cx = bx + range(rng, -14, 14);
      const cz = bz + range(rng, -14, 14);
      if (Math.abs(cx) > 200 || Math.abs(cz) > 200) continue;
      const w = range(rng, 16, 26);
      const d = range(rng, 16, 26);
      const h = range(rng, 12, 46);
      const base = pick(rng, BUILDING_COLORS);
      const tex = windowTexture(rng, base);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx, h / 2, cz);
      group.add(b);
      buildings.push(b);
      // Roof cap.
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 1.2, d + 1.5), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
      roof.position.set(cx, h + 0.6, cz);
      group.add(roof);
      // Sign on taller buildings.
      if (h > 24 && rng() < 0.7) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: signTexture(pick(rng, SIGN_TEXTS), pick(rng, ['#e5539e', '#3fa7d6', '#f2a541', '#5da85d'])) }));
        sign.position.set(cx, h - 3, cz + d / 2 + 0.2);
        group.add(sign);
      }
      // Awning.
      if (rng() < 0.5) {
        const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.6, 3), new THREE.MeshLambertMaterial({ color: pick(rng, ['#e5539e', '#f2c94c', '#3fa7d6', '#5da85d']) }));
        awn.position.set(cx, 4.5, cz + d / 2 + 1.2);
        group.add(awn);
      }
    }
  }

  // Palms along the Beachfront and planters near the road.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (let i = 0; i < 46; i++) {
    const px = range(rng, -200, 200);
    const pz = range(rng, 120, 200);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.4, 7), leafMat);
    crown.position.set(px, 8.2, pz);
    group.add(crown);
  }
  for (let i = 0; i < 24; i++) {
    const px = pick(rng, [-180, -120, -60, 0, 60, 120, 180]) + range(rng, -30, 30);
    const pz = pick(rng, [-180, -120, -60, 0, 60, 120, 180]) + 9;
    const planter = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 1.4), new THREE.MeshLambertMaterial({ color: 0x9a8a72 }));
    planter.position.set(px, 0.6, pz);
    group.add(planter);
  }

  // Landmark markers: a small gold pillar + floating label sprite is added by the
  // map screen; here each landmark gets a distinct coloured block in the world.
  const landmarkMeshes = LANDMARKS.map((lm) => {
    const d = DISTRICTS.find((x) => x.name === lm.district) || DISTRICTS[0];
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 6), new THREE.MeshLambertMaterial({ color: d.color }));
    m.position.set(lm.x, 5, lm.z);
    group.add(m);
    return m;
  });

  return { group, buildings, landmarkMeshes, districtOf };
}

export function districtList() {
  return DISTRICTS;
}
