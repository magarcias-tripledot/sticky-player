import { BALL_RADIUS } from "../sticky/constants";

// Mirrors Assets/_Sticky/Scripts/Levels/CylindricalLatticeMath.cs (prefab-radius units).
export const LATTICE_BALL_RADIUS = 0.5;
export const ROW_PITCH = Math.sqrt(3) / 2;
export const LAYER_PITCH = 0.9;
export const MAX_LAYERS = 3;

const WORLD_SCALE = BALL_RADIUS / LATTICE_BALL_RADIUS;

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
