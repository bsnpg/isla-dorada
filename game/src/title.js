// The title screen: the big title, the subtitle, the six portraits, the
// continue line and the control hints. Morning light, bright city behind.
import { CHARACTERS, START_JOB, START_MONEY, START_COMPLETION } from './config.js';

export function createTitleScreen(state) {
  const el = document.getElementById('title-screen');
  el.innerHTML = `
    <div class="title-inner">
      <div class="title-kicker">CASINO DORADA PRESENTS</div>
      <h1 class="title-big">ISLA<br>DORADA</h1>
      <div class="title-sub">8 JOBS TO CLEAR HIS NAME</div>
      <div class="title-portraits">
        ${CHARACTERS.map((c) => `<div class="portrait" title="${c.name} — ${c.role}">
          <div class="portrait-face" style="background:${c.color}">${c.initial}</div>
          <div class="portrait-name">${c.name}</div>
          <div class="portrait-role">${c.role}</div>
          <div class="portrait-line">${c.line}</div>
        </div>`).join('')}
      </div>
      <div class="title-continue">CONTINUE — JOB ${START_JOB}/8 · $${START_MONEY.toLocaleString()} · ${START_COMPLETION}% COMPLETE</div>
      <div class="title-buttons">
        <button id="btn-new" class="title-btn primary">NEW GAME</button>
        <button id="btn-continue" class="title-btn">CONTINUE</button>
      </div>
      <div class="title-hint">WASD drive &amp; walk · Mouse aim · 1–6 switch weapons · Q weapon wheel · J jetpack · E steal car · M map · Esc pause</div>
      <div class="title-story">Wowo, ex-Sergeant, dishonourably discharged, came to Isla Dorada to disappear — and became its most wanted getaway driver. Eight jobs stand between him and a clean name.</div>
    </div>`;
  document.getElementById('btn-new').addEventListener('click', () => state.startGame(true));
  document.getElementById('btn-continue').addEventListener('click', () => state.startGame(false));
  return {
    el,
    show() { el.classList.remove('hidden'); },
    hide() { el.classList.add('hidden'); },
  };
}
