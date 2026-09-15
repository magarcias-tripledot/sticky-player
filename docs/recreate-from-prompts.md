# Sticky Level Authoring — recreate from prompts

Use this file as the source of truth to rebuild the project in a clean environment.
Feed it to an agent in **phases**. Do not skip invariants. This is a **web authoring tool**, not the Unity gameplay runtime.

Canonical details also live in [architecture.md](architecture.md), [level-format.md](level-format.md), [geometry.md](geometry.md), and [editor-state.md](editor-state.md). If this file and those disagree, prefer the code and those four docs.

**Out of scope:** prompt-based / OpenAI level generation. That is planned only ([ai-generation.md](ai-generation.md)); do not implement it unless a later spec says so.

---

## Phase 0 — Master constraints (always in context)

### Product

A Next.js 15 App Router **static** site titled Sticky Level Authoring. It imports, edits, previews, and exports Unity-compatible Sticky level JSON (placements or cylindrical grid). A 3D viewport shows balls. Zustand holds the document.

### Stack

- Next 15, React 19, TypeScript strict
- `@react-three/fiber`, `@react-three/drei`, `three`
- `zustand`
- Vitest (`environment: "node"`, alias `@` → `src`)
- `next.config.ts`: `reactStrictMode: true`, `output: "export"`, `assetPrefix: "."`
- No backend, no database, no LLM client
- Do not import React Three Fiber from `src/lib/*` (keep parse/generate testable in Node)

### Scripts

```
npm run dev    # localhost:3000
npm test       # vitest run
npm run lint
npm run build  # writes static site to out/
```

Never run `next build` while `next dev` is using the same `.next` folder.

### Layout

- `src/app/layout.tsx` — title “Sticky Level Authoring”
- `src/app/page.tsx` — `EditorApp`
- `EditorApp`: CSS grid `1fr 320px`, viewport | inspector (`globals.css`)
- Load `Viewport` with `next/dynamic` and `ssr: false`
- Dark inspector: background `#171a21`, text `#e8eaef`, IBM Plex Sans / Segoe UI

### Hard invariants

- `sceneKey` is always `"Sticky"`.
- In memory, levels always have a `balls[]` list with editor `id`s.
- `payload.ballCount` is **available shots**, never `balls.length`.
- Ball diameter **0.6**, radius **0.3** (Unity: collider 0.5 × prefab scale 0.6).
- Y-up. `position` is sphere **center**. Ground plane Y = 0. Lowest generated/grid balls: `y = 0.3`.
- Colors: `R O Y G B P K C` with hex:
  - R `#FF3B30` O `#FF9012` Y `#FFD21E` G `#3ECC4A`
  - B `#2F8BFF` P `#9B4DFF` K `#FF5FB0` C `#1FD3D3`
- Grid cells may also be `.` (empty).
- Default min center distance: `0.6 + spacingTolerance − 1e-5`. Exact contact at 0.6 is valid at tolerance 0.
- **Cross-shell exception:** two balls whose ids are `slot-{layer}-{row}-{column}` on **different layers** may be as close as `0.9 × 0.6 − 1e-5` ≈ 0.54. Same-layer slots and any pair involving a non-slot id use the diameter rule.
- Import does **not** check spacing. Export is **disabled** if any pair is too close.
- Exported placement balls are `{ position, color }` only (strip `id`).
- Editor-only (never in JSON): ball `id`, selection, undo, `spacingTolerance`, `cameraFitNonce`, `importError`, `lattice`, `generatorSession`.
- Empty document: id `untitled-level`, name `Untitled Level`, order `1`, no balls, `ballCount` 50, `rotationSpeed` 12, boosters all 10, `seed` 1.

### Module map

| Path | Role |
|------|------|
| `src/lib/sticky/types.ts` | Document, ball, boosters, `StickyLevelError`, `createEmptyDocument` |
| `src/lib/sticky/constants.ts` | Radius, formats, epsilon |
| `src/lib/sticky/colors.ts` | Codes, labels, hex, type guard |
| `src/lib/sticky/schema.ts` | `parseStickyLevel`, serialize, export dispatch |
| `src/lib/sticky/validateSpacing.ts` | Pairwise overlap |
| `src/state/editorStore.ts` | Zustand store |
| `src/lib/generators/types.ts` | `GeneratedBall`, `GeometryGenerator` |
| `src/lib/generators/cylindricalLattice.ts` | Unity ring math, slot ids |
| `src/lib/generators/cylindricalGrid.ts` | `grid`/`inner` parse/serialize |
| `src/lib/generators/boostedGrid.ts` | Fill lattice |
| `src/lib/generators/csvImport.ts` | CSV → `GeneratedBall[]` |
| `src/lib/generators/tools.ts` | Tool tabs + generator registry |
| `src/components/EditorApp.tsx` | Shell + undo keys |
| `src/components/Viewport.tsx` | R3F |
| `src/components/Inspector.tsx` | JSON I/O, metadata, tools host |
| `src/components/BoostedGridPanel.tsx` | Grid generator UI |
| `src/components/CsvImportPanel.tsx` | CSV import UI |

