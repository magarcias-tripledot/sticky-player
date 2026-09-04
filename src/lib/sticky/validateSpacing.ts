import { BALL_DIAMETER, OVERLAP_EPSILON, SPACING_TOLERANCE } from "./constants";
import type { StickyBall } from "./types";

// Matches BallsSpawner.IsPositionFree (2 * radius) plus optional authoring margin,
// then subtracts OVERLAP_EPSILON so serialized-float contact pairs stay valid.
export function minCenterDistanceFor(spacingTolerance: number): number {
  const tolerance = Number.isFinite(spacingTolerance) ? Math.max(0, spacingTolerance) : 0;
  return BALL_DIAMETER + tolerance - OVERLAP_EPSILON;
}

function distanceSquared(a: StickyBall, b: StickyBall): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dz = a.position.z - b.position.z;
  return dx * dx + dy * dy + dz * dz;
}

export function findInvalidBallIds(
  balls: readonly StickyBall[],
  spacingTolerance: number = SPACING_TOLERANCE,
): Set<string> {
  const invalid = new Set<string>();
  const minDistance = minCenterDistanceFor(spacingTolerance);
  const minSquared = minDistance * minDistance;

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      if (distanceSquared(balls[i], balls[j]) < minSquared) {
        invalid.add(balls[i].id);
        invalid.add(balls[j].id);
      }
    }
  }

  return invalid;
}
