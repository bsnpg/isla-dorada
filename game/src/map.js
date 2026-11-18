// Isla Dorada — full city map screen (rebuild, #map-canvas 640x640): sea,
// island, district washes + labels, roads, landmark markers, player arrow
// and the mission marker. Also refreshes the job checklist and run stats
// from live G. drawMap reads live values every call (no caching) — shots.js
// calls it directly after staging stats. Rebuild: brighter island fill so
// the map reads at a glance, a compass rose, and stats that also show the
// wanted level and cash alongside the measured run numbers.
import { DISTRICTS, MISSIONS, WORLD, KEYS, UPGRADES } from './config.js';
import { Input } from './input.js';

let canvas = null;
let ctx = null;
let checklistEl = null;
let statsEl = null;
let legendEl = null;
let currentRoads = null;

const SIZE = 640;
const SCALE = SIZE / WORLD.size; // px per metre

function toPx(v) {
  return (v + WORLD.size / 2) * SCALE;
}

function posOf(o) {
  if (!o) return null;
  if (o.position && typeof o.position.x === 'number') return { x: o.position.x, z: o.position.z };
  if (o.pos && typeof o.pos.x === 'number') return { x: o.pos.x, z: o.pos.z };
  if (typeof o.x === 'number' && typeof o.z === 'number') return { x: o.x, z: o.z };
  return null;
}

function drawRoads(c) {
  c.strokeStyle = '#565d6e';
  c.lineCap = 'round';
  const roadW = Math.max(3, WORLD.roadWidth * SCALE);
  c.lineWidth = roadW;
  let drew = false;
  const rs = currentRoads;
  if (Array.isArray(rs) && rs.length) {
    for (const r of rs) {
      c.beginPath();
      if (typeof r.x1 === 'number' && typeof r.z1 === 'number'
          && typeof r.x2 === 'number' && typeof r.z2 === 'number') {
        c.moveTo(toPx(r.x1), toPx(r.z1));
        c.lineTo(toPx(r.x2), toPx(r.z2));
      } else if (typeof r.x === 'number' && typeof r.z === 'number'
          && typeof r.angle === 'number' && typeof r.len === 'number') {
        const dx = Math.sin(r.angle) * r.len / 2;
        const dz = Math.cos(r.angle) * r.len / 2;
        c.moveTo(toPx(r.x - dx), toPx(r.z - dz));
        c.lineTo(toPx(r.x + dx), toPx(r.z + dz));
      } else if (Array.isArray(r.points) && r.points.length > 1) {
        r.points.forEach((pt, i) => {
          const q = posOf(pt);
          if (!q) return;
          if (i === 0) c.moveTo(toPx(q.x), toPx(q.z));
          else c.lineTo(toPx(q.x), toPx(q.z));
        });
      } else if (typeof r.x === 'number' && typeof r.z === 'number') {
        c.arc(toPx(r.x), toPx(r.z), roadW / 2, 0, Math.PI * 2);
      } else {
        continue;
      }
      c.stroke();
      drew = true;
    }
  }
  if (!drew) {
    // Fallback: the regular city grid from WORLD constants.
    c.lineWidth = roadW;
    for (let v = -WORLD.size / 2; v <= WORLD.size / 2; v += WORLD.roadGap) {
      c.beginPath(); c.moveTo(toPx(v), 0); c.lineTo(toPx(v), SIZE); c.stroke();
      c.beginPath(); c.moveTo(0, toPx(v)); c.lineTo(SIZE, toPx(v)); c.stroke();
    }
  }
}

function drawDiamond(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y - r);
  c.lineTo(x + r, y);
  c.lineTo(x, y + r);
  c.lineTo(x - r, y);
  c.closePath();
  c.fill();
}

