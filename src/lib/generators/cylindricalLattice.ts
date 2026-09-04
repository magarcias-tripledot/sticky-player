import { BALL_RADIUS } from "../sticky/constants";

// Mirrors Assets/_Sticky/Scripts/Levels/CylindricalLatticeMath.cs (prefab-radius units).
export const LATTICE_BALL_RADIUS = 0.5;
export const ROW_PITCH = Math.sqrt(3) / 2;
export const LAYER_PITCH = 0.9;
export const MAX_LAYERS = 3;

export const WORLD_SCALE = BALL_RADIUS / LATTICE_BALL_RADIUS;

// Shells sit LAYER_PITCH apart while a ball is 2 * LATTICE_BALL_RADIUS across, so radial
// neighbours interpenetrate by design; the GDD relies on that contact for inner-ring support.
export const LAYER_MIN_CENTER_DISTANCE = LAYER_PITCH * WORLD_SCALE;

export function ringRadius(columns: number): number {
  if (columns < 3) {
    throw new RangeError("A ring requires at least three columns.");
  }
  return LATTICE_BALL_RADIUS / Math.sin(Math.PI / columns);
}

export function innerColumnsFor(outerColumns: number, layer: number): number | null {
  if (layer <= 0) {
    return outerColumns;
  }
  const radius = ringRadius(outerColumns) - layer * LAYER_PITCH;
  if (radius <= LATTICE_BALL_RADIUS * 1.05) {
    return null;
  }
  const columns = Math.floor(Math.PI / Math.asin(LATTICE_BALL_RADIUS / radius));
  return columns >= 3 ? columns : null;
}

export function cellCenterWorld(
  layer: number,
  row: number,
  column: number,
  columns: number,
  rows: number,
  outerRadius: number,
): { x: number; y: number; z: number } {
  const radius = outerRadius - layer * LAYER_PITCH;
  const angle = (column + (row % 2 === 0 ? 0 : 0.5)) * Math.PI * 2 / columns;
  return {
    x: radius * Math.sin(angle) * WORLD_SCALE,
    y: (LATTICE_BALL_RADIUS + (rows - 1 - row) * ROW_PITCH) * WORLD_SCALE,
    z: radius * Math.cos(angle) * WORLD_SCALE,
  };
}

export function slotId(layer: number, row: number, column: number): string {
  return `slot-${layer}-${row}-${column}`;
}

export type LatticeSpec = {
  columns: number;
  rows: number;
  layers: number;
};

export function normalizeLattice(spec: LatticeSpec): LatticeSpec {
  return {
    columns: Math.max(3, Math.trunc(Number.isFinite(spec.columns) ? spec.columns : 3)),
    rows: Math.max(1, Math.trunc(Number.isFinite(spec.rows) ? spec.rows : 1)),
    layers: Math.min(
      MAX_LAYERS,
      Math.max(1, Math.trunc(Number.isFinite(spec.layers) ? spec.layers : 1)),
    ),
  };
}

export function parseSlotId(id: string): { layer: number; row: number; column: number } | null {
  const match = /^slot-(\d+)-(\d+)-(\d+)$/.exec(id);
  if (!match) {
    return null;
  }
  return {
    layer: Number(match[1]),
    row: Number(match[2]),
    column: Number(match[3]),
  };
}

export function enumerateLatticeSlots(spec: LatticeSpec): string[] {
  const { columns, rows, layers } = normalizeLattice(spec);
  const ids: string[] = [];
  for (let layer = 0; layer < layers; layer += 1) {
    const layerColumns = innerColumnsFor(columns, layer);
    if (layerColumns === null) {
      continue;
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < layerColumns; column += 1) {
        ids.push(slotId(layer, row, column));
      }
    }
  }
  return ids;
}
