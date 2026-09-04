import { describe, expect, it } from "vitest";
import { parseStickyLevel, serializeStickyLevel } from "./schema";
import { StickyLevelError } from "./types";
import overlappingFixture from "./fixtures/overlapping.json";

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

describe("parseStickyLevel", () => {
  it("parses a placements document and keeps ballCount independent of balls.length", () => {
    let n = 0;
    const document = parseStickyLevel(validJson, () => `id-${n++}`);
    expect(document.payload.format).toBe("placements");
    expect(document.payload.balls).toHaveLength(2);
    expect(document.payload.ballCount).toBe(9);
    expect(document.payload.balls[0]).toMatchObject({
      id: "id-0",
      color: "R",
      position: { x: 0, y: 0.5, z: 0 },
    });
  });

  it("rejects non-placements format", () => {
    expect(() =>
      parseStickyLevel(
        JSON.stringify({
          sceneKey: "Sticky",
          payload: { format: "grid", balls: [], ballCount: 0 },
        }),
      ),
    ).toThrow(StickyLevelError);
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
    const document = parseStickyLevel(
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
});

describe("serializeStickyLevel", () => {
  it("round-trips placements JSON without editor ids", () => {
    const document = parseStickyLevel(validJson, () => "temp");
    const serialized = serializeStickyLevel(document);
    const parsed = JSON.parse(serialized);
    expect(parsed.payload.balls[0].id).toBeUndefined();
    expect(parsed.payload.ballCount).toBe(9);
    expect(parsed.payload.balls).toHaveLength(2);
    const again = parseStickyLevel(serialized, () => "x");
    expect(again.payload.ballCount).toBe(document.payload.ballCount);
    expect(again.payload.balls.map((ball) => ball.color)).toEqual(["R", "B"]);
  });

  it("preserves overlapping fixture ballCount", () => {
    const document = parseStickyLevel(JSON.stringify(overlappingFixture), () => "a");
    expect(document.payload.ballCount).toBe(5);
    expect(document.payload.balls).toHaveLength(2);
  });
});
