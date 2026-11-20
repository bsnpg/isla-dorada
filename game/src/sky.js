// The sky: morning, evening and night presets, the sun disc with halo and flare,
// the moon disc with halo, per-mood lighting, and the clock panel's sun/moon arc.
// The morning sun is deliberately LOUD: a big low disc with a halo and flare.
import * as THREE from 'three';

export const MOODS = {
  morning: { sky: 0x9fd4f2, fog: 0xbfd9ea, sun: 0xffd34d, sunPos: [-140, 26, -260], hemi: 0xbfd9ff, hemiGround: 0x8a7a5a, dir: 0xffe6b0, dirIntensity: 1.5, ambient: 0x8090a0 },
  evening: { sky: 0xf2a35e, fog: 0xe8a06a, sun: 0xff8c2e, sunPos: [160, 20, -240], hemi: 0xffc890, hemiGround: 0x6a5a4a, dir: 0xffb36a, dirIntensity: 1.2, ambient: 0x705a50 },
  night: { sky: 0x0d1730, fog: 0x14203c, sun: 0xf2ead8, sunPos: [120, 90, -220], hemi: 0x33456e, hemiGround: 0x1a2030, dir: 0x9db4e8, dirIntensity: 0.55, ambient: 0x2a3550 },
};

export function createSky(scene, moodName) {
  const mood = MOODS[moodName] || MOODS.morning;
  scene.background = new THREE.Color(mood.sky);
  scene.fog = new THREE.Fog(mood.fog, 120, 520);
  const hemi = new THREE.HemisphereLight(mood.hemi, mood.hemiGround, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(mood.dir, mood.dirIntensity);
  dir.position.set(mood.sunPos[0], mood.sunPos[1] + 60, mood.sunPos[2]);
  scene.add(dir);
  const amb = new THREE.AmbientLight(mood.ambient, 0.5);
  scene.add(amb);

  const group = new THREE.Group();
  scene.add(group);
  // Both luminaries are always built; the mood only decides which one shows,
  // so a night shot staged from a morning scene still gets its moon.
  const sunGroup = new THREE.Group();
  const moonGroup = new THREE.Group();
  group.add(sunGroup);
  group.add(moonGroup);
  let sunMesh = null;
  let moonMesh = null;

  // Big low morning sun: radius 22 (was a small pale disc in V7), with halo + flare.
  sunMesh = makeDisc(mood.sun, 22, 0xffdf80);
  sunMesh.position.set(mood.sunPos[0], mood.sunPos[1], mood.sunPos[2]);
  sunGroup.add(sunMesh);
  const halo = makeDisc(0xffdf80, 40, 0xffdf80, 0.28);
  halo.position.set(mood.sunPos[0], mood.sunPos[1], mood.sunPos[2] - 2);
  sunGroup.add(halo);
  const flare = makeDisc(0xfff2b0, 9, 0xfff2b0, 0.85);
  flare.position.set(mood.sunPos[0] + 52, mood.sunPos[1] + 14, mood.sunPos[2] - 1);
  sunGroup.add(flare);
  const flare2 = makeDisc(0xfff2b0, 5, 0xfff2b0, 0.7);
  flare2.position.set(mood.sunPos[0] - 46, mood.sunPos[1] - 10, mood.sunPos[2] - 1);
  sunGroup.add(flare2);

  moonMesh = makeDisc(0xf2ead8, 16, 0xf8f2dd);
  moonMesh.position.set(120, 95, -260);
  moonGroup.add(moonMesh);
  const mhalo = makeDisc(0xdde6ff, 26, 0xdde6ff, 0.16);
  mhalo.position.set(120, 95, -262);
  moonGroup.add(mhalo);

  function setMood(name) {
    const m = MOODS[name] || MOODS.morning;
    scene.background = new THREE.Color(m.sky);
    scene.fog = new THREE.Fog(m.fog, 120, 520);
    hemi.color.set(m.hemi);
    hemi.groundColor.set(m.hemiGround);
    dir.color.set(m.dir);
    dir.intensity = m.dirIntensity;
    amb.color.set(m.ambient);
    sunGroup.visible = name !== 'night';
    moonGroup.visible = name === 'night';
  }
  setMood(moodName);
  return { mood, group, sunGroup, moonGroup, sunMesh, moonMesh, hemi, dir, setMood };
}

function makeDisc(color, radius, edgeColor, opacity = 1) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
  return mesh;
}

// Clock panel: an SVG arc with the sun travelling across the day and the moon at
// night. Returns the inner HTML for the #clock element.
export function clockArcHtml(hours, minutes) {
  const t = hours + minutes / 60;
  const isNight = t < 6 || t >= 19;
  const frac = isNight ? ((t + 24 - 19) % 24) / 11 : (t - 6) / 13;
  const clamped = Math.max(0, Math.min(1, frac));
  const angle = Math.PI * (1 - clamped);
  const cx = 34 + 28 * Math.cos(angle);
  const cy = 30 - 24 * Math.sin(angle);
  const icon = isNight ? '☾' : '☀';
  const label = isNight ? 'Night' : t < 12 ? 'Morning' : t < 17 ? 'Afternoon' : 'Evening';
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `<svg viewBox="0 0 68 34" width="68" height="34" aria-hidden="true">
    <path d="M6 30 A28 24 0 0 1 62 30" fill="none" stroke="#f2c94c" stroke-width="2"/>
    <text x="${cx}" y="${cy + 5}" font-size="13" text-anchor="middle" fill="#ffd34d">${icon}</text>
  </svg><div class="clock-time">${hh}:${mm}</div><div class="clock-label">${label}</div>`;
}

export function applyMood(scene, moodName) {
  const mood = MOODS[moodName] || MOODS.morning;
  scene.background = new THREE.Color(mood.sky);
  scene.fog = new THREE.Fog(mood.fog, 120, 520);
}
