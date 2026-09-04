import { describe, expect, it } from "vitest";
import { parseStickyLevel, serializeExportedLevel, serializeStickyLevel } from "./schema";
import overlappingFixture from "./fixtures/overlapping.json";
import gridHoleFixture from "./fixtures/grid-hole.json";
import { slotId } from "../generators/cylindricalLattice";

const validJson = `{
  "id": "test-level",
  "order": 3,
  "name": "Test Level",
  "sceneKey": "Sticky",
  "payload": {
    "format": "placements",
    "balls": [
      { "position": { "x": 0, "y": 0.5, "z": 0 }, "color": "R" },
      { "position": { "x": 1.1, "y": 0.5, "z": 0 }, "color": "B" }
    ],
    "ballCount": 9,
    "rotationSpeed": 12,
    "boosters": { "bomb": 2, "multiball": 1, "wild": 0, "rainbow": 4 },
    "seed": 17
  }
}`;

const sculptureLike = {
  id: "sculpt",
  order: 1,
  name: "Sculpt",
  sceneKey: "Sticky",
  payload: {
    grid: [
      "................",
      "RRRRRRRRRRRRRRRR",
    ],
    inner: [
      ["..........", "RRRRRRRRRR"],
      ["....", "RRRR"],
    ],
    ballCount: 55,
    rotationSpeed: 12,
    boosters: { bomb: 0, multiball: 0, wild: 0, rainbow: 0 },
    seed: 101,
  },
};

describe("parseStickyLevel", () => {
  it("parses a placements document and keeps ballCount independent of balls.length", () => {
    let n = 0;
    const { document, lattice } = parseStickyLevel(validJson, () => `id-${n++}`);
    expect(lattice).toBeNull();
    expect(document.payload.format).toBe("placements");
    expect(document.payload.balls).toHaveLength(2);
    expect(document.payload.ballCount).toBe(9);
    expect(document.payload.balls[0]).toMatchObject({
      id: "id-0",
      color: "R",
      position: { x: 0, y: 0.5, z: 0 },
    });
  });

  it("rejects format grid without a grid", () => {
    expect(() =>
      parseStickyLevel(
        JSON.stringify({
          sceneKey: "Sticky",
          payload: { format: "grid", balls: [], ballCount: 0 },
        }),
      ),
    ).toThrow(/grid is missing/);
  });

  it("rejects invalid color codes", () => {
    expect(() =>
      parseStickyLevel(
        JSON.stringify({
          sceneKey: "Sticky",
          payload: {
            format: "placements",
            ballCount: 1,
            balls: [{ position: { x: 0, y: 0, z: 0 }, color: "X" }],
          },
        }),
      ),
    ).toThrow(/invalid color/);
  });

  it("defaults missing seed to order and clamps boosters", () => {
    const { document } = parseStickyLevel(
      JSON.stringify({
        order: 8,
        sceneKey: "Sticky",
        payload: {
          format: "placements",
          ballCount: 0,
          balls: [],
          boosters: { bomb: 250, wild: 1.5 },
        },
      }),
    );
    expect(document.payload.seed).toBe(8);
    expect(document.payload.boosters.bomb).toBe(100);
    expect(document.payload.boosters.wild).toBe(0);
    expect(document.payload.boosters.multiball).toBe(0);
  });

  it("parses grid maps, skips holes, and uses slot ids", () => {
    const { document, lattice } = parseStickyLevel(JSON.stringify(gridHoleFixture));
    expect(lattice).toEqual({ columns: 3, rows: 2, layers: 1 });
    expect(document.payload.balls.map((ball) => ball.id).sort()).toEqual(
      [slotId(0, 0, 0), slotId(0, 0, 2), slotId(0, 1, 0), slotId(0, 1, 1), slotId(0, 1, 2)].sort(),
    );
    expect(document.payload.balls.find((ball) => ball.id === slotId(0, 0, 1))).toBeUndefined();
  });

  it("parses omitted format as grid when grid is present", () => {
    const { lattice } = parseStickyLevel(JSON.stringify(sculptureLike));
    expect(lattice).toEqual({ columns: 16, rows: 2, layers: 3 });
  });

  it("rejects an inner layer with the wrong width", () => {
    expect(() =>
      parseStickyLevel(
        JSON.stringify({
          sceneKey: "Sticky",
          payload: {
            format: "grid",
            grid: ["RRRRRRRRRRRR"],
            inner: [["RRRR"]],
            ballCount: 0,
          },
        }),
      ),
    ).toThrow(/width must be 6/);
  });
});

describe("serializeStickyLevel", () => {
  it("round-trips placements JSON without editor ids", () => {
    const { document } = parseStickyLevel(validJson, () => "temp");
    const serialized = serializeStickyLevel(document);
    const parsed = JSON.parse(serialized);
    expect(parsed.payload.balls[0].id).toBeUndefined();
    expect(parsed.payload.ballCount).toBe(9);
    expect(parsed.payload.balls).toHaveLength(2);
    const again = parseStickyLevel(serialized, () => "x");
    expect(again.document.payload.ballCount).toBe(document.payload.ballCount);
    expect(again.document.payload.balls.map((ball) => ball.color)).toEqual(["R", "B"]);
    expect(again.lattice).toBeNull();
  });

  it("preserves overlapping fixture ballCount", () => {
    const { document } = parseStickyLevel(JSON.stringify(overlappingFixture), () => "a");
    expect(document.payload.ballCount).toBe(5);
    expect(document.payload.balls).toHaveLength(2);
  });
});

describe("serializeExportedLevel", () => {
  it("writes format grid without balls and omits inner for one layer", () => {
    const { document, lattice } = parseStickyLevel(JSON.stringify(gridHoleFixture));
    const serialized = serializeExportedLevel(document, lattice);
    const parsed = JSON.parse(serialized);
    expect(parsed.payload.format).toBe("grid");
    expect(parsed.payload.balls).toBeUndefined();
    expect(parsed.payload.inner).toBeUndefined();
    expect(parsed.payload.grid).toEqual(["R.R", "RRR"]);
  });

  it("round-trips sculpture-like inner layers", () => {
    const { document, lattice } = parseStickyLevel(JSON.stringify(sculptureLike));
    const parsed = JSON.parse(serializeExportedLevel(document, lattice));
    expect(parsed.payload.format).toBe("grid");
    expect(parsed.payload.inner[0][0]).toHaveLength(10);
    expect(parsed.payload.inner[1][0]).toHaveLength(4);
    const again = parseStickyLevel(JSON.stringify(parsed));
    expect(again.lattice).toEqual(lattice);
    expect(again.document.payload.balls).toHaveLength(document.payload.balls.length);
  });

  it("falls back to placements when lattice is missing", () => {
    const { document } = parseStickyLevel(validJson, () => "x");
    const parsed = JSON.parse(serializeExportedLevel(document, null));
    expect(parsed.payload.format).toBe("placements");
    expect(parsed.payload.balls).toHaveLength(2);
  });
});
