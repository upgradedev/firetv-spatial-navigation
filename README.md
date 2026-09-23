# Fire TV Spatial Navigation

A dependency-free geometric D-pad navigator for Fire TV, Android TV, Vega web views and ordinary browser-based ten-foot interfaces.

DOM-order navigation breaks as soon as a television layout becomes a grid. This package measures the centre of every visible focus target, keeps only candidates in the pressed direction, and selects the nearest one while penalising sideways drift. Keyboard events, clicks and a native WebView bridge all drive the same focus state.

## What it adds

- Spatial `UP`, `DOWN`, `LEFT` and `RIGHT` movement over ragged grids.
- Edge hold instead of surprising wrap-around.
- Skips hidden, zero-size and disabled controls.
- Preserves arrow keys while the viewer edits an input.
- `SELECT` and page-owned `BACK` handling.
- A configurable global bridge for Fire TV or Android WebView hosts.
- Focus-change events for a visible key-hint bar.
- Zero runtime dependencies and TypeScript declarations.

## Install and run

```bash
npm install
npm test
```

```js
import { installSpatialNavigation } from "@upgradedev/firetv-spatial-navigation";

installSpatialNavigation({
  selector: "[data-tv-focusable]",
  bridgeName: "navigateDpad",
  onBack: () => closeCurrentPanel()
});
```

Mark controls with `data-tv-focusable`. A native Fire TV host can forward a remote key through its WebView with `evaluateJavascript("navigateDpad('LEFT')")`; browser arrow keys use the same navigator automatically. See [`examples/fire-tv-webview.html`](examples/fire-tv-webview.html).

## Why this exists

This package was extracted during the Amazon Developer Hackathon 2026 from Mercury, a Fire TV incident-command cockpit. It turns the reusable platform integration into an additional MIT-licensed project instead of hiding it inside one application. The test suite executes the real navigator against grids, ragged layouts, disabled controls, text inputs and bridge calls.

The package does not claim a Fire OS certification or Appstore publication. Device-specific key forwarding remains the host application's responsibility.

## Contribution record

- Contribution URL: this repository's initial pull request, added after the repository is created.
- Project repository: `https://github.com/upgradedev/firetv-spatial-navigation`
- GitHub username: `upgradedev`
- What: a reusable spatial navigator with a native bridge, browser adapter, types, example and executable tests.
- How: pure candidate scoring plus one shared state machine for remote, keyboard and click input.
- Why: it removes a common class of focus bugs from Fire TV web views and makes remote-only interaction testable outside a device.

## License

MIT
