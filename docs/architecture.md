# Architecture

## App shell

- `src/app/layout.tsx` — HTML document, title “Sticky Level Authoring”.
- `src/app/page.tsx` — renders `EditorApp`.
- `next.config.ts` — `reactStrictMode`, `output: "export"`, `assetPrefix: "."` (static deploy).

`EditorApp` loads `Viewport` with `next/dynamic` (`ssr: false`) so Three.js stays client-only. Layout is CSS grid: viewport | 320px inspector (`globals.css`).

## Modules

| Module | Responsibility |
|--------|----------------|
| `src/lib/sticky/types.ts` | `StickyLevelDocument`, `StickyBall`, boosters, `StickyLevelError`, empty-level defaults |
| `src/lib/sticky/constants.ts` | Radius/diameter, overlap epsilon, scene/format keys, booster cap |
| `src/lib/sticky/colors.ts` | Color codes, labels, hex for viewport |
| `src/lib/sticky/schema.ts` | `parseStickyLevel` / placements serialize / export dispatch |
| `src/lib/sticky/validateSpacing.ts` | Pairwise overlap (diameter, or shell pitch across lattice layers); used by viewport, inspector, export |
| `src/state/editorStore.ts` | Single Zustand store: document, lattice, selection, history, generators |
| `src/lib/generators/types.ts` | `GeneratedBall`, `GeometryGenerator` |
| `src/lib/generators/cylindricalLattice.ts` | Unity-aligned ring/lattice math, slot ids, `LatticeSpec` |
| `src/lib/generators/cylindricalGrid.ts` | Parse/serialize `grid`/`inner` maps, encode check |
| `src/lib/generators/boostedGrid.ts` | Fills or sparsely rebuilds lattice cells → `GeneratedBall[]` |
| `src/lib/generators/csvImport.ts` | Parse CSV ball rows → `GeneratedBall[]` (layer column ignored) |
| `src/lib/generators/tools.ts` | Inspector tool tabs + generator registry |
| `Viewport` | Camera, grid, spheres, click selection |
| `Inspector` | File I/O, metadata, tools host |
| `BoostedGridPanel` | Columns/rows/layers → store session + live rebuild |
| `CsvImportPanel` | CSV file → `applyGeneratedBalls` replace (placements) |

There is **no** backend, persistence, or LLM client in this repo.

## Data flow

1. **Import** — file picker → `importJson` → `parseStickyLevel` → replace `document`, set `lattice` for grid files (and start `boosted-grid` session), clear selection/history, bump `cameraFitNonce`.
2. **Edit** — inspector / viewport / generators mutate `document` through store actions (most push undo).
3. **Render** — `Viewport` reads `document.payload.balls` (always a ball list in memory).
4. **Export** — `exportJson` runs `findInvalidBallIds`; if empty, lattice-encodable → `serializeStickyGrid` (`"format": "grid"`), else `serializeStickyLevel` (`"format": "placements"`).

Generator path (boosted grid): panel params → `generateBoostedGrid` → `beginGeneratorSession` (first Generate, one undo snapshot, sets `lattice`) or `rebuildGeneratedBalls` (live param changes, **no** extra undo, occupancy-preserving). Slot ids `slot-{layer}-{row}-{column}`.

`applyGeneratedBalls` is used by CSV import (`replace`). Append onto a lattice level makes export fall back to placements.

CSV path: Tools → CSV → `parseCsvPlacements` → `applyGeneratedBalls(..., "replace")`. One undo step; clears `lattice` and `generatorSession`; export is placements. Does not wipe history like JSON import.

## Dependencies

```
app → EditorApp → Viewport, Inspector
Inspector → editorStore, sticky/*, generators/tools, BoostedGridPanel, CsvImportPanel
BoostedGridPanel → boostedGrid, cylindricalLattice, editorStore
CsvImportPanel → csvImport, editorStore
Viewport → editorStore, sticky constants/colors/validateSpacing, R3F/drei/three
editorStore → schema, types, validateSpacing, generators/types
schema → cylindricalGrid, colors, constants, types
validateSpacing → cylindricalLattice (shell pitch, slot parsing), constants, types
cylindricalGrid → cylindricalLattice, sticky colors/constants/types
boostedGrid → cylindricalLattice, sticky colors
csvImport → sticky colors/types
cylindricalLattice → sticky BALL_RADIUS (world scale only)
```

Do not import React Three Fiber from `src/lib/*`. Keep parse/validate/generate usable from Vitest (node).

## Where to add features

| Feature | Place |
|---------|--------|
| New placements/grid field / parse rule | `types.ts`, `schema.ts`, `cylindricalGrid.ts`, tests |
| Spacing / diameter policy | `constants.ts`, `validateSpacing.ts` |
| New editor action / history behavior | `editorStore.ts` + `editorStore.test.ts` |
| New procedural shape | `src/lib/generators/<name>.ts` implementing `GeometryGenerator`; lattice helpers only if cylindrical |
| Register generator + inspector tab | `tools.ts` (`authoringTools` + `geometryGenerators`) and a `*Panel.tsx` |
| Viewport interaction / camera | `Viewport.tsx` |
| Global chrome / shortcuts | `EditorApp.tsx` |
| Styling | `globals.css` |

Non-grid generators should **not** set `lattice` so export stays placements.

Prompt-based generation is **Planned** — [ai-generation.md](ai-generation.md).
