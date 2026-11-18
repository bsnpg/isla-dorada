// Isla Dorada — HUD: mission panel, wanted stars, money, clock, police list,
// minimap district label, vitals, weapon rack, drive panel, dialogue, prompt,
// toast and the low-health damage vignette. DOM lookups are cached at init;
// renderHUD only touches the DOM when a value actually changed.
import { MISSIONS, WEAPONS, RADIO, districtAt } from './config.js';
import { Input } from './input.js';

const el = {};
let last = {};
let dialogueTimer = null;
let toastTimer = null;
let weaponSlots = [];

function $(id) {
  return document.getElementById(id);
}

function fmtMoney(n) {
  return '$' + Math.floor(n || 0).toLocaleString('en-US');
}

function fmtClock(playSeconds) {
  // In-game clock starts DAY 1 18:36 and advances with play time.
  const totalMin = 18 * 60 + 36 + Math.floor((playSeconds || 0) / 60);
  const day = 1 + Math.floor(totalMin / 1440);
  const mins = ((totalMin % 1440) + 1440) % 1440;
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `DAY ${day}  ${hh}:${mm}`;
}

function fmtTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function setText(node, key, value) {
  if (last[key] !== value) {
    last[key] = value;
    node.textContent = value;
  }
}

function carPosOf(car) {
  if (!car) return null;
  if (car.mesh && car.mesh.position) return car.mesh.position;
  if (car.pos) return car.pos;
  if (typeof car.x === 'number' && typeof car.z === 'number') return car;
  return null;
}

export function initHUD(G) {
  el.missionCode = $('mission-code');
  el.missionName = $('mission-name');
  el.missionStage = $('mission-stage');
  el.missionObjective = $('mission-objective');
  el.missionTimer = $('mission-timer');
  el.missionNext = $('mission-next');
  el.wanted = $('wanted');
  el.stars = Array.from(el.wanted ? el.wanted.querySelectorAll('span') : []);
  el.money = $('money');
  el.clock = $('game-clock');
  el.policeList = $('police-list');
  el.policeUnits = $('police-units');
  el.district = $('district');
  el.healthFill = $('health-fill');
  el.healthNum = $('health-num');
  el.armourFill = $('armour-fill');
  el.armourNum = $('armour-num');
  el.weaponRack = $('weapon-rack');
  el.speed = $('speed');
  el.vehicleName = $('vehicle-name');
  el.radio = $('radio');
  el.dialogue = $('dialogue');
  el.portrait = $('dialogue-portrait');
  el.speaker = $('dialogue-speaker');
  el.dialogueText = $('dialogue-text');
  el.crosshair = $('crosshair');
  el.prompt = $('prompt');
  el.toast = $('toast');
  el.damage = $('damage');

  // Build the 4 weapon-rack slots once from WEAPONS.
  weaponSlots = [];
  if (el.weaponRack) {
    el.weaponRack.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const slot = document.createElement('div');
      slot.className = 'wslot' + (i === 0 ? ' active' : '');
      slot.innerHTML = `${w.name}<span class="ammo">${w.ammo}</span>`;
      el.weaponRack.appendChild(slot);
      weaponSlots.push(slot);
    });
  }
  last = {};
  void G;
}

