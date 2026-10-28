/**
 * Generates the portable `kit/` from opencode's desktop themes.
 *
 * Pipeline per theme, per mode:
 *   1. run opencode's V2 resolver  -> surfaces, text, border, state colours
 *   2. run opencode's V1 resolver  -> syntax, markdown, diff colours
 *   3. resolve `var(--...)` dereferences across both layers (alpha ramps live
 *      in CSS only, so they are parsed out of the vendored stylesheet)
 *   4. map onto the kit's `--oc-*` slots
 *
 * Output is plain CSS + one Shiki theme JSON. Nothing here ships to a consuming
 * site; only `kit/` does.
 */

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { contrastRatio, hexToRgb, shift } from "../vendor/opencode-theme/color"
import { resolveThemeVariant } from "../vendor/opencode-theme/resolve"
import { resolveThemeVariantV2 } from "../vendor/opencode-theme/v2/resolve"
import { policy } from "./policy"

const here = path.dirname(fileURLToPath(import.meta.url)) // generator/dist
const generatorRoot = path.resolve(here, "..") // generator
const vendor = path.join(generatorRoot, "vendor", "opencode-theme")
const outDir = path.resolve(generatorRoot, "..", "kit")

const SOURCE = "anomalyco/opencode v2.2.0 (1097e2668b), MIT"

type Tokens = Record<string, string>

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const isHex = (value: string) => /^#[0-9a-f]{3,8}$/i.test(value)
const isRgba = (value: string) => /^rgba?\(/i.test(value)

/** Emit one canonical spelling: `#rrggbb`, or `rgba()` when there is alpha. */
function normalizeColor(value: string) {
  if (!isHex(value)) return value
  const h = value.slice(1)
  const full =
    h.length === 3 || h.length === 4
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h
  const rgb = full.slice(0, 6).toLowerCase()
  const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
  if (alpha >= 0.999) return `#${rgb}`
  const { r, g, b } = hexToRgb(`#${rgb}` as `#${string}`)
  const to255 = (v: number) => Math.round(v * 255)
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${Number(alpha.toFixed(3))})`
}

/** Hex -> `rgba(r, g, b, a)`. */
function tint(hex: string, alpha: number) {
  if (!isHex(hex)) throw new Error(`tint expects a hex color, got ${hex}`)
  const { r, g, b } = hexToRgb(hex as `#${string}`)
  const to255 = (value: number) => Math.round(value * 255)
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${alpha})`
}

/** Blume's `labelOn` / opencode's `on()`: white unless dark ink reads better. */
function foregroundOn(hex: string) {
  const white = contrastRatio("#ffffff", hex as `#${string}`)
  const black = contrastRatio("#000000", hex as `#${string}`)
  return white >= black ? "#ffffff" : "#000000"
}

/** Composite a translucent colour onto an opaque background so contrast math is valid. */
function flatten(color: string, background: string) {
  const match = /^rgba?\(([^)]+)\)$/i.exec(color)
  if (!match) return color
  const [r, g, b, a = 1] = match[1]!.split(",").map((value) => Number.parseFloat(value))
  const bg = hexToRgb(background as `#${string}`)
  const channel = (value: number, base: number) =>
    Math.round(Math.max(0, Math.min(255, value! * a! + base * 255 * (1 - a!))))
      .toString(16)
      .padStart(2, "0")
  return `#${channel(r!, bg.r)}${channel(g!, bg.g)}${channel(b!, bg.b)}`
}

/**
 * Blume paints body prose with `--blume-muted-foreground`, but opencode's
 * `text-muted` is de-emphasised *UI* text and can sit well below AA (everforest
 * lands at 2.1:1). Keep the theme's own neutral, but walk its grey ramp to the
 * nearest step that clears AA against every surface the text sits on.
 */
