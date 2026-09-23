import assert from "node:assert/strict";
import test from "node:test";
import {
  SpatialNavigator,
  actionFromKeyboardEvent,
  installSpatialNavigation,
  isNavigable,
  normaliseAction,
  scoreCandidate
} from "../src/index.js";

function element(id, left, top, width = 100, height = 80) {
  const classes = new Set();
  const attributes = new Map();
  return {
    id,
    tagName: "BUTTON",
    hidden: false,
    disabled: false,
    textContent: id,
    display: "block",
    visibility: "visible",
    clicked: 0,
    focused: 0,
    scrolled: 0,
    getAttribute: (name) => attributes.get(name) ?? (name === "data-tv-label" ? `label ${id}` : null),
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }),
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    hasClass: (name) => classes.has(name),
    focus() { this.focused += 1; },
    click() { this.clicked += 1; },
    scrollIntoView() { this.scrolled += 1; },
    closest() { return this; }
  };
}

function dom(elements, { readyState = "complete" } = {}) {
  const listeners = new Map();
  const root = {
    readyState,
    querySelectorAll: () => [...elements],
    addEventListener(name, fn) {
      listeners.set(name, [...(listeners.get(name) || []), fn]);
    },
    removeEventListener(name, fn) {
      listeners.set(name, (listeners.get(name) || []).filter((listener) => listener !== fn));
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) fn(event);
      return true;
    },
    fire(name, event = {}) {
      for (const fn of [...(listeners.get(name) || [])]) fn(event);
    },
    contains(candidate) {
      return elements.includes(candidate);
    },
    listenerCount(name) {
      return (listeners.get(name) || []).length;
    }
  };
  class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  const window = {
    innerWidth: 1920,
    innerHeight: 1080,
    CustomEvent,
    getComputedStyle: (target) => ({ display: target.display, visibility: target.visibility })
  };
  return { root, window };
}

function grid() {
  return Array.from({ length: 9 }, (_, index) => (
    element(`r${Math.floor(index / 3)}c${index % 3}`, (index % 3) * 140, Math.floor(index / 3) * 110)
  ));
}

function keyEvent(key, target = { tagName: "BODY" }) {
  return {
    key,
    target,
    defaultPrevented: false,
    prevented: false,
    preventDefault() { this.prevented = true; }
  };
}

test("normalises bridge actions and legacy TV key codes", () => {
  assert.equal(normaliseAction(" left "), "LEFT");
  assert.equal(normaliseAction("ArrowDown"), "DOWN");
  assert.equal(normaliseAction(23), "SELECT");
  assert.equal(normaliseAction("4"), "BACK");
  assert.equal(normaliseAction("SIDEWAYS"), null);
  assert.equal(actionFromKeyboardEvent({ key: "Unidentified", keyCode: 19 }), "UP");
});

