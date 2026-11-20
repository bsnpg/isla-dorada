// The HUD: speed, wanted stars, the IDPD panel, the objective, health, money,
// REP, the clock, the radio badge, the wedge weapon wheel interface, dialogue
// lines and floating notices. Dense and always readable; it never covers the
// single most important thing in a shot.
import { WEAPONS, RADIO_STATION } from './config.js';
import { clockArcHtml } from './sky.js';
import { currentMission, currentStageText } from './missions.js';

export function createHud(state) {
  const hud = document.getElementById('hud');
  const api = {
    el: hud,
    noticeTimer: 0,
    setSpeed(kmh, nitro) {
      const el = document.getElementById('speed');
      if (el) el.textContent = `${kmh} KM/H`;
      const n = document.getElementById('nitro-bar');
      if (n) n.style.width = `${Math.round(nitro)}%`;
    },
    setWanted(level) {
      const stars = document.querySelectorAll('#wanted span');
      stars.forEach((s, i) => s.classList.toggle('off', i >= level));
    },
    setMoney(v) { const el = document.getElementById('money'); if (el) el.textContent = `$${v.toLocaleString()}`; },
    setHealth(v) { const el = document.getElementById('health-bar'); if (el) el.style.width = `${v}%`; },
    setRep(v) { const el = document.getElementById('rep'); if (el) el.textContent = `REP ${v}`; },
    setVehicle(name) { const el = document.getElementById('vehicle-name'); if (el) el.textContent = name; },
    setClock(h, m) { const el = document.getElementById('clock'); if (el) el.innerHTML = clockArcHtml(h, m); },
    setChaseTimer(s) { const el = document.getElementById('chase-timer'); if (el) el.textContent = s > 0 ? `CHASE ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : ''; },
    setObjective(text) { const el = document.getElementById('mission-objective'); if (el) el.textContent = text; },
    setMissionName(text) { const el = document.getElementById('mission-name'); if (el) el.textContent = text; },
    setMissionCode(text) { const el = document.getElementById('mission-code'); if (el) el.textContent = text; },
    setPrompt(text) { const el = document.getElementById('prompt'); if (el) el.textContent = text; },
    setDialogue(text) { const el = document.getElementById('dialogue'); if (el) el.textContent = text; },
    setIdpd(units, heliOn) {
      const el = document.getElementById('idpd-list');
      if (!el) return;
      el.innerHTML = units.filter((u) => u.active).map((u) =>
        `<div class="idpd-row"><span class="idpd-role">${u.role}</span><span class="idpd-dist">${u.distance}m</span></div>`).join('')
        + (heliOn ? '<div class="idpd-row"><span class="idpd-role">HAWK-1 · Air</span><span class="idpd-dist">240m</span></div>' : '');
    },
    flashNotice(text) {
      const el = document.getElementById('notice');
      if (!el) return;
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(api.noticeTimer);
      api.noticeTimer = setTimeout(() => el.classList.remove('show'), 2600);
    },
    showMissionPassed(mission) {
      const el = document.getElementById('mission-passed');
      if (!el) return;
      el.innerHTML = `<div class="mp-title">MISSION PASSED</div><div class="mp-name">${mission.name} — ${mission.en}</div><div class="mp-pay">+$${mission.payout.toLocaleString()}</div>`;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2600);
    },
    // The GTA-style wedge weapon wheel: six wedges in a circle, Fists at the
    // top, clockwise; the selected wedge is gold, the rest dark; the centre
    // shows the selected weapon's name and ammo.
    renderWheel(selectedIndex) {
      const el = document.getElementById('wheel');
      if (!el) return;
      const size = 190;
      const cx = size / 2;
      const cy = size / 2;
      const R = 88;
      const r = 30;
      const glyphs = ['✊', '🔫', '🔫', '💥', '🎯', '🚀'];
      let wedges = '';
      WEAPONS.forEach((w, i) => {
        const a0 = (-90 + i * 60) * Math.PI / 180;
        const a1 = (-90 + (i + 1) * 60) * Math.PI / 180;
        const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
        const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
        const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
        const x3 = cx + r * Math.cos(a0), y3 = cy + r * Math.sin(a0);
        const sel = i === selectedIndex;
        const mid = (-90 + (i + 0.5) * 60) * Math.PI / 180;
        const gx = cx + 60 * Math.cos(mid);
        const gy = cy + 60 * Math.sin(mid);
        wedges += `<path d="M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 0 0 ${x3} ${y3} Z"
          fill="${sel ? '#f2c94c' : 'rgba(16,20,28,0.88)'}" stroke="#000" stroke-width="1.5"/>
          <text x="${gx}" y="${gy + 5}" font-size="17" text-anchor="middle">${glyphs[i]}</text>`;
      });
      const w = WEAPONS[selectedIndex];
      el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        ${wedges}
        <text x="${cx}" y="${cy - 2}" font-size="13" font-weight="bold" text-anchor="middle" fill="#fff">${w.name.toUpperCase()}</text>
        <text x="${cx}" y="${cy + 15}" font-size="11" text-anchor="middle" fill="#ffd34d">${w.ammo} / ${w.reserve}</text>
      </svg>`;
    },
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },
  };
  return api;
}

// One refresh of every HUD field from the live game state.
export function refreshHud(state) {
  const h = state.hud;
  const d = state.driving;
  h.setSpeed(d.inCar ? Math.round(Math.abs(d.speed) * 3.6) : 0, d.nitro);
  h.setWanted(state.police.wanted);
  h.setMoney(state.money);
  h.setHealth(state.player.health);
  h.setRep(state.rep);
  h.setVehicle(d.inCar ? 'AUREA GT' : 'ON FOOT');
  h.setClock(state.clockHours, state.clockMinutes);
  const m = currentMission(state.missions);
  h.setMissionName(`${m.id}. ${m.name}`);
  h.setMissionCode(`JOB ${m.id}/8 · $${m.payout.toLocaleString()}`);
  h.setObjective(currentStageText(state.missions));
  h.setIdpd(state.police.units, state.police.heli.visible);
  h.renderWheel(state.combat.weaponIndex);
}

export function radioBadge() {
  return RADIO_STATION;
}
