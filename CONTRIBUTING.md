# Contributing

Thank you for improving Fire TV Spatial Navigation.

## Local checks

Use Node.js 20 or newer:

```bash
npm ci
npm run check
npm run test:coverage
npm run pack:check
```

The package has no runtime or development dependencies. Please discuss any proposed dependency before adding it.

## Pull requests

- Add a failing test for each behaviour change, then make it pass.
- Update `src/index.d.ts` when the public JavaScript API changes.
- Keep native input bounded to `UP`, `DOWN`, `LEFT`, `RIGHT`, `SELECT` and `BACK`.
- Preserve editable controls, edge hold and lifecycle cleanup unless a release documents a breaking change.
- State which host and browser runtime you tested. Do not claim device certification without a reproducible device record.
- Keep the README example and package tarball current.

By contributing, you agree that your contribution is licensed under the repository's MIT license.