function snapToContrast(raw: string, candidates: string[], backgrounds: string[], min: number) {
  const original = flatten(raw, backgrounds[0]!)
  const passes = (value: string) =>
    backgrounds.every((background) => contrastRatio(value as `#${string}`, background as `#${string}`) >= min)

  if (passes(original)) return { value: original, adjusted: false }

  const passing = candidates.filter(passes)
  if (passing.length) {
    // The lowest passing ratio is the closest to what the theme intended.
    passing.sort(
      (a, b) =>
        contrastRatio(a as `#${string}`, backgrounds[0] as `#${string}`) -
        contrastRatio(b as `#${string}`, backgrounds[0] as `#${string}`),
    )
    return { value: passing[0]!, adjusted: true }
  }

  // The ramp could not reach AA (solarized tops out at 4.47:1). Move the theme's
  // own colour along OKLCH lightness instead, keeping its hue and chroma.
  const lighter = (value: string) => contrastRatio(value as `#${string}`, "#000000")
  // Move away from the background: lighten text that already sits lighter than
  // it, darken text that sits darker.
  const direction = lighter(original) > lighter(backgrounds[0]!) ? 1 : -1
  for (let step = 1; step <= 25; step++) {
    const candidate = shift(original as `#${string}`, { l: direction * 0.02 * step })
    if (passes(candidate)) return { value: candidate, adjusted: true }
  }

  return { value: original, adjusted: false, unsatisfiable: true }
}

function parseAlphaRamps(css: string) {
  const ramps: Tokens = {}
  for (const match of css.matchAll(/--(v2-alpha-[a-z]+-\d+):\s*([^;]+);/g)) {
    ramps[match[1]!] = match[2]!.trim()
  }
  return ramps
}

/**
 * V2 semantic tokens are references (`var(--v2-grey-300)`), and some point at
 * the alpha ramps that exist only in CSS. V1 tokens reference both layers too,
 * so one namespace resolves the lot.
 */
function makeReader(tokens: Tokens, ramps: Tokens) {
  const get = (key: string, stack: string[] = []): string => {
    const value = tokens[key] ?? ramps[key]
    if (value === undefined) throw new Error(`missing token: ${key}`)
    if (stack.includes(key)) throw new Error(`circular reference: ${[...stack, key].join(" -> ")}`)
    const ref = /^var\(--([a-z0-9-]+)\)$/i.exec(value)
    if (!ref) {
      if (!isHex(value) && !isRgba(value) && value !== "transparent") {
        throw new Error(`unresolved value for ${key}: ${value}`)
      }
      return value
    }
    return get(ref[1]!, [...stack, key])
  }
  return get
}

// ---------------------------------------------------------------------------
// slots
// ---------------------------------------------------------------------------

