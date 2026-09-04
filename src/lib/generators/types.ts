import type { StickyColorCode } from "../sticky/colors";
import type { Vec3 } from "../sticky/types";

export type GeneratedBall = {
  position: Vec3;
  color: StickyColorCode;
};

export interface GeometryGenerator {
  readonly id: string;
  generate(params?: unknown): GeneratedBall[];
}

export const geometryGenerators: GeometryGenerator[] = [];
