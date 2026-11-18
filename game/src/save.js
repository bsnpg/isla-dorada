// Isla Dorada — save / load via localStorage (key GAME.saveKey).
// All localStorage access is wrapped in try/catch (private windows).
import { GAME, MISSIONS } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      missionIndex: (G.missions && typeof G.missions.index === 'number') ? G.missions.index : 0,
      money: G.player ? G.player.money : 0,
      upgrades: (G.garage && G.garage.owned) ? { ...G.garage.owned } : {},
      stats: G.stats ? { ...G.stats } : {},
      playerPos: (G.player && G.player.pos)
        ? { x: G.player.pos.x, z: G.player.pos.z } : { x: 0, z: 0 },
      health: G.player ? G.player.health : 100,
      armour: G.player ? G.player.armour : 0,
    };
    window.localStorage.setItem(GAME.saveKey, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame(G) {
  let data = null;
  try {
    const raw = window.localStorage.getItem(GAME.saveKey);
    if (!raw) return false;
    data = JSON.parse(raw);
  } catch (err) {
    return false;
  }
  if (!data || typeof data !== 'object') return false;

  if (typeof data.money === 'number' && G.player) G.player.money = data.money;
  if (typeof data.health === 'number' && G.player) G.player.health = data.health;
  if (typeof data.armour === 'number' && G.player) G.player.armour = data.armour;

  if (data.upgrades && typeof data.upgrades === 'object') {
    if (!G.garage) G.garage = { owned: {} };
    if (!G.garage.owned) G.garage.owned = {};
    for (const key of Object.keys(G.garage.owned)) delete G.garage.owned[key];
    Object.assign(G.garage.owned, data.upgrades);
  }

  if (data.stats && typeof data.stats === 'object' && G.stats) {
    Object.assign(G.stats, data.stats);
  }

  if (data.playerPos && G.player && G.player.pos && typeof G.player.pos.set === 'function') {
    G.player.pos.set(data.playerPos.x || 0, 0, data.playerPos.z || 0);
  }

  const missionIndex = (typeof data.missionIndex === 'number'
    && data.missionIndex >= 0 && data.missionIndex < MISSIONS.length)
    ? data.missionIndex : 0;
  if (G.startMission) G.startMission(missionIndex);
  if (G.setMode) G.setMode('play');
  return true;
}

export function hasSave() {
  try {
    return window.localStorage.getItem(GAME.saveKey) !== null;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(GAME.saveKey);
    return true;
  } catch (err) {
    return false;
  }
}
