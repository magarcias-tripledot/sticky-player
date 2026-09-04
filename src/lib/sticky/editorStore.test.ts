import { beforeEach, describe, expect, it } from "vitest";
import { BALL_DIAMETER, SPACING_TOLERANCE } from "./constants";
import { createEmptyDocument } from "./types";
import overlapping from "./fixtures/overlapping.json";
import { useEditorStore } from "@/state/editorStore";

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
});
