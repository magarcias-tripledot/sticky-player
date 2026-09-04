import { LAYER_MIN_CENTER_DISTANCE, parseSlotId } from "../generators/cylindricalLattice";
import { BALL_DIAMETER, OVERLAP_EPSILON, SPACING_TOLERANCE } from "./constants";
import type { StickyBall } from "./types";

function safeTolerance(spacingTolerance: number): number {
  return Number.isFinite(spacingTolerance) ? Math.max(0, spacingTolerance) : 0;
}

// Matches BallsSpawner.IsPositionFree (2 * radius) plus optional authoring margin,
// then subtracts OVERLAP_EPSILON so serialized-float contact pairs stay valid.
export function minCenterDistanceFor(spacingTolerance: number): number {
  return BALL_DIAMETER + safeTolerance(spacingTolerance) - OVERLAP_EPSILON;
}

// Cylindrical shells pack at LAYER_PITCH, closer than a diameter. Unity spawns grid levels
// straight from CylindricalGridPlacementBuilder without a spacing check.
export function minLayerCenterDistanceFor(spacingTolerance: number): number {
  return LAYER_MIN_CENTER_DISTANCE + safeTolerance(spacingTolerance) - OVERLAP_EPSILON;
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
  const layerDistance = minLayerCenterDistanceFor(spacingTolerance);
  const layerSquared = layerDistance * layerDistance;
  const layers = balls.map((ball) => parseSlotId(ball.id)?.layer ?? null);

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const layerA = layers[i];
      const layerB = layers[j];
      const crossShell = layerA !== null && layerB !== null && layerA !== layerB;
      if (distanceSquared(balls[i], balls[j]) < (crossShell ? layerSquared : minSquared)) {
        invalid.add(balls[i].id);
        invalid.add(balls[j].id);
      }
    }
  }

  return invalid;
}