// Places on the map: [landmark key, label, marker shape, marker colour].
// Every entry is a real location in the city (city.js LANDMARK_SPOTS) —
// the legend is built from this same table, so it can never point at a
// place that does not exist. Shapes: dot = gold circle, star = casino,
// square = gas station, diamond = restaurant.
const POIS = [
  ['casino', 'CASINO DORADA', 'star', '#f2c230'],
  ['station', 'IDPD STATION', 'dot', '#f2c230'],
  ['marina', 'MARINA', 'dot', '#f2c230'],
  ['warehouse', 'WAREHOUSE', 'dot', '#f2c230'],
  ['garage', 'GARAGE', 'dot', '#f2c230'],
  ['impound', 'IMPOUND', 'dot', '#f2c230'],
  ['causeway', 'CAUSEWAY', 'dot', '#f2c230'],
  ['harbor', 'HARBOR', 'dot', '#f2c230'],
  ['ferrisWheel', 'FERRIS WHEEL', 'dot', '#f2c230'],
  ['gas', 'GAS STATION', 'square', '#ff8a3a'],
  ['restaurant', 'RESTAURANT', 'diamond', '#ff6ab0'],
];

// Where each of the 8 story jobs lives (stage 1 of missions.js — the job's
// home location). Several jobs share a place, so the badges are drawn as a
// row above the spot. States come from live G: done = green, current =
// gold, next = cream.
const JOB_SPOTS = {
  casino: [1],
  marina: [2, 6],
  impound: [3],
  causeway: [4, 8],
  warehouse: [5],
  station: [7],
};

const JOB_DONE = '#58b368';
const JOB_CURRENT = '#f2c230';
const JOB_NEXT = '#f5efe0';

function refreshChecklist(G) {
  if (!checklistEl) return;
  const idx = (G.missions && typeof G.missions.index === 'number') ? G.missions.index : 0;
  const done = (G.stats && typeof G.stats.missionsDone === 'number') ? G.stats.missionsDone : 0;
  checklistEl.innerHTML = MISSIONS.map((m, i) => {
    const cls = (i < idx || i < done) ? 'done' : (i === idx ? 'current' : '');
    const mark = (i < idx || i < done) ? '✓ ' : (i === idx ? '▶ ' : '· ');
    return `<li class="${cls}">${mark}JOB ${i + 1} — ${m.name}</li>`;
  }).join('');
}

function refreshStats(G) {
  if (!statsEl) return;
  const s = G.stats || {};
  const totalSec = Math.floor(s.playSeconds || 0);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const pct = Math.round(((s.missionsDone || 0) / MISSIONS.length) * 100);
  const wanted = (G.police && typeof G.police.wanted === 'number') ? G.police.wanted : 0;
  const money = G.player ? Math.floor(G.player.money || 0).toLocaleString('en-US') : '0';
  const hours = totalSec >= 3600 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  // V3-3: garage upgrade prices, read from the real UPGRADES table (never
  // hardcoded) — the map now also shows the garage economy.
  const picks = UPGRADES.filter((u) => ['engine', 'armor', 'nitro', 'paint'].includes(u.id));
  const parts = picks.map((u) => `${u.id.toUpperCase()} $${u.price.toLocaleString('en-US')}`);
  const garage = parts.slice(0, 2).join(' · ') + '<br>' + parts.slice(2).join(' · ');
  statsEl.innerHTML =
    `Cars stolen <b>${s.carsStolen || 0}</b><br>` +
    `IDPD escapes <b>${s.escapes || 0}</b><br>` +
    `Jobs done <b>${s.missionsDone || 0} / ${MISSIONS.length}</b><br>` +
    `Play time <b>${hours}</b><br>` +
    `Cash <b>$${money}</b> &nbsp;·&nbsp; Wanted <b>${'★'.repeat(wanted)}${'☆'.repeat(5 - wanted)}</b><br>` +
    `SAVE SLOT 1 — <b>${pct}% COMPLETE</b><br>` +
    `GARAGE <b>${garage}</b>`;
}

export function initMap(G) {
  canvas = document.getElementById('map-canvas');
  ctx = canvas ? canvas.getContext('2d') : null;
  checklistEl = document.getElementById('map-checklist');
  statsEl = document.getElementById('map-stats');
  legendEl = document.getElementById('map-legend');
  const btn = document.getElementById('btn-close-map');
  if (btn) btn.addEventListener('click', () => closeMap(G));
  window.addEventListener('keydown', (e) => {
    if (G.mode === 'map' && (e.code === KEYS.map || e.code === 'Escape')) closeMap(G);
  });
  // main.js opens the map via setMode('map') directly (M key), so refresh
  // whenever the screen becomes visible, not only via openMap.
  const screen = document.getElementById('map-screen');
  if (screen && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      if (!screen.classList.contains('hidden')) drawMap(G);
    }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  }
}