Tests: `*.test.ts` next to code. Store tests live at `src/lib/sticky/editorStore.test.ts`.

After each phase: typecheck, `vitest run`, lint. Update `/docs` when contracts change.

---

## Phase 1 — Scaffold

Create a Next 15 App Router TypeScript app with the stack above. Path alias `@/*` → `src/*`.

Implement `src/lib/sticky/{constants,colors,types}.ts` exactly as specified.

Write `AGENTS.md` and the four architecture docs. Keep `docs/ai-generation.md` as **Planned** only.

---

## Phase 2 — Parse / serialize placements JSON

`parseStickyLevel(json)`:

- Require `sceneKey === "Sticky"`.
- If `payload.format === "placements"`, parse `balls[].position` and `color`.
- Else require `payload.grid` (Unity files may omit `format`).
- Assign `crypto.randomUUID()` ids on import.
- Field rules:

| Field | Import |
|-------|--------|
| `id`, `name` | string or `""` |
| `order` | finite number or `0` |
| `ballCount` | required finite `>= 0`, trunc int |
| `rotationSpeed` | finite or `0` |
| `boosters.*` (`bomb`, `multiball`, `wild`, `rainbow`) | int 0–100; missing → 0 |
| `seed` | finite trunc, else `trunc(order)` |

`serializeStickyLevel`: placements payload, strip ball ids.

Tests for valid placements, `ballCount` ≠ `balls.length`, invalid sceneKey, missing grid when not placements.

---

## Phase 3 — Spacing + Zustand store (placements only)

`findInvalidBallIds(balls, spacingTolerance?)`: pairwise; mark both ids of an offending pair. Use squared distance vs `minCenterDistanceFor`. Later add the cross-shell rule once slot ids exist.

Store fields: `document`, `selectedIds`, `importError`, `cameraFitNonce`, `spacingTolerance` (default 0), `past`/`future` (max 100), `lattice` null, `generatorSession` null.

Actions: `importJson` (wipe history, fit camera), `selectBall(id, toggle)`, `clearSelection`, `setSpacingTolerance` (clamp `>= 0`), `setSelectedBallsColor`, `deleteSelectedBalls`, `updateMetadata`, `newLevel`, `clearBalls` (empty balls, `ballCount = 0`, keep id/name/boosters), `undo`/`redo` (clear selection), `exportJson` (null if overlap else serialize).

History: color, delete, metadata, `applyGeneratedBalls`, `beginGeneratorSession`, `clearBalls` push snapshots of `{ document, lattice, generatorSession }`. Select / tolerance / `setLattice` / `rebuildGeneratedBalls` do not. `importJson` and `newLevel` wipe stacks.

Shortcuts in EditorApp: Cmd/Ctrl+Z undo; Shift+Z or Cmd/Ctrl+Y redo; ignore when focus is INPUT/TEXTAREA.

Inspector: New Level (confirm if dirty), Clear (confirm), Import JSON, Export JSON (disabled if overlap), Undo/Redo, spacing tolerance, counts (`balls.length` readonly, `ballCount` editable), selected ball(s) XYZ + color swatches + delete, level metadata, boosters 0–100.

Viewport: OrbitControls, ground `Grid` at Y=0 cell size 0.6, spheres radius 0.3, click select, Shift/Cmd/Ctrl multi-select, empty click clears, selected scale 1.06 + white outline, overlapping balls red emissive + red outline. Default camera `[2.6, 2, 3.4]` fov 50. `cameraFitNonce` frames AABB expanded by `2 * BALL_RADIUS`, or a box at `(0, 0.3, 0)` if empty.

Samples: `public/sample-level.json`; fixture `src/lib/sticky/fixtures/overlapping.json`.

---

## Phase 4 — Cylindrical lattice + grid format

Mirror Unity cylindrical lattice math in **lattice units** (`LATTICE_BALL_RADIUS = 0.5`), then `* WORLD_SCALE` (`0.6`).

