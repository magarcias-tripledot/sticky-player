import type { StickyColorCode } from "./colors";

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type StickyBall = {
  id: string;
  position: Vec3;
  color: StickyColorCode;
};

export type StickyBoosters = {
  bomb: number;
  multiball: number;
  wild: number;
  rainbow: number;
};

export type StickyLevelDocument = {
  id: string;
  order: number;
  name: string;
  sceneKey: "Sticky";
  payload: {
    format: "placements";
    balls: StickyBall[];
    ballCount: number;
    rotationSpeed: number;
    boosters: StickyBoosters;
    seed: number;
  };
};

export type ExportedStickyBall = {
  position: Vec3;
  color: StickyColorCode;
};

export class StickyLevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StickyLevelError";
  }
}

export function createEmptyDocument(): StickyLevelDocument {
  return {
    id: "untitled-level",
    order: 1,
    name: "Untitled Level",
    sceneKey: "Sticky",
    payload: {
      format: "placements",
      balls: [],
      ballCount: 0,
      rotationSpeed: 12,
      boosters: {
        bomb: 0,
        multiball: 0,
        wild: 0,
        rainbow: 0,
      },
      seed: 1,
    },
  };
}
