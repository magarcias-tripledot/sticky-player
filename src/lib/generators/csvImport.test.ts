import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BALL_RADIUS } from "@/lib/sticky/constants";
import { findInvalidBallIds } from "@/lib/sticky/validateSpacing";
import { parseCsvPlacements } from "./csvImport";

const cubeCsv = readFileSync(resolve(process.cwd(), "public/sample-cube.csv"), "utf8");

describe("parseCsvPlacements", () => {
  it("parses a header row and ball positions", () => {
    const balls = parseCsvPlacements("x,y,z,color,layer\n0,0.3,0,B,1\n");
    expect(balls).toEqual([{ position: { x: 0, y: 0.3, z: 0 }, color: "B" }]);
  });

  it("requires layer but does not store it", () => {
    const balls = parseCsvPlacements("x,y,z,color,layer\n1,2,3,G,9\n");
    expect(balls[0]).toEqual({ position: { x: 1, y: 2, z: 3 }, color: "G" });
    expect(JSON.stringify(balls[0])).not.toContain("layer");
  });

  it("rejects unknown color codes with a row number", () => {
    expect(() => parseCsvPlacements("x,y,z,color,layer\n0,0.3,0,Q,0\n")).toThrow(
      'CSV row 2: color "Q" is not a Sticky color code.',
    );
  });

  it("rejects a missing required header", () => {
    expect(() => parseCsvPlacements("x,y,z,color\n0,0.3,0,R\n")).toThrow(
      'CSV is missing required header "layer".',
    );
  });

  it("rejects a header-only file", () => {
    expect(() => parseCsvPlacements("x,y,z,color,layer\n")).toThrow("CSV has no ball rows.");
  });

  it("loads the sample 4x4x4 cube with contact packing", () => {
    const balls = parseCsvPlacements(cubeCsv);
    expect(balls).toHaveLength(64);
    expect(balls.every((ball) => ball.color === "R")).toBe(true);
    expect(Math.min(...balls.map((ball) => ball.position.y))).toBe(BALL_RADIUS);
    const withIds = balls.map((ball, index) => ({ ...ball, id: `csv-${index}` }));
    expect(findInvalidBallIds(withIds).size).toBe(0);
  });
});
