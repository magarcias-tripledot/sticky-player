import { describe, expect, it } from "vitest";
import { generateBoostedGrid } from "../generators/boostedGrid";
import {
  LAYER_MIN_CENTER_DISTANCE,
  LAYER_PITCH,
  slotId,
  WORLD_SCALE,
} from "../generators/cylindricalLattice";
import { BALL_DIAMETER, BALL_RADIUS, MIN_CENTER_DISTANCE, OVERLAP_EPSILON, SPACING_TOLERANCE } from "./constants";
import type { StickyBall } from "./types";
import { findInvalidBallIds, minCenterDistanceFor, minLayerCenterDistanceFor } from "./validateSpacing";

function ball(id: string, x: number, y = 0, z = 0): StickyBall {
  return { id, color: "R", position: { x, y, z } };
}

function latticeBalls(columns: number, rows: number, layers: number): StickyBall[] {
  return generateBoostedGrid({ columns, rows, layers }).map((generated) => ({
    id: generated.id as string,
    position: generated.position,
    color: generated.color,
  }));
}

describe("ball size constants", () => {
  it("matches the Unity Ball prefab and default contact packing", () => {
    expect(BALL_RADIUS).toBeCloseTo(0.5 * 0.6, 10);
    expect(BALL_DIAMETER).toBeCloseTo(0.6, 10);
    expect(SPACING_TOLERANCE).toBe(0);
    expect(OVERLAP_EPSILON).toBe(1e-5);
    expect(MIN_CENTER_DISTANCE).toBeCloseTo(BALL_DIAMETER - OVERLAP_EPSILON, 10);
  });
});

describe("findInvalidBallIds", () => {
  it("marks both balls when they overlap", () => {
    const invalid = findInvalidBallIds([ball("a", 0), ball("b", 0.59)]);
    expect(invalid).toEqual(new Set(["a", "b"]));
  });

  it("treats exactly the minimum distance as valid", () => {
    const invalid = findInvalidBallIds([ball("a", 0), ball("b", MIN_CENTER_DISTANCE)]);
    expect(invalid.size).toBe(0);
  });

  it("treats just under the minimum distance as invalid", () => {
    const invalid = findInvalidBallIds([ball("a", 0), ball("b", MIN_CENTER_DISTANCE - 1e-6)]);
    expect(invalid).toEqual(new Set(["a", "b"]));
  });

  it("keeps Unity-authored spacing valid", () => {
    const invalid = findInvalidBallIds([ball("a", 0, 0.3), ball("b", 0.7, 0.3)]);
    expect(invalid.size).toBe(0);
  });

  it("accepts the worst observed Unity JSON float deficit", () => {
    // Ice_Cream_Level.json pair at 0.599999702 vs diameter 0.6.
    const invalid = findInvalidBallIds([ball("a", 0), ball("b", 0.599999702)]);
    expect(invalid.size).toBe(0);
  });
});

describe("spacing tolerance", () => {
  const contactPair = [ball("a", 0, 0.3), ball("b", BALL_DIAMETER, 0.3)];

  it("accepts exact-contact packing at the default tolerance", () => {
    expect(findInvalidBallIds(contactPair).size).toBe(0);
  });

  it("flags exact-contact packing when extra authoring margin is 0.02", () => {
    expect(findInvalidBallIds(contactPair, 0.02)).toEqual(new Set(["a", "b"]));
  });

  it("subtracts overlap epsilon from the threshold", () => {
    expect(minCenterDistanceFor(0)).toBeCloseTo(BALL_DIAMETER - OVERLAP_EPSILON, 10);
  });

  it("clamps negative tolerance to 0 like Unity's Mathf.Max", () => {
    expect(minCenterDistanceFor(-1)).toBeCloseTo(BALL_DIAMETER - OVERLAP_EPSILON, 10);
    expect(findInvalidBallIds(contactPair, -1).size).toBe(0);
  });

  it("grows the threshold with a larger tolerance", () => {
    expect(minCenterDistanceFor(0.1)).toBeCloseTo(0.7 - OVERLAP_EPSILON, 10);
    expect(findInvalidBallIds([ball("a", 0), ball("b", 0.65)], 0.1)).toEqual(new Set(["a", "b"]));
  });
});

describe("cylindrical shell spacing", () => {
  it("derives the shell minimum from LAYER_PITCH in world units", () => {
    expect(LAYER_MIN_CENTER_DISTANCE).toBeCloseTo(0.54, 10);
    expect(LAYER_MIN_CENTER_DISTANCE).toBeCloseTo(LAYER_PITCH * WORLD_SCALE, 10);
    expect(minLayerCenterDistanceFor(0)).toBeCloseTo(0.54 - OVERLAP_EPSILON, 10);
  });

  it("accepts slot ids on different layers at the shell pitch", () => {
    const invalid = findInvalidBallIds([
      ball(slotId(0, 0, 0), 0),
      ball(slotId(1, 0, 0), LAYER_MIN_CENTER_DISTANCE),
    ]);
    expect(invalid.size).toBe(0);
  });

  it("still flags slot ids on the same layer at the shell pitch", () => {
    const invalid = findInvalidBallIds([
      ball(slotId(0, 0, 0), 0),
      ball(slotId(0, 0, 1), LAYER_MIN_CENTER_DISTANCE),
    ]);
    expect(invalid).toEqual(new Set([slotId(0, 0, 0), slotId(0, 0, 1)]));
  });

  it("still flags a slot against a freeform ball at the shell pitch", () => {
    const invalid = findInvalidBallIds([
      ball(slotId(0, 0, 0), 0),
      ball("uuid-ball", LAYER_MIN_CENTER_DISTANCE),
    ]);
    expect(invalid).toEqual(new Set([slotId(0, 0, 0), "uuid-ball"]));
  });

  it("flags cross-shell pairs closer than the shell pitch", () => {
    const invalid = findInvalidBallIds([
      ball(slotId(0, 0, 0), 0),
      ball(slotId(1, 0, 0), LAYER_MIN_CENTER_DISTANCE - 1e-4),
    ]);
    expect(invalid).toEqual(new Set([slotId(0, 0, 0), slotId(1, 0, 0)]));
  });

  it("accepts generated multi-layer grids that Unity spawns as-is", () => {
    expect(findInvalidBallIds(latticeBalls(12, 6, 2)).size).toBe(0);
    expect(findInvalidBallIds(latticeBalls(16, 8, 3)).size).toBe(0);
    expect(findInvalidBallIds(latticeBalls(24, 8, 3)).size).toBe(0);
  });

  it("accepts a generated single-layer grid", () => {
    expect(findInvalidBallIds(latticeBalls(8, 6, 1)).size).toBe(0);
  });
});
