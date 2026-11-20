// Drops and pickups on the ground: money, ammo and health. Walk or drive over
// one to collect it; it pays out immediately and shows a floating notice.
import * as THREE from 'three';
import { range } from './random.js';

const DROP_STYLE = {
  money: { color: 0x2ecc71, label: '+$500' },
  ammo: { color: 0xf2c94c, label: '+AMMO' },
  health: { color: 0xe5534b, label: '+25 HP' },
};

export function createDrops(scene, rng) {
  const drops = [];
  const kinds = ['money', 'ammo', 'health'];
  for (let i = 0; i < 12; i++) {
    const kind = kinds[i % 3];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshBasicMaterial({ color: DROP_STYLE[kind].color }),
    );
    mesh.rotation.y = Math.PI / 4;
    const x = range(rng, -120, 120);
    const z = range(rng, -120, 120);
    mesh.position.set(x, 0.8, z);
    scene.add(mesh);
    drops.push({ mesh, kind, x, z, taken: false, bob: rng() * Math.PI * 2 });
  }
  return { drops };
}

export function updateDrops(state, dt) {
  const p = state.player.position;
  for (const d of state.drops.drops) {
    if (d.taken) continue;
    d.bob += dt * 3;
    d.mesh.position.y = 0.8 + Math.sin(d.bob) * 0.25;
    d.mesh.rotation.y += dt * 1.5;
    const dist = Math.hypot(d.mesh.position.x - p.x, d.mesh.position.z - p.z);
    if (dist < 2.6) {
      d.taken = true;
      d.mesh.visible = false;
      const style = DROP_STYLE[d.kind];
      if (d.kind === 'money') state.money += 500;
      if (d.kind === 'health') state.player.health = Math.min(100, state.player.health + 25);
      state.hud.flashNotice(`PICKUP ${style.label}`);
      state.audio.playPickup();
    }
  }
}

export function respawnDrops(state) {
  for (const d of state.drops.drops) {
    d.taken = false;
    d.mesh.visible = true;
  }
}
