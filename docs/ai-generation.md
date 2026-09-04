# AI generation

**Status: Planned.** This repo has no prompt UI, no model client, and no prompt-to-JSON pipeline.

## Implemented today (use this, do not bypass)

Procedural code owns positions:

- `GeometryGenerator.generate(params?)` → `GeneratedBall[]` (`position` + `color`, optional `id`).
- Boosted grid: typed `BoostedGridParams` (`columns`, `rows`, `layers`, `colorsBySlot`, optional `previousSlots`) → `generateBoostedGrid`.
- Store applies arrays via `beginGeneratorSession` / `rebuildGeneratedBalls` / `applyGeneratedBalls`. Lattice-backed Boosted output is exported as `"format": "grid"`.
- Level metadata stays in the editor; geometry does not write full placements JSON.
- Overlap is `findInvalidBallIds` after positions exist.

Any future AI path should call this same stack.

## Planned architecture

1. User prompt (and maybe current document / seed) → **structured generation intent** (generator id + parameters, optional constraints). Not a free-form final level JSON blob when a generator can express the shape.
2. A thin mapper validates/clamps that intent into the generator’s param type.
3. Geometry `generate()` produces `{ position, color }[]`.
4. Editor inserts balls, user edits colors/metadata, spacing check on export.

If a prompt cannot map onto an existing generator, **Planned** options are: add a generator, or a constrained fallback that still emits `GeneratedBall[]` from code—not unchecked model JSON.

## What AI should not do (when implemented)

- Invent `sceneKey` / `format` / color codes outside the schema.
- Treat `ballCount` as number of spheres.
- Skip `findInvalidBallIds` before treating a result as exportable.
- Put editor-only fields into downloaded JSON.

## Hook points (existing)

- Registry: `geometryGenerators` in `src/lib/generators/tools.ts`.
- Apply: `useEditorStore` generator actions.
- Validate: `src/lib/sticky/validateSpacing.ts`.
- Serialize: `serializeExportedLevel` (grid vs placements) after the user exports.
