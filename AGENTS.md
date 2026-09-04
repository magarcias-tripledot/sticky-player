# Sticky Player — agent guide

Web authoring tool for **Sticky** levels. It imports, edits, and exports Unity-compatible JSON (placements or cylindrical grid) and previews balls in a 3D viewport. This is not the Unity gameplay runtime.

Before making architectural changes, read the relevant docs under `/docs`. When a change alters architecture, data contracts, invariants, or module responsibilities, update the corresponding documentation in the same change.

## Overview

A Next.js 15 (App Router) static app. Zustand holds the level document. React Three Fiber renders spheres. The Boosted cylindrical grid generator writes `{ position, color }[]` (stable `slot-*` ids) into the store and is exported as `"format": "grid"`. Other authoring stays `"format": "placements"`.

## Architecture

```
JSON file → parseStickyLevel → editorStore.document (+ lattice if grid)
                              → Viewport (R3F spheres)
                              → Inspector (metadata, tools, export)
generator params → generate*() → GeneratedBall[] → store (replace / session rebuild)
exportJson → spacing check → serialize grid or placements → download
```

Details: [docs/architecture.md](docs/architecture.md)

## Important paths

| Path | Role |
|------|------|
| `src/app/` | Next routes, `layout.tsx`, `globals.css` |
| `src/components/EditorApp.tsx` | Shell: viewport + inspector, undo/redo keys |
| `src/components/Viewport.tsx` | R3F canvas, pick/select, overlap highlight |
| `src/components/Inspector.tsx` | Import/export, metadata, tools host |
| `src/components/BoostedGridPanel.tsx` | Boosted-grid generator UI |
| `src/state/editorStore.ts` | Zustand store, history, import/export, lattice |
| `src/lib/sticky/` | Schema, types, colors, spacing validation |
| `src/lib/generators/` | Procedural geometry, lattice math, grid maps |
| `public/sample-level.json` | Example placements file |
| `public/sample-grid.json` | Example cylindrical grid file |

## Invariants

- `sceneKey` is `"Sticky"`.
- Import: `payload.format === "placements"` → balls list. Otherwise a `grid` array is required (Unity files may omit `format`; this app writes `"format": "grid"`).
- Export: lattice-backed levels (Boosted Generate or grid import) with only valid slot ids → `"format": "grid"` + `grid`/`inner`. Everything else → `"format": "placements"` + `balls`.
- `payload.ballCount` is **available shots**, not `balls.length`.
- Ball diameter in level space is **`0.6`** (`BALL_RADIUS = 0.3`). Default min center distance is **diameter + spacingTolerance − 1e-5**.
- Exception: two balls on **different lattice shells** (`slot-*` ids, different layer) may be as close as **`LAYER_PITCH × 0.6 = 0.54`**. Shells interpenetrate by design so inner rings stay supported.
- Colors: `R O Y G B P K C`. Grid cells may also be `.` (empty).
- Exported placement balls are `{ position, color }` only (no editor `id`).
- `spacingTolerance`, selection, undo stacks, camera fit, `lattice`, and generator session are **not** in placements JSON. Grid export encodes occupancy in the maps, not ball ids.
- Overlapping balls may be imported; **export is disabled** while any pair is closer than the current min distance.

See [docs/level-format.md](docs/level-format.md), [docs/geometry.md](docs/geometry.md), [docs/editor-state.md](docs/editor-state.md).

## Run / test / build

Requires Node (project uses Next 15). From repo root:

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest run
npm run lint
npm run build    # `output: "export"` static site
npm start        # after build
```

Tests live next to code (`*.test.ts`). Vitest alias `@` → `src`.

## Docs

- [docs/architecture.md](docs/architecture.md) — modules, data flow, where to add features
- [docs/level-format.md](docs/level-format.md) — placements and grid JSON
- [docs/geometry.md](docs/geometry.md) — coordinates, spacing, generators
- [docs/editor-state.md](docs/editor-state.md) — store, selection, undo, import/export
- [docs/ai-generation.md](docs/ai-generation.md) — **Planned** prompt-based generation
