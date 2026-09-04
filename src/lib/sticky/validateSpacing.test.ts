import { describe, expect, it } from "vitest";
import { BALL_DIAMETER, BALL_RADIUS, MIN_CENTER_DISTANCE, SPACING_TOLERANCE } from "./constants";
import type { StickyBall } from "./types";
import { findInvalidBallIds, minCenterDistanceFor } from "./validateSpacing";

function ball(id: string, x: number, y = 0, z = 0): StickyBall {
  return { id, color: "R", position: { x, y, z } };
}

describe("ball size constants", () => {
  it("matches the Unity Ball prefab (collider 0.5 * scale 0.6)", () => {
    expect(BALL_RADIUS).toBeCloseTo(0.5 * 0.6, 10);
    expect(BALL_DIAMETER).toBeCloseTo(0.6, 10);
    expect(SPACING_TOLERANCE).toBe(0.02);
    expect(MIN_CENTER_DISTANCE).toBeCloseTo(0.62, 10);
  });
});

describe("findInvalidBallIds", () => {
  it("marks both balls when closer than the minimum distance", () => {
    const invalid = findInvalidBallIds([ball("a", 0), ball("b", 0.61)]);
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
});

describe("spacing tolerance", () => {
  const contactPair = [ball("a", 0, 0.3), ball("b", BALL_DIAMETER, 0.3)];

  it("flags exact-contact packing at the default tolerance", () => {
    expect(findInvalidBallIds(contactPair)).toEqual(new Set(["a", "b"]));
  });

  it("accepts exact-contact packing when tolerance is 0", () => {
    expect(minCenterDistanceFor(0)).toBeCloseTo(BALL_DIAMETER, 10);
    expect(findInvalidBallIds(contactPair, 0).size).toBe(0);
  });

  it("clamps negative tolerance to 0 like Unity's Mathf.Max", () => {
    expect(minCenterDistanceFor(-1)).toBeCloseTo(BALL_DIAMETER, 10);
    expect(findInvalidBallIds(contactPair, -1).size).toBe(0);
  });

  it("grows the threshold with a larger tolerance", () => {
    expect(minCenterDistanceFor(0.1)).toBeCloseTo(0.7, 10);
    expect(findInvalidBallIds([ball("a", 0), ball("b", 0.65)], 0.1)).toEqual(new Set(["a", "b"]));
  });
});
