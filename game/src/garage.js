// Isla Dorada — garage screen (rebuild): build the upgrade list from
// UPGRADES, buy upgrades with cash, refresh on open. driving.js reads
// G.garage.owned for the engine / brakes / nitro effects — this module only
// stores the owned levels. The rebuild adds level pips (●○○) so owned levels
// read at a glance, an affordability state on every row, and a one-line
// summary of the car the upgrades apply to.
import { UPGRADES, KEYS } from './config.js';
import { Input } from './input.js';
import { playSFX } from './audio.js';

let listEl = null;
let moneyEl = null;
let summaryEl = null;

function fmtMoney(n) {
  return '$' + Math.floor(n || 0).toLocaleString('en-US');
}

function ownedLevel(G, id) {
  return (G.garage && G.garage.owned && G.garage.owned[id]) || 0;
}

function pips(level, max) {
  let s = '';
  for (let i = 0; i < max; i++) s += i < level ? '●' : '○';
  return s;
}

function refreshGarage(G) {
  const money = G.player ? G.player.money : 0;
  if (moneyEl) moneyEl.textContent = fmtMoney(money);
  if (summaryEl) {
    const car = (G.driving && G.driving.car) ? G.driving.car : null;
    const owned = (G.garage && G.garage.owned) || {};
    const spent = UPGRADES.reduce((t, u) => t + (owned[u.id] || 0) * u.price, 0);
    const carName = car ? (car.name || (car.def && car.def.name) || 'YOUR CAR') : 'NO CAR — STEAL ONE FIRST';
    summaryEl.textContent = `${carName}  ·  UPGRADES INSTALLED: ${Object.values(owned).reduce((a, b) => a + b, 0)}  ·  SPENT: ${fmtMoney(spent)}`;
  }
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const u of UPGRADES) {
    const level = ownedLevel(G, u.id);
    const maxed = level >= u.max;
    const afford = money >= u.price;
    const row = document.createElement('div');
    row.className = 'upg' + (maxed ? ' owned' : '') + (!maxed && !afford ? ' cant-afford' : '');
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.innerHTML = `<b>${u.name}</b> — ${u.desc} <span class="price">${fmtMoney(u.price)}</span>`;
    const lvl = document.createElement('div');
    lvl.textContent = `LV ${level}/${u.max}  ${pips(level, u.max)}${maxed ? '  — MAXED' : (afford ? '' : '  — NEED ' + fmtMoney(u.price - money) + ' MORE')}`;
    lvl.style.cssText = 'color: var(--muted); font-size: 12px; margin-top: 2px;';
    info.appendChild(title);
    info.appendChild(lvl);
    const btn = document.createElement('button');
    btn.textContent = maxed ? 'MAXED' : 'BUY';
    btn.disabled = maxed || !afford;
    btn.addEventListener('click', () => buyUpgrade(G, u.id));
    row.appendChild(info);
    row.appendChild(btn);
    listEl.appendChild(row);
  }
}

export function initGarage(G) {
  if (!G.garage) G.garage = { owned: {} };
  if (!G.garage.owned) G.garage.owned = {};
  listEl = document.getElementById('garage-list');
  moneyEl = document.getElementById('garage-money');
  // Summary line under the money display (created here, index.html untouched).
  const screen = document.getElementById('garage-screen');
  if (screen && moneyEl && !$('garage-summary')) {
    summaryEl = document.createElement('div');
    summaryEl.id = 'garage-summary';
    summaryEl.style.cssText = 'color: var(--muted); font: 600 12px ui-monospace, Menlo, monospace; margin: 2px 0 10px; text-align: center;';
    moneyEl.after(summaryEl);
  } else {
    summaryEl = document.getElementById('garage-summary');
  }
  const btn = document.getElementById('btn-close-garage');
  if (btn) btn.addEventListener('click', () => closeGarage(G));
  window.addEventListener('keydown', (e) => {
    if (G.mode === 'garage' && (e.code === KEYS.garage || e.code === 'Escape')) closeGarage(G);
  });
  // main.js opens the garage via setMode('garage') directly (G key near the
  // garage), so refresh whenever the screen becomes visible, not only via
  // openGarage.
  if (screen && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      if (!screen.classList.contains('hidden')) refreshGarage(G);
    }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  }
  refreshGarage(G);
}

export function openGarage(G) {
  refreshGarage(G);
  if (G.setMode) G.setMode('garage');
}

export function closeGarage(G) {
  // Clear the closing keys from Input: without this, the main loop's next frame
  // would see the still-held G/Escape and reopen the garage / pause the game.
  Input.clear(KEYS.garage, KEYS.pause);
  if (G.setMode) G.setMode('play');
}

export function buyUpgrade(G, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return;
  if (!G.garage) G.garage = { owned: {} };
  if (!G.garage.owned) G.garage.owned = {};
  const level = G.garage.owned[id] || 0;
  if (level >= u.max) return;
  if (!G.player || G.player.money < u.price) return;
  G.player.money -= u.price;
  G.garage.owned[id] = level + 1;
  playSFX(G, 'cash');
  refreshGarage(G);
}

function $(id) {
  return document.getElementById(id);
}
