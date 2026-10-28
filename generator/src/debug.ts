import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { contrastRatio } from "../vendor/opencode-theme/color"
import { resolveThemeVariant } from "../vendor/opencode-theme/resolve"
import { resolveThemeVariantV2 } from "../vendor/opencode-theme/v2/resolve"

const here = path.dirname(fileURLToPath(import.meta.url))
const vendor = path.join(here, "..", "vendor", "opencode-theme")
const id = process.argv[2] ?? "solarized"

const def = JSON.parse(await readFile(path.join(vendor, "themes", `${id}.json`), "utf8"))
const v2 = resolveThemeVariantV2(def.light, false) as unknown as Record<string, string>
const v1 = resolveThemeVariant(def.light, false) as unknown as Record<string, string>

const alpha: Record<string, string> = {}
for (const m of (await readFile(path.join(vendor, "alpha-ramps.css"), "utf8")).matchAll(/--(v2-alpha-[a-z]+-\d+):\s*([^;]+);/g)) {
  alpha[m[1]!] = m[2]!.trim()
}

const get = (key: string, stack: string[] = []): string => {
  const value = v2[key] ?? alpha[key] ?? v1[key]
  if (value === undefined) throw new Error(`missing ${key}`)
  const ref = /^var\(--([a-z0-9-]+)\)$/i.exec(value)
  return ref ? get(ref[1]!, [...stack, key]) : value
}

const bg = get("v2-background-bg-base")
const muted = get("v2-background-bg-layer-01")
const mutedFg = get("v2-text-text-muted")

console.log({ bg, muted, mutedFg })
console.log("ratio on bg:   ", contrastRatio(mutedFg as `#${string}`, bg as `#${string}`).toFixed(2))
console.log("ratio on muted:", contrastRatio(mutedFg as `#${string}`, muted as `#${string}`).toFixed(2))
console.log("--- ramp ---")
for (const step of [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]) {
  const value = get(`v2-grey-${step}`)
  const onBg = contrastRatio(value as `#${string}`, bg as `#${string}`)
  const onMuted = contrastRatio(value as `#${string}`, muted as `#${string}`)
  console.log(`grey-${step}\t${value}\ton-bg ${onBg.toFixed(2)}\ton-muted ${onMuted.toFixed(2)}`)
}
