// The mission state machine: the eight jobs, their three stages (reach, the
// job, escape), objectives, the mission-passed banner and payouts.
import { MISSIONS, START_JOB } from './config.js';

export function createMissions() {
  return {
    current: START_JOB - 1,
    stage: 0,
    timer: 0,
    passed: false,
    passedAt: 0,
    completed: [true, true, true, true, false, false, false, false],
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.current];
}

export function currentStageText(missions) {
  const m = currentMission(missions);
  return m.stages[missions.stage] || m.stages[0];
}

export function advanceStage(state) {
  const ms = state.missions;
  const m = currentMission(ms);
  ms.stage += 1;
  if (ms.stage >= m.stages.length) {
    completeMission(state);
  } else {
    state.hud.flashNotice(`STAGE ${ms.stage + 1}/3 — ${m.stages[ms.stage]}`);
  }
}

export function completeMission(state) {
  const ms = state.missions;
  const m = currentMission(ms);
  ms.completed[ms.current] = true;
  ms.passed = true;
  ms.passedAt = performance.now();
  state.money += m.payout;
  state.rep += 120;
  state.completion = Math.min(100, state.completion + 5);
  state.hud.showMissionPassed(m);
  state.audio.playMissionPassed();
  state.hud.flashNotice(`+$${m.payout.toLocaleString()} — ${m.name} complete`);
  setTimeout(() => {
    ms.current = Math.min(MISSIONS.length - 1, ms.current + 1);
    ms.stage = 0;
    ms.passed = false;
  }, 2600);
}

export function updateMissions(state, dt) {
  const ms = state.missions;
  ms.timer += dt;
  // Causeway chase (job 4) runs on a 150-second clock while active.
  if (ms.current === 3 && ms.stage === 1) {
    const left = Math.max(0, 150 - Math.floor(ms.timer));
    state.hud.setChaseTimer(left);
    if (left === 0) advanceStage(state);
  }
}

export function missionProgressText(state) {
  const done = state.missions.completed.filter(Boolean).length;
  return `JOB ${state.missions.current + 1}/8 · ${done}/8 DONE`;
}
