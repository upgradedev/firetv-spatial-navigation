const DIRECTIONS = Object.freeze({
  UP: "UP",
  DOWN: "DOWN",
  LEFT: "LEFT",
  RIGHT: "RIGHT"
});

const DIRECTION_SET = new Set(Object.values(DIRECTIONS));

const KEY_TO_ACTION = Object.freeze({
  ArrowUp: DIRECTIONS.UP,
  Up: DIRECTIONS.UP,
  ArrowDown: DIRECTIONS.DOWN,
  Down: DIRECTIONS.DOWN,
  ArrowLeft: DIRECTIONS.LEFT,
  Left: DIRECTIONS.LEFT,
  ArrowRight: DIRECTIONS.RIGHT,
  Right: DIRECTIONS.RIGHT,
  Enter: "SELECT",
  Select: "SELECT",
  Escape: "BACK",
  Backspace: "BACK"
});

// Android KeyEvent direction codes and common browser keyCode fallbacks.
const KEY_CODE_TO_ACTION = Object.freeze({
  4: "BACK",
  8: "BACK",
  13: "SELECT",
  19: DIRECTIONS.UP,
  20: DIRECTIONS.DOWN,
  21: DIRECTIONS.LEFT,
  22: DIRECTIONS.RIGHT,
  23: "SELECT",
  37: DIRECTIONS.LEFT,
  38: DIRECTIONS.UP,
  39: DIRECTIONS.RIGHT,
  40: DIRECTIONS.DOWN
});

const ACTION_ALIASES = Object.freeze({
  ARROWUP: DIRECTIONS.UP,
  ARROWDOWN: DIRECTIONS.DOWN,
  ARROWLEFT: DIRECTIONS.LEFT,
  ARROWRIGHT: DIRECTIONS.RIGHT,
  ENTER: "SELECT",
  OK: "SELECT",
  ESCAPE: "BACK",
  BACKSPACE: "BACK"
});

export function normaliseAction(action) {
  if (typeof action === "number" && Number.isFinite(action)) {
    return KEY_CODE_TO_ACTION[action] || null;
  }
  if (typeof action !== "string") return null;
  const value = action.trim().toUpperCase();
  if (DIRECTION_SET.has(value) || value === "SELECT" || value === "BACK") return value;
  if (ACTION_ALIASES[value]) return ACTION_ALIASES[value];
  if (/^\d+$/.test(value)) return KEY_CODE_TO_ACTION[Number(value)] || null;
  return null;
}

export function actionFromKeyboardEvent(event) {
  if (!event) return null;
  if (typeof event.key === "string" && KEY_TO_ACTION[event.key]) {
    return KEY_TO_ACTION[event.key];
  }
  const legacyCode = event.keyCode ?? event.which;
  return KEY_CODE_TO_ACTION[legacyCode] || null;
}

