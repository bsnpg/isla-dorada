// The minimap in the HUD corner: the seven districts as coloured blocks, the
// roads, the player arrow, the mission marker and the police dots.
import { DISTRICTS, LANDMARKS } from './config.js';

export function createMinimap() {
  const canvas = document.getElementById('minimap');
  if (!canvas) return { draw() {} };
  const ctx = canvas.getContext('2d');
  const S = 150;
  canvas.width = S;
  canvas.height = S;
  const toMap = (x, z) => [((x + 210) / 420) * S, ((z + 210) / 420) * S];
  return {
    draw(state) {
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(10,16,24,0.85)';
      ctx.fillRect(0, 0, S, S);
      // District blocks.
      const blocks = [
        { x: -210, z: 120, w: 420, h: 90, c: DISTRICTS[0].color },
        { x: -90, z: -90, w: 180, h: 180, c: DISTRICTS[1].color },
        { x: -210, z: 0, w: 120, h: 120, c: DISTRICTS[2].color },
        { x: 90, z: 0, w: 120, h: 180, c: DISTRICTS[3].color },
        { x: 90, z: -210, w: 120, h: 120, c: DISTRICTS[4].color },
        { x: -30, z: -210, w: 60, h: 120, c: DISTRICTS[5].color },
        { x: 90, z: 120, w: 120, h: 90, c: DISTRICTS[6].color },
      ];
      for (const b of blocks) {
        const [mx, mz] = toMap(b.x, b.z);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = b.c;
        ctx.fillRect(mx, mz, (b.w / 420) * S, (b.h / 420) * S);
      }
      ctx.globalAlpha = 1;
      // Roads.
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      for (const p of [-180, -120, -60, 0, 60, 120, 180]) {
        const [mx] = toMap(p, 0);
        const [, mz] = toMap(0, p);
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(S, mz); ctx.stroke();
      }
      // Landmark dots.
      ctx.fillStyle = '#ffd34d';
      for (const lm of LANDMARKS) {
        const [mx, mz] = toMap(lm.x, lm.z);
        ctx.beginPath(); ctx.arc(mx, mz, 2, 0, Math.PI * 2); ctx.fill();
      }
      // Police dots.
      ctx.fillStyle = '#4d8dff';
      for (const u of state.police.units) {
        if (!u.active) continue;
        const [mx, mz] = toMap(u.mesh.position.x, u.mesh.position.z);
        ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      // Mission marker.
      const [mmx, mmz] = toMap(30, -30);
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath(); ctx.arc(mmx, mmz, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      // Player arrow.
      const [px, pz] = toMap(state.player.position.x, state.player.position.z);
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(state.player.heading);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
    },
  };
}