function buildSlots(variant: any, isDark: boolean, ramps: Tokens) {
  const v1 = resolveThemeVariant(variant, isDark) as unknown as Tokens
  const v2 = resolveThemeVariantV2(variant, isDark) as unknown as Tokens
  // V1 keys (`text-strong`) and V2 keys (`v2-text-text-strong`) never collide,
  // and either layer may reference the other.
  const read = makeReader({ ...v1, ...v2 }, ramps)
  const v1v = (key: string) => read(key)

  const palette = variant.palette ?? variant.seeds
  const accent = normalizeColor(
    policy.accent === "primary" && palette?.primary ? palette.primary : read("v2-text-text-accent"),
  )

  const surface = policy.muted === "layer-01" ? "v2-background-bg-layer-01" : "v2-background-bg-layer-02"

  const bg = normalizeColor(read("v2-background-bg-base"))
  const fg = normalizeColor(read("v2-text-text-base"))
  const muted = normalizeColor(read(surface))
  const rawMutedFg = flatten(normalizeColor(read("v2-text-text-muted")), bg)
  const greyRamp = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200].map((step) =>
    normalizeColor(read(`v2-grey-${step}`)),
  )
  const mutedFg = snapToContrast(rawMutedFg, greyRamp, [bg, muted], policy.minContrast)

  const slots: Tokens = {
    // surfaces + text
    "--oc-bg": bg,
    "--oc-fg": fg,
    "--oc-muted": muted,
    "--oc-muted-fg": mutedFg.value,
    "--oc-border": read("v2-border-border-base"),
    "--oc-accent": accent,
    "--oc-accent-fg": foregroundOn(accent),
    "--oc-code-bg": muted,

    // code notation surfaces (Blume's `--blume-code-*`)
    "--oc-code-highlight": tint(accent, 0.1),
    "--oc-code-highlight-border": tint(accent, 0.55),
    "--oc-code-add": tint(v1v("text-diff-add-base"), 0.16),
    "--oc-code-add-border": tint(v1v("text-diff-add-base"), 0.7),
    "--oc-code-remove": tint(v1v("text-diff-delete-base"), 0.16),
    "--oc-code-remove-border": tint(v1v("text-diff-delete-base"), 0.7),
    "--oc-code-error": tint(read("v2-state-fg-danger"), 0.16),
    "--oc-code-error-border": tint(read("v2-state-fg-danger"), 0.7),
    "--oc-code-warning": tint(read("v2-state-fg-warning"), 0.18),
    "--oc-code-warning-border": tint(read("v2-state-fg-warning"), 0.7),
    "--oc-code-word": tint(accent, 0.16),
    "--oc-code-word-border": tint(accent, 0.5),

    // syntax slots, from the V1 generator's richer vocabulary
    "--oc-syn-comment": v1v("syntax-comment"),
    "--oc-syn-keyword": v1v("syntax-keyword"),
    "--oc-syn-string": v1v("syntax-string"),
    "--oc-syn-constant": v1v("syntax-constant"),
    "--oc-syn-property": v1v("syntax-property"),
    "--oc-syn-variable": v1v("syntax-variable"),
    "--oc-syn-type": v1v("syntax-type"),
    "--oc-syn-operator": v1v("syntax-operator"),
    "--oc-syn-punctuation": v1v("syntax-punctuation"),
    "--oc-syn-primitive": v1v("syntax-primitive"),
    "--oc-syn-object": v1v("syntax-object"),
    "--oc-syn-regexp": v1v("syntax-regexp"),
    "--oc-syn-success": v1v("syntax-success"),
    "--oc-syn-warning": v1v("syntax-warning"),
    "--oc-syn-critical": v1v("syntax-critical"),
    "--oc-syn-info": v1v("syntax-info"),
    "--oc-syn-diff-add": v1v("syntax-diff-add"),
    "--oc-syn-diff-delete": v1v("syntax-diff-delete"),

    // markdown slots
    "--oc-md-text": v1v("markdown-text"),
    "--oc-md-heading": v1v("markdown-heading"),
    "--oc-md-link": v1v("markdown-link"),
    "--oc-md-link-text": v1v("markdown-link-text"),
    "--oc-md-code": v1v("markdown-code"),
    "--oc-md-block-quote": v1v("markdown-block-quote"),
    "--oc-md-emphasis": v1v("markdown-emph"),
    "--oc-md-strong": v1v("markdown-strong"),
    "--oc-md-horizontal-rule": v1v("markdown-horizontal-rule"),
    "--oc-md-list-item": v1v("markdown-list-item"),
    "--oc-md-list-enumeration": v1v("markdown-list-enumeration"),
    "--oc-md-image": v1v("markdown-image"),
    "--oc-md-image-text": v1v("markdown-image-text"),
    "--oc-md-code-block": v1v("markdown-code-block"),
  }

  for (const [key, value] of Object.entries(slots)) {
    if (!value) throw new Error(`${key} resolved empty`)
    slots[key] = normalizeColor(value)
  }

  const adjustments =
    mutedFg.adjusted || mutedFg.unsatisfiable
      ? [
          {
            slot: "--oc-muted-fg",
            from: rawMutedFg,
            to: mutedFg.value,
            reason: mutedFg.unsatisfiable ? "no ramp step clears AA" : "raised to AA for body text",
          },
        ]
      : []

  return { slots, adjustments }
}