export function centreOf(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function scoreCandidate(from, to, direction, perpendicularPenalty = 2.5) {
  const resolvedDirection = normaliseAction(direction);
  if (!DIRECTION_SET.has(resolvedDirection)) return null;
  if (!Number.isFinite(perpendicularPenalty) || perpendicularPenalty < 0) {
    throw new TypeError("perpendicularPenalty must be a non-negative finite number");
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let along;
  let across;

  if (resolvedDirection === DIRECTIONS.RIGHT) [along, across] = [dx, Math.abs(dy)];
  else if (resolvedDirection === DIRECTIONS.LEFT) [along, across] = [-dx, Math.abs(dy)];
  else if (resolvedDirection === DIRECTIONS.DOWN) [along, across] = [dy, Math.abs(dx)];
  else [along, across] = [-dy, Math.abs(dx)];

  if (along <= 0) return null;
  return along + across * perpendicularPenalty;
}

function isEditable(element) {
  if (!element) return false;
  const tagName = String(element.tagName || "").toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || element.isContentEditable === true;
}

export function isNavigable(element, win = globalThis.window) {
  if (!element || element.hidden || element.disabled) return false;
  if (element.getAttribute?.("aria-hidden") === "true") return false;
  if (element.getAttribute?.("aria-disabled") === "true") return false;

  const style = win?.getComputedStyle?.(element);
  if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) {
    return false;
  }

  const rect = element.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

function labelOf(element) {
  const explicit = element.getAttribute?.("data-tv-label") || element.getAttribute?.("aria-label");
  if (explicit) return explicit;
  const text = String(element.textContent || "").trim();
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function focusWithoutScrolling(element) {
  if (typeof element.focus !== "function") return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export class SpatialNavigator {
  constructor(options = {}) {
    this.root = options.root || globalThis.document;
    this.window = options.window || globalThis.window;
    if (!this.root?.querySelectorAll) {
      throw new TypeError("root must provide querySelectorAll");
    }

    this.selector = options.selector || "[data-tv-focusable]:not([disabled]):not([hidden])";
    this.focusClass = options.focusClass || "tv-focused";
    this.focusEvent = options.focusEvent || "tv:focuschange";
    this.perpendicularPenalty = options.perpendicularPenalty ?? 2.5;
    if (!Number.isFinite(this.perpendicularPenalty) || this.perpendicularPenalty < 0) {
      throw new TypeError("perpendicularPenalty must be a non-negative finite number");
    }

    this.current = null;
    this.enabled = true;
    this.onBack = options.onBack || null;
    this.onFocusChange = options.onFocusChange || null;
    this._cleanup = null;
  }

  candidates() {
    return Array.from(this.root.querySelectorAll(this.selector)).filter((element) => isNavigable(element, this.window));
  }

  setFocus(element) {
    if (!isNavigable(element, this.window)) return null;
    const previous = this.current;
    if (previous && previous !== element) previous.classList?.remove(this.focusClass);
    element.classList?.add(this.focusClass);
    this.current = element;
    focusWithoutScrolling(element);

    const rect = element.getBoundingClientRect();
    const width = this.window?.innerWidth || 0;
    const height = this.window?.innerHeight || 0;
    const outside = width && height && (rect.left < 0 || rect.top < 0 || rect.right > width || rect.bottom > height);
    if (outside) element.scrollIntoView?.({ block: "nearest", inline: "nearest" });

    const detail = { element, previous, label: labelOf(element) };
    this.onFocusChange?.(detail);
    const EventCtor = this.window?.CustomEvent;
    if (EventCtor && this.root.dispatchEvent) {
      this.root.dispatchEvent(new EventCtor(this.focusEvent, { detail }));
    }
    return element;
  }

  focusFirst() {
    const candidates = this.candidates().sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (ar.top - br.top) || (ar.left - br.left);
    });
    return this.setFocus(candidates[0]);
  }

  move(direction) {
    if (!this.enabled) return null;
    const resolvedDirection = normaliseAction(direction);
    if (!DIRECTION_SET.has(resolvedDirection)) return null;

    const candidates = this.candidates();
    if (!candidates.length) return null;
    if (!this.current || !candidates.includes(this.current)) return this.focusFirst();

    const from = centreOf(this.current.getBoundingClientRect());
    let best = null;
    let bestScore = Infinity;
    for (const candidate of candidates) {
      if (candidate === this.current) continue;
      const score = scoreCandidate(
        from,
        centreOf(candidate.getBoundingClientRect()),
        resolvedDirection,
        this.perpendicularPenalty
      );
      if (score !== null && score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best ? this.setFocus(best) : this.current;
  }

  select() {
    const element = this.current && isNavigable(this.current, this.window)
      ? this.current
      : this.focusFirst();
    element?.click?.();
    return element || null;
  }

  back() {
    return typeof this.onBack === "function" ? this.onBack() === true : false;
  }

  dispatch(action) {
    const resolvedAction = normaliseAction(action);
    if (DIRECTION_SET.has(resolvedAction)) return Boolean(this.move(resolvedAction));
    if (resolvedAction === "SELECT") return Boolean(this.select());
    if (resolvedAction === "BACK") return this.back();
    return false;
  }

  destroy() {
    this._cleanup?.();
    this._cleanup = null;
    this.current?.classList?.remove(this.focusClass);
    this.current = null;
  }
}

export function installSpatialNavigation(options = {}) {
  const root = options.root || globalThis.document;
  const win = options.window || globalThis.window;
  if (!root?.addEventListener || !root?.removeEventListener) {
    throw new TypeError("root must provide addEventListener and removeEventListener");
  }
  if (!win) throw new TypeError("window is required");

  const navigator = new SpatialNavigator({ ...options, root, window: win });
  const bridgeName = options.bridgeName === false ? null : (options.bridgeName || "navigateDpad");
  if (bridgeName && (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(bridgeName) || ["__proto__", "prototype", "constructor"].includes(bridgeName))) {
    throw new TypeError("bridgeName must be a safe JavaScript property name");
  }

  let bridge;
  let hadOwnBridge = false;
  let bridgeExisted = false;
  let previousBridge;
  if (bridgeName) {
    hadOwnBridge = Object.prototype.hasOwnProperty.call(win, bridgeName);
    bridgeExisted = bridgeName in win;
    previousBridge = win[bridgeName];
    if (bridgeExisted && !options.overwriteBridge) {
      throw new Error(`window.${bridgeName} already exists; choose another bridgeName or set overwriteBridge`);
    }
    bridge = (action) => navigator.dispatch(action);
    win[bridgeName] = bridge;
  }

  const keydown = (event) => {
    if (event.defaultPrevented || isEditable(event.target)) return;
    const action = actionFromKeyboardEvent(event);
    if (!action) return;
    if (navigator.dispatch(action)) event.preventDefault();
  };
  const click = (event) => {
    const focusable = event.target?.closest?.(navigator.selector);
    const belongsToRoot = typeof root.contains !== "function" || root.contains(focusable);
    if (focusable && belongsToRoot) navigator.setFocus(focusable);
  };
  const ready = () => navigator.focusFirst();

  const waitsForReady = root.readyState === "loading";
  try {
    root.addEventListener("keydown", keydown);
    root.addEventListener("click", click, true);
    if (waitsForReady) root.addEventListener("DOMContentLoaded", ready, { once: true });
    else ready();
  } catch (error) {
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("click", click, true);
    if (waitsForReady) root.removeEventListener("DOMContentLoaded", ready);
    if (bridgeName && win[bridgeName] === bridge) {
      if (hadOwnBridge) win[bridgeName] = previousBridge;
      else delete win[bridgeName];
    }
    throw error;
  }

  navigator._cleanup = () => {
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("click", click, true);
    if (waitsForReady) root.removeEventListener("DOMContentLoaded", ready);
    if (bridgeName && win[bridgeName] === bridge) {
      if (hadOwnBridge) win[bridgeName] = previousBridge;
      else delete win[bridgeName];
    }
  };
  return navigator;
}

export { DIRECTIONS, KEY_CODE_TO_ACTION, KEY_TO_ACTION };
