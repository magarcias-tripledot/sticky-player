import type { StickyColorCode } from "../sticky/colors";
import type { Vec3 } from "../sticky/types";

export type GeneratedBall = {
  id?: string;
  position: Vec3;
  color: StickyColorCode;
};

export interface GeometryGenerator {
  readonly id: string;
  generate(params?: unknown): GeneratedBall[];
}
