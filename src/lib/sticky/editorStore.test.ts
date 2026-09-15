import { beforeEach, describe, expect, it } from "vitest";
import { BALL_DIAMETER, SPACING_TOLERANCE } from "./constants";
import { createEmptyDocument } from "./types";
import overlapping from "./fixtures/overlapping.json";
import gridHole from "./fixtures/grid-hole.json";
import { useEditorStore } from "@/state/editorStore";
import { generateBoostedGrid } from "@/lib/generators/boostedGrid";
import { parseCsvPlacements } from "@/lib/generators/csvImport";
import { slotId } from "@/lib/generators/cylindricalLattice";

const validJson = `{
  "id": "ok",
  "order": 1,
  "name": "Ok",
  "sceneKey": "Sticky",
  "payload": {
    "format": "placements",
    "balls": [
      { "position": { "x": 0, "y": 0.5, "z": 0 }, "color": "R" },
      { "position": { "x": 1.1, "y": 0.5, "z": 0 }, "color": "B" }
    ],
    "ballCount": 4,
    "rotationSpeed": 12,
    "boosters": { "bomb": 0, "multiball": 0, "wild": 0, "rainbow": 0 },
    "seed": 1
  }
}`;

// Mirrors ProceduralGridPlacementBuilder, which packs balls at exactly 2 * radius.
const contactJson = JSON.stringify({
  id: "contact",
  order: 1,
  name: "Contact",
  sceneKey: "Sticky",
  payload: {
    format: "placements",
    balls: [
      { position: { x: 0, y: 0.3, z: 0 }, color: "R" },
      { position: { x: BALL_DIAMETER, y: 0.3, z: 0 }, color: "B" },
    ],
    ballCount: 4,
    rotationSpeed: 12,
    boosters: { bomb: 0, multiball: 0, wild: 0, rainbow: 0 },
    seed: 1,
  },
});