test("scores only candidates in the requested direction", () => {
  assert.equal(scoreCandidate({ x: 0, y: 0 }, { x: 100, y: 0 }, "RIGHT"), 100);
  assert.equal(scoreCandidate({ x: 0, y: 0 }, { x: -100, y: 0 }, "RIGHT"), null);
  assert.equal(scoreCandidate({ x: 0, y: 0 }, { x: 0, y: -100 }, "UP"), 100);
  assert.equal(scoreCandidate({ x: 0, y: 0 }, { x: 1, y: 0 }, "SIDEWAYS"), null);
  assert.throws(() => scoreCandidate({ x: 0, y: 0 }, { x: 1, y: 0 }, "RIGHT", -1), /non-negative/);
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

test("penalises perpendicular drift in a ragged layout", () => {
  const origin = element("origin", 0, 0);
  const straight = element("straight", 300, 0);
  const diagonal = element("diagonal", 220, 300);
  const { root, window } = dom([origin, diagonal, straight]);
  const nav = new SpatialNavigator({ root, window });
  nav.setFocus(origin);
  assert.equal(nav.move("RIGHT").id, "straight");
});

test("holds focus at an edge and skips unavailable controls", () => {
  const origin = element("origin", 0, 0);
  const zeroSize = element("zero-size", 150, 0, 0, 0);
  const disabled = element("disabled", 300, 0);
  disabled.disabled = true;
  const ariaDisabled = element("aria-disabled", 400, 0);
  ariaDisabled.setAttribute("aria-disabled", "true");
  const cssHidden = element("css-hidden", 500, 0);
  cssHidden.visibility = "hidden";
  const visible = element("visible", 600, 0);
  const { root, window } = dom([origin, zeroSize, disabled, ariaDisabled, cssHidden, visible]);
  const nav = new SpatialNavigator({ root, window });
  nav.setFocus(origin);
  assert.equal(nav.move("UP"), origin);
  assert.equal(nav.move("RIGHT"), visible);
  assert.equal(isNavigable(cssHidden, window), false);
});

test("recovers when the current target disappears", () => {
  const first = element("first", 0, 0);
  const second = element("second", 200, 0);
  const { root, window } = dom([first, second]);
  const nav = new SpatialNavigator({ root, window });
  nav.setFocus(second);
  second.hidden = true;
  assert.equal(nav.move("LEFT"), first);
});

test("keyboard, native bridge and direct calls share one focus state", () => {
  const cells = grid();
  const { root, window } = dom(cells);
  const nav = installSpatialNavigation({ root, window, bridgeName: "fireTvDpad" });
  nav.setFocus(cells[4]);
  assert.equal(window.fireTvDpad("down"), true);
  assert.equal(nav.current.id, "r2c1");
  const event = keyEvent("ArrowUp");
  root.fire("keydown", event);
  assert.equal(nav.current.id, "r1c1");
  assert.equal(event.prevented, true);
});

test("supports legacy keyCode events emitted by older web views", () => {
  const cells = grid();
  const { root, window } = dom(cells);
  const nav = installSpatialNavigation({ root, window });
  nav.setFocus(cells[4]);
  const event = keyEvent(undefined);
  event.keyCode = 22;
  root.fire("keydown", event);
  assert.equal(nav.current.id, "r1c2");
  assert.equal(event.prevented, true);
});

test("does not steal keys from editable controls", () => {
  const cells = grid();
  const { root, window } = dom(cells);
  const nav = installSpatialNavigation({ root, window });
  nav.setFocus(cells[4]);
  for (const target of [{ tagName: "INPUT" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }]) {
    const event = keyEvent("ArrowDown", target);
    root.fire("keydown", event);
    assert.equal(event.prevented, false);
  }
  assert.equal(nav.current.id, "r1c1");
});

test("select clicks once and back is consumed only when the page handles it", () => {
  const target = element("target", 0, 0);
  const { root, window } = dom([target]);
  const nav = new SpatialNavigator({ root, window, onBack: () => true });
  nav.setFocus(target);
  assert.equal(nav.dispatch("SELECT"), true);
  assert.equal(target.clicked, 1);
  assert.equal(nav.dispatch("BACK"), true);
  assert.equal(nav.dispatch("SIDEWAYS"), false);
  assert.equal(new SpatialNavigator({ root, window }).dispatch("BACK"), false);
});

test("announces focus changes and reports the previous target", () => {
  const first = element("first", 0, 0);
  const second = element("second", 200, 0);
  const { root, window } = dom([first, second]);
  const events = [];
  const callbacks = [];
  root.addEventListener("tv:focuschange", (event) => events.push(event.detail));
  const nav = new SpatialNavigator({ root, window, onFocusChange: (detail) => callbacks.push(detail) });
  nav.setFocus(first);
  nav.setFocus(second);
  assert.equal(events[1].label, "label second");
  assert.equal(events[1].previous, first);
  assert.equal(callbacks.length, 2);
});

test("scrolls a focused target into the viewport", () => {
  const target = element("target", 2000, 0);
  const { root, window } = dom([target]);
  new SpatialNavigator({ root, window }).setFocus(target);
  assert.equal(target.scrolled, 1);
});

test("focuses immediately after document readiness", () => {
  const first = element("first", 0, 0);
  const { root, window } = dom([first]);
  const nav = installSpatialNavigation({ root, window, bridgeName: false });
  assert.equal(nav.current, first);
});

test("waits for DOMContentLoaded while the document is loading", () => {
  const first = element("first", 0, 0);
  const { root, window } = dom([first], { readyState: "loading" });
  const nav = installSpatialNavigation({ root, window, bridgeName: false });
  assert.equal(nav.current, null);
  root.fire("DOMContentLoaded");
  assert.equal(nav.current, first);
});

test("destroy removes listeners, focus state and the installed bridge", () => {
  const first = element("first", 0, 0);
  const { root, window } = dom([first]);
  const nav = installSpatialNavigation({ root, window, bridgeName: "fireTvDpad" });
  assert.equal(root.listenerCount("keydown"), 1);
  assert.equal(typeof window.fireTvDpad, "function");
  nav.destroy();
  assert.equal(root.listenerCount("keydown"), 0);
  assert.equal(window.fireTvDpad, undefined);
  assert.equal(first.hasClass("tv-focused"), false);
});

test("protects an existing page bridge unless override is explicit", () => {
  const first = element("first", 0, 0);
  const { root, window } = dom([first]);
  assert.throws(() => installSpatialNavigation({ root, window, bridgeName: "__proto__" }), /safe JavaScript property/);
  const existing = () => "existing";
  window.navigateDpad = existing;
  assert.throws(() => installSpatialNavigation({ root, window }), /already exists/);
  assert.equal(root.listenerCount("keydown"), 0);

  const nav = installSpatialNavigation({ root, window, overwriteBridge: true });
  assert.notEqual(window.navigateDpad, existing);
  nav.destroy();
  assert.equal(window.navigateDpad, existing);
});
