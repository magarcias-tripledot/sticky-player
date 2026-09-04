import { describe, expect, it } from "vitest";
import { generateBoostedGrid } from "./boostedGrid";
import {
  cellCenterWorld,
  innerColumnsFor,
  LATTICE_BALL_RADIUS,
  ringRadius,
  ROW_PITCH,
  slotId,
} from "./cylindricalLattice";
import { BALL_RADIUS } from "../sticky/constants";

const WORLD_SCALE = BALL_RADIUS / LATTICE_BALL_RADIUS;

describe("cylindricalLattice", () => {
  it("matches Unity RingRadius for six columns", () => {
    expect(ringRadius(6)).toBeCloseTo(1, 10);
  });

  it("rejects rings smaller than three columns", () => {
    expect(() => ringRadius(2)).toThrow();
  });

  it("skips an inner layer when the ring would clip the axis", () => {
    expect(innerColumnsFor(6, 1)).toBeNull();
  });

  it("computes inner columns for a wide outer ring", () => {
    expect(innerColumnsFor(12, 1)).toBe(6);
  });

  it("places the bottom-row cell on the play surface after world scale", () => {
    const outer = ringRadius(6);
    const pos = cellCenterWorld(0, 2, 0, 6, 3, outer);
    expect(pos.y).toBeCloseTo(LATTICE_BALL_RADIUS * WORLD_SCALE, 10);
    expect(pos.x).toBeCloseTo(0, 10);
    expect(pos.z).toBeCloseTo(outer * WORLD_SCALE, 10);
  });

  it("staggers odd rows by half a column", () => {
    const outer = ringRadius(6);
    const even = cellCenterWorld(0, 0, 0, 6, 2, outer);
    const odd = cellCenterWorld(0, 1, 0, 6, 2, outer);
    expect(even.x).not.toBeCloseTo(odd.x, 5);
    expect(odd.y - even.y).toBeCloseTo(-ROW_PITCH * WORLD_SCALE, 10);
  });
});

describe("generateBoostedGrid", () => {
  it("fills every cell on the outer layer and keeps colors by slot", () => {
    const first = generateBoostedGrid({ columns: 6, rows: 2, layers: 1 });
    expect(first).toHaveLength(12);
    expect(first.every((ball) => ball.color === "R")).toBe(true);
    const painted = { [slotId(0, 0, 0)]: "B" as const };
    const grown = generateBoostedGrid({
      columns: 8,
      rows: 2,
      layers: 1,
      colorsBySlot: painted,
    });
    expect(grown).toHaveLength(16);
    expect(grown.find((ball) => ball.id === slotId(0, 0, 0))?.color).toBe("B");
    expect(grown.find((ball) => ball.id === slotId(0, 0, 6))?.color).toBe("R");
  });
});
