import { useEffect, useState } from "react";
import manifest from "../opencode-themes/manifest.json";

const STORAGE_KEY = "oc-theme";

function apply(id: string) {
  const root = document.documentElement;
  if (id) root.dataset.ocTheme = id;
  else delete root.dataset.ocTheme;
}

/**
 * Theme switcher for the opencode-themes kit.
 *
 * Copy to `<your-site>/islands/ThemePicker.tsx` next to an `opencode-themes/`
 * folder, then use `<ThemePicker />` on any MDX page. It only writes
 * `data-oc-theme` on <html>; Blume keeps owning light/dark via `data-theme`.
 */
export default function ThemePicker() {
  const [active, setActive] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    setActive(saved);
    apply(saved);
  }, []);

  const select = (id: string) => {
    setActive(id);
    apply(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <label className="not-prose flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Theme</span>
      <select
        className="rounded-md border border-border bg-muted px-2 py-1 text-foreground"
        value={active}
        onChange={(event) => select(event.currentTarget.value)}
      >
        <option value="">
          Default ({manifest.themes.find((theme) => theme.id === manifest.policy.defaultTheme)?.name ?? "oc-2"})
        </option>
        {manifest.themes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">{manifest.themes.length} opencode presets</span>
    </label>
  );
}
