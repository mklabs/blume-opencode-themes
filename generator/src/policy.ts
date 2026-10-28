/**
 * Mapping policy: the only file to edit when a theme looks wrong.
 *
 * Everything else in `src/generate.ts` is mechanical: it runs opencode's own
 * resolvers and writes the result out.
 */

export const policy = {
  /** Preset used when `data-oc-theme` is unset. Must exist in `themes/`. */
  defaultTheme: "oc-2",

  /**
   * Which opencode palette entry becomes Blume's single `accent`.
   *
   * - `interactive`: the blue family the desktop app uses for interactive UI
   *   (oc-2: #034cff light / #a2bcff dark).
   * - `primary`: the brand seed, which for oc-2 is a pale yellow (#dcde8d)
   *   and is unused by the V2 token layer.
   */
  accent: "interactive" as "interactive" | "primary",

  /**
   * Which opencode surface becomes Blume's `muted` (a subtle surface used by
   * callouts, table headers, badges):
   *
   * - `layer-01`: barely above the page background.
   * - `layer-02`: the visible panel surface.
   */
  muted: "layer-01" as "layer-01" | "layer-02",

  /** WCAG AA for body-size text. */
  minContrast: 4.5,

  /** Emit only these ids (omit for all 36). */
  include: undefined as string[] | undefined,
}
