# Fire TV Spatial Navigation

[![CI](https://github.com/upgradedev/firetv-spatial-navigation/actions/workflows/ci.yml/badge.svg)](https://github.com/upgradedev/firetv-spatial-navigation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A dependency-free D-pad navigator for television web interfaces. It gives Fire TV, Android TV and Vega-hosted web surfaces predictable focus movement without tying the page to a UI framework.

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
- Restores event listeners, focus styling and any replaced bridge on `destroy()`.
- Emits a focus event and callback for hints, announcements or telemetry.
- Ships ESM, TypeScript declarations, an example and zero runtime dependencies.

## Quickstart

Prerequisites: Node.js 20 or newer. The repository example imports the source directly, so no build step is required.

```bash
git clone https://github.com/upgradedev/firetv-spatial-navigation.git
cd firetv-spatial-navigation
npm ci
npm test
```

Expected result: 16 passing tests in under a second on a typical development machine.

Add the focus marker to controls and install the navigator after the page loads:

```html
<button data-tv-focusable>Incident</button>
<button data-tv-focusable>Evidence</button>
```

```js
import { installSpatialNavigation } from "@upgradedev/firetv-spatial-navigation";

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

Open [`examples/fire-tv-webview.html`](examples/fire-tv-webview.html) through any local static server to exercise the same keyboard and bridge paths.

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

The library uses DOM keyboard, focus and geometry APIs available in modern Chromium-based WebViews. It is designed for Fire TV and Android TV WebView hosts and for Vega-hosted web surfaces that expose standard DOM events. It has not been certified by Amazon, published in the Amazon Appstore or validated on every device generation.

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
| What | Spatial scoring, browser and native input adapters, lifecycle cleanup, declarations, example and executable tests. |
| How | One dependency-free state machine receives bounded actions from keyboard events, native calls and direct API calls. |
| Why | Television grids need visual-direction focus; DOM-order focus can jump to a control that is elsewhere on screen. |
| Publication status | Private during pre-submission review. Public visibility requires the repository owner's final approval. |

This package was extracted from Mercury, a Fire TV incident-command application built for the Amazon Developer Hackathon 2026. The source and contribution record are independent so another television web application can review and reuse the navigation layer.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Behaviour changes need a failing test first and must keep the package dependency-free.

## License

[MIT](LICENSE)
