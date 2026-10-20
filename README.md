# Fire TV Spatial Navigation

[![CI](https://github.com/upgradedev/firetv-spatial-navigation/actions/workflows/ci.yml/badge.svg)](https://github.com/upgradedev/firetv-spatial-navigation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A dependency-free D-pad navigator for television web interfaces. It is designed to give web pages in Fire TV and Android TV WebViews predictable focus movement without tying the page to a UI framework.

DOM order stops matching the screen as soon as a television layout becomes a grid. This package measures each visible focus target, keeps candidates in the pressed direction, then selects the nearest candidate while penalising sideways drift. Keyboard events, native WebView calls and direct API calls share one focus state.

## Contents

- [Capabilities](#capabilities)
- [Quickstart](#quickstart)
- [Native host bridge](#native-host-bridge)
- [Behaviour](#behaviour)
- [API](#api)
- [Compatibility and limits](#compatibility-and-limits)
- [Verification](#verification)
- [Contribution record](#contribution-record)
- [Contributing](#contributing)
- [License](#license)

## Capabilities

- Spatial `UP`, `DOWN`, `LEFT` and `RIGHT` movement over grids and ragged layouts.
- Edge hold instead of unexpected wrap-around.
- Skips hidden, zero-size, disabled and `aria-disabled` controls.
- Leaves arrow, Enter and Back keys with inputs, selects and editable content.
- Handles `SELECT` and page-owned `BACK` actions.
- Accepts modern browser keys, legacy WebView key codes and named bridge actions.
- Removes its event listeners and focus styling and restores any replaced bridge on `destroy()`.
- Emits a focus event and callback for hints, announcements or telemetry.
- Ships ESM, TypeScript declarations, an example and zero runtime dependencies.

## Quickstart

Prerequisites: Node.js 20 or newer and Git. The example page also needs a static file server; the command below uses Python 3. The repository example imports the source directly, so no build step is required.

```bash
git clone https://github.com/upgradedev/firetv-spatial-navigation.git
cd firetv-spatial-navigation
npm ci
npm test
```

Expected result: 16 passing tests in under a second on a typical development machine.

To try it in a browser, serve the repository root, because the example page imports `../src/index.js`:

```bash
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/examples/fire-tv-webview.html`. The arrow keys move the focus, Enter selects, and Escape or Backspace is Back. The status line under the buttons names the focused control.

The package is not on the npm registry. To use it in your own app, install it from a clone next to your app or from GitHub:

```bash
npm install ../firetv-spatial-navigation
npm install git+https://github.com/upgradedev/firetv-spatial-navigation.git
```

Either command installs it under the name `@upgradedev/firetv-spatial-navigation`, which a bundler resolves. A page without a bundler instead imports `src/index.js` by a relative path that the page's server can reach, as the example page does.

Add the focus marker to controls and install the navigator after the page loads:

```html
<button data-tv-focusable>Incident</button>
<button data-tv-focusable>Evidence</button>
```

```js
// With a bundler, after npm install: "@upgradedev/firetv-spatial-navigation".
// Without one, a relative path to src/index.js that the page's server can reach, for example:
import { installSpatialNavigation } from "./firetv-spatial-navigation/src/index.js";

const navigation = installSpatialNavigation({
  selector: "[data-tv-focusable]",
  bridgeName: "navigateDpad",
  onBack: () => closeCurrentPanel()
});

// When the page is removed:
navigation.destroy();
```

Give `.tv-focused` a visible treatment. The package also calls the element's native `focus()` method, so standard `:focus-visible` styles can be used.

## Native host bridge

A native host can map its trusted remote-key enum to one of six bounded actions and call the page bridge:

```kotlin
private fun forwardDpad(action: String) {
    val allowed = setOf("UP", "DOWN", "LEFT", "RIGHT", "SELECT", "BACK")
    if (action in allowed) {
        webView.evaluateJavascript("window.navigateDpad('$action')", null)
    }
}
```

The bridge also accepts Android direction codes `19` through `23`, Android Back `4`, and browser key codes `8`, `13`, and `37` through `40`. Unknown actions return `false` and do not change focus.

If the bridge name already exists, installation throws instead of replacing page state. Set `overwriteBridge: true` only when replacement is intentional. `destroy()` restores the previous value.

## Behaviour

For a candidate in the pressed direction, the score is:

```text
distance along the requested axis + perpendicular distance * 2.5
```

The lowest score wins. Change `perpendicularPenalty` when a layout should favour a nearer diagonal target or a farther target on the same row. Equal scores preserve DOM order. At an edge, focus remains on the current control.

The primary journey is three steps: mark controls, install the navigator, then forward remote actions. There is no runtime service, network request or collected user data.

Serve the repository root and open [`examples/fire-tv-webview.html`](examples/fire-tv-webview.html), as in the [Quickstart](#quickstart), to exercise the same keyboard and bridge paths.

## API

| Export | Purpose |
|---|---|
| `installSpatialNavigation(options)` | Wires keyboard, click, readiness and optional native bridge adapters. |
| `SpatialNavigator` | Owns candidates, focus, movement, select and back state. |
| `normaliseAction(action)` | Converts named actions and supported numeric key codes to a bounded action. |
| `actionFromKeyboardEvent(event)` | Maps modern and legacy keyboard event fields. |
| `scoreCandidate(from, to, direction, penalty)` | Scores one candidate with no DOM dependency. |
| `isNavigable(element, window)` | Applies visibility and disabled-state checks. |
| `DIRECTIONS`, `KEY_TO_ACTION`, `KEY_CODE_TO_ACTION` | Frozen integration constants. |

See [`src/index.d.ts`](src/index.d.ts) for the full option and return types.

## Compatibility and limits

The library uses DOM keyboard, focus and geometry APIs available in modern Chromium-based WebViews. It is designed for Fire TV and Android TV WebView hosts. Its tests run in Node.js against stub elements, and the example page has been run in a desktop browser. It has not been run in a Fire TV or Android TV WebView, on a device or in an emulator, and it is not certified by Amazon or published in the Amazon Appstore.

Native key capture remains the host application's responsibility. CSS transforms can change measured geometry. Pages must provide a visible focus style and semantic labels. The library does not create UI, wrap focus, control media keys or send analytics.

## Verification

CI runs on Node.js 20 and 22. It checks JavaScript syntax, executes the navigator tests with native V8 coverage, and inspects the package tarball. Tests cover four-direction geometry, ragged layouts, edge hold, unavailable controls, stale focus recovery, modern and legacy key input, editable controls, select, back, announcements, scrolling, DOM readiness, bridge collision and cleanup.

Run the same checks locally:

```bash
npm run check
npm run test:coverage
npm run pack:check
```

## Contribution record

| Field | Record |
|---|---|
| Contribution URL | [Pull request #1](https://github.com/upgradedev/firetv-spatial-navigation/pull/1) |
| Repository | `https://github.com/upgradedev/firetv-spatial-navigation` |
| GitHub username | `upgradedev` |
| What | Pull request #1 extended the repository's seed commit [`f013c58`](https://github.com/upgradedev/firetv-spatial-navigation/commit/f013c58), made the same day, which already held the spatial scoring, keyboard input, a native bridge for named actions, a focus-change event, initial focus once the DOM loads, TypeScript declarations, the example page, a Node.js 22 CI workflow and 8 tests. The pull request added legacy key-code input, action aliases with normalisation, a collision-safe bridge, `destroy()` cleanup that removes the listeners and restores any replaced bridge, stricter navigability checks, validation of the scoring inputs with an adjusted forward cut-off, an `onFocusChange` callback beside the focus event, and initial focus when the navigator is installed after the DOM has loaded. It extended CI to a Node.js 20 and 22 matrix with coverage and a tarball check, and extended the declarations, the example and the tests, from 8 to 16. |
| How | One dependency-free state machine receives bounded actions from keyboard events, native calls and direct API calls. |
| Why | Television grids need visual-direction focus; DOM-order focus can jump to a control that is elsewhere on screen. |
| Publication status | Public under the MIT licence. |

This package was extracted from the D-pad navigator of [Mercury](https://github.com/upgradedev/mercury_amazon), a Fire TV incident-command application built for the Amazon Developer Hackathon 2026. Mercury does not import this package: its board loads its own `docs/firetv_nav.js`, which has changed separately since the extraction. The source and contribution record are independent so another television web application can review and reuse the navigation layer.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Behaviour changes need a failing test first and must keep the package dependency-free.

## License

[MIT](LICENSE)
