// Isla Dorada — title screen wiring: NEW GAME, CONTINUE (save slot 1),
// HOW TO PLAY toggle. showTitle refreshes the continue button from the
// save state; hideTitle is a no-op (main.js setMode hides the screen).
import { hasSave, loadGame } from './save.js';

let btnContinue = null;
let btnNew = null;
let btnHowto = null;
let howtoEl = null;

export function initTitle(G) {
  btnContinue = document.getElementById('btn-continue');
  btnNew = document.getElementById('btn-new');
  btnHowto = document.getElementById('btn-howto');
  howtoEl = document.getElementById('howto');

  if (btnNew) {
    btnNew.addEventListener('click', () => {
      if (G.player) {
        G.player.money = 1250;
        G.player.health = 100;
        G.player.armour = 0;
        G.player.mode = 'foot';
      }
      if (G.stats) {
        G.stats.carsStolen = 0;
        G.stats.escapes = 0;
        G.stats.playSeconds = 0;
        G.stats.missionsDone = 0;
        G.stats.shotsFired = 0;
      }
      if (G.garage) G.garage.owned = {};
      if (G.setWanted) G.setWanted(0);
      if (G.startMission) G.startMission(0);
      if (G.setMode) G.setMode('play');
    });
  }

  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      loadGame(G);
    });
  }

  if (btnHowto && howtoEl) {
    btnHowto.addEventListener('click', () => {
      howtoEl.classList.toggle('hidden');
    });
  }
}

export function showTitle(G) {
  if (!btnContinue) btnContinue = document.getElementById('btn-continue');
  if (!btnContinue) return;
  if (hasSave()) {
    btnContinue.disabled = false;
    btnContinue.textContent = 'CONTINUE — SAVE SLOT 1';
  } else {
    btnContinue.disabled = true;
    btnContinue.textContent = 'CONTINUE — NO SAVE YET';
  }
  void G;
}

export function hideTitle(G) {
  // No structural work: main.js setMode hides the title screen.
  void G;
}