// ---------------------------------------------------------------------------
// Shiki theme - a translation of opencode's `generateSyntax` scope table
// ---------------------------------------------------------------------------

type Rule = { scope: string[]; color: string; fontStyle?: string }

const RULES: Rule[] = [
  { scope: ["default"], color: "var(--oc-fg)" },
  { scope: ["comment", "comment.documentation"], color: "var(--oc-syn-comment)", fontStyle: "italic" },
  { scope: ["string", "symbol", "character.special", "character"], color: "var(--oc-syn-string)" },
  { scope: ["number", "boolean", "constant", "float"], color: "var(--oc-syn-constant)" },
  {
    scope: ["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"],
    color: "var(--oc-syn-keyword)",
    fontStyle: "italic",
  },
  { scope: ["keyword.type"], color: "var(--oc-syn-type)", fontStyle: "bold italic" },
  { scope: ["keyword.function", "function.method"], color: "var(--oc-syn-property)" },
  { scope: ["keyword"], color: "var(--oc-syn-keyword)", fontStyle: "italic" },
  {
    scope: ["keyword.import", "string.escape", "string.regexp", "tag.attribute", "keyword.export"],
    color: "var(--oc-syn-keyword)",
  },
  {
    scope: ["operator", "keyword.operator", "punctuation.delimiter", "keyword.conditional.ternary"],
    color: "var(--oc-syn-operator)",
  },
  {
    scope: [
      "variable",
      "variable.parameter",
      "function.method.call",
      "function.call",
      "property",
      "parameter",
      "field",
    ],
    color: "var(--oc-syn-variable)",
  },
  { scope: ["variable.member", "function", "constructor"], color: "var(--oc-syn-property)" },
  { scope: ["type", "module", "class", "namespace"], color: "var(--oc-syn-type)" },
  { scope: ["type.definition"], color: "var(--oc-syn-type)", fontStyle: "bold" },
  { scope: ["punctuation", "punctuation.bracket"], color: "var(--oc-syn-punctuation)" },
  {
    scope: [
      "variable.builtin",
      "type.builtin",
      "function.builtin",
      "module.builtin",
      "constant.builtin",
      "variable.super",
    ],
    color: "var(--oc-syn-critical)",
  },
  {
    scope: ["keyword.directive", "keyword.modifier", "keyword.exception"],
    color: "var(--oc-syn-keyword)",
    fontStyle: "italic",
  },
  { scope: ["punctuation.special", "tag.delimiter"], color: "var(--oc-syn-operator)" },

  // markdown
  {
    scope: [
      "markup.heading",
      "markup.heading.2",
      "markup.heading.3",
      "markup.heading.4",
      "markup.heading.5",
      "markup.heading.6",
    ],
    color: "var(--oc-md-heading)",
    fontStyle: "bold",
  },
  { scope: ["markup.heading.1"], color: "var(--oc-md-heading)", fontStyle: "bold underline" },
  { scope: ["markup.bold", "markup.strong"], color: "var(--oc-md-strong)", fontStyle: "bold" },
  { scope: ["markup.italic"], color: "var(--oc-md-emphasis)", fontStyle: "italic" },
  { scope: ["markup.list"], color: "var(--oc-md-list-item)" },
  { scope: ["markup.quote"], color: "var(--oc-md-block-quote)", fontStyle: "italic" },
  { scope: ["markup.raw", "markup.raw.block"], color: "var(--oc-md-code)" },
  { scope: ["markup.raw.inline"], color: "var(--oc-md-code)" },
  {
    scope: ["markup.link", "markup.link.url", "string.special", "string.special.url"],
    color: "var(--oc-md-link)",
    fontStyle: "underline",
  },
  { scope: ["markup.link.label"], color: "var(--oc-md-link-text)", fontStyle: "underline" },
  { scope: ["label"], color: "var(--oc-md-link-text)" },

  // tree-sitter oddments
  { scope: ["spell", "nospell"], color: "var(--oc-fg)" },
  { scope: ["markup.underline"], color: "var(--oc-fg)", fontStyle: "underline" },
  { scope: ["comment.error"], color: "var(--oc-syn-critical)", fontStyle: "italic bold" },
  { scope: ["comment.warning"], color: "var(--oc-syn-warning)", fontStyle: "italic bold" },
  { scope: ["comment.todo", "comment.note"], color: "var(--oc-syn-info)", fontStyle: "italic bold" },
  { scope: ["attribute", "annotation"], color: "var(--oc-syn-warning)" },
  { scope: ["tag"], color: "var(--oc-syn-critical)" },
  { scope: ["markup.strikethrough", "markup.list.unchecked", "debug"], color: "var(--oc-muted-fg)" },
  { scope: ["markup.list.checked"], color: "var(--oc-syn-success)" },
  { scope: ["diff.plus"], color: "var(--oc-syn-diff-add)" },
  { scope: ["diff.minus"], color: "var(--oc-syn-diff-delete)" },
  { scope: ["diff.delta"], color: "var(--oc-muted-fg)" },
  { scope: ["error"], color: "var(--oc-syn-critical)", fontStyle: "bold" },
  { scope: ["warning"], color: "var(--oc-syn-warning)", fontStyle: "bold" },
  { scope: ["info"], color: "var(--oc-syn-info)" },
]

