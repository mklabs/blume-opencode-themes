# blume-opencode-themes

Derive Blume themes from opencode's desktop color themes.

36 presets, generated from `anomalyco/opencode` v2.2.0 (MIT) by running opencode's own theme resolvers.

The gallery demo runs at <https://mklabs.github.io/blume-opencode-themes/>.

You can use the kit two ways: **one fixed theme** (most docs sites), or **all 36 with a switcher** (demos and showcases). Both start the same way.

## Presets

All 36, each with light and dark variants. `oc-2` (OpenCode) is the default; IDs match the filenames in `standalone/` and `themes/`.

| Preset | ID | Preset | ID |
| --- | --- | --- | --- |
| OpenCode | [`oc-2`](kit/standalone/oc-2.css) | AMOLED | [`amoled`](kit/standalone/amoled.css) |
| Aura | [`aura`](kit/standalone/aura.css) | Ayu | [`ayu`](kit/standalone/ayu.css) |
| Carbonfox | [`carbonfox`](kit/standalone/carbonfox.css) | Catppuccin | [`catppuccin`](kit/standalone/catppuccin.css) |
| Catppuccin Frappe | [`catppuccin-frappe`](kit/standalone/catppuccin-frappe.css) | Catppuccin Macchiato | [`catppuccin-macchiato`](kit/standalone/catppuccin-macchiato.css) |
| Cobalt2 | [`cobalt2`](kit/standalone/cobalt2.css) | Cursor | [`cursor`](kit/standalone/cursor.css) |
| Dracula | [`dracula`](kit/standalone/dracula.css) | Everforest | [`everforest`](kit/standalone/everforest.css) |
| Flexoki | [`flexoki`](kit/standalone/flexoki.css) | GitHub | [`github`](kit/standalone/github.css) |
| Gruvbox | [`gruvbox`](kit/standalone/gruvbox.css) | Kanagawa | [`kanagawa`](kit/standalone/kanagawa.css) |
| Lucent Orng | [`lucent-orng`](kit/standalone/lucent-orng.css) | Material | [`material`](kit/standalone/material.css) |
| Matrix | [`matrix`](kit/standalone/matrix.css) | Mercury | [`mercury`](kit/standalone/mercury.css) |
| Monokai | [`monokai`](kit/standalone/monokai.css) | Night Owl | [`nightowl`](kit/standalone/nightowl.css) |
| Nord | [`nord`](kit/standalone/nord.css) | One Dark | [`one-dark`](kit/standalone/one-dark.css) |
| One Dark Pro | [`onedarkpro`](kit/standalone/onedarkpro.css) | Orng | [`orng`](kit/standalone/orng.css) |
| Osaka Jade | [`osaka-jade`](kit/standalone/osaka-jade.css) | Palenight | [`palenight`](kit/standalone/palenight.css) |
| Rose Pine | [`rosepine`](kit/standalone/rosepine.css) | Shades of Purple | [`shadesofpurple`](kit/standalone/shadesofpurple.css) |
| Solarized | [`solarized`](kit/standalone/solarized.css) | Synthwave '84 | [`synthwave84`](kit/standalone/synthwave84.css) |
| Tokyonight | [`tokyonight`](kit/standalone/tokyonight.css) | Vercel | [`vercel`](kit/standalone/vercel.css) |
| Vesper | [`vesper`](kit/standalone/vesper.css) | Zenburn | [`zenburn`](kit/standalone/zenburn.css) |

## Step 1: copy the folder

Copy `kit/` to your Blume project root as `opencode-themes/`, next to `blume.config.ts` and `theme.css`:

```bash
cp -r kit <your-site>/opencode-themes
```

The commands in this README are plain `cp` and `rm`, so they work unchanged in bash, zsh and PowerShell 7.

## Step 2: pick your setup

### A. One fixed theme (recommended for a real docs site)

Every preset also exists **standalone**, already scoped to `:root`, so it needs no attribute and no JavaScript:

```bash
cp opencode-themes/standalone/flexoki.css <your-site>/theme.css
```

