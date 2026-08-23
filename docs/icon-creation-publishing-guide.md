# App Icon Creation and Publishing Guide

JPHours uses `public/icon-dark.svg` as the source artwork for browser and
installable-app icons. Keep the source in SVG; generate platform-specific PNGs
with `scripts/convert-icons.sh`.

## Design the source SVG

Use a square `viewBox`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
```

The icon must follow these rules:

- Extend the background to every edge of the canvas. Do not add transparent
  margins or bake rounded corners into the background; the operating system
  chooses the final circle, squircle, or rounded-square shape.
- Keep all essential artwork inside the maskable safe zone: a circle centered
  at `(512, 512)` with radius `410`. Content outside that circle may be cropped.
- Let only expendable background decoration extend beyond the safe zone.
- Use bold silhouettes and strong contrast. Check that the subject remains
  recognizable at 48×48 pixels.
- Avoid text, thin strokes, tiny texture, external fonts, and linked images.
  Convert any indispensable text to paths.
- Prefer sRGB colors and verify the icon on both light and dark launcher
  backgrounds.

The current artwork should ultimately replace its inset rounded background
with an edge-to-edge rectangle and move or scale the chair-leg extremities into
the safe circle.

## Generate the raster icons

Install `rsvg-convert` if it is not already available, then run the converter
from the repository root:

```sh
sh scripts/convert-icons.sh
```

The script produces:

| File | Purpose |
| --- | --- |
| `public/favicon-32.png` | 32×32 fallback browser-tab icon |
| `public/icon-192.png` | Standard 192×192 PWA icon |
| `public/icon-512.png` | Standard 512×512 PWA icon |
| `public/icon-maskable-192.png` | Opaque 192×192 adaptive Android icon |
| `public/icon-maskable-512.png` | Opaque 512×512 adaptive Android icon |
| `public/apple-touch-icon.png` | Opaque 180×180 iOS/iPadOS Home Screen icon |

The standard icons preserve the SVG's transparency. The maskable and Apple
exports are composited over `#140B0A` so their canvases are opaque.

If the SVG background color changes, update both `background` in
`scripts/convert-icons.sh` and `background_color` in `vite.config.ts`.

## Keep platform declarations correct

The web app manifest in `vite.config.ts` declares the full-bleed standard icons
with `purpose: 'any maskable'` so Chrome cannot install them through its legacy
white-background icon path. Dedicated maskable entries remain available as
explicit adaptive-icon fallbacks. Never give `maskable` purpose to a
transparent or already-rounded icon.

`index.html` must continue to declare:

```html
<link rel="icon" href="%BASE_URL%favicon-32.png" sizes="32x32" type="image/png" />
<link rel="icon" href="%BASE_URL%icon-dark.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />
```

Safari uses the Apple touch icon when it is supplied. Chromium-based Android
browsers use the manifest purpose to select the adaptive icon.

## Validate before publishing

Run:

```sh
sh -n scripts/convert-icons.sh
sh scripts/convert-icons.sh
pnpm build
```

Then verify:

- The generated manifest contains 192px and 512px `any maskable` entries plus
  explicit `maskable` fallbacks.
- The PNG favicon is exactly 32×32.
- The standard files are exactly 192×192 and 512×512.
- The maskable files are exactly 192×192 and 512×512 and contain no alpha
  channel.
- The Apple touch icon is exactly 180×180 and contains no alpha channel.
- Circle, squircle, and rounded-square previews do not crop the recognizable
  subject.
- The 48×48 preview remains readable.

Chrome DevTools' Application panel can inspect the emitted manifest and preview
maskable safe areas. A physical Android launcher remains the final check because
launcher masks vary by device.

## Publish and refresh cached installations

Commit the SVG, generated PNGs, manifest configuration, and HTML declaration
together. Deploy the complete build so no manifest points temporarily at a
missing asset.

Android launchers and installed web apps cache icons aggressively. When an icon
must update immediately, rename the generated files and update their manifest
or HTML references before deployment. Otherwise, users may need to uninstall
the existing PWA, clear the browser's site data, revisit the deployed site, and
install it again.

After deployment, test at least:

1. Android installation from Chrome.
2. Android installation from Brave.
3. iPhone or iPad “Add to Home Screen.”
4. A desktop browser tab and installed desktop PWA.

Check the launcher, task switcher, splash screen, and browser tab—not only the
installation prompt.
