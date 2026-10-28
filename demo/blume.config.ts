import { defineConfig } from "blume";
import codeTheme from "./opencode-themes/shiki/opencode.json" with { type: "json" };

export default defineConfig({
  title: "opencode themes for Blume",
  description: "Every opencode desktop palette, as a Blume theme.",
  content: {
    root: "docs",
  },
  theme: {
    mode: "system",
    toggle: true,
    radius: "md",
  },
  markdown: {
    code: {
      icons: true,
      theme: {
        light: codeTheme,
        dark: codeTheme,
      },
    },
  },
});
