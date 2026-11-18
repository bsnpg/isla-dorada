// Isla Dorada — garage screen: build the upgrade list from UPGRADES,
// buy upgrades with cash, refresh on open. driving.js reads
// G.garage.owned for the engine / brakes / nitro effects — this module
// only stores the owned levels.
import { UPGRADES, KEYS } from './config.js';
import { Input } from './input.js';
import { playSFX } from './audio.js';

let listEl = null;
let moneyEl = null;

function fmtMoney(n) {
  return '$' + Math.floor(n || 0).toLocaleString('en-US');
}

function ownedLevel(G, id) {
  return (G.garage && G.garage.owned && G.garage.owned[id]) || 0;
}

function refreshGarage(G) {
  if (moneyEl) moneyEl.textContent = fmtMoney(G.player ? G.player.money : 0);
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const u of UPGRADES) {
    const level = ownedLevel(G, u.id);
    const maxed = level >= u.max;
    const afford = (G.player ? G.player.money : 0) >= u.price;
    const row = document.createElement('div');
    row.className = 'upg' + (maxed ? ' owned' : '');
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.innerHTML = `<b>${u.name}</b> — ${u.desc} <span class="price">${fmtMoney(u.price)}</span>`;
    const lvl = document.createElement('div');
    lvl.textContent = `LV ${level}/${u.max}`;
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
  const btn = document.getElementById('btn-close-garage');
  if (btn) btn.addEventListener('click', () => closeGarage(G));
  window.addEventListener('keydown', (e) => {
    if (G.mode === 'garage' && (e.code === KEYS.garage || e.code === 'Escape')) closeGarage(G);
  });
  // main.js opens the garage via setMode('garage') directly (G key near the
  // garage), so refresh whenever the screen becomes visible, not only via
  // openGarage.
  const screen = document.getElementById('garage-screen');
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
