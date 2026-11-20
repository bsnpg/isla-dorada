// Sound made inside the game with the browser's own audio (Web Audio): engine
// hum, shots, explosions, pickup notes and the mission-passed chime. No audio
// files are fetched from the network; every sound is generated.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }
  function noise(dur, vol) {
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    src.connect(g);
    g.connect(c.destination);
    src.start();
  }
  return {
    unlock() { ensure(); },
    playShot(name) {
      if (name === 'Bazooka') { noise(0.4, 0.3); tone(90, 0.35, 'sawtooth', 0.2, 40); }
      else if (name === 'Shotgun') { noise(0.25, 0.28); tone(160, 0.15, 'square', 0.14, 70); }
      else if (name === 'Fists') { tone(120, 0.08, 'sine', 0.15, 80); }
      else { tone(720, 0.07, 'square', 0.1, 220); noise(0.06, 0.1); }
    },
    playExplosion() { noise(0.8, 0.4); tone(60, 0.7, 'sawtooth', 0.25, 28); },
    playPickup() { tone(660, 0.1, 'sine', 0.14); setTimeout(() => tone(990, 0.14, 'sine', 0.14), 90); },
    playMissionPassed() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 130));
    },
    startEngine() {
      const c = ensure();
      if (!c || engineOsc) return;
      engineOsc = c.createOscillator();
      engineGain = c.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      engineGain.gain.value = 0.03;
      engineOsc.connect(engineGain);
      engineGain.connect(c.destination);
      engineOsc.start();
    },
    setEngine(rpm) {
      if (engineOsc) engineOsc.frequency.value = 55 + rpm * 120;
    },
    stopEngine() {
      if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; }
    },
  };
}
