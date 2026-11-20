// Save slots: the job, the money and the completion percentage per slot.
// Stored in this browser only; a slot that was never written reads EMPTY.
const SAVE_KEY = 'isla-dorada.saves';

export function createSave() {
  let slots = [null, null, null];
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) slots = parsed.slice(0, 3);
    }
  } catch {
    slots = [null, null, null];
  }
  return { slots, key: SAVE_KEY };
}

export function writeSave(state, slot) {
  const s = state.save;
  s.slots[slot] = {
    job: state.missions.current + 1,
    money: state.money,
    completion: state.completion,
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(s.key, JSON.stringify(s.slots));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
  state.hud.flashNotice(`SAVED TO SLOT ${slot + 1}`);
}

export function loadSave(state, slot) {
  const s = state.save.slots[slot];
  if (!s) return false;
  state.missions.current = Math.max(0, Math.min(7, s.job - 1));
  state.money = s.money;
  state.completion = s.completion;
  return true;
}

export function saveSummary(state) {
  return state.save.slots.map((s, i) =>
    `SLOT ${i + 1}: ${s ? `JOB ${s.job}/8 · $${s.money.toLocaleString()} · ${s.completion}%` : 'EMPTY'}`).join(' | ');
}