- `ROW_PITCH = √3/2`, `LAYER_PITCH = 0.9`, `MAX_LAYERS = 3`
- `ringRadius(columns) = 0.5 / sin(π / columns)`, columns ≥ 3
- `innerColumnsFor(outer, layer)`: layer 0 → outer; else `radius = ringRadius(outer) − layer * 0.9`; if `radius <= 0.5 * 1.05` return null; else `floor(π / asin(0.5 / radius))` if ≥ 3 else null
- `cellCenterWorld`: radius = outerRadius − layer * 0.9; odd rows +0.5 column; `x = r sin θ * scale`, `z = r cos θ * scale`; `y = (0.5 + (rows-1-row) * ROW_PITCH) * scale`
- Slot id: `slot-{layer}-{row}-{column}`
- `normalizeLattice`: columns ≥ 3, rows ≥ 1, layers 1..3

Grid JSON:

```json
"payload": {
  "format": "grid",
  "grid": ["R.R", "RRR"],
  "inner": [["OOO"]],
  "ballCount": 8,
  "rotationSpeed": 12,
  "boosters": { "bomb": 0, "multiball": 0, "wild": 0, "rainbow": 0 },
  "seed": 1
}
```

- `grid` = outer shell, wrapping row strings, equal width ≥ 3
- `inner[0]` = layer 1; max 3 layers total; same row count as `grid`
- Layer L width **must** equal `innerColumnsFor(outerColumns, L)` or import fails
- `.` = empty (no ball). Occupied cells → balls with slot ids. No `balls` array on disk.

Export `"format": "grid"` iff `lattice != null` **and** every ball id is a slot of that lattice (`canEncodeAsCylindricalGrid`). Otherwise placements.

Import grid: set `lattice`, `generatorSession = "boosted-grid"`, wipe history.

Spacing: implement the cross-shell exception using `parseSlotId`.

`clearBalls` on a lattice level **keeps** `lattice` (export is an all-`.` grid).

Fixture: `src/lib/sticky/fixtures/grid-hole.json` (`["R.R","RRR"]`). Optional `public/sample-grid.json`.

Tests: ring math, multi-layer export not blocked, hole round-trip, append non-slot ball → placements fallback.

---

## Phase 5 — Boosted grid tool

`GeometryGenerator { id, generate(params?) }`.

`generateBoostedGrid({ columns, rows, layers, colorsBySlot?, previousSlots? })`: enumerate slots; skip layers where `innerColumnsFor` is null; default color `R`; if `previousSlots` set, keep holes (only new slot ids get default color); preserve `colorsBySlot`.

`beginGeneratorSession(session, generated, lattice)`: replace balls, set session + lattice, one undo, fit camera.

`rebuildGeneratedBalls`: replace balls, **no** history, keep selection ids that still exist, optional lattice update.

`applyGeneratedBalls(generated, "replace"|"append")`: replace clears lattice + session; append keeps them (forces placements if mixed ids). Map generated balls: `id ?? crypto.randomUUID()`.

UI `BoostedGridPanel` (Tools tab “Boosted grid”): columns/rows/layers; first Generate → `beginGeneratorSession`; while session live, param changes rebuild occupancy-preserving (no extra undo). Show inner widths / skip warning (inner needs a wider outer ring, try 12+). Default draft 8×6×1.

Register in `tools.ts`. Inspector renders tool tabs from `authoringTools`.

---

## Phase 6 — CSV import tool

Editor-only. Not a Unity payload.

Headers (required, case-insensitive): `x,y,z,color,layer`. Extra columns ignored. Comma-separated, simple quotes. Skip blank rows. `layer` must parse as a finite number then **discard**. Colors must be Sticky codes; errors include row number. Empty/invalid files must not mutate the document.

`parseCsvPlacements(text) → GeneratedBall[]` (no ids). `csvImportGenerator.id = "csv-import"`; `generate` takes a CSV string and returns `[]` on bad input.

Panel “CSV”: file picker `.csv`, help text, Import. Success: `applyGeneratedBalls(balls, "replace")` — one undo, fit camera, clear lattice/session. Do **not** wipe history like JSON import. Do **not** call `beginGeneratorSession`.

Sample `public/sample-cube.csv`: 4×4×4 red cube, 64 rows + header, step 0.6, `y` starts at 0.3, `layer` 0. Tests: 64 balls, default spacing valid, ignored layer, bad color, missing header, empty body. Store test: CSV after boosted grid → lattice null, export placements.

---

## Phase 7 — Docs + static export

Ensure AGENTS.md and the architecture docs match the code. Note CSV is editor-only.

`next build` produces `out/`. Test by serving `out/` over HTTP (not `file://`):

```
cd out && python3 -m http.server 4173
```

---

## Done when

- Import/export placements and grid JSON match the Unity contracts above
- Viewport shows balls; select/color/delete; overlap highlights; export blocked on overlap
- Boosted grid generate + live resize; grid export with holes
- CSV cube import visible and undoable; export placements
- New Level / Clear / undo behave as specified
- Vitest + lint + typecheck pass
- Static `out/` site runs without Node
