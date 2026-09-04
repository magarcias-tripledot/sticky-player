import { isStickyColorCode } from "../sticky/colors";
import { GRID_EMPTY_CELL } from "../sticky/constants";
import { StickyLevelError, type StickyBall, type StickyLevelDocument } from "../sticky/types";
import {
  cellCenterWorld,
  enumerateLatticeSlots,
  innerColumnsFor,
  MAX_LAYERS,
  normalizeLattice,
  ringRadius,
  slotId,
  type LatticeSpec,
} from "./cylindricalLattice";

const ALLOWED_GRID_CELLS = "ROYGBPKC.";

export function canEncodeAsCylindricalGrid(
  balls: readonly { id: string }[],
  lattice: LatticeSpec | null,
): lattice is LatticeSpec {
  if (!lattice) {
    return false;
  }
  const allowed = new Set(enumerateLatticeSlots(lattice));
  return balls.every((ball) => allowed.has(ball.id));
}

export function ballsFromGridLayers(
  layers: readonly (readonly string[])[],
  lattice: LatticeSpec,
): StickyBall[] {
  const { columns, rows } = normalizeLattice(lattice);
  const outerRadius = ringRadius(columns);
  const balls: StickyBall[] = [];

  for (let layer = 0; layer < layers.length; layer += 1) {
    const layerRows = layers[layer];
    const layerColumns = innerColumnsFor(columns, layer);
    if (layerColumns === null) {
      continue;
    }
    for (let row = 0; row < layerRows.length; row += 1) {
      const cells = layerRows[row];
      for (let column = 0; column < cells.length; column += 1) {
        const cell = cells[column];
        if (cell === GRID_EMPTY_CELL) {
          continue;
        }
        if (!isStickyColorCode(cell)) {
          continue;
        }
        balls.push({
          id: slotId(layer, row, column),
          position: cellCenterWorld(layer, row, column, layerColumns, rows, outerRadius),
          color: cell,
        });
      }
    }
  }

  return balls;
}

function validateGridRows(rows: string[], layer: number | null): void {
  const label = layer === null ? "Outer grid" : `Layer ${layer}`;
  if (rows.length === 0) {
    throw new StickyLevelError(`${label} has no rows.`);
  }
  if (rows[0] === undefined || rows[0].length < 3) {
    throw new StickyLevelError(`${label} rows must contain at least 3 cells.`);
  }
  const width = rows[0].length;
  for (let row = 0; row < rows.length; row += 1) {
    const cells = rows[row];
    if (cells === undefined || cells.length !== width) {
      throw new StickyLevelError(`${label} row ${row} has a different width.`);
    }
    for (let column = 0; column < width; column += 1) {
      if (ALLOWED_GRID_CELLS.indexOf(cells[column]) < 0) {
        throw new StickyLevelError(`${label} row ${row} contains invalid cell '${cells[column]}'.`);
      }
    }
  }
}

function asStringRows(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new StickyLevelError(`${label} has no rows.`);
  }
  return value.map((row, index) => {
    if (typeof row !== "string") {
      throw new StickyLevelError(`${label} row ${index} has a different width.`);
    }
    return row;
  });
}

export function parseCylindricalGridMaps(payload: Record<string, unknown>): {
  balls: StickyBall[];
  lattice: LatticeSpec;
} {
  const outer = asStringRows(payload.grid, "Outer grid");
  validateGridRows(outer, null);

  const rows = outer.length;
  const columns = outer[0].length;
  const layers: string[][] = [outer];

  const innerValue = payload.inner;
  const inner = innerValue === undefined || innerValue === null ? [] : innerValue;
  if (!Array.isArray(inner)) {
    throw new StickyLevelError("Level inner layers are invalid.");
  }
  if (inner.length > MAX_LAYERS - 1) {
    throw new StickyLevelError(`Level has ${inner.length + 1} layers; maximum is ${MAX_LAYERS}.`);
  }

  for (let layer = 1; layer <= inner.length; layer += 1) {
    const expectedColumns = innerColumnsFor(columns, layer);
    if (expectedColumns === null) {
      throw new StickyLevelError(`Layer ${layer} does not fit inside a ${columns}-column shell.`);
    }
    const layerRows = asStringRows(inner[layer - 1], `Layer ${layer}`);
    validateGridRows(layerRows, layer);
    if (layerRows.length !== rows) {
      throw new StickyLevelError(`Layer ${layer} has ${layerRows.length} rows; expected ${rows}.`);
    }
    if (layerRows[0].length !== expectedColumns) {
      throw new StickyLevelError(`Layer ${layer} width must be ${expectedColumns}.`);
    }
    layers.push(layerRows);
  }

  const lattice = normalizeLattice({ columns, rows, layers: layers.length });
  return { balls: ballsFromGridLayers(layers, lattice), lattice };
}

function mapsFromBalls(balls: readonly StickyBall[], lattice: LatticeSpec): {
  grid: string[];
  inner: string[][];
} {
  const { columns, rows, layers } = normalizeLattice(lattice);
  const byId = new Map(balls.map((ball) => [ball.id, ball.color]));
  const layerMaps: string[][] = [];

  for (let layer = 0; layer < layers; layer += 1) {
    const layerColumns = innerColumnsFor(columns, layer);
    if (layerColumns === null) {
      continue;
    }
    const layerRows: string[] = [];
    for (let row = 0; row < rows; row += 1) {
      let cells = "";
      for (let column = 0; column < layerColumns; column += 1) {
        const color = byId.get(slotId(layer, row, column));
        cells += color ?? GRID_EMPTY_CELL;
      }
      layerRows.push(cells);
    }
    layerMaps.push(layerRows);
  }

  return {
    grid: layerMaps[0] ?? [],
    inner: layerMaps.slice(1),
  };
}

export function serializeStickyGrid(document: StickyLevelDocument, lattice: LatticeSpec): string {
  const { grid, inner } = mapsFromBalls(document.payload.balls, lattice);
  const payload: Record<string, unknown> = {
    format: "grid",
    grid,
    ballCount: document.payload.ballCount,
    rotationSpeed: document.payload.rotationSpeed,
    boosters: document.payload.boosters,
    seed: document.payload.seed,
  };
  if (inner.length > 0) {
    payload.inner = inner;
  }
  return `${JSON.stringify(
    {
      id: document.id,
      order: document.order,
      name: document.name,
      sceneKey: document.sceneKey,
      payload,
    },
    null,
    2,
  )}\n`;
}
