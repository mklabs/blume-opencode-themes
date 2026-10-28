# generator

Rebuilds `kit/` from opencode's desktop themes. A consuming Blume site never runs
this: it only needs the generated `kit/`.

## Regenerate

```bash
cd generator
npm ci
npm run generate        # writes ../kit
npm run check           # validate only; exits 1 if a preset misses WCAG AA
```

Then refresh the demo copy:

```bash
rm -r ../demo/opencode-themes
cp -r ../kit ../demo/opencode-themes
cp ../kit/theme.css ../demo/theme.css
cp ../kit/ThemePicker.tsx ../demo/islands/
cp ../kit/ThemeGallery.tsx ../demo/islands/
```

## How it works

- Surfaces, text, border and state colors come from opencode's **V2** resolver.
- Syntax, markdown and diff colors come from its **V1** resolver, because V2 has
  no syntax layer.
- Both layers emit `var(...)` references, so the generator dereferences them
  across both maps plus the alpha ramps, which only exist in CSS.
- `muted-foreground` maps to opencode's `text-muted`, but Blume paints **body
  prose** with it, so the generator raises it along the theme's grey ramp until
  it clears 4.5:1. 13 of 36 themes need this.
- One Shiki theme serves all presets: its colors are `var(--oc-syn-*)`, so
  switching `data-oc-theme` recolors code at runtime with no rebuild.
- Each preset ships twice: attribute-scoped in `kit/themes/` for switching, and
  `:root`-scoped in `kit/standalone/` for pasting a single theme as `theme.css`.

## Layout

```
src/policy.ts    the only file to edit when a theme looks wrong
src/generate.ts  runs both resolvers and writes kit/
starter/         kit files copied verbatim (the two islands)
vendor/          opencode's theme engine and 36 theme JSONs, from v2.2.0
```

## Vendor

`vendor/opencode-theme/` is opencode's theme engine at v2.2.0, MIT, copied
verbatim so its resolvers run exactly as the app runs them. See
[vendor/VENDOR.md](vendor/VENDOR.md).

## Status

Verified in `demo/`: `blume build` and `blume doctor` clean; 36 presets at
4.51:1 worst-case contrast; switching recolors surfaces, text and syntax; the
standalone path builds as a single-theme site with no `data-oc-theme` selectors;
the gallery renders 36 cards with no console errors.

Not done: the generator is not packaged as a reusable command; the gallery's
**use** button was exercised while the desktop window was visible, not after; the
demo has two pages only.
