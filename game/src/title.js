// Isla Dorada — title screen (rebuild): NEW GAME, CONTINUE (save slot 1),
// HOW TO PLAY panel. The rebuild brief: the title must read BRIGHT — the sun
// and skyline behind the menu must stay visible, never a dark murk — and the
// three character cards carry DRAWN PORTRAITS (same art as the dialogue box),
// not bare initials. The HOW TO PLAY controls panel is shown by default;
// the button still toggles it. All visual work is done here in JS (injected
// style + portrait SVGs) so index.html stays untouched.
import { hasSave, loadGame, saveSummary } from './save.js';
import { portraitSVG } from './hud.js';

let btnContinue = null;
let btnNew = null;
let btnHowto = null;
let howtoEl = null;

const TITLE_CHARS = [
  { face: 0, who: 'WOWO', portrait: 'WOWO' },
  { face: 1, who: 'OFFICER BRAGA', portrait: 'BRAGA' },
  { face: 2, who: 'MARA', portrait: 'MARA' },
];

function injectTitleStyle() {
  if (document.getElementById('title-rebuild-style')) return;
  const st = document.createElement('style');
  st.id = 'title-rebuild-style';
  st.textContent = `
/* Bright title: a light warm wash so the sunset, sun disc and skyline read
   through instead of a dark murk. The 3D orbit camera keeps moving behind it. */
#title-screen { background: linear-gradient(180deg, rgba(255,170,60,0.10), rgba(20,16,40,0.28) 55%, rgba(10,8,20,0.55)); }
#title-screen::before { content: ''; position: absolute; left: 12%; top: 9%; width: 150px; height: 150px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,214,122,0.95) 0%, rgba(255,170,60,0.55) 45%, rgba(255,140,40,0) 70%);
  pointer-events: none; }
#title-screen h1 { text-shadow: 0 2px 0 #7a4a00, 0 4px 24px rgba(242,194,48,.65), 0 0 60px rgba(255,180,60,.5); }
#title-screen .tagline { color: #fff3d0; text-shadow: 0 1px 4px rgba(0,0,0,.7); }
#title-screen .char .face { overflow: hidden; background: #2a1c10; }
#title-screen .char .face svg { width: 100%; height: 100%; display: block; }
#title-screen #howto { border-color: rgba(242,194,48,.55); box-shadow: 0 4px 24px rgba(0,0,0,.45); }
#title-screen #howto b { color: #f2c230; }
#title-screen .controls { color: #ffe9b0; text-shadow: 0 1px 4px rgba(0,0,0,.8); }`;
  document.head.appendChild(st);
}

function paintTitlePortraits() {
  const faces = document.querySelectorAll('#title-screen .char .face');
  faces.forEach((faceEl, i) => {
    const def = TITLE_CHARS[i];
    if (!def) return;
    faceEl.innerHTML = portraitSVG(def.portrait);
    faceEl.setAttribute('role', 'img');
    faceEl.setAttribute('aria-label', def.who);
  });
}

function showHowtoByDefault() {
  // The HOW TO PLAY panel lists the real controls and must be visible on the
  // title screen (and in the staged title screenshot), not hidden behind a
  // toggle nobody presses. The button still toggles it for players who want
  // it gone.
  if (howtoEl) howtoEl.classList.remove('hidden');
}

export function initTitle(G) {
  injectTitleStyle();
  btnContinue = document.getElementById('btn-continue');
  btnNew = document.getElementById('btn-new');
  btnHowto = document.getElementById('btn-howto');
  howtoEl = document.getElementById('howto');

  paintTitlePortraits();
  showHowtoByDefault();

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
  // Portraits + bright panel are re-applied on every return to title so a
  // stale DOM (or a staged title shot) always shows the rebuilt face.
  paintTitlePortraits();
  showHowtoByDefault();
  if (!btnContinue) return;
  if (hasSave()) {
    btnContinue.disabled = false;
    const summary = saveSummary();
    const pct = summary ? ` — ${summary.percent}% COMPLETE` : '';
    btnContinue.textContent = `CONTINUE — SAVE SLOT 1${pct}`;
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