export function renderHUD(G) {
  if (!el.money || !G.player) return;
  const p = G.player;
  const m = G.missions || {};
  const idx = typeof m.index === 'number' ? m.index : 0;
  const def = MISSIONS[idx] || MISSIONS[0];

  // --- mission panel ---
  setText(el.missionCode, 'code', def.code || `JOB ${idx + 1}/8`);
  setText(el.missionName, 'name', m.title || def.name || '');
  setText(el.missionStage, 'stage', `STAGE ${m.stage || 1}/${m.stageCount || 3}`);
  setText(el.missionObjective, 'objective', m.objective || def.objective || '');
  const timer = m.timer || 0;
  if (el.missionTimer) {
    const show = timer > 0;
    if (last.timerVisible !== show) {
      last.timerVisible = show;
      el.missionTimer.classList.toggle('hidden', !show);
    }
    if (show) setText(el.missionTimer, 'timer', fmtTimer(timer));
  }
  const nextDef = MISSIONS[idx + 1];
  setText(el.missionNext, 'next', nextDef ? `NEXT: ${nextDef.code} — ${nextDef.name}` : 'NEXT: FREEDOM');

  // --- wanted stars ---
  const wanted = (G.police && typeof G.police.wanted === 'number' ? G.police.wanted : 0);
  if (last.wanted !== wanted) {
    last.wanted = wanted;
    el.stars.forEach((span, i) => span.classList.toggle('off', i >= wanted));
  }

  // --- money + clock ---
  setText(el.money, 'money', fmtMoney(p.money));
  setText(el.clock, 'clock', fmtClock(G.stats ? G.stats.playSeconds : 0));

  // --- police list (only while wanted) ---
  if (el.policeList) {
    const show = wanted > 0;
    if (last.policeVisible !== show) {
      last.policeVisible = show;
      el.policeList.classList.toggle('hidden', !show);
    }
    if (show && el.policeUnits) {
      const units = (G.police && Array.isArray(G.police.units)) ? G.police.units : [];
      const sig = units.map((u) => `${u.name}|${Math.round(u.dist || 0)}|${u.status || ''}`).join(';');
      if (last.policeSig !== sig) {
        last.policeSig = sig;
        el.policeUnits.innerHTML = units.map((u) =>
          `<div class="police-row"><span>${u.name || 'UNIT'}</span>` +
          `<span>${Math.round(u.dist || 0)}m</span>` +
          `<span class="st">${u.status || ''}</span></div>`).join('');
      }
    }
  }

  // --- district ---
  if (el.district && p.pos) {
    setText(el.district, 'district', districtAt(p.pos.x, p.pos.z).name);
  }

  // --- vitals ---
  const health = Math.max(0, Math.min(100, Math.round(p.health || 0)));
  const armour = Math.max(0, Math.min(100, Math.round(p.armour || 0)));
  if (last.health !== health) {
    last.health = health;
    if (el.healthFill) el.healthFill.style.width = `${health}%`;
    if (el.healthNum) el.healthNum.textContent = String(health);
  }
  if (last.armour !== armour) {
    last.armour = armour;
    if (el.armourFill) el.armourFill.style.width = `${armour}%`;
    if (el.armourNum) el.armourNum.textContent = String(armour);
  }

  // --- weapon rack ---
  const wi = (G.combat && typeof G.combat.weaponIndex === 'number') ? G.combat.weaponIndex : 0;
  weaponSlots.forEach((slot, i) => {
    const ammo = (G.combat && G.combat.weapons && G.combat.weapons[i])
      ? G.combat.weapons[i].ammo : WEAPONS[i].ammo;
    const key = `wslot${i}`;
    const sig = `${i === wi ? 'a' : ''}|${ammo}`;
    if (last[key] !== sig) {
      last[key] = sig;
      slot.classList.toggle('active', i === wi);
      const ammoEl = slot.querySelector('.ammo');
      if (ammoEl) ammoEl.textContent = String(ammo);
    }
  });

  // --- drive panel ---
  const inCar = p.mode === 'car' && G.driving && G.driving.car;
  const speedMs = inCar ? Math.abs(G.driving.speed || 0) : Math.abs(p.speed || 0);
  const kmh = Math.round(speedMs * 3.6);
  if (last.kmh !== kmh) {
    last.kmh = kmh;
    if (el.speed) el.speed.innerHTML = `${kmh} <small>KM/H</small>`;
  }
  const car = inCar ? G.driving.car : null;
  const vname = car ? (car.name || (car.def && car.def.name) || car.model || 'CAR') : 'ON FOOT';
  setText(el.vehicleName, 'vname', vname);
  const ri = (G.audio && typeof G.audio.radioIndex === 'number') ? G.audio.radioIndex : 0;
  const station = RADIO[ri] || RADIO[0];
  setText(el.radio, 'radio', `${station.name} — ${station.genre}`);

  // --- crosshair: on foot, in play mode only ---
  if (el.crosshair) {
    const show = G.mode === 'play' && p.mode === 'foot';
    if (last.crosshair !== show) {
      last.crosshair = show;
      el.crosshair.classList.toggle('hidden', !show);
    }
  }

  // --- prompt: 'E — STEAL CAR' within 5 m of a car; otherwise, on foot with the
  // pointer unlocked, a hint to click and aim (suppressed in staged shots) ---
  if (el.prompt) {
    let mode = 'none';
    if (p.mode === 'foot' && p.pos) {
      const cars = [];
      if (G.driving && Array.isArray(G.driving.parked)) cars.push(...G.driving.parked);
      if (G.traffic && Array.isArray(G.traffic.cars)) cars.push(...G.traffic.cars);
      for (const carObj of cars) {
        const cp = carPosOf(carObj);
        if (!cp) continue;
        const dx = cp.x - p.pos.x;
        const dz = cp.z - p.pos.z;
        if (dx * dx + dz * dz <= 25) { mode = 'steal'; break; }
      }
      if (mode === 'none' && !Input.pointerLocked && !G.shotMode) mode = 'aim';
    }
    if (last.prompt !== mode) {
      last.prompt = mode;
      el.prompt.classList.toggle('hidden', mode === 'none');
      el.prompt.textContent = mode === 'steal' ? 'E — STEAL CAR'
        : mode === 'aim' ? 'CLICK TO AIM WITH MOUSE' : '';
    }
  }

  // --- damage vignette ---
  if (el.damage) {
    const opacity = health < 40 ? ((40 - health) / 40) * 0.9 : 0;
    const rounded = Math.round(opacity * 100) / 100;
    if (last.damage !== rounded) {
      last.damage = rounded;
      el.damage.style.opacity = String(rounded);
    }
  }
}

export function showDialogue(G, speaker, text, ms) {
  if (!el.dialogue) return;
  if (dialogueTimer) { clearTimeout(dialogueTimer); dialogueTimer = null; }
  if (el.speaker) el.speaker.textContent = speaker || '';
  if (el.dialogueText) el.dialogueText.textContent = text || '';
  if (el.portrait) el.portrait.textContent = (speaker || '?').charAt(0).toUpperCase();
  el.dialogue.classList.remove('hidden');
  dialogueTimer = setTimeout(() => {
    if (el.dialogue) el.dialogue.classList.add('hidden');
    dialogueTimer = null;
  }, typeof ms === 'number' ? ms : 4000);
  void G;
}

export function flashToast(G, text) {
  if (!el.toast) return;
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  el.toast.textContent = text || '';
  el.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    if (el.toast) el.toast.classList.add('hidden');
    toastTimer = null;
  }, 2500);
  void G;
}
