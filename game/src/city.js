// Isla Dorada — city construction: ground, sea, roads, buildings, palms, lamps.
// All placement is seeded through G.rng, so the same seed builds the same island.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { pick, range } from './random.js';

export const ROAD_LINES = [-280, -200, -120, -40, 40, 120, 200, 280];

const BUILDING_COLORS = [0x8a7a6a, 0x6a7a8a, 0x9a8a6a, 0x7a6a5a, 0x5a6a7a, 0x8a6a5a, 0xa08a7a];

const LANDMARK_SPOTS = {
  casino: { x: -120, z: -200 },
  impound: { x: -120, z: 40 },
  warehouse: { x: 120, z: 240 },
  station: { x: 40, z: -200 },
  marina: { x: -120, z: 240 },
  garage: { x: 40, z: 120 },
  causeway: { x: 260, z: 0 },
};

// Landmark buildings sit offset (+24,+24) into the block beside their plaza point,
// so the road grid stays clear. Collider r = half the footprint diagonal.
const LANDMARK_BUILDINGS = [
  { key: 'casino', w: 26, d: 20, h: 55, color: 0x8a6d2f, goldTop: true, sign: 0xffd76a, signH: 3.5 },
  { key: 'impound', w: 24, d: 16, h: 10, color: 0x5a6a7a, sign: 0x9fb3c8, signH: 2 },
  { key: 'warehouse', w: 26, d: 16, h: 14, color: 0x7a5a3a, sign: 0xe8a34c, signH: 2.5 },
  { key: 'station', w: 26, d: 18, h: 16, color: 0x3a5a8a, sign: 0x6aa8ff, signH: 2.5 },
  { key: 'marina', w: 22, d: 14, h: 9, color: 0x4a7a8a, sign: 0x7ec8e8, signH: 2 },
  { key: 'garage', w: 24, d: 16, h: 12, color: 0x8a3a3a, sign: 0xff8a6a, signH: 2 },
];

// Exclusion zones for regular buildings: landmark plazas + buildings, the parked
// cars spawned by driving.js, and the combat-shot staging area by the warehouse.
const EXCLUSIONS = [
  { x: -120, z: -200, r: 22 }, { x: -120, z: 40, r: 22 }, { x: 120, z: 240, r: 22 },
  { x: 40, z: -200, r: 22 }, { x: -120, z: 240, r: 22 }, { x: 40, z: 120, r: 22 },
  { x: -96, z: -176, r: 30 }, { x: -96, z: 64, r: 30 }, { x: 144, z: 264, r: 30 },
  { x: 64, z: -176, r: 30 }, { x: -96, z: 264, r: 30 }, { x: 64, z: 144, r: 30 },
  { x: -124, z: 232, r: 12 }, { x: 36, z: 116, r: 12 }, { x: -116, z: -193, r: 12 },
  { x: 116, z: 236, r: 12 }, { x: 44, z: -196, r: 12 }, { x: -116, z: 44, r: 12 },
  { x: 115, z: 250, r: 26 },
];

function excluded(x, z) {
  for (const e of EXCLUSIONS) {
    const dx = x - e.x, dz = z - e.z;
    if (dx * dx + dz * dz < e.r * e.r) return true;
  }
  return false;
}

