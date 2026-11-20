// Progression: the six skills, REP, the twenty Dorada Idols and the completion
// percentage. Skills grow with play; idols are found around the city.
import { SKILLS, IDOL_COUNT } from './config.js';

export function createProgression() {
  return {
    skills: SKILLS.map((s) => ({ ...s })),
    rep: 340,
    idolsFound: 7,
    idolSpots: [],
  };
}

export function gainRep(state, amount) {
  state.rep += amount;
  state.progression.rep = state.rep;
}

export function gainSkill(state, name, amount = 1) {
  const s = state.progression.skills.find((x) => x.name === name);
  if (s) s.level = Math.min(s.max, s.level + amount);
}

export function collectIdol(state) {
  const p = state.progression;
  if (p.idolsFound >= IDOL_COUNT) return false;
  p.idolsFound += 1;
  state.rep += 40;
  state.completion = Math.min(100, state.completion + 1);
  state.hud.flashNotice(`DORADA IDOL ${p.idolsFound}/${IDOL_COUNT} — +40 REP`);
  return true;
}

export function completionBreakdown(state) {
  const jobs = state.missions.completed.filter(Boolean).length / 8;
  const idols = state.progression.idolsFound / IDOL_COUNT;
  const props = state.progression.ownedProperties || 1;
  return {
    jobs: Math.round(jobs * 100),
    idols: Math.round(idols * 100),
    properties: props,
    total: state.completion,
  };
}

export function skillList(state) {
  return state.progression.skills;
}
