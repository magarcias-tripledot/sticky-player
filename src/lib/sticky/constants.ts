// Ball size mirrors Assets/_Sticky/Prefabs/Ball.prefab in the Unity project:
// SphereCollider radius 0.5 * prefab scale 0.6. Unity resolves it the same way
// (collider.radius * prefab.transform.localScale.x), so placements JSON written
// by either tool uses the same level-space units.
export const BALL_RADIUS = 0.3;
export const BALL_DIAMETER = BALL_RADIUS * 2;

// Matches StickyLevelAuthoring._spacingTolerance.
export const SPACING_TOLERANCE = 0.02;
export const MIN_CENTER_DISTANCE = BALL_DIAMETER + SPACING_TOLERANCE;

export const SCENE_KEY = "Sticky";
export const PLACEMENT_FORMAT = "placements";
export const MAX_BOOSTER_CHARGE = 100;
