import { useEffect, useState } from "react";
import manifest from "../opencode-themes/manifest.json";

const STORAGE_KEY = "oc-theme";

/**
 * Renders every preset in the kit side by side.
 *
 * Each card is a genuinely themed subtree: it carries `data-oc-theme` (and
 * `data-theme` for the mode), so the preset's `--oc-*` slots resolve on the card
 * itself. The kit repeats its `--blume-*` aliases on `[data-oc-theme]` for
 * exactly this reason: custom properties substitute at the declaring element.
 *
 * Copy to `<your-site>/islands/ThemeGallery.tsx` next to an `opencode-themes/`
 * folder, then use `<ThemeGallery />` on any MDX page.
 */

const CODE = [
  { text: "// one palette, every surface\n", color: "var(--oc-syn-comment)" },
  { text: "export function ", color: "var(--oc-syn-keyword)" },
  { text: "greet", color: "var(--oc-syn-property)" },
  { text: "(", color: "var(--oc-syn-punctuation)" },
  { text: "name", color: "var(--oc-syn-variable)" },
  { text: ": ", color: "var(--oc-syn-operator)" },
  { text: "string", color: "var(--oc-syn-type)" },
  { text: ") {\n  ", color: "var(--oc-syn-punctuation)" },
  { text: "return ", color: "var(--oc-syn-keyword)" },
  { text: "`hi ${name}`", color: "var(--oc-syn-string)" },
  { text: "\n}", color: "var(--oc-syn-punctuation)" },
];

function applyTheme(id: string) {
  document.documentElement.dataset.ocTheme = id;
  localStorage.setItem(STORAGE_KEY, id);
}

export default function ThemeGallery() {
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const [applied, setApplied] = useState("");

  useEffect(() => {
    setApplied(document.documentElement.dataset.ocTheme ?? "");
  }, []);

  const apply = (id: string) => {
    applyTheme(id);
    setApplied(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="not-prose">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-border text-xs">
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={
                "px-2 py-1 capitalize " +
                (mode === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {value}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {manifest.themes.length} presets from opencode {manifest.source.split(" ")[1]}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {manifest.themes.map((theme) => (
          <article
            key={theme.id}
            data-oc-theme={theme.id}
            data-theme={mode}
            className="overflow-hidden rounded-xl border border-border bg-background text-foreground"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="truncate text-sm font-medium">{theme.name}</span>
              <button
                type="button"
                onClick={() => apply(theme.id)}
                className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {applied === theme.id ? "active" : "use"}
              </button>
            </header>

            <div className="space-y-2 px-3 py-3">
              <p className="text-[13px] font-medium">Getting started</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Body copy sits on the muted foreground.{" "}
                <span className="text-foreground underline decoration-dotted underline-offset-2">A link</span> keeps the
                body colour, as Blume intends.
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">npm i blume</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{ background: "var(--oc-code-add)", color: "var(--oc-syn-diff-add)" }}
                >
                  + added
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{ background: "var(--oc-code-remove)", color: "var(--oc-syn-diff-delete)" }}
                >
                  - removed
                </span>
              </div>

              {/* A div, not a <pre>: Blume's layout script injects copy buttons
                  into <pre> elements, which would break island hydration. */}
              <div className="overflow-hidden rounded-md border border-border bg-code px-2 py-1.5 font-mono text-[10px] leading-[1.55] whitespace-pre">
                {CODE.map((part, index) => (
                  <span key={index} style={{ color: part.color }}>
                    {part.text}
                  </span>
                ))}
              </div>

              <div
                className="rounded-r border-l-2 px-2 py-1 text-[10px]"
                style={{ background: "var(--oc-code-highlight)", borderColor: "var(--oc-code-highlight-border)" }}
              >
                <span className="text-foreground">A callout</span>{" "}
                <span className="text-muted-foreground">on the highlight tint.</span>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                {["var(--oc-accent)", "var(--oc-syn-warning)", "var(--oc-syn-critical)", "var(--oc-syn-success)"].map(
                  (color) => (
                    <span key={color} className="h-2 w-2 rounded-full" style={{ background: color }} />
                  ),
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">{theme.id}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
