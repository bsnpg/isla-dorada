// Side jobs around the city: deliveries, getaways and pickups with their pay.
// Completing one pays money and REP and advances the clock.
import { range, pick } from './random.js';

const JOB_TYPES = [
  { kind: 'Delivery', text: 'Deliver the package to Hotel Row', pay: 800 },
  { kind: 'Getaway', text: 'Getaway driver for the Marina crew', pay: 1500 },
  { kind: 'Pickup', text: 'Pick up the courier at the Old Market', pay: 600 },
  { kind: 'Delivery', text: 'Deliver casino chips to the Hill Villa', pay: 1200 },
  { kind: 'Getaway', text: 'Lose the IDPD tail on the Causeway', pay: 2000 },
  { kind: 'Pickup', text: 'Collect the crate at the Container Yard', pay: 900 },
];

export function createSideJobs(rng) {
  const jobs = JOB_TYPES.map((j, i) => ({
    ...j,
    id: i + 1,
    done: false,
    x: range(rng, -160, 160),
    z: range(rng, -160, 160),
  }));
  return { jobs, active: null };
}

export function offerSideJob(state) {
  const sj = state.sidejobs;
  const next = sj.jobs.find((j) => !j.done);
  if (!next) return null;
  sj.active = next;
  state.hud.flashNotice(`SIDE JOB — ${next.kind}: ${next.text} ($${next.pay})`);
  return next;
}

export function completeSideJob(state) {
  const sj = state.sidejobs;
  if (!sj.active) return false;
  sj.active.done = true;
  state.money += sj.active.pay;
  state.rep += 25;
  state.hud.flashNotice(`SIDE JOB DONE +$${sj.active.pay} · +25 REP`);
  state.audio.playPickup();
  sj.active = null;
  return true;
}

export function sideJobList(state) {
  return state.sidejobs.jobs.map((j) =>
    `${j.done ? '✓' : '○'} ${j.kind} — ${j.text} ($${j.pay})`).join('\n');
}

export function randomSideJobText(rng) {
  return pick(rng, JOB_TYPES).text;
}