If you already have a `theme.css`, paste the contents of `opencode-themes/standalone/<id>.css` at the **end** of it instead: later rules win, so the preset takes over.

Pick `<id>` from the table above, the filenames in `opencode-themes/standalone/`, or the `themes` array in `manifest.json`.

### B. All 36, switchable at runtime

Paste **everything between the markers** in `opencode-themes/theme.css` into your site's `theme.css` (at the end if you already have one):

```
/* >>> opencode-themes:start */
...
/* <<< opencode-themes:end */
```

Blume inlines `theme.css` into a generated sheet under `.blume/`, so a relative `@import` cannot reach the project root, which is why the block has to live inside the file. The markers make a later regeneration a splice instead of a manual merge.

Then copy the picker island (React) next to your content:

```bash
cp opencode-themes/ThemePicker.tsx <your-site>/islands/
```

and use it on any page:

```mdx
<ThemePicker />
```

It writes `data-oc-theme` on `<html>` and remembers the choice in `localStorage`. Without it, or on a first visit, the site uses the default preset (`oc-2`). To change that default permanently, set `policy.defaultTheme` in the generator and regenerate, or just use setup A.

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

Cards carry their own `data-oc-theme` and `data-theme`, so they do not depend on the page's theme. A light/dark toggle covers both modes, and **use** applies that preset to the whole site. Presets are attribute-scoped (not `:root`-scoped) for exactly this reason.

---

## Step 3: code highlighting (required)

The palette is also applied to fenced code. Point Blume's Shiki config at the kit's theme in `blume.config.ts`:

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

The same file serves every preset: its colors are `var(--oc-syn-*)` references rather than baked hex, so switching presets recolors code too. Nothing is hardcoded to one theme and no rebuild is needed.

That is the whole install. Run `blume doctor` and `blume build` to confirm.

## What's inside

| Path | Purpose |
| --- | --- |
| `standalone/<id>.css` | One preset, ready to paste as `theme.css` |
| `theme.css` | All presets + token aliases, marker-delimited |
| `themes/<id>.css` | One preset as an attribute-scoped block |
| `shiki/opencode.json` | One Shiki theme for all presets |
| `manifest.json` | Ids, display names, sample colors, contrast report |
| `ThemePicker.tsx` | Optional island: a dropdown |
| `ThemeGallery.tsx` | Optional island: all 36 side by side |

About 190 KB of CSS for all 36 presets. Ship fewer by regenerating with `policy.include` set, or by taking one `standalone/` file.

## Generator

The kit in `kit/` is what to copy into any Blume site. `generator/` rebuilds it and is not needed by a consuming site; notes for regenerating themes are in [generator/README.md](generator/README.md).

## Notes

- **Contrast is enforced.** Blume paints body copy with `muted-foreground`, a much more demanding role than opencode's de-emphasised `text-muted`. The generator raises that one color along the theme's own grey ramp until it clears WCAG AA (4.5:1) against both the page and the `muted` surface. 13 of the 36 need it; `manifest.json` records each adjustment under `adjusted`.
- **Fonts and radius are yours.** Blume's defaults (Inter + IBM Plex Mono) already match opencode's desktop fonts, so usually there is nothing to do. Override with `theme.fonts` / `theme.radius` for a different character.
- **`accent` is the interactive blue.** opencode has two accent-ish colors; this kit uses `interactive` (oc-2: `#034cff` light, `#a2bcff` dark), the one the app uses for interactive UI. Blume paints prose *links* with `foreground`, so `accent` shows up in focus rings, step markers, badges and active tabs.
- **Dark mode composes.** Every preset declares both modes; the mode comes from Blume's `data-theme`, so `mode: "system"`, the header toggle and print styles behave normally.
- **The islands are React.** Blume also supports Vue and Svelte islands; only `ThemePicker.tsx` and `ThemeGallery.tsx` would need porting. The CSS is framework-agnostic.
- **Islands hydrate when visible.** Both use `client: "visible"`, so a gallery far down a page activates on scroll.

## Licence

Theme colors derived from opencode (MIT, (c) 2025 opencode). The rest is yours to use however you like.
