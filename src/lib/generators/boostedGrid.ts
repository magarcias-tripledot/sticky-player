import type { StickyColorCode } from "../sticky/colors";
import {
  cellCenterWorld,
  innerColumnsFor,
  normalizeLattice,
  ringRadius,
  slotId,
  type LatticeSpec,
} from "./cylindricalLattice";
import type { GeneratedBall, GeometryGenerator } from "./types";

export const DEFAULT_BOOSTED_COLOR: StickyColorCode = "R";

export type BoostedGridParams = LatticeSpec & {
  colorsBySlot?: Record<string, StickyColorCode>;
  /** When set, keep holes; fill only brand-new slot ids with the default color. */
  previousSlots?: readonly string[];
};

export function generateBoostedGrid(params: BoostedGridParams): GeneratedBall[] {
  const { columns, rows, layers } = normalizeLattice(params);
  const colors = params.colorsBySlot ?? {};
  const sparse = params.previousSlots !== undefined;
  const previous = sparse ? new Set(params.previousSlots) : null;
  const outerRadius = ringRadius(columns);
  const balls: GeneratedBall[] = [];

  for (let layer = 0; layer < layers; layer += 1) {
    const layerColumns = innerColumnsFor(columns, layer);
    if (layerColumns === null) {
      continue;
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < layerColumns; column += 1) {
        const id = slotId(layer, row, column);
        const painted = colors[id];
        if (sparse && painted === undefined && previous?.has(id)) {
          continue;
        }
        balls.push({
          id,
          position: cellCenterWorld(layer, row, column, layerColumns, rows, outerRadius),
          color: painted ?? DEFAULT_BOOSTED_COLOR,
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
