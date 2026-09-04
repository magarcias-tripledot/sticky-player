# Sticky level JSON

Source of truth: `src/lib/sticky/schema.ts`, `types.ts`, `constants.ts`, `colors.ts`, `src/lib/generators/cylindricalGrid.ts`.

`sceneKey` must be `"Sticky"`. Two payload formats:

| `payload.format` | When | Body |
|------------------|------|------|
| `"placements"` | New Level, imported placement files, non-grid generators | `balls: [{ position, color }]` |
| `"grid"` | Boosted grid Generate, or imported cylindrical maps | `grid` string rows + optional `inner` |

**Import:** `format === "placements"` → balls parser. Else a `grid` array is required (Unity sculpture files often omit `format`; this editor always writes `"format": "grid"` on grid export).

## Placements

```json
{
  "id": "string",
  "order": 0,
  "name": "string",
  "sceneKey": "Sticky",
  "payload": {
    "format": "placements",
    "balls": [{ "position": { "x": 0, "y": 0.3, "z": 0 }, "color": "R" }],
    "ballCount": 50,
    "rotationSpeed": 12,
    "boosters": { "bomb": 0, "multiball": 0, "wild": 0, "rainbow": 0 },
    "seed": 1
  }
}
```

Editor assigns `StickyBall.id` on parse (`crypto.randomUUID`). **Serialize strips `id`.**

## Cylindrical grid

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

- `grid`: outer shell. Each string is a row around the cylinder. Width = outer columns (≥ 3). Same length every row.
- `inner`: optional extra shells inward. `inner[0]` is layer 1. Max 3 layers total (`inner.length ≤ 2`). Same row count as `grid`.
- Layer `L` width **must** be `innerColumnsFor(outerColumns, L)` (e.g. outer 16 → 10 then 4). If the shell cannot fit, import fails.
- Cells: `R O Y G B P K C` or `.` (empty). Omit `inner` when there is only the outer layer.
- In memory, cells become balls with ids `slot-{layer}-{row}-{column}`; `.` is omitted.
- No `balls` array on disk.

Shared payload fields (`ballCount`, `rotationSpeed`, `boosters`, `seed`) match placements. `ballCount` is **shots**, not occupied cells.

## Shared import rules

| Field | Import behavior |
|-------|-----------------|
| `id`, `name` | String or `""` |
| `order` | Finite number or `0` |
| `payload.ballCount` | Required finite number `>= 0`; truncated to int |
| `payload.rotationSpeed` | Finite number or `0` |
| `payload.boosters.*` | Integer 0–100; missing/invalid → `0` |
| `payload.seed` | Finite number truncated, else `trunc(order)` |

Spacing is **not** checked on import.

## Geometry numbers (level space)

| Constant | Value | Notes |
|----------|--------|--------|
| `BALL_RADIUS` | `0.3` | Unity: collider radius `0.5` × prefab scale `0.6` |
| `BALL_DIAMETER` | `0.6` | Viewport sphere radius |
| `SPACING_TOLERANCE` | `0` default | Authoring-only extra gap; not exported |
| `OVERLAP_EPSILON` | `1e-5` | Absorbs Unity float32 noise |
| Min center distance | `BALL_DIAMETER + spacingTolerance − OVERLAP_EPSILON` | Exact contact at `0.6` is valid at default tolerance |
| Cross-shell min distance | `0.9 × 0.6 + spacingTolerance − OVERLAP_EPSILON` | `slot-*` pairs on different layers pack at `0.54`; see [geometry.md](geometry.md) |

## Sample files

- `public/sample-level.json` — placements cluster.
- `public/sample-grid.json` — 12-column outer + 6-column inner with holes.
- `src/lib/sticky/fixtures/overlapping.json` — overlapping placements (export blocked).
- `src/lib/sticky/fixtures/grid-hole.json` — 3×2 grid with a `.` hole.
