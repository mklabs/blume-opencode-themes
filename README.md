# blume-opencode-themes

Experiment: derive Blume themes from opencode's desktop colour themes.

```
generator/   runs opencode's own resolvers -> emits kit/
  vendor/      opencode theme engine + 36 theme JSONs, copied from v2.2.0
  src/policy.ts   the only file to edit when a theme looks wrong
  starter/     hand-maintained kit files, copied into kit/ on every run
kit/         THE deliverable, copy this folder into any Blume site
demo/        throwaway Blume site used to check the result
```

## Regenerate

```bash
cd generator
npm run generate        # writes ../kit
npm run check           # validate only; exits 1 if a preset misses WCAG AA
```

Then re-copy into the demo:

```bash
rm -r ../demo/opencode-themes
cp -r ../kit ../demo/opencode-themes
cp ../kit/theme.css ../demo/theme.css
cp ../kit/ThemePicker.tsx ../demo/islands/
cp ../kit/ThemeGallery.tsx ../demo/islands/
```

## How it works

- Surfaces, text, border and state colours come from opencode's **V2** resolver.
- Syntax, markdown and diff colours come from its **V1** resolver (V2 has no
  syntax layer).
- Both layers emit `var(--...)` references, so the generator dereferences them
  across both maps plus the alpha ramps (which only exist in CSS).
- `muted-foreground` maps to opencode's `text-muted`, but Blume paints **body
  prose** with it, so the generator raises it along the theme's grey ramp until
  it clears 4.5:1. 13 of 36 themes need this.
- One Shiki theme serves all presets: its colours are `var(--oc-syn-*)`, so
  switching `data-oc-theme` recolours code at runtime with no rebuild.
- Each preset ships twice: attribute-scoped (`themes/`, for switching) and
  `:root`-scoped (`standalone/`, for pasting a single theme as `theme.css`).

## Status

Verified in `demo/`:

- `blume build` and `blume doctor` clean.
- 36 presets, all at least 4.51:1 worst-case contrast.
- Switching `data-oc-theme` re-themes surfaces, text and syntax highlighting
  (oc-2 `rgb(247,153,198)` -> flexoki `rgb(135,154,57)` -> matrix
  `rgb(199,112,255)` for the same keyword span).
- The standalone path builds as a single-theme site with zero
  `data-oc-theme` selectors.
- `/themes` gallery renders 36 cards, each a real themed subtree, with no
  console errors.

Not done: the demo has two pages only; the generator is not packaged as a
reusable command; the gallery's "use" button was exercised while the desktop
window was visible, not after.
