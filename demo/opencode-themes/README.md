# opencode themes for Blume

Every [opencode](https://opencode.ai) desktop colour theme, as a drop-in palette
for any Blume documentation site, with code highlighting that matches and can
change live without a rebuild.

36 presets, generated from `anomalyco/opencode` v2.2.0 (MIT) by running
opencode's own theme resolvers. The colours are the app's, not an approximation.

You can use it two ways: **one fixed theme** (most docs sites), or **all 36 with
a switcher** (demos and showcases). Both start the same way.

---

## Step 1: copy the folder

Put this `opencode-themes/` folder at your Blume project root, next to
`blume.config.ts` and `theme.css`:

```bash
cp -r opencode-themes <your-site>/opencode-themes
```

The commands in this README are plain `cp` and `rm`, so they work unchanged in
bash, zsh and PowerShell 7.

## Step 2: pick your setup

### A. One fixed theme (recommended for a real docs site)

Every preset also exists **standalone**, already scoped to `:root`, so it needs
no attribute and no JavaScript:

```bash
cp opencode-themes/standalone/flexoki.css <your-site>/theme.css
```

If you already have a `theme.css`, paste the contents of
`opencode-themes/standalone/<id>.css` at the **end** of it instead: later rules
win, so the preset takes over.

Pick `<id>` from the filenames in `opencode-themes/standalone/` (or the `themes`
array in `manifest.json`). Ids are the opencode desktop ids: `oc-2` (opencode's
own theme), `flexoki`, `gruvbox`, `tokyonight`, `catppuccin`, `rosepine`,
`solarized`, `matrix`, `nord`, `dracula`, `github`, `monokai`, `vesper`,
`kanagawa`, `everforest`, `material`, `zenburn`, and 20 more.

### B. All 36, switchable at runtime

Paste **everything between the markers** in `opencode-themes/theme.css` into
your site's `theme.css` (at the end if you already have one):

```
/* >>> opencode-themes:start */
...
/* <<< opencode-themes:end */
```

Blume inlines `theme.css` into a generated sheet under `.blume/`, so a relative
`@import` cannot reach the project root, which is why the block has to live
inside the file. The markers make a later regeneration a splice instead of a
manual merge.

Then copy the picker island (React) next to your content:

```bash
cp opencode-themes/ThemePicker.tsx <your-site>/islands/
```

and use it on any page:

```mdx
<ThemePicker />
```

It writes `data-oc-theme` on `<html>` and remembers the choice in
`localStorage`. Without it, or on a first visit, the site uses the default
preset (`oc-2`). To change that default permanently, set `policy.defaultTheme`
in the generator and regenerate, or just use setup A.

You can also set it statically on the root element if you override the layout:
`<html lang="en" data-oc-theme="flexoki">`.

### C. Optional: the gallery

All 36 side by side, each card a real themed surface:

```bash
cp opencode-themes/ThemeGallery.tsx <your-site>/islands/
```

```mdx
<ThemeGallery />
```

Cards carry their own `data-oc-theme` and `data-theme`, so they do not depend on
the page's theme. A light/dark toggle covers both modes, and **use** applies that
preset to the whole site. Presets are attribute-scoped (not `:root`-scoped) for
exactly this reason.

---

## Step 3: code highlighting (required)

The palette is also applied to fenced code. Point Blume's Shiki config at the
kit's theme in `blume.config.ts`:

```ts
import codeTheme from "./opencode-themes/shiki/opencode.json" with { type: "json" };

export default defineConfig({
  markdown: {
    code: {
      theme: { light: codeTheme, dark: codeTheme },
    },
  },
});
```

The same file serves every preset: its colours are `var(--oc-syn-*)` references
rather than baked hex, so switching presets recolours code too. Nothing is
hardcoded to one theme and no rebuild is needed.

That is the whole install. Run `blume doctor` and `blume build` to confirm.

---

## Notes

- **Contrast is enforced.** Blume paints body copy with `muted-foreground`, a
  much more demanding role than opencode's de-emphasised `text-muted`. The
  generator raises that one colour along the theme's own grey ramp until it
  clears WCAG AA (4.5:1) against both the page and the `muted` surface. 13 of
  the 36 need it; `manifest.json` records each adjustment under `adjusted`.
- **Fonts and radius are yours.** opencode is a terminal: it has no corner
  radius or type scale. Blume's defaults (Inter + IBM Plex Mono) already match
  opencode's desktop fonts, so usually there is nothing to do. Override with
  `theme.fonts` / `theme.radius` for a different character.
- **`accent` is the interactive blue.** opencode has two accent-ish colours;
  this kit uses `interactive` (oc-2: `#034cff` light, `#a2bcff` dark), the one
  the app uses for interactive UI. Blume paints prose *links* with `foreground`,
  so `accent` shows up in focus rings, step markers, badges and active tabs.
- **Dark mode composes.** Every preset declares both modes; the mode comes from
  Blume's `data-theme`, so `mode: "system"`, the header toggle and print styles
  behave normally.
- **The islands are React.** Blume also supports Vue and Svelte islands; only
  `ThemePicker.tsx` and `ThemeGallery.tsx` would need porting. The CSS is
  framework-agnostic.
- **Islands hydrate when visible.** Both use `client: "visible"`, so a gallery
  far down a page activates on scroll.

## What's inside

| Path | Purpose |
| --- | --- |
| `standalone/<id>.css` | One preset, ready to paste as `theme.css` |
| `theme.css` | All presets + token aliases, marker-delimited |
| `themes/<id>.css` | One preset as an attribute-scoped block |
| `shiki/opencode.json` | One Shiki theme for all presets |
| `manifest.json` | Ids, display names, sample colours, contrast report |
| `ThemePicker.tsx` | Optional island: a dropdown |
| `ThemeGallery.tsx` | Optional island: all 36 side by side |

About 190 KB of CSS for all 36 presets. Ship fewer by regenerating with
`policy.include` set, or by taking one `standalone/` file.

## Licence

Theme colours derived from opencode (MIT, (c) 2025 opencode). The rest is yours
to use however you like.
