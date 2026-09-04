import { canEncodeAsCylindricalGrid, parseCylindricalGridMaps, serializeStickyGrid } from "../generators/cylindricalGrid";
import type { LatticeSpec } from "../generators/cylindricalLattice";
import { isStickyColorCode } from "./colors";
import { GRID_FORMAT, MAX_BOOSTER_CHARGE, PLACEMENT_FORMAT, SCENE_KEY } from "./constants";
import {
  StickyLevelError,
  type StickyBall,
  type StickyBoosters,
  type StickyLevelDocument,
  type Vec3,
} from "./types";

type UnknownRecord = Record<string, unknown>;

export type ParsedStickyLevel = {
  document: StickyLevelDocument;
  lattice: LatticeSpec | null;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCharge(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_BOOSTER_CHARGE, value));
}

function parsePosition(value: unknown, index: number): Vec3 {
  if (!isRecord(value)) {
    throw new StickyLevelError(`Placement ball ${index} has no position.`);
  }
  const x = value.x;
  const y = value.y;
  const z = value.z;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    throw new StickyLevelError(`Placement ball ${index} has an invalid position.`);
  }
  return { x, y, z };
}

function parseBoosters(value: unknown): StickyBoosters {
  const record = isRecord(value) ? value : {};
  return {
    bomb: normalizeCharge(record.bomb),
    multiball: normalizeCharge(record.multiball),
    wild: normalizeCharge(record.wild),
    rainbow: normalizeCharge(record.rainbow),
  };
}

function parseSharedPayload(parsed: UnknownRecord, payload: UnknownRecord) {
  const ballCount = payload.ballCount;
  if (typeof ballCount !== "number" || !Number.isFinite(ballCount) || ballCount < 0) {
    throw new StickyLevelError("ballCount cannot be negative.");
  }

  const order = readNumber(parsed.order, 0);
  const seedValue = payload.seed;
  const seed =
    typeof seedValue === "number" && Number.isFinite(seedValue)
      ? Math.trunc(seedValue)
      : Math.trunc(order);

  return {
    id: readString(parsed.id),
    order,
    name: readString(parsed.name),
    ballCount: Math.trunc(ballCount),
    rotationSpeed: readNumber(payload.rotationSpeed, 0),
    boosters: parseBoosters(payload.boosters),
    seed,
  };
}

function parsePlacementBalls(payload: UnknownRecord, createId: () => string): StickyBall[] {
  if (!Array.isArray(payload.balls)) {
    throw new StickyLevelError("Placement level balls are missing.");
  }

  return payload.balls.map((ball, index) => {
    if (!isRecord(ball)) {
      throw new StickyLevelError(`Placement ball ${index} is missing.`);
    }
    if (typeof ball.color !== "string" || !isStickyColorCode(ball.color)) {
      throw new StickyLevelError(`Placement ball ${index} has invalid color '${String(ball.color)}'.`);
    }
    return {
      id: createId(),
      position: parsePosition(ball.position, index),
      color: ball.color,
    };
  });
}

export function parseStickyLevel(
  json: string,
  createId: () => string = () => crypto.randomUUID(),
): ParsedStickyLevel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new StickyLevelError("Level JSON is invalid.");
  }

  if (!isRecord(parsed)) {
    throw new StickyLevelError("Level JSON is empty.");
  }

  if (parsed.sceneKey !== SCENE_KEY) {
    throw new StickyLevelError("Level sceneKey must be 'Sticky'.");
  }

  if (!isRecord(parsed.payload)) {
    throw new StickyLevelError("Level payload is missing.");
  }

  const shared = parseSharedPayload(parsed, parsed.payload);

  if (parsed.payload.format === PLACEMENT_FORMAT) {
    const balls = parsePlacementBalls(parsed.payload, createId);
    return {
      lattice: null,
      document: {
        id: shared.id,
        order: shared.order,
        name: shared.name,
        sceneKey: SCENE_KEY,
        payload: {
          format: PLACEMENT_FORMAT,
          balls,
          ballCount: shared.ballCount,
          rotationSpeed: shared.rotationSpeed,
          boosters: shared.boosters,
          seed: shared.seed,
        },
      },
    };
  }

  if (parsed.payload.format === GRID_FORMAT && parsed.payload.grid === undefined) {
    throw new StickyLevelError("Level grid is missing.");
  }

  if (!Array.isArray(parsed.payload.grid)) {
    throw new StickyLevelError('Level must use payload.format "placements" or include a grid.');
  }

  const { balls, lattice } = parseCylindricalGridMaps(parsed.payload);
  return {
    lattice,
    document: {
      id: shared.id,
      order: shared.order,
      name: shared.name,
      sceneKey: SCENE_KEY,
      payload: {
        format: PLACEMENT_FORMAT,
        balls,
        ballCount: shared.ballCount,
        rotationSpeed: shared.rotationSpeed,
        boosters: shared.boosters,
        seed: shared.seed,
      },
    },
  };
}

export function serializeStickyLevel(document: StickyLevelDocument): string {
  return `${JSON.stringify(
    {
      id: document.id,
      order: document.order,
      name: document.name,
      sceneKey: document.sceneKey,
      payload: {
        format: PLACEMENT_FORMAT,
        balls: document.payload.balls.map((ball) => ({
          position: {
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z,
          },
          color: ball.color,
        })),
        ballCount: document.payload.ballCount,
        rotationSpeed: document.payload.rotationSpeed,
        boosters: document.payload.boosters,
        seed: document.payload.seed,
      },
    },
    null,
    2,
  )}\n`;
}

export function serializeExportedLevel(
  document: StickyLevelDocument,
  lattice: LatticeSpec | null,
): string {
  if (canEncodeAsCylindricalGrid(document.payload.balls, lattice)) {
    return serializeStickyGrid(document, lattice);
  }
  return serializeStickyLevel(document);
}
