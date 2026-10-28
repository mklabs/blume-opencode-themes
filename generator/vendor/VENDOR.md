# Vendored: opencode desktop theme engine

Copied verbatim from `anomalyco/opencode` at tag **v2.2.0** (`1097e2668b`), path
`packages/ui/src/theme/`. MIT licensed, (c) 2025 opencode.

Why vendored instead of installed: `@opencode/ui@2.2.0` cannot be installed on its
own (its dependency graph asks for `motion-dom@14.0.0`, which is not on the
registry), and we only need the theme layer, which has no runtime dependencies.

Included:

- `color.ts`, `types.ts`, `resolve.ts`: the V1 (legacy) token generator
- `v2/{avatar,default-primitives,foreground,mapping,resolve}.ts`: the V2
  primitive/semantic generator
- `themes/*.json`: the 36 shipped desktop themes

`v2/resolve.test.ts` was dropped (it imports vitest).

These files are unmodified apart from removing that test file, so refreshing is a
straight copy. Keep it that way.

To refresh against a newer opencode release, re-copy the same paths from the
opencode checkout at that tag, then regenerate.