// Legend panel (HTML, in #map-side): every marker on the map, explained.
// Built from the same POIS table the canvas draws, plus the live job states,
// so the legend can never drift from the map. Icons are CSS shapes, not emoji.
function refreshLegend(G) {
  if (!legendEl) return;
  const idx = (G.missions && typeof G.missions.index === 'number') ? G.missions.index : 0;
  const done = (G.stats && typeof G.stats.missionsDone === 'number') ? G.stats.missionsDone : 0;
  const cur = idx + 1;
  const doneJobs = [];
  const nextJobs = [];
  for (let i = 1; i <= MISSIONS.length; i++) {
    if (i < cur || i <= done) doneJobs.push(i);
    else if (i > cur) nextJobs.push(i);
  }
  // Compact ranges ("1–5", "7–8", "1–2, 4") so the legend never wraps.
  const rangeList = (list) => {
    if (!list.length) return '—';
    const out = [];
    let start = list[0], prev = list[0];
    for (let i = 1; i <= list.length; i++) {
      if (list[i] === prev + 1) { prev = list[i]; continue; }
      out.push(start === prev ? String(start) : `${start}–${prev}`);
      start = list[i]; prev = list[i];
    }
    return out.join(', ');
  };
  const swatch = (shape, color) => {
    const base = 'display:inline-block;width:12px;height:12px;margin-right:6px;vertical-align:-1px;';
    if (shape === 'square') return `<span style="${base}background:${color};border:1px solid #1a2030;"></span>`;
    if (shape === 'diamond') return `<span style="${base}background:${color};border:1px solid #1a2030;transform:rotate(45deg);"></span>`;
    if (shape === 'star') return `<span style="${base}background:${color};border:1px solid #1a2030;transform:rotate(45deg);border-radius:2px;"></span>`;
    return `<span style="${base}background:${color};border:1px solid #1a2030;border-radius:50%;"></span>`;
  };
  const rows = [];
  rows.push(`<div>${swatch('diamond', JOB_CURRENT)}<b>JOB ${cur}</b> — CURRENT</div>`);
  rows.push(`<div>${swatch('dot', JOB_DONE)}JOB ${rangeList(doneJobs)} — DONE</div>`);
  rows.push(`<div>${swatch('dot', JOB_NEXT)}JOB ${rangeList(nextJobs)} — NEXT</div>`);
  for (const [key, label, shape, color] of POIS) rows.push(`<div>${swatch(shape, color)}${label}</div>`);
  rows.push(`<div><span style="display:inline-block;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid ${JOB_CURRENT};margin-right:6px;vertical-align:-1px;"></span><b>YOU</b> — PLAYER</div>`);
  legendEl.innerHTML = `<h3>LEGEND</h3><div class="legend-grid">${rows.join('')}</div>`;
}

