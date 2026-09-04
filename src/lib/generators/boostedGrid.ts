import type { StickyColorCode } from "../sticky/colors";
import {
  cellCenterWorld,
  innerColumnsFor,
  MAX_LAYERS,
  ringRadius,
  slotId,
} from "./cylindricalLattice";
import type { GeneratedBall, GeometryGenerator } from "./types";

export const DEFAULT_BOOSTED_COLOR: StickyColorCode = "R";

export type BoostedGridParams = {
  columns: number;
  rows: number;
  layers: number;
  colorsBySlot?: Record<string, StickyColorCode>;
};

export function generateBoostedGrid(params: BoostedGridParams): GeneratedBall[] {
  const columns = Math.max(3, Math.trunc(Number.isFinite(params.columns) ? params.columns : 3));
  const rows = Math.max(1, Math.trunc(Number.isFinite(params.rows) ? params.rows : 1));
  const layerCount = Math.min(
    MAX_LAYERS,
    Math.max(1, Math.trunc(Number.isFinite(params.layers) ? params.layers : 1)),
  );
  const colors = params.colorsBySlot ?? {};
  const outerRadius = ringRadius(columns);
  const balls: GeneratedBall[] = [];

  for (let layer = 0; layer < layerCount; layer += 1) {
    const layerColumns = innerColumnsFor(columns, layer);
    if (layerColumns === null) {
      continue;
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < layerColumns; column += 1) {
        const id = slotId(layer, row, column);
        balls.push({
          id,
          position: cellCenterWorld(layer, row, column, layerColumns, rows, outerRadius),
          color: colors[id] ?? DEFAULT_BOOSTED_COLOR,
        });
      }
    }
  }

  return balls;
}

export const boostedGridGenerator: GeometryGenerator = {
  id: "boosted-grid",
  generate(params?: unknown) {
    if (typeof params !== "object" || params === null) {
      return [];
    }
    const record = params as Record<string, unknown>;
    if (
      typeof record.columns !== "number" ||
      typeof record.rows !== "number" ||
      typeof record.layers !== "number"
    ) {
      return [];
    }
    return generateBoostedGrid({
      columns: record.columns,
      rows: record.rows,
      layers: record.layers,
      colorsBySlot:
        typeof record.colorsBySlot === "object" && record.colorsBySlot !== null
          ? (record.colorsBySlot as Record<string, StickyColorCode>)
          : undefined,
    });
  },
};
