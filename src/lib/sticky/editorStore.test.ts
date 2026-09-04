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
      selectedId: null,
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

  it("exports a level packed at exact contact once tolerance is 0", () => {
    useEditorStore.getState().importJson(contactJson);
    expect(useEditorStore.getState().exportJson()).toBeNull();

    useEditorStore.getState().setSpacingTolerance(0);
    const json = useEditorStore.getState().exportJson();
    expect(json).not.toBeNull();
    expect(JSON.parse(json as string).payload.balls).toHaveLength(2);
  });

  it("clamps negative tolerance input to 0", () => {
    useEditorStore.getState().setSpacingTolerance(-5);
    expect(useEditorStore.getState().spacingTolerance).toBe(0);
  });

  it("undoes color changes and deletions", () => {
    useEditorStore.getState().importJson(validJson);
    const firstId = useEditorStore.getState().document.payload.balls[0].id;
    useEditorStore.getState().setBallColor(firstId, "C");
    expect(useEditorStore.getState().document.payload.balls[0].color).toBe("C");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls[0].color).toBe("R");
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.payload.balls[0].color).toBe("C");
    useEditorStore.getState().deleteBall(firstId);
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.payload.balls).toHaveLength(2);
  });
});
