// The full city map screen: seven coloured districts, thirteen landmark chips,
// jobs with payouts, skills, properties, the garage, the legend, collectibles,
// save slots and the big completion ring. A dense coloured diagram.
import { DISTRICTS, LANDMARKS, MISSIONS, SKILLS, PROPERTIES, GARAGE_UPGRADES, IDOL_COUNT } from './config.js';
import { missionProgressText } from './missions.js';

export function createMapScreen(state) {
  const el = document.getElementById('map-screen');
  return {
    el,
    show() {
      el.innerHTML = renderMap(state);
      el.classList.remove('hidden');
    },
    hide() { el.classList.add('hidden'); },
    toggle() {
      if (el.classList.contains('hidden')) this.show();
      else this.hide();
    },
  };
}

function renderMap(state) {
  const done = state.missions.completed.filter(Boolean).length;
  const jobs = MISSIONS.map((m) => {
    const isDone = state.missions.completed[m.id - 1];
    const isCurrent = state.missions.current === m.id - 1;
    return `<div class="map-job ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}">
      <span class="map-job-num">${m.id}</span>
      <span class="map-job-name">${m.name}</span>
      <span class="map-job-pay">$${m.payout.toLocaleString()}</span>
      <span class="map-job-state">${isDone ? '✓ DONE' : isCurrent ? '▶ NOW' : 'LOCKED'}</span>
    </div>`;
  }).join('');
  const districts = DISTRICTS.map((d) => `<div class="map-district"><span class="swatch" style="background:${d.color}"></span>${d.name}<i>${d.desc}</i></div>`).join('');
  const landmarks = LANDMARKS.map((lm) => `<span class="map-chip" style="border-color:${(DISTRICTS.find((d) => d.name === lm.district) || {}).color || '#fff'}">◆ ${lm.name}</span>`).join('');
  const skills = SKILLS.map((s) => `<div class="map-skill"><span>${s.name}</span><span class="skill-bar"><i style="width:${s.level * 10}%"></i></span><b>${s.level}/10</b></div>`).join('');
  const props = PROPERTIES.map((p) => `<div class="map-prop">${p.owned ? '★ OWNED' : '— FOR SALE'} <b>${p.name}</b> ${p.owned ? `+$${p.income}/day` : `$${p.price.toLocaleString()}`}</div>`).join('');
  const garage = GARAGE_UPGRADES.map((g) => `<div class="map-garage-row"><span>${g.name}</span><span class="skill-bar"><i style="width:${g.level * 20}%"></i></span><b>Lv ${g.level}/5</b><span>$${g.cost.toLocaleString()}</span></div>`).join('');
  const saves = state.save.slots.map((s, i) => `<div class="map-save">SLOT ${i + 1} — ${s ? `JOB ${s.job}/8 · $${s.money.toLocaleString()} · ${s.completion}%` : 'EMPTY'}</div>`).join('');
  const idols = Math.min(IDOL_COUNT, 7 + done * 2);
  const ring = completionRing(state.completion);
  return `
  <div class="map-head"><h2>ISLA DORADA — CITY MAP</h2><span class="map-close">Press M to close · ${missionProgressText(state)}</span></div>
  <div class="map-grid">
    <div class="map-col map-left">
      <h3>DISTRICTS</h3>${districts}
      <h3>LANDMARKS</h3><div class="map-chips">${landmarks}</div>
      <h3>LEGEND</h3><div class="map-legend">
        <span><b style="color:#ffd34d">●</b> Landmark</span><span><b style="color:#ff5a3c">●</b> Mission</span>
        <span><b style="color:#4d8dff">●</b> IDPD unit</span><span><b style="color:#fff">▲</b> Wowo</span>
        <span><b style="color:#f2c94c">◆</b> Dorada Idol (${idols}/${IDOL_COUNT})</span>
      </div>
    </div>
    <div class="map-col map-mid">
      <div class="map-diagram">${mapDiagram()}</div>
      <h3>COLLECTIBLES — DORADA IDOLS ${idols}/${IDOL_COUNT}</h3>
      <div class="map-idols">${Array.from({ length: IDOL_COUNT }, (_, i) => `<span class="idol ${i < idols ? 'found' : ''}">◆</span>`).join('')}</div>
    </div>
    <div class="map-col map-right">
      <div class="map-ring-wrap">${ring}</div>
      <h3>JOBS — BERSIHKAN NAMA</h3>${jobs}
      <h3>SKILLS</h3>${skills}
      <h3>PROPERTIES</h3>${props}
      <h3>GARAGE — AUREA GT</h3>${garage}
      <h3>SAVE SLOTS</h3>${saves}
    </div>
  </div>`;
}

function completionRing(pct) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return `<svg viewBox="0 0 72 72" width="72" height="72">
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="7"/>
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="#f2c94c" stroke-width="7" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 36 36)"/>
    <text x="36" y="35" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">${pct}%</text>
    <text x="36" y="46" font-size="6" fill="#ffd34d" text-anchor="middle">COMPLETE</text>
  </svg>`;
}

// The diagram: seven coloured district blocks with the Causeway road running
// down the middle, the Beachfront holding markers so it is never an empty strip,
// and the CAUSEWAY label clear of the road marker.
function mapDiagram() {
  const block = (x, y, w, h, color, label, sub) => `<div class="dblock" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;background:${color}">
    <b>${label}</b><i>${sub}</i></div>`;
  return `
  ${block(2, 62, 96, 34, '#f2c94c', 'BEACHFRONT', '◆ Lighthouse · ◆ Beach · ◆ Hotel Row')}
  ${block(2, 6, 30, 52, '#3fa7d6', 'MARINA', '◆ Marina · boats')}
  ${block(34, 6, 32, 52, '#e5539e', 'CASINO ROW', '◆ Casino Dorada')}
  ${block(68, 6, 30, 30, '#d98e4a', 'OLD TOWN', '◆ Old Market · ◆ Garage · ◆ Old Church')}
  ${block(68, 38, 30, 20, '#7a8a99', 'HARBOR', '◆ Warehouse · ◆ IDPD HQ')}
  ${block(34, 38, 32, 20, '#5da85d', 'HILLS', '◆ Hill Villa')}
  <div class="droad"><span class="droad-label">CAUSEWAY</span><span class="droad-toll">◆ Causeway Toll</span></div>
  <div class="dmarker" style="left:20%;top:30%">▲ WOWO</div>
  <div class="dmarker red" style="left:44%;top:18%">● JOB 5 · GUDANG SENJATA</div>`;
}
