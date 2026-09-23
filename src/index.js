const DIRECTIONS = Object.freeze({ UP: "UP", DOWN: "DOWN", LEFT: "LEFT", RIGHT: "RIGHT" });

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

export function centreOf(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function scoreCandidate(from, to, direction, perpendicularPenalty = 2.5) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let along;
  let across;

  if (direction === DIRECTIONS.RIGHT) [along, across] = [dx, Math.abs(dy)];
  else if (direction === DIRECTIONS.LEFT) [along, across] = [-dx, Math.abs(dy)];
  else if (direction === DIRECTIONS.DOWN) [along, across] = [dy, Math.abs(dx)];
  else if (direction === DIRECTIONS.UP) [along, across] = [-dy, Math.abs(dx)];
  else return null;

  if (along <= 1) return null;
  return along + across * perpendicularPenalty;
}

function isVisible(element) {
  if (!element || element.hidden || element.disabled) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function labelOf(element) {
  const explicit = element.getAttribute?.("data-tv-label") || element.getAttribute?.("aria-label");
  if (explicit) return explicit;
  const text = String(element.textContent || "").trim();
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

export class SpatialNavigator {
  constructor(options = {}) {
    this.root = options.root || globalThis.document;
    this.window = options.window || globalThis.window;
    this.selector = options.selector || "[data-tv-focusable]:not([disabled]):not([hidden])";
    this.focusClass = options.focusClass || "tv-focused";
    this.focusEvent = options.focusEvent || "tv:focuschange";
    this.perpendicularPenalty = options.perpendicularPenalty ?? 2.5;
    this.current = null;
    this.enabled = true;
    this.onBack = options.onBack || null;
  }

  candidates() {
    return Array.from(this.root.querySelectorAll(this.selector)).filter(isVisible);
  }

  setFocus(element) {
    if (!element) return null;
    const previous = this.root.querySelector(`.${this.focusClass}`);
    if (previous && previous !== element) previous.classList.remove(this.focusClass);
    element.classList.add(this.focusClass);
    this.current = element;
    element.focus?.({ preventScroll: true });
    const rect = element.getBoundingClientRect();
    const width = this.window?.innerWidth || 0;
    const height = this.window?.innerHeight || 0;
    const outside = width && height && (rect.left < 0 || rect.top < 0 || rect.right > width || rect.bottom > height);
    if (outside) element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    const EventCtor = this.window?.CustomEvent;
    if (EventCtor && this.root.dispatchEvent) {
      this.root.dispatchEvent(new EventCtor(this.focusEvent, {
        detail: { element, label: labelOf(element) }
      }));
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
    const candidates = this.candidates();
    if (!candidates.length) return null;
    if (!this.current || !candidates.includes(this.current) || !isVisible(this.current)) {
      return this.focusFirst();
    }

    const from = centreOf(this.current.getBoundingClientRect());
    let best = null;
    let bestScore = Infinity;
    for (const candidate of candidates) {
      if (candidate === this.current) continue;
      const score = scoreCandidate(
        from,
        centreOf(candidate.getBoundingClientRect()),
        direction,
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
    const element = this.current || this.focusFirst();
    element?.click?.();
    return element || null;
  }

  back() {
    return typeof this.onBack === "function" ? this.onBack() === true : false;
  }

  dispatch(action) {
    if (Object.values(DIRECTIONS).includes(action)) return Boolean(this.move(action));
    if (action === "SELECT") return Boolean(this.select());
    if (action === "BACK") return this.back();
    return false;
  }
}

export function installSpatialNavigation(options = {}) {
  const root = options.root || globalThis.document;
  const win = options.window || globalThis.window;
  const navigator = new SpatialNavigator({ ...options, root, window: win });

  const keydown = (event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    const editing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
    if (editing && event.key !== "Enter") return;
    const action = KEY_TO_ACTION[event.key];
    if (!action || (editing && action === "SELECT")) return;
    const consumed = navigator.dispatch(action);
    if (consumed) event.preventDefault();
  };

  root.addEventListener("keydown", keydown);
  root.addEventListener("DOMContentLoaded", () => navigator.focusFirst());
  root.addEventListener("click", (event) => {
    const focusable = event.target?.closest?.(navigator.selector);
    if (focusable) navigator.setFocus(focusable);
  }, true);

  const bridgeName = options.bridgeName || "navigateDpad";
  win[bridgeName] = (action) => navigator.dispatch(action);
  return navigator;
}

export { DIRECTIONS, KEY_TO_ACTION };
