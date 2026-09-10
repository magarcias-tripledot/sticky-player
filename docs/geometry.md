# Geometry

## Coordinates

- Level JSON and Three.js share the same Cartesian frame: **Y-up**, X/Z horizontal.
- `position` is the **sphere center**. Viewport meshes use `sphereGeometry(BALL_RADIUS)` with `BALL_RADIUS = 0.3`.
- Ground grid sits on **Y = 0**; cell size is `BALL_DIAMETER` (`0.6`).
- Default empty-scene camera: `[2.6, 2, 3.4]`, fov 50. Fit-camera (on import / generate / clear) frames ball AABB expanded by `2 * BALL_RADIUS`, or a small box at `(0, BALL_RADIUS, 0)` if empty.

Cylindrical lattice math (`cylindricalLattice.ts`) first computes in **Unity lattice units** (`LATTICE_BALL_RADIUS = 0.5`), then multiplies by `WORLD_SCALE = BALL_RADIUS / 0.5` (`0.6`) so exported positions match this editor’s diameter.

Lattice conventions (pre-scale, then `* WORLD_SCALE`):

- Ring in XZ; `x = r sin θ`, `z = r cos θ`.
- Odd rows offset by **half a column**.
- Row pitch `√3 / 2`; layer pitch `0.9` inward; max **3** layers.
- Bottom row center Y (after scale) is `BALL_RADIUS` (sits on the play surface).
- Inner layer column count shrinks; if the ring would clip the axis, `innerColumnsFor` returns `null` and that layer is skipped.
- Cylindrical **grid JSON** stores occupancy as wrapping strings (`grid` + `inner`), not positions. Widths are derived from the outer column count; see [level-format.md](level-format.md).

## Collision / overlap

`findInvalidBallIds(balls, spacingTolerance?)`:

- Pairwise squared distance against a **per-pair** threshold.
- Default: `minCenterDistanceFor` = `diameter + max(0, tolerance) − OVERLAP_EPSILON` (`0.59999`).
- Cross-shell: when both ids are `slot-*` on **different layers**, `minLayerCenterDistanceFor` = `LAYER_PITCH × WORLD_SCALE + max(0, tolerance) − OVERLAP_EPSILON` (`0.53999`).
- Both ids of an offending pair are marked.
- Used for viewport highlight, inspector warning, and **export gate**. Does not mutate positions.

The cross-shell exception is not a fudge factor. Rings step inward by `LAYER_PITCH = 0.9` while a ball is `1.0` across (lattice units), so radial neighbours touch at `0.9`; the Boosted Sculpture GDD depends on that contact for inner-ring support. Unity spawns grid levels straight from `CylindricalGridPlacementBuilder` with no spacing check — `BallsSpawner.IsPositionFree` (`2 * radius`) only applies when nudging a ball in flight. Without the exception every level with 2+ layers is unexportable.

Same-layer neighbours are at exact contact (`0.6`), so they use the diameter rule. A `slot-*` ball paired with a freeform ball also uses the diameter rule.

There is no physics, snapping, or continuous collision in this app.

## Placement rules for generators

- Output centers in the same units as JSON (`BALL_RADIUS = 0.3` world).
- Prefer packing that stays `>=` default min distance so export works at tolerance `0`.
- Colors must be `StickyColorCode`.
- Optional stable `id` (boosted grid: `slot-{layer}-{row}-{column}`) so rebuilds can keep painted colors.

## Utilities (exist today)

| Function / const | File | Use |
|------------------|------|-----|
| `BALL_RADIUS`, `BALL_DIAMETER`, `MIN_CENTER_DISTANCE`, … | `constants.ts` | Size and default threshold |
| `minCenterDistanceFor`, `minLayerCenterDistanceFor`, `findInvalidBallIds` | `validateSpacing.ts` | Authoring overlap |
| `ringRadius`, `innerColumnsFor`, `cellCenterWorld`, `slotId`, `parseSlotId`, `enumerateLatticeSlots`, `WORLD_SCALE`, `LAYER_MIN_CENTER_DISTANCE`, `MAX_LAYERS` | `cylindricalLattice.ts` | Boosted / Unity lattice |
| `parseCylindricalGridMaps`, `serializeStickyGrid`, `canEncodeAsCylindricalGrid` | `cylindricalGrid.ts` | Grid JSON I/O |
| `generateBoostedGrid`, `boostedGridGenerator` | `boostedGrid.ts` | Fill or sparse rebuild |
| `parseCsvPlacements`, `csvImportGenerator` | `csvImport.ts` | CSV rows → placements (layer ignored) |

`MIN_CENTER_DISTANCE` is the default-tolerance threshold (`diameter − epsilon`), not a separate gameplay constant.

## Intended generator interface

```ts
type GeneratedBall = {
  id?: string;
  position: { x: number; y: number; z: number };
  color: StickyColorCode;
};

interface GeometryGenerator {
  readonly id: string;
  generate(params?: unknown): GeneratedBall[];
}
```

New generators should:

1. Implement `GeometryGenerator` in `src/lib/generators/`.
2. Produce **`{ position, color }[]`** (ids optional).
3. Register on `geometryGenerators` in `tools.ts`.
4. Add an inspector panel that maps UI → typed params → `generate`, then `beginGeneratorSession` / `rebuildGeneratedBalls` or `applyGeneratedBalls`.
5. Validate with `findInvalidBallIds` if the algorithm can overlap (boosted grid relies on lattice spacing).
6. Only the Boosted/cylindrical tool should set store `lattice` (grid export). Other generators leave `lattice` null so export stays placements.

CSV import (`csvImport.ts`) is a placements source: headers `x,y,z,color,layer`. The `layer` column is required and discarded. Sample cube: `public/sample-cube.csv` (4×4×4 at diameter spacing).

Do not emit full level JSON from geometry code; the store owns metadata (`ballCount`, boosters, etc.).