describe("editorStore", () => {
  beforeEach(() => {
    useEditorStore.setState({
      document: createEmptyDocument(),
      selectedIds: [],
      importError: null,
      cameraFitNonce: 0,
      spacingTolerance: SPACING_TOLERANCE,
      past: [],
      future: [],
      lattice: null,
      generatorSession: null,
    });
  });

  it("imports placements and keeps ballCount separate from balls.length", () => {
    useEditorStore.getState().importJson(validJson);
    const { document } = useEditorStore.getState();
    expect(document.payload.balls).toHaveLength(2);
    expect(document.payload.ballCount).toBe(4);
  });

  it("blocks export when balls are closer than the minimum distance", () => {
    useEditorStore.getState().importJson(JSON.stringify(overlapping));
    expect(useEditorStore.getState().exportJson()).toBeNull();
  });

  it("exports a level packed at exact contact by default", () => {
    useEditorStore.getState().importJson(contactJson);
    const json = useEditorStore.getState().exportJson();
    expect(json).not.toBeNull();
    expect(JSON.parse(json as string).payload.balls).toHaveLength(2);
  });

  it("blocks export of contact packing when extra authoring margin is requested", () => {
    useEditorStore.getState().importJson(contactJson);
    useEditorStore.getState().setSpacingTolerance(0.02);
    expect(useEditorStore.getState().exportJson()).toBeNull();
  });

  it("clamps negative tolerance input to 0", () => {
    useEditorStore.getState().setSpacingTolerance(-5);
    expect(useEditorStore.getState().spacingTolerance).toBe(0);
  });

  it("undoes color changes and deletions", () => {
    useEditorStore.getState().importJson(validJson);
    const firstId = useEditorStore.getState().document.payload.balls[0].id;
    useEditorStore.getState().selectBall(firstId, false);
    useEditorStore.getState().setSelectedBallsColor("C");
    expect(useEditorStore.getState().document.payload.balls[0].color).toBe("C");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls[0].color).toBe("R");
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.payload.balls[0].color).toBe("C");
    useEditorStore.getState().selectBall(firstId, false);
    useEditorStore.getState().deleteSelectedBalls();
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(2);
  });

  it("newLevel restores default id/name, empty balls, and wipes undo", () => {
    useEditorStore.getState().importJson(validJson);
    useEditorStore.getState().selectBall(useEditorStore.getState().document.payload.balls[0].id, false);
    useEditorStore.getState().setSelectedBallsColor("C");
    useEditorStore.getState().newLevel();
    const { document, past, future, selectedIds } = useEditorStore.getState();
    expect(document.id).toBe("untitled-level");
    expect(document.name).toBe("Untitled Level");
    expect(document.payload.balls).toHaveLength(0);
    expect(document.payload.ballCount).toBe(50);
    expect(document.payload.rotationSpeed).toBe(12);
    expect(document.payload.boosters).toEqual({
      bomb: 10,
      multiball: 10,
      wild: 10,
      rainbow: 10,
    });
    expect(past).toHaveLength(0);
    expect(future).toHaveLength(0);
    expect(selectedIds).toEqual([]);
  });

  it("toggles balls into and out of a multi-selection", () => {
    useEditorStore.getState().importJson(validJson);
    const [first, second] = useEditorStore.getState().document.payload.balls;
    useEditorStore.getState().selectBall(first.id, false);
    useEditorStore.getState().selectBall(second.id, true);
    expect(useEditorStore.getState().selectedIds).toEqual([first.id, second.id]);
    useEditorStore.getState().selectBall(first.id, true);
    expect(useEditorStore.getState().selectedIds).toEqual([second.id]);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it("colors multiple selected balls as one undo step", () => {
    useEditorStore.getState().importJson(validJson);
    const [first, second] = useEditorStore.getState().document.payload.balls;
    useEditorStore.getState().selectBall(first.id, false);
    useEditorStore.getState().selectBall(second.id, true);
    useEditorStore.getState().setSelectedBallsColor("C");
    expect(useEditorStore.getState().document.payload.balls.map((ball) => ball.color)).toEqual(["C", "C"]);
    expect(useEditorStore.getState().past).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls.map((ball) => ball.color)).toEqual(["R", "B"]);
  });

  it("deletes multiple selected balls as one undo step", () => {
    useEditorStore.getState().importJson(validJson);
    const [first, second] = useEditorStore.getState().document.payload.balls;
    useEditorStore.getState().selectBall(first.id, false);
    useEditorStore.getState().selectBall(second.id, true);
    useEditorStore.getState().deleteSelectedBalls();
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(0);
    expect(useEditorStore.getState().past).toHaveLength(1);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(2);
  });

  it("clearBalls empties balls, zeros ballCount, and keeps identity metadata", () => {
    useEditorStore.getState().importJson(validJson);
    useEditorStore.getState().clearBalls();
    const { document } = useEditorStore.getState();
    expect(document.id).toBe("ok");
    expect(document.name).toBe("Ok");
    expect(document.payload.balls).toHaveLength(0);
    expect(document.payload.ballCount).toBe(0);
    expect(document.payload.boosters.bomb).toBe(0);
    expect(document.payload.rotationSpeed).toBe(12);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(2);
    expect(useEditorStore.getState().document.payload.ballCount).toBe(4);
  });

  it("clearBalls zeros ballCount even when there are no balls", () => {
    useEditorStore.setState({
      document: {
        ...createEmptyDocument(),
        id: "kept-id",
        name: "Kept Name",
        payload: {
          ...createEmptyDocument().payload,
          balls: [],
          ballCount: 9,
        },
      },
      past: [],
      future: [],
    });
    useEditorStore.getState().clearBalls();
    expect(useEditorStore.getState().document.id).toBe("kept-id");
    expect(useEditorStore.getState().document.payload.ballCount).toBe(0);
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(0);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.ballCount).toBe(9);
  });

  it("clearBalls is a no-op when balls and ballCount are already empty", () => {
    useEditorStore.setState({
      document: {
        ...createEmptyDocument(),
        payload: { ...createEmptyDocument().payload, balls: [], ballCount: 0 },
      },
      past: [],
      future: [],
    });
    useEditorStore.getState().clearBalls();
    expect(useEditorStore.getState().past).toHaveLength(0);
  });

  it("starts a generator session with one undo snapshot and rebuilds without growing history", () => {
    const first = generateBoostedGrid({ columns: 6, rows: 1, layers: 1 });
    useEditorStore.getState().beginGeneratorSession("boosted-grid", first, { columns: 6, rows: 1, layers: 1 });
    expect(useEditorStore.getState().past).toHaveLength(1);
    expect(useEditorStore.getState().generatorSession).toBe("boosted-grid");
    const painted = first.map((ball) =>
      ball.id === slotId(0, 0, 0) ? { ...ball, color: "B" as const } : ball,
    );
    useEditorStore.getState().rebuildGeneratedBalls(
      generateBoostedGrid({
        columns: 8,
        rows: 1,
        layers: 1,
        colorsBySlot: Object.fromEntries(painted.map((ball) => [ball.id as string, ball.color])),
      }),
      { columns: 8, rows: 1, layers: 1 },
    );
    expect(useEditorStore.getState().past).toHaveLength(1);
    const balls = useEditorStore.getState().document.payload.balls;
    expect(balls).toHaveLength(8);
    expect(balls.find((ball) => ball.id === slotId(0, 0, 0))?.color).toBe("B");
    expect(balls.find((ball) => ball.id === slotId(0, 0, 6))?.color).toBe("R");
  });

  it("undoes a color change after a live rebuild as a single step", () => {
    useEditorStore.getState().beginGeneratorSession(
      "boosted-grid",
      generateBoostedGrid({ columns: 6, rows: 1, layers: 1 }),
      { columns: 6, rows: 1, layers: 1 },
    );
    useEditorStore.getState().rebuildGeneratedBalls(generateBoostedGrid({ columns: 8, rows: 1, layers: 1 }), {
      columns: 8,
      rows: 1,
      layers: 1,
    });
    useEditorStore.getState().selectBall(slotId(0, 0, 0), false);
    useEditorStore.getState().setSelectedBallsColor("C");
    expect(useEditorStore.getState().document.payload.balls.find((ball) => ball.id === slotId(0, 0, 0))?.color).toBe(
      "C",
    );
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls.find((ball) => ball.id === slotId(0, 0, 0))?.color).toBe(
      "R",
    );
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(8);
  });

  it("exports a multi-layer grid instead of blocking on shell spacing", () => {
    useEditorStore.getState().beginGeneratorSession(
      "boosted-grid",
      generateBoostedGrid({ columns: 16, rows: 8, layers: 3 }),
      { columns: 16, rows: 8, layers: 3 },
    );
    const json = useEditorStore.getState().exportJson();
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json as string);
    expect(parsed.payload.format).toBe("grid");
    expect(parsed.payload.grid[0]).toHaveLength(16);
    expect(parsed.payload.inner[0][0]).toHaveLength(10);
    expect(parsed.payload.inner[1][0]).toHaveLength(4);
  });

  it("exports format grid after a boosted-grid generate", () => {
    useEditorStore.getState().beginGeneratorSession(
      "boosted-grid",
      generateBoostedGrid({ columns: 6, rows: 1, layers: 1 }),
      { columns: 6, rows: 1, layers: 1 },
    );
    const parsed = JSON.parse(useEditorStore.getState().exportJson() as string);
    expect(parsed.payload.format).toBe("grid");
    expect(parsed.payload.balls).toBeUndefined();
    expect(parsed.payload.grid).toHaveLength(1);
    expect(parsed.payload.grid[0]).toHaveLength(6);
    expect(parsed.payload.inner).toBeUndefined();
  });

  it("round-trips an imported grid file including holes", () => {
    useEditorStore.getState().importJson(JSON.stringify(gridHole));
    expect(useEditorStore.getState().lattice).toEqual({ columns: 3, rows: 2, layers: 1 });
    const parsed = JSON.parse(useEditorStore.getState().exportJson() as string);
    expect(parsed.payload.format).toBe("grid");
    expect(parsed.payload.grid).toEqual(["R.R", "RRR"]);
  });

  it("keeps placements export for imported placement levels", () => {
    useEditorStore.getState().importJson(validJson);
    const parsed = JSON.parse(useEditorStore.getState().exportJson() as string);
    expect(parsed.payload.format).toBe("placements");
    expect(parsed.payload.balls).toHaveLength(2);
  });

  it("writes a hole after deleting a generated slot", () => {
    useEditorStore.getState().beginGeneratorSession(
      "boosted-grid",
      generateBoostedGrid({ columns: 3, rows: 1, layers: 1 }),
      { columns: 3, rows: 1, layers: 1 },
    );
    useEditorStore.getState().selectBall(slotId(0, 0, 1), false);
    useEditorStore.getState().deleteSelectedBalls();
    const parsed = JSON.parse(useEditorStore.getState().exportJson() as string);
    expect(parsed.payload.grid[0]).toBe("R.R");
  });

  it("falls back to placements when a lattice level has a non-slot ball", () => {
    useEditorStore.getState().beginGeneratorSession(
      "boosted-grid",
      generateBoostedGrid({ columns: 3, rows: 1, layers: 1 }),
      { columns: 3, rows: 1, layers: 1 },
    );
    useEditorStore.getState().applyGeneratedBalls(
      [{ position: { x: 10, y: 0.3, z: 10 }, color: "B" }],
      "append",
    );
    const parsed = JSON.parse(useEditorStore.getState().exportJson() as string);
    expect(parsed.payload.format).toBe("placements");
    expect(parsed.payload.balls).toHaveLength(4);
  });

  it("clearBalls on a grid level keeps lattice so export stays grid", () => {
    useEditorStore.getState().beginGeneratorSession(
      "boosted-grid",
      generateBoostedGrid({ columns: 3, rows: 1, layers: 1 }),
      { columns: 3, rows: 1, layers: 1 },
    );
    useEditorStore.getState().clearBalls();
    const parsed = JSON.parse(useEditorStore.getState().exportJson() as string);
    expect(parsed.payload.format).toBe("grid");
    expect(parsed.payload.grid[0]).toBe("...");
  });

  it("replaces a grid session with CSV placements and exports placements", () => {
    useEditorStore.getState().beginGeneratorSession(
      "boosted-grid",
      generateBoostedGrid({ columns: 3, rows: 1, layers: 1 }),
      { columns: 3, rows: 1, layers: 1 },
    );
    useEditorStore.getState().applyGeneratedBalls(
      parseCsvPlacements("x,y,z,color,layer\n0,0.3,0,R,0\n0.6,0.3,0,B,1\n"),
      "replace",
    );
    const state = useEditorStore.getState();
    expect(state.lattice).toBeNull();
    expect(state.generatorSession).toBeNull();
    expect(state.document.payload.balls).toHaveLength(2);
    expect(state.past).toHaveLength(2);
    const parsed = JSON.parse(state.exportJson() as string);
    expect(parsed.payload.format).toBe("placements");
    expect(parsed.payload.balls).toHaveLength(2);
  });
});
