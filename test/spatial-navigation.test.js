import assert from "node:assert/strict";
import test from "node:test";
import { SpatialNavigator, installSpatialNavigation, scoreCandidate } from "../src/index.js";

function element(id, left, top, width = 100, height = 80) {
  const classes = new Set();
  return {
    id,
    tagName: "BUTTON",
    hidden: false,
    disabled: false,
    textContent: id,
    clicked: 0,
    focused: 0,
    getAttribute: (name) => name === "data-tv-label" ? `label ${id}` : null,
    getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }),
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    hasClass: (name) => classes.has(name),
    focus() { this.focused += 1; },
    click() { this.clicked += 1; },
    scrollIntoView() {},
    closest() { return this; }
  };
}

function dom(elements) {
  const listeners = new Map();
  const root = {
    querySelectorAll: () => [...elements],
    querySelector: (selector) => selector.startsWith(".")
      ? elements.find((item) => item.hasClass(selector.slice(1))) || null
      : null,
    addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]),
    dispatchEvent: (event) => { for (const fn of listeners.get(event.type) || []) fn(event); return true; },
    fire: (name, event) => { for (const fn of listeners.get(name) || []) fn(event); }
  };
  class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init.detail; }
  }
  const window = { innerWidth: 1920, innerHeight: 1080, CustomEvent };
  return { root, window };
}

function grid() {
  return Array.from({ length: 9 }, (_, index) => element(`r${Math.floor(index / 3)}c${index % 3}`, (index % 3) * 140, Math.floor(index / 3) * 110));
}

test("scores only candidates in the requested direction", () => {
  assert.equal(scoreCandidate({ x: 0, y: 0 }, { x: 100, y: 0 }, "RIGHT"), 100);
  assert.equal(scoreCandidate({ x: 0, y: 0 }, { x: -100, y: 0 }, "RIGHT"), null);
  assert.equal(scoreCandidate({ x: 0, y: 0 }, { x: 0, y: -100 }, "UP"), 100);
});

test("moves geometrically rather than in DOM order", () => {
  const cells = grid();
  const { root, window } = dom(cells);
  const nav = new SpatialNavigator({ root, window });
  nav.setFocus(cells[4]);
  assert.equal(nav.move("RIGHT").id, "r1c2");
  nav.setFocus(cells[4]);
  assert.equal(nav.move("DOWN").id, "r2c1");
});

test("penalises perpendicular drift", () => {
  const origin = element("origin", 0, 0);
  const straight = element("straight", 300, 0);
  const diagonal = element("diagonal", 220, 300);
  const { root, window } = dom([origin, diagonal, straight]);
  const nav = new SpatialNavigator({ root, window });
  nav.setFocus(origin);
  assert.equal(nav.move("RIGHT").id, "straight");
});

test("holds focus at an edge and skips hidden or disabled controls", () => {
  const origin = element("origin", 0, 0);
  const hidden = element("hidden", 150, 0, 0, 0);
  const disabled = element("disabled", 300, 0);
  disabled.disabled = true;
  const visible = element("visible", 450, 0);
  const { root, window } = dom([origin, hidden, disabled, visible]);
  const nav = new SpatialNavigator({ root, window });
  nav.setFocus(origin);
  assert.equal(nav.move("UP"), origin);
  assert.equal(nav.move("RIGHT"), visible);
});

test("native bridge, keyboard and direct calls share one navigator", () => {
  const cells = grid();
  const { root, window } = dom(cells);
  const nav = installSpatialNavigation({ root, window, bridgeName: "fireTvDpad" });
  nav.setFocus(cells[4]);
  assert.equal(window.fireTvDpad("DOWN"), true);
  assert.equal(nav.current.id, "r2c1");
  let prevented = false;
  root.fire("keydown", { key: "ArrowUp", target: { tagName: "BODY" }, defaultPrevented: false, preventDefault: () => { prevented = true; } });
  assert.equal(nav.current.id, "r1c1");
  assert.equal(prevented, true);
});

test("does not steal arrow keys from editable controls", () => {
  const cells = grid();
  const { root, window } = dom(cells);
  const nav = installSpatialNavigation({ root, window });
  nav.setFocus(cells[4]);
  root.fire("keydown", { key: "ArrowDown", target: { tagName: "INPUT" }, defaultPrevented: false, preventDefault() { throw new Error("must not prevent"); } });
  assert.equal(nav.current.id, "r1c1");
});

test("select clicks once and back reports whether the page consumed it", () => {
  const target = element("target", 0, 0);
  const { root, window } = dom([target]);
  const nav = new SpatialNavigator({ root, window, onBack: () => true });
  nav.setFocus(target);
  assert.equal(nav.dispatch("SELECT"), true);
  assert.equal(target.clicked, 1);
  assert.equal(nav.dispatch("BACK"), true);
  assert.equal(nav.dispatch("SIDEWAYS"), false);
});

test("announces focus changes with a readable label", () => {
  const target = element("target", 0, 0);
  const { root, window } = dom([target]);
  const labels = [];
  root.addEventListener("tv:focuschange", (event) => labels.push(event.detail.label));
  new SpatialNavigator({ root, window }).setFocus(target);
  assert.deepEqual(labels, ["label target"]);
});
