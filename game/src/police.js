// The wanted level and the IDPD response: the stars, the responding units with
// their roles and distances, and the HAWK-1 helicopter with its searchlight.
import * as THREE from 'three';

export const UNIT_ROLES = ['Marksman', 'Shore Watch', 'Ramming', 'Flanking', 'Air Support'];

export function createPolice(scene) {
  const heli = makeHeli();
  heli.visible = false;
  scene.add(heli);
  const units = [];
  for (let i = 0; i < 5; i++) {
    const car = makePoliceCar();
    car.visible = false;
    scene.add(car);
    units.push({ mesh: car, role: UNIT_ROLES[i], distance: 0, active: false });
  }
  return { wanted: 0, heli, units, decayTimer: 0 };
}

function makePoliceCar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), new THREE.MeshLambertMaterial({ color: 0x1c2f4a }));
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: 0x22303f }));
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [x, z] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  bar.position.set(0, 1.6, -0.2);
  g.add(bar);
  const barB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.5), new THREE.MeshBasicMaterial({ color: 0x2e7fff }));
  barB.position.set(0.85, 1.6, -0.2);
  g.add(barB);
  return g;
}

export function makeHeli() {
  // HAWK-1: dark, front-facing, with a searchlight cone underneath.
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5.2), new THREE.MeshLambertMaterial({ color: 0x1a2432 }));
  g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshLambertMaterial({ color: 0x22303f }));
  nose.position.set(0, -0.2, 2.6);
  nose.scale.set(1, 0.8, 1.2);
  g.add(nose);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9fd4f2 }));
  glass.position.set(0, 0.3, 2.4);
  glass.scale.set(1, 0.7, 0.8);
  g.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1;
  g.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), new THREE.MeshLambertMaterial({ color: 0x1a2432 }));
  tail.position.set(0, 0.3, -4.4);
  g.add(tail);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  tailRotor.position.set(0, 0.4, -6.4);
  g.add(tailRotor);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 16, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.x = Math.PI;
  beam.position.y = -9;
  g.add(beam);
  const spot = new THREE.SpotLight(0xfff2b0, 3, 40, 0.35, 0.4);
  spot.position.set(0, -1, 0);
  const target = new THREE.Object3D();
  target.position.set(0, -18, 0);
  g.add(target);
  spot.target = target;
  g.add(spot);
  g.userData.rotor = rotor;
  return g;
}

export function setWanted(state, level) {
  const p = state.police;
  p.wanted = Math.max(0, Math.min(5, level));
  p.decayTimer = 0;
  const active = Math.min(p.wanted + 1, p.units.length);
  p.units.forEach((u, i) => {
    u.active = i < active;
    u.mesh.visible = i < active;
    u.distance = 40 + i * 55;
  });
  p.heli.visible = p.wanted >= 2;
}

export function updatePolice(state, dt) {
  const p = state.police;
  const player = state.player.position;
  if (p.wanted > 0) {
    p.decayTimer += dt;
    if (p.decayTimer > 45) {
      setWanted(state, p.wanted - 1);
      p.decayTimer = 0;
    }
  }
  // Heli hunts the player from above, never clipping a building: it stays high.
  if (p.heli.visible) {
    p.heli.userData.rotor.rotation.y += dt * 14;
    const t = performance.now() / 1000;
    p.heli.position.set(player.x + Math.sin(t * 0.4) * 14, 34 + Math.sin(t * 0.7) * 2, player.z - 26 + Math.cos(t * 0.3) * 8);
    p.heli.lookAt(player.x, 0, player.z);
  }
  p.units.forEach((u, i) => {
    if (!u.active) return;
    const angle = (i / p.units.length) * Math.PI * 2 + performance.now() / 9000;
    const r = 26 + i * 7;
    u.mesh.position.set(player.x + Math.cos(angle) * r, 0, player.z + Math.sin(angle) * r);
    u.mesh.lookAt(player.x, 0, player.z);
    u.distance = Math.round(r + 18 + Math.sin(performance.now() / 2000 + i) * 12);
  });
}
