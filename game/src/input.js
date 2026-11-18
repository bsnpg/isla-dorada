// Keyboard + mouse input state. Classic WASD driving, mouse aim on foot.
export const Input = {
  keys: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  mouseClicked: false,
  pointerLocked: false,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  },

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  },

  pressed(code) {
    if (this.keys.has(code)) { this.keys.delete(code); return true; }
    return false;
  },

  // Drop keys from the held set (used when a key both closes an overlay and would
  // otherwise be seen again by the main loop on the next frame — e.g. M closing
  // the map would instantly reopen it).
  clear(...codes) {
    for (const c of codes) this.keys.delete(c);
  },

  // Consume the per-frame mouse deltas.
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  },

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  },

  lockPointer(canvas) {
    if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
  },

  unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  },
};
