# Editor state

Store: `src/state/editorStore.ts` (`useEditorStore`, Zustand, `"use client"`).

## Shape

| Field | Meaning |
|-------|---------|
| `document` | `StickyLevelDocument` (in-memory balls always, including ids) |
| `lattice` | `{ columns, rows, layers }` when the level is cylindrical-grid-backed; else `null` |
| `selectedIds` | Ordered unique ball ids |
| `importError` | Last parse failure message, or `null` |
| `cameraFitNonce` | Incremented to refit OrbitControls |
| `spacingTolerance` | Authoring extra gap (`>= 0`); default `SPACING_TOLERANCE` (`0`) |
| `past` / `future` | Undo/redo stacks, max **100** snapshots |
| `generatorSession` | Active generator id (`"boosted-grid"`) or `null` |

Empty document (`createEmptyDocument`): placements, `lattice: null`, id `untitled-level`, order `1`, name `Untitled Level`, no balls, `ballCount` 50, `rotationSpeed` 12, boosters all 10, seed 1.

## Selection

- Click mesh: `selectBall(id, false)` → exclusive selection.
- Shift / Meta / Ctrl click: `selectBall(id, true)` toggle.
- Click empty canvas: `clearSelection`.
- Unknown id is ignored.
- Undo/redo **clears** selection. Selection is **not** stored in snapshots.
- Multi-select color/delete is one history step.

## Undo / redo

Snapshots clone `document`, `lattice`, and `generatorSession` (not selection or spacing tolerance).

**Pushes history** (clears `future`): color, delete, metadata, `applyGeneratedBalls`, `beginGeneratorSession`, `clearBalls`.

**No history**: select, spacing tolerance, `setLattice`, `rebuildGeneratedBalls` (live generator resize), failed import.

**Wipes history**: successful `importJson`, `newLevel`.

Shortcuts in `EditorApp`: Cmd/Ctrl+Z undo, Shift+Z or Cmd/Ctrl+Y redo; ignored when focus is INPUT/TEXTAREA.

`rebuildGeneratedBalls` keeps selection ids that still exist after the new slot set.

## Import / export

- **Import placements:** parse balls; `lattice` null; session null; wipe history; fit camera.
- **Import grid:** expand maps to slot balls; set `lattice`; start `boosted-grid` session; wipe history; fit camera.
- **Export:** overlap → `null`. Else if `lattice` is set and every ball id is a slot of that lattice → `"format": "grid"`. Else `"format": "placements"`.
- **New Level:** factory placements document; `lattice` null; wipe history/session; fit camera.
- **Clear:** empty `balls`, `ballCount = 0`; keep id/name/boosters. On a lattice-backed level, keep `lattice` (export is an all-`.` grid). On placements, clear session.

## Editor-only vs exported

**Placements export:** `id`, `order`, `name`, `sceneKey`, `payload.format: "placements"`, each ball `{ position, color }`, `ballCount`, `rotationSpeed`, `boosters`, `seed`.

**Grid export:** same metadata, `payload.format: "grid"`, `grid` (and `inner` if extra shells). No `balls`. Occupancy and color live in the character maps.

**Editor-only:** ball `id`, `selectedIds`, `importError`, `cameraFitNonce`, `spacingTolerance`, `past`/`future`, `generatorSession`, `lattice`.
