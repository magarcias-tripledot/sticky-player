"use client";

import type { GeneratedBall } from "@/lib/generators/types";
import type { StickyColorCode } from "@/lib/sticky/colors";
import { parseStickyLevel, serializeStickyLevel } from "@/lib/sticky/schema";
import { StickyLevelError, createEmptyDocument, type StickyBoosters, type StickyLevelDocument } from "@/lib/sticky/types";
import { SPACING_TOLERANCE } from "@/lib/sticky/constants";
import { findInvalidBallIds } from "@/lib/sticky/validateSpacing";
import { create } from "zustand";

const MAX_HISTORY = 100;

type Snapshot = {
  document: StickyLevelDocument;
};

type MetadataPatch = {
  id?: string;
  order?: number;
  name?: string;
  ballCount?: number;
  rotationSpeed?: number;
  seed?: number;
  boosters?: Partial<StickyBoosters>;
};

type EditorState = {
  document: StickyLevelDocument;
  selectedIds: string[];
  importError: string | null;
  cameraFitNonce: number;
  // Authoring-only setting, like StickyLevelAuthoring._spacingTolerance. Never exported.
  spacingTolerance: number;
  past: Snapshot[];
  future: Snapshot[];
  importJson: (json: string) => void;
  selectBall: (id: string, toggle: boolean) => void;
  clearSelection: () => void;
  setSpacingTolerance: (tolerance: number) => void;
  setSelectedBallsColor: (color: StickyColorCode) => void;
  deleteSelectedBalls: () => void;
  updateMetadata: (patch: MetadataPatch) => void;
  applyGeneratedBalls: (generated: GeneratedBall[], mode?: "replace" | "append") => void;
  newLevel: () => void;
  clearBalls: () => void;
  undo: () => void;
  redo: () => void;
  exportJson: () => string | null;
};

function cloneDocument(document: StickyLevelDocument): StickyLevelDocument {
  return {
    ...document,
    payload: {
      ...document.payload,
      balls: document.payload.balls.map((ball) => ({
        ...ball,
        position: { ...ball.position },
      })),
      boosters: { ...document.payload.boosters },
    },
  };
}

function snapshotOf(document: StickyLevelDocument): Snapshot {
  return { document: cloneDocument(document) };
}

function withHistory(state: EditorState, nextDocument: StickyLevelDocument): Partial<EditorState> {
  return {
    document: nextDocument,
    past: [...state.past, snapshotOf(state.document)].slice(-MAX_HISTORY),
    future: [],
    importError: null,
  };
}

function createBallId(): string {
  return crypto.randomUUID();
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createEmptyDocument(),
  selectedIds: [],
  importError: null,
  cameraFitNonce: 0,
  spacingTolerance: SPACING_TOLERANCE,
  past: [],
  future: [],

  importJson: (json) => {
    try {
      const document = parseStickyLevel(json);
      set({
        document,
        selectedIds: [],
        importError: null,
        past: [],
        future: [],
        cameraFitNonce: get().cameraFitNonce + 1,
      });
    } catch (error) {
      const message = error instanceof StickyLevelError ? error.message : "Level JSON is invalid.";
      set({ importError: message });
    }
  },

  selectBall: (id, toggle) => {
    const { document, selectedIds } = get();
    if (!document.payload.balls.some((ball) => ball.id === id)) {
      return;
    }
    if (!toggle) {
      set({ selectedIds: [id] });
      return;
    }
    set({
      selectedIds: selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  setSpacingTolerance: (tolerance) => {
    const safe = Number.isFinite(tolerance) ? Math.max(0, tolerance) : 0;
    set({ spacingTolerance: safe });
  },

  setSelectedBallsColor: (color) => {
    const { document, selectedIds } = get();
    const selected = new Set(selectedIds);
    if (
      selected.size === 0 ||
      !document.payload.balls.some((ball) => selected.has(ball.id) && ball.color !== color)
    ) {
      return;
    }
    const nextDocument = cloneDocument(document);
    nextDocument.payload.balls = nextDocument.payload.balls.map((ball) =>
      selected.has(ball.id) ? { ...ball, color } : ball,
    );
    set((state) => withHistory(state, nextDocument));
  },

  deleteSelectedBalls: () => {
    const { document, selectedIds } = get();
    const selected = new Set(selectedIds);
    if (selected.size === 0 || !document.payload.balls.some((ball) => selected.has(ball.id))) {
      return;
    }
    const nextDocument = cloneDocument(document);
    nextDocument.payload.balls = nextDocument.payload.balls.filter((ball) => !selected.has(ball.id));
    set((state) => ({
      ...withHistory(state, nextDocument),
      selectedIds: [],
    }));
  },

  updateMetadata: (patch) => {
    const nextDocument = cloneDocument(get().document);
    if (patch.id !== undefined) nextDocument.id = patch.id;
    if (patch.order !== undefined) nextDocument.order = patch.order;
    if (patch.name !== undefined) nextDocument.name = patch.name;
    if (patch.ballCount !== undefined) {
      nextDocument.payload.ballCount = Math.max(0, Math.trunc(patch.ballCount));
    }
    if (patch.rotationSpeed !== undefined) nextDocument.payload.rotationSpeed = patch.rotationSpeed;
    if (patch.seed !== undefined) nextDocument.payload.seed = Math.trunc(patch.seed);
    if (patch.boosters) {
      nextDocument.payload.boosters = {
        ...nextDocument.payload.boosters,
        ...patch.boosters,
      };
    }
    set((state) => withHistory(state, nextDocument));
  },

  applyGeneratedBalls: (generated, mode = "replace") => {
    const nextDocument = cloneDocument(get().document);
    const mapped = generated.map((ball) => ({
      id: createBallId(),
      position: { ...ball.position },
      color: ball.color,
    }));
    nextDocument.payload.balls = mode === "append" ? [...nextDocument.payload.balls, ...mapped] : mapped;
    set((state) => ({
      ...withHistory(state, nextDocument),
      selectedIds: [],
      cameraFitNonce: state.cameraFitNonce + 1,
    }));
  },

  newLevel: () => {
    set({
      document: createEmptyDocument(),
      selectedIds: [],
      importError: null,
      past: [],
      future: [],
      cameraFitNonce: get().cameraFitNonce + 1,
    });
  },

  clearBalls: () => {
    const { document } = get();
    if (document.payload.balls.length === 0 && document.payload.ballCount === 0) {
      return;
    }
    const nextDocument = cloneDocument(document);
    nextDocument.payload.balls = [];
    nextDocument.payload.ballCount = 0;
    set((state) => ({
      ...withHistory(state, nextDocument),
      selectedIds: [],
      cameraFitNonce: state.cameraFitNonce + 1,
    }));
  },

  undo: () => {
    const { past, document, future } = get();
    const previous = past[past.length - 1];
    if (!previous) {
      return;
    }
    set({
      document: cloneDocument(previous.document),
      selectedIds: [],
      past: past.slice(0, -1),
      future: [snapshotOf(document), ...future],
    });
  },

  redo: () => {
    const { future, document, past } = get();
    const next = future[0];
    if (!next) {
      return;
    }
    set({
      document: cloneDocument(next.document),
      selectedIds: [],
      past: [...past, snapshotOf(document)],
      future: future.slice(1),
    });
  },

  exportJson: () => {
    const { document, spacingTolerance } = get();
    if (findInvalidBallIds(document.payload.balls, spacingTolerance).size > 0) {
      return null;
    }
    return serializeStickyLevel(document);
  },
}));
