// Keyboard and mouse input. Held keys steer and drive; one-shot presses (weapon
// keys, wheel, enter/exit car, map, pause) are queued as flags and taken once by
// the game loop, so a press between frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MAP = 4;
export const ACTION_EXIT_CAR = 8;
export const ACTION_WHEEL = 16;
export const ACTION_JETPACK = 32;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['Escape', 'KeyP']);
const MAP = new Set(['KeyM']);
const EXIT = new Set(['KeyE', 'KeyF']);
const WHEEL = new Set(['Tab', 'KeyQ']);
const JETPACK = new Set(['KeyJ', 'ShiftLeft']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let weaponKey = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code >= 'Digit1' && event.code <= 'Digit6') {
      if (!event.repeat) weaponKey = Number(event.code.slice(5));
      return;
    }
    held.add(event.code);
    if (CONFIRM.has(event.code) && !event.repeat) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code) && !event.repeat) actions |= ACTION_PAUSE;
    else if (MAP.has(event.code) && !event.repeat) actions |= ACTION_MAP;
    else if (EXIT.has(event.code) && !event.repeat) actions |= ACTION_EXIT_CAR;
    else if (WHEEL.has(event.code) && !event.repeat) actions |= ACTION_WHEEL;
    else if (JETPACK.has(event.code) && !event.repeat) actions |= ACTION_JETPACK;
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  target.addEventListener('pointerdown', (event) => { mouseDown = true; mouseX = event.clientX; mouseY = event.clientY; });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  window.addEventListener('pointermove', (event) => { mouseX = event.clientX; mouseY = event.clientY; });

  const has = (...sets) => sets.some((s) => [...s].some((c) => held.has(c)));
  return {
    forward() { return has(FORWARD); },
    back() { return has(BACK); },
    left() { return has(LEFT); },
    right() { return has(RIGHT); },
    sprint() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    takeActions() { const t = actions; actions = 0; return t; },
    takeWeaponKey() { const t = weaponKey; weaponKey = 0; return t; },
    firing() { return mouseDown; },
    pointer() { return { x: mouseX, y: mouseY }; },
  };
}