const shikiTheme = {
  name: "opencode",
  type: "dark",
  colors: {
    "editor.background": "transparent",
    "editor.foreground": "var(--oc-fg)",
  },
  tokenColors: RULES.map((rule) => ({
    scope: rule.scope,
    settings: { foreground: rule.color, ...(rule.fontStyle ? { fontStyle: rule.fontStyle } : {}) },
  })),
}

// ---------------------------------------------------------------------------
// emitters
// ---------------------------------------------------------------------------

const HEADER = (name: string) =>
  `/* ${name} - opencode desktop theme, generated from ${SOURCE}. Do not edit by hand. */`

function block(selector: string, slots: Tokens) {
  return `${selector} {\n${Object.entries(slots)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n")}\n}`
}

/** One preset, scoped to an attribute so it also works on a subtree. */
function themeCss(id: string, light: Tokens, dark: Tokens) {
  return [
    HEADER(id),
    block(`[data-oc-theme="${id}"]`, light),
    block(`[data-oc-theme="${id}"][data-theme="dark"]`, dark),
    "",
  ].join("\n\n")
}

/** One preset, applied as the site theme through Blume's own `:root` tokens. */
function standaloneCss(id: string, name: string, light: Tokens, dark: Tokens) {
  return [
    HEADER(`${name} (${id})`),
    [
      "/*",
      " * Standalone: this is the only preset in the file, so it goes straight onto",
      " * :root and needs no data-oc-theme attribute.",
      " *",
      " * Install: paste this whole file into your project's theme.css (or copy it",
      " * there as theme.css if you do not have one yet), then point",
      ' * `markdown.code.theme` at `opencode-themes/shiki/opencode.json`.',
      " */",
    ].join("\n"),
    block(":root", light),
    block(':root[data-theme="dark"]', dark),
    STANDALONE_ALIAS_CSS,
    "",
  ].join("\n\n")
}

const ALIASES = `
  --blume-background: var(--oc-bg);
  --blume-foreground: var(--oc-fg);
  --blume-muted: var(--oc-muted);
  --blume-muted-foreground: var(--oc-muted-fg);
  --blume-border: var(--oc-border);
  --blume-accent: var(--oc-accent);
  --blume-accent-foreground: var(--oc-accent-fg);
  --blume-code-background: var(--oc-code-bg);
  --blume-code-highlight: var(--oc-code-highlight);
  --blume-code-highlight-border: var(--oc-code-highlight-border);
  --blume-code-add: var(--oc-code-add);
  --blume-code-add-border: var(--oc-code-add-border);
  --blume-code-remove: var(--oc-code-remove);
  --blume-code-remove-border: var(--oc-code-remove-border);
  --blume-code-error: var(--oc-code-error);
  --blume-code-error-border: var(--oc-code-error-border);
  --blume-code-warning: var(--oc-code-warning);
  --blume-code-warning-border: var(--oc-code-warning-border);
  --blume-code-word: var(--oc-code-word);
  --blume-code-word-border: var(--oc-code-word-border);
`