function drawMarkerShape(c, x, y, shape, color) {
  c.save();
  c.fillStyle = color;
  c.strokeStyle = '#1a2030';
  c.lineWidth = 2;
  if (shape === 'square') {
    c.fillRect(x - 6, y - 6, 12, 12);
    c.strokeRect(x - 6, y - 6, 12, 12);
  } else if (shape === 'diamond') {
    c.beginPath();
    c.moveTo(x, y - 8);
    c.lineTo(x + 8, y);
    c.lineTo(x, y + 8);
    c.lineTo(x - 8, y);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (shape === 'star') {
    c.beginPath();
    c.moveTo(x, y - 9);
    c.lineTo(x + 3, y - 3);
    c.lineTo(x + 9, y);
    c.lineTo(x + 3, y + 3);
    c.lineTo(x, y + 9);
    c.lineTo(x - 3, y + 3);
    c.lineTo(x - 9, y);
    c.lineTo(x - 3, y - 3);
    c.closePath();
    c.fill();
    c.stroke();
  } else {
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.restore();
}

function drawRoute(c, G) {
  const marker = (G.missions && G.missions.marker) ? posOf(G.missions.marker) : null;
  const player = (G.player && G.player.pos) ? { x: G.player.pos.x, z: G.player.pos.z } : null;
  if (!marker || !player) return;
  if (Math.hypot(marker.x - player.x, marker.z - player.z) < 25) return;
  const lines = (G.city && G.city.roadLines) || [-280, -200, -120, -40, 40, 120, 200, 280];
  const nearest = (v) => lines.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const hz = nearest(player.z);
  const vx = nearest(marker.x);
  const pts = [
    [player.x, player.z],
    [player.x, hz],
    [vx, hz],
    [vx, marker.z],
    [marker.x, marker.z],
  ];
  const path = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [px, pz] = pts[i];
    const [lx, lz] = path[path.length - 1];
    if (Math.hypot(px - lx, pz - lz) > 1) path.push([px, pz]);
  }
  if (path.length < 2) return;
  c.save();
  c.strokeStyle = '#f2c230';
  c.lineWidth = 3;
  c.setLineDash([8, 6]);
  c.globalAlpha = 0.9;
  c.beginPath();
  path.forEach(([x, z], i) => {
    const px = toPx(x), py = toPx(z);
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  });
  c.stroke();
  c.restore();
}

export function drawMap(G) {
  if (!ctx || !canvas) return;
  const c = ctx;
  currentRoads = (G.city && G.city.roads) || null;

  // Island background (brighter than the minimap so the full map reads).
  c.clearRect(0, 0, SIZE, SIZE);
  c.fillStyle = '#232c42';
  c.fillRect(0, 0, SIZE, SIZE);

  // Sea (west strip) + beach.
  c.fillStyle = '#1d5a78';
  c.fillRect(0, 0, toPx(WORLD.beachX), SIZE);
  c.fillStyle = '#c9a86a';
  c.fillRect(toPx(WORLD.beachX), 0, toPx(WORLD.beachX + 20) - toPx(WORLD.beachX), SIZE);

  // District washes + labels.
  for (const d of DISTRICTS) {
    c.globalAlpha = 0.14;
    c.fillStyle = d.color;
    c.fillRect(toPx(d.minX), toPx(d.minZ), (d.maxX - d.minX) * SCALE, (d.maxZ - d.minZ) * SCALE);
  }
  c.globalAlpha = 1;

  drawRoads(c);

  // Buildings: small boxes inside each block so the map reads as a city, not
  // empty boxes. Blocks are the 80 m grid cells; roads are 12 m wide, so the
  // boxes sit 10 m inside each block, clear of the road strokes. The west
  // column is sea / beach, so it stays empty. Layout varies by a hash of the
  // cell indices, so it is identical every time the map opens.
  c.fillStyle = '#4d5c7d';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const bx = toPx(-320 + i * 80 + 10);
    const bz = toPx(-320 + j * 80 + 10);
    if (bx < toPx(-280)) continue;
    const v = (i * 7 + j * 13) % 3;
    c.fillRect(bx, bz, 22, 16);
    c.fillRect(bx + 30, bz + 4, 18, 20);
    if (v) c.fillRect(bx + 6, bz + 30, 20, 18);
    if (v === 2) c.fillRect(bx + 34, bz + 32, 16, 14);
  }

  // District names: small and faint, tucked into each district's top-left corner
  // (district centres coincide with landmark dots, so centre labels collide).
  // Drawn after the roads so road strokes never cross the text.
  c.font = '600 11px system-ui, sans-serif';
  c.textAlign = 'left';
  c.fillStyle = 'rgba(245,239,224,0.55)';
  for (const d of DISTRICTS) {
    c.fillText(d.name.toUpperCase(), toPx(d.minX) + 8, toPx(d.minZ) + 16);
  }

  // Route to the current job: a dashed gold line on the road grid, from the
  // player to the mission marker (Manhattan route via the nearest roads).
  // Only when the job is far enough to show a route; also a real GPS in play.
  drawRoute(c, G);

  // POI markers: one shape per place type (see POIS), label on a dark pill
  // so it stays readable; labels that would run past the right edge
  // (Causeway) are right-aligned instead.
  const landmarks = (G.city && G.city.landmarks) || {};
  c.font = '700 12px system-ui, sans-serif';
  for (const [key, label, shape, color] of POIS) {
    const q = posOf(landmarks[key]);
    if (!q) continue;
    const x = toPx(q.x);
    const y = toPx(q.z);
    drawMarkerShape(c, x, y, shape, color);
    const w = c.measureText(label).width;
    const pad = 4;
    const right = x + 10 + w + pad * 2 > SIZE - 4;
    const tx = right ? x - 10 - w - pad * 2 : x + 10;
    c.fillStyle = 'rgba(10,14,22,0.72)';
    c.fillRect(tx, y - 10, w + pad * 2, 18);
    c.fillStyle = '#f5efe0';
    c.textAlign = 'left';
    c.fillText(label, tx + pad, y + 4);
  }

  // Quest badges: numbered circles for all 8 jobs, grouped by place
  // (JOB_SPOTS mirrors missions.js stage 1). Done = green, current = gold
  // with a white ring, next = cream. Shared places get a row above the spot.
  const idx = (G.missions && typeof G.missions.index === 'number') ? G.missions.index : 0;
  const done = (G.stats && typeof G.stats.missionsDone === 'number') ? G.stats.missionsDone : 0;
  c.font = '800 11px system-ui, sans-serif';
  c.textAlign = 'center';
  for (const [key, jobs] of Object.entries(JOB_SPOTS)) {
    const q = posOf(landmarks[key]);
    if (!q) continue;
    const x = toPx(q.x);
    const y = toPx(q.z);
    jobs.forEach((job, k) => {
      const bx = x + (k - (jobs.length - 1) / 2) * 20;
      const by = y - 22;
      const isDone = (job - 1 < idx) || (job - 1 < done);
      const isCurrent = (job - 1 === idx);
      c.fillStyle = isDone ? JOB_DONE : (isCurrent ? JOB_CURRENT : JOB_NEXT);
      c.beginPath();
      c.arc(bx, by, 9, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = isCurrent ? '#ffffff' : '#1a2030';
      c.lineWidth = isCurrent ? 2.5 : 1.5;
      c.stroke();
      c.fillStyle = '#1a2030';
      c.fillText(String(job), bx, by + 4);
    });
  }

  // Mission marker: gold diamond.
  const marker = (G.missions && G.missions.marker) ? posOf(G.missions.marker) : null;
  if (marker) drawDiamond(c, toPx(marker.x), toPx(marker.z), 9, '#f2c230');

  // Player arrow.
  if (G.player && G.player.pos) {
    const px = toPx(G.player.pos.x);
    const py = toPx(G.player.pos.z);
    c.save();
    c.translate(px, py);
    c.rotate(Math.PI - (G.player.heading || 0));
    c.fillStyle = '#f2c230';
    c.strokeStyle = '#1a2030';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(9, 9);
    c.lineTo(0, 4);
    c.lineTo(-9, 9);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  // Compass rose, top-right corner.
  c.fillStyle = '#f2c230';
  c.font = '800 14px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('N', SIZE - 22, 24);
  c.strokeStyle = '#f2c230';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(SIZE - 22, 30);
  c.lineTo(SIZE - 22, 44);
  c.stroke();
  c.beginPath();
  c.moveTo(SIZE - 22, 28);
  c.lineTo(SIZE - 27, 38);
  c.lineTo(SIZE - 17, 38);
  c.closePath();
  c.fill();

  currentRoads = null;
  refreshChecklist(G);
  refreshStats(G);
  refreshLegend(G);
}

export function openMap(G) {
  drawMap(G);
  if (G.setMode) G.setMode('map');
}

export function closeMap(G) {
  // Clear the closing keys from Input: without this, the main loop's next frame
  // would see the still-held M/Escape and reopen the map / pause the game.
  Input.clear(KEYS.map, KEYS.pause);
  if (G.setMode) G.setMode('play');
}