export function buildCity(G) {
  const scene = G.scene;
  const rng = G.rng;
  const colliders = [];
  const roads = [];
  for (const at of ROAD_LINES) {
    roads.push({ axis: 'ns', at, from: -320, to: 320 });
    roads.push({ axis: 'ew', at, from: -320, to: 320 });
  }

  // ---- shared materials / geometries (one-time build, reused everywhere) ----
  const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 });
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 });
  const seaMat = new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.15 });
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.95 });
  const dashMat = new THREE.MeshStandardMaterial({ color: PALETTE.roadLine, roughness: 0.6 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const winGeo = new THREE.PlaneGeometry(1, 1);
  const buildingMats = BUILDING_COLORS.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const winWarm = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffc86a, emissiveIntensity: 1.4, roughness: 0.4 });
  const winCool = new THREE.MeshStandardMaterial({ color: 0x18242a, emissive: 0x7ec8e8, emissiveIntensity: 1.0, roughness: 0.4 });
  const winDark = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.2, metalness: 0.7 });
  const winMats = [winWarm, winCool, winDark];
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8a020, metalness: 0.85, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.9, side: THREE.DoubleSide });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x332a18, emissive: 0xffe0a0, emissiveIntensity: 2.2 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });

  // ---- ground, sand, sea ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, 640), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-300, 0.01, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(340, 640), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-470, -0.5, 0);
  scene.add(sea);

  // ---- roads, centre dashes, sidewalks ----
  const roadGeoNS = new THREE.PlaneGeometry(12, 640);
  const roadGeoEW = new THREE.PlaneGeometry(640, 12);
  const walkGeoNS = new THREE.PlaneGeometry(3, 640);
  const walkGeoEW = new THREE.PlaneGeometry(640, 3);
  for (const at of ROAD_LINES) {
    const rNS = new THREE.Mesh(roadGeoNS, roadMat);
    rNS.rotation.x = -Math.PI / 2;
    rNS.position.set(at, 0.02, 0);
    rNS.receiveShadow = true;
    scene.add(rNS);
    const rEW = new THREE.Mesh(roadGeoEW, roadMat);
    rEW.rotation.x = -Math.PI / 2;
    rEW.position.set(0, 0.02, at);
    rEW.receiveShadow = true;
    scene.add(rEW);
    for (const side of [-7.5, 7.5]) {
      const wNS = new THREE.Mesh(walkGeoNS, walkMat);
      wNS.rotation.x = -Math.PI / 2;
      wNS.position.set(at + side, 0.015, 0);
      wNS.receiveShadow = true;
      scene.add(wNS);
      const wEW = new THREE.Mesh(walkGeoEW, walkMat);
      wEW.rotation.x = -Math.PI / 2;
      wEW.position.set(0, 0.015, at + side);
      wEW.receiveShadow = true;
      scene.add(wEW);
    }
  }

  // Gold centre dashes, one InstancedMesh for the whole grid + causeway.
  const dashTransforms = [];
  for (const at of ROAD_LINES) {
    for (let s = -312; s <= 312; s += 16) {
      dashTransforms.push({ x: at, z: s, ry: 0 });
      dashTransforms.push({ x: s, z: at, ry: Math.PI / 2 });
    }
  }
  for (let x = 208; x <= 312; x += 16) dashTransforms.push({ x, z: 0, ry: Math.PI / 2 });
  const dashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.04, 3), dashMat, dashTransforms.length);
  {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < dashTransforms.length; i++) {
      const t = dashTransforms[i];
      dummy.position.set(t.x, 0.04, t.z);
      dummy.rotation.set(0, t.ry, 0);
      dummy.updateMatrix();
      dashMesh.setMatrixAt(i, dummy.matrix);
    }
  }
  dashMesh.instanceMatrix.needsUpdate = true;
  scene.add(dashMesh);

  // ---- causeway: water channel + bridge deck + rails ----
  const cwWater = new THREE.Mesh(new THREE.PlaneGeometry(120, 160), seaMat);
  cwWater.rotation.x = -Math.PI / 2;
  cwWater.position.set(260, 0.015, 0);
  scene.add(cwWater);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(120, 0.1, 14), roadMat);
  deck.position.set(260, 0, 0);
  deck.receiveShadow = true;
  scene.add(deck);
  for (const side of [-7, 7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(120, 0.5, 0.4), walkMat);
    rail.position.set(260, 0.3, side);
    scene.add(rail);
  }

  // ---- buildings ----
  function addBuilding(x, z, w, d, h, mat, opts) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    const winMat = pick(rng, winMats);
    const win = new THREE.Mesh(winGeo, winMat);
    win.scale.set(w * 0.75, h * 0.45, 1);
    win.position.set(x, h * 0.45, z + d / 2 + 0.06);
    scene.add(win);
    if (h >= 24) {
      const win2 = new THREE.Mesh(winGeo, pick(rng, winMats));
      win2.scale.set(w * 0.75, h * 0.45, 1);
      win2.rotation.y = Math.PI;
      win2.position.set(x, h * 0.45, z - d / 2 - 0.06);
      scene.add(win2);
    }
    if (opts && opts.sign) {
      const signMat = new THREE.MeshStandardMaterial({ color: 0x201808, emissive: opts.sign, emissiveIntensity: 1.6 });
      const sign = new THREE.Mesh(winGeo, signMat);
      sign.scale.set(w * 0.85, opts.signH || 2, 1);
      sign.position.set(x, h * 0.78, z + d / 2 + 0.08);
      scene.add(sign);
    }
    if (opts && opts.goldTop) {
      const top = new THREE.Mesh(boxGeo, goldMat);
      top.scale.set(w * 0.7, 1.6, d * 0.7);
      top.position.set(x, h + 0.8, z);
      top.castShadow = true;
      scene.add(top);
    }
    colliders.push({ x, z, r: Math.hypot(w, d) / 2 });
    return m;
  }

  // Regular buildings: 2x2 lots per city block. Beachfront column (x -280..-200)
  // stays open so the coastal road and the chase shot stay clear; the causeway
  // blocks (x 200..280, z -80..80) stay open for the bridge.
  for (let ix = 1; ix < ROAD_LINES.length - 1; ix++) {
    for (let iz = 0; iz < ROAD_LINES.length - 1; iz++) {
      if (ix === 6 && iz >= 2 && iz <= 4) continue; // causeway blocks
      const x0 = ROAD_LINES[ix] + 10, x1 = ROAD_LINES[ix + 1] - 10;
      const z0 = ROAD_LINES[iz] + 10, z1 = ROAD_LINES[iz + 1] - 10;
      for (const lx of [x0 + 12, x0 + 36]) {
        for (const lz of [z0 + 12, z0 + 36]) {
          if (rng() > 0.88) continue;
          const x = lx + range(rng, -4, 4);
          const z = lz + range(rng, -4, 4);
          if (excluded(x, z)) continue;
          const w = range(rng, 10, 20);
          const d = range(rng, 10, 18);
          const h = rng() < 0.18 ? range(rng, 24, 40) : range(rng, 8, 22);
          addBuilding(x, z, w, d, h, pick(rng, buildingMats));
        }
      }
    }
  }

  // Landmark buildings.
  for (const lb of LANDMARK_BUILDINGS) {
    const spot = LANDMARK_SPOTS[lb.key];
    addBuilding(spot.x + 24, spot.z + 24, lb.w, lb.d, lb.h,
      new THREE.MeshStandardMaterial({ color: lb.color, roughness: 0.85 }),
      { sign: lb.sign, signH: lb.signH, goldTop: lb.goldTop });
  }

  // Marina pier + boats in the sea off the marina.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 6), walkMat);
  pier.position.set(-300, 0.05, 240);
  scene.add(pier);
  for (const bz of [215, 245, 275]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo, whiteMat);
    hull.scale.set(5, 1, 2);
    hull.position.y = 0.2;
    boat.add(hull);
    const cabin = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x3a5a8a, roughness: 0.6 }));
    cabin.scale.set(2, 0.8, 1.4);
    cabin.position.set(-0.5, 1, 0);
    boat.add(cabin);
    boat.position.set(-312, -0.3, bz);
    boat.rotation.y = range(rng, -0.2, 0.2);
    scene.add(boat);
  }

  // ---- palm trees: beach row + scattered along roads (instanced) ----
  const palmSpots = [];
  for (let z = -300; z <= 300; z += 16) {
    palmSpots.push({ x: -288 + range(rng, -3, 3), z: z + range(rng, -4, 4) });
  }
  for (let i = 0; i < 30; i++) {
    const line = pick(rng, ROAD_LINES);
    const s = range(rng, -280, 280);
    const side = rng() < 0.5 ? -9.5 : 9.5;
    if (rng() < 0.5) palmSpots.push({ x: line + side, z: s });
    else palmSpots.push({ x: s, z: line + side });
  }
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.28, 6, 6), trunkMat, palmSpots.length);
  const frondMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 0.9), frondMat, palmSpots.length * 6);
  {
    const dummy = new THREE.Object3D();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const off = new THREE.Vector3();
    const pos = new THREE.Vector3();
    let fi = 0;
    for (let i = 0; i < palmSpots.length; i++) {
      const p = palmSpots[i];
      dummy.position.set(p.x, 3, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      for (let f = 0; f < 6; f++) {
        const yaw = (f / 6) * Math.PI * 2 + range(rng, -0.2, 0.2);
        e.set(0, yaw, -0.55, 'YXZ');
        q.setFromEuler(e);
        off.set(1.3, 0, 0).applyQuaternion(q);
        pos.set(p.x + off.x, 6.2 + off.y, p.z + off.z);
        const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
        frondMesh.setMatrixAt(fi++, m);
      }
      colliders.push({ x: p.x, z: p.z, r: 0.6 });
    }
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  frondMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.castShadow = true;
  scene.add(trunkMesh);
  scene.add(frondMesh);

  // ---- street lamps along the north-south roads (instanced) ----
  const lampSpots = [];
  for (const at of ROAD_LINES) {
    for (const z of [-240, -80, 80, 240]) lampSpots.push({ x: at + 8, z });
  }
  const lampPoleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 5, 6), poleMat, lampSpots.length);
  const lampHeadMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 6), lampMat, lampSpots.length);
  {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < lampSpots.length; i++) {
      dummy.position.set(lampSpots[i].x, 2.5, lampSpots[i].z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      lampPoleMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(lampSpots[i].x, 5.05, lampSpots[i].z);
      dummy.updateMatrix();
      lampHeadMesh.setMatrixAt(i, dummy.matrix);
    }
  }
  lampPoleMesh.instanceMatrix.needsUpdate = true;
  lampHeadMesh.instanceMatrix.needsUpdate = true;
  scene.add(lampPoleMesh);
  scene.add(lampHeadMesh);

  // ---- G.city ----
  function nearestRoad(x, z) {
    let nsLine = ROAD_LINES[0], nsD = Math.abs(x - nsLine);
    let ewLine = ROAD_LINES[0], ewD = Math.abs(z - ewLine);
    for (const l of ROAD_LINES) {
      if (Math.abs(x - l) < nsD) { nsD = Math.abs(x - l); nsLine = l; }
      if (Math.abs(z - l) < ewD) { ewD = Math.abs(z - l); ewLine = l; }
    }
    if (nsD <= ewD) return { x: nsLine, z, heading: 0 };
    return { x, z: ewLine, heading: Math.PI / 2 };
  }

  function randomRoadPos(r) {
    const line = pick(r, ROAD_LINES);
    const s = range(r, -280, 280);
    const dir = r() < 0.5 ? 1 : -1;
    if (r() < 0.5) return { x: line, z: s, heading: dir > 0 ? 0 : Math.PI };
    return { x: s, z: line, heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  G.city = {
    roads,
    roadLines: ROAD_LINES,
    colliders,
    landmarks: {
      casino: { x: LANDMARK_SPOTS.casino.x, z: LANDMARK_SPOTS.casino.z },
      impound: { x: LANDMARK_SPOTS.impound.x, z: LANDMARK_SPOTS.impound.z },
      warehouse: { x: LANDMARK_SPOTS.warehouse.x, z: LANDMARK_SPOTS.warehouse.z },
      station: { x: LANDMARK_SPOTS.station.x, z: LANDMARK_SPOTS.station.z },
      marina: { x: LANDMARK_SPOTS.marina.x, z: LANDMARK_SPOTS.marina.z },
      garage: { x: LANDMARK_SPOTS.garage.x, z: LANDMARK_SPOTS.garage.z },
      causeway: { x: LANDMARK_SPOTS.causeway.x, z: LANDMARK_SPOTS.causeway.z },
    },
    nearGarage(pos) {
      const dx = pos.x - LANDMARK_SPOTS.garage.x;
      const dz = pos.z - LANDMARK_SPOTS.garage.z;
      return dx * dx + dz * dz < 12 * 12;
    },
    randomRoadPos,
    nearestRoad,
  };
  return G.city;
}