const ALIAS_NOTE = `Connects the preset's \`--oc-*\` slots to Blume's design tokens.
   \`--oc-*\` already carries the mode, so the dark selector only exists to
   outrank Blume's own \`:root[data-theme="dark"]\` defaults, which declare at
   higher specificity than a bare \`:root\`.`

const STANDALONE_ALIAS_CSS = `/* ${ALIAS_NOTE} */

:root,
:root[data-theme="dark"] {${ALIASES}}
`

const BASE_CSS = `/* ${ALIAS_NOTE.replace("Connects the preset's", "Connects the kit's")}
   \`[data-oc-theme]\` repeats them on any themed subtree: custom properties
   substitute at the element that declares them, so a scoped preview would
   otherwise inherit \`:root\`'s resolved colours. */

:root,
:root[data-theme="dark"],
[data-oc-theme] {${ALIASES}}
`

const MARK_START = "/* >>> opencode-themes:start */"
const MARK_END = "/* <<< opencode-themes:end */"

/**
 * The full kit. Blume inlines `theme.css` into a generated sheet under
 * `.blume/src/generated`, so a relative `@import` cannot reach the project root
 * - the CSS has to live *inside* theme.css. The markers make regeneration a
 * splice rather than a manual merge.
 */
function kitThemeCss(presets: { id: string; name: string; light: Tokens; dark: Tokens }[], defaultId: string) {
  const fallback = presets.find((theme) => theme.id === defaultId) ?? presets[0]!
  return [
    HEADER("opencode themes for Blume"),
    [
      "/*",
      " * All presets. Paste everything between the markers at the END of your",
      " * project's theme.css (or copy this file there if you have none).",
      " * Want a single fixed theme instead? Use `standalone/<id>.css`.",
      " *",
      ' * Switching: set data-oc-theme="<id>" on <html>, or use the ThemePicker',
      ` * island. No attribute = the default preset (${fallback.id}).`,
      " */",
    ].join("\n"),
    MARK_START,
    [
      "/* Default preset, for a site with no data-oc-theme set (and no JS). */",
      block(":root", fallback.light),
      block(':root[data-theme="dark"]', fallback.dark),
    ].join("\n\n"),
    ...presets.map((theme) => themeCss(theme.id, theme.light, theme.dark)),
    BASE_CSS,
    MARK_END,
    "",
  ].join("\n\n")
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const checkOnly = process.argv.includes("--check")

  const ramps = parseAlphaRamps(await readFile(path.join(vendor, "alpha-ramps.css"), "utf8"))
  const themeDir = path.join(vendor, "themes")
  const files = (await readdir(themeDir)).filter((file) => file.endsWith(".json")).sort()

  const themes: {
    id: string
    name: string
    light: Tokens
    dark: Tokens
    contrast: { pair: string; ratio: number; ok: boolean }[]
    adjustments: { slot: string; from: string; to: string; reason: string }[]
  }[] = []

  for (const file of files) {
    const id = file.replace(/\.json$/, "")
    if (policy.include && !policy.include.includes(id)) continue
    const def = JSON.parse(await readFile(path.join(themeDir, file), "utf8"))

    const lightRun = buildSlots(def.light, false, ramps)
    const darkRun = buildSlots(def.dark, true, ramps)
    const light = lightRun.slots
    const dark = darkRun.slots

    const contrast = [
      ["foreground on background", light["--oc-fg"]!, light["--oc-bg"]!],
      ["muted-foreground on background", light["--oc-muted-fg"]!, light["--oc-bg"]!],
      ["muted-foreground on muted", light["--oc-muted-fg"]!, light["--oc-muted"]!],
      ["accent-foreground on accent", light["--oc-accent-fg"]!, light["--oc-accent"]!],
      ["foreground on background (dark)", dark["--oc-fg"]!, dark["--oc-bg"]!],
      ["muted-foreground on background (dark)", dark["--oc-muted-fg"]!, dark["--oc-bg"]!],
      ["muted-foreground on muted (dark)", dark["--oc-muted-fg"]!, dark["--oc-muted"]!],
      ["accent-foreground on accent (dark)", dark["--oc-accent-fg"]!, dark["--oc-accent"]!],
    ].map(([pair, fg, bg]) => {
      const ratio = Number(contrastRatio(fg as `#${string}`, bg as `#${string}`).toFixed(2))
      return { pair: pair!, ratio, ok: ratio >= policy.minContrast }
    })

    themes.push({
      id,
      name: def.name ?? id,
      light,
      dark,
      contrast,
      adjustments: [...lightRun.adjustments, ...darkRun.adjustments],
    })
  }

  const failures = themes.flatMap((theme) =>
    theme.contrast.filter((row) => !row.ok).map((row) => `${theme.id}: ${row.pair} = ${row.ratio}:1`),
  )

  const width = Math.max(...themes.map((theme) => theme.id.length))
  for (const theme of themes) {
    const worst = Math.min(...theme.contrast.map((row) => row.ratio))
    console.log(
      `${theme.id.padEnd(width)}  ${worst.toFixed(2)}:1 worst  ${theme.light["--oc-bg"]} / ${theme.light["--oc-accent"]}`,
    )
  }

  if (failures.length) {
    console.log(`\n${failures.length} below ${policy.minContrast}:1`)
    for (const failure of failures) console.log(`  ${failure}`)
  }

  if (checkOnly) {
    process.exitCode = failures.length ? 1 : 0
    return
  }

  await rm(outDir, { recursive: true, force: true })
  await mkdir(path.join(outDir, "themes"), { recursive: true })
  await mkdir(path.join(outDir, "standalone"), { recursive: true })
  await mkdir(path.join(outDir, "shiki"), { recursive: true })

  for (const theme of themes) {
    await writeFile(path.join(outDir, "themes", `${theme.id}.css`), themeCss(theme.id, theme.light, theme.dark))
    await writeFile(
      path.join(outDir, "standalone", `${theme.id}.css`),
      standaloneCss(theme.id, theme.name, theme.light, theme.dark),
    )
  }

  const fallback = themes.find((theme) => theme.id === policy.defaultTheme) ?? themes[0]!
  await writeFile(path.join(outDir, "theme.css"), kitThemeCss(themes, fallback.id))
  await writeFile(path.join(outDir, "shiki", "opencode.json"), JSON.stringify(shikiTheme, null, 2) + "\n")

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        source: SOURCE,
        generator: "opencode-themes-generator",
        policy: { defaultTheme: fallback.id, accent: policy.accent, muted: policy.muted },
        themes: themes.map((theme) => ({
          id: theme.id,
          name: theme.name,
          light: {
            background: theme.light["--oc-bg"],
            foreground: theme.light["--oc-fg"],
            accent: theme.light["--oc-accent"],
          },
          dark: {
            background: theme.dark["--oc-bg"],
            foreground: theme.dark["--oc-fg"],
            accent: theme.dark["--oc-accent"],
          },
          contrast: {
            worst: Math.min(...theme.contrast.map((row) => row.ratio)),
            failures: theme.contrast.filter((row) => !row.ok).map((row) => `${row.pair} = ${row.ratio}:1`),
          },
          adjusted: theme.adjustments,
        })),
      },
      null,
      2,
    ) + "\n",
  )

  // Static kit assets live outside the generator's output so regenerating never
  // destroys hand-maintained files: the whole kit/ directory is disposable.
  const starter = path.join(generatorRoot, "starter")
  for (const file of await readdir(starter)) {
    await copyFile(path.join(starter, file), path.join(outDir, file))
  }

  console.log(`\nwrote ${themes.length} presets to ${outDir}`)
}

await main()
