"use client";

import { generateBoostedGrid } from "@/lib/generators/boostedGrid";
import { innerColumnsFor, MAX_LAYERS } from "@/lib/generators/cylindricalLattice";
import type { StickyColorCode } from "@/lib/sticky/colors";
import { useEditorStore } from "@/state/editorStore";
import { useEffect, useRef, useState } from "react";

const SESSION = "boosted-grid";

function colorsBySlotFromBalls(balls: { id: string; color: StickyColorCode }[]): Record<string, StickyColorCode> {
  const colors: Record<string, StickyColorCode> = {};
  for (const ball of balls) {
    if (ball.id.startsWith("slot-")) {
      colors[ball.id] = ball.color;
    }
  }
  return colors;
}

export function BoostedGridPanel() {
  const balls = useEditorStore((state) => state.document.payload.balls);
  const generatorSession = useEditorStore((state) => state.generatorSession);
  const beginGeneratorSession = useEditorStore((state) => state.beginGeneratorSession);
  const rebuildGeneratedBalls = useEditorStore((state) => state.rebuildGeneratedBalls);

  const [columns, setColumns] = useState(8);
  const [rows, setRows] = useState(6);
  const [layers, setLayers] = useState(1);
  const live = generatorSession === SESSION;
  const skipLive = useRef(true);

  const innerMissing = layers > 1 && innerColumnsFor(Math.max(3, Math.trunc(columns)), 1) === null;

  function onGenerate() {
    const next = generateBoostedGrid({
      columns,
      rows,
      layers,
      colorsBySlot: colorsBySlotFromBalls(balls),
    });
    if (live) {
      rebuildGeneratedBalls(next);
      return;
    }
    beginGeneratorSession(SESSION, next);
  }

  useEffect(() => {
    if (!live) {
      skipLive.current = true;
      return;
    }
    if (skipLive.current) {
      skipLive.current = false;
      return;
    }
    rebuildGeneratedBalls(
      generateBoostedGrid({
        columns,
        rows,
        layers,
        colorsBySlot: colorsBySlotFromBalls(useEditorStore.getState().document.payload.balls),
      }),
    );
  }, [columns, rows, layers, live, rebuildGeneratedBalls]);

  return (
    <section className="panel">
      <h2>Boosted grid</h2>
      <p className="muted">
        Cylindrical lattice (Unity Boosted). Generate once, then columns / rows / layers update live and keep slot
        colors.
      </p>
      <label>
        Columns
        <input
          type="number"
          min={3}
          step={1}
          value={columns}
          onChange={(event) => setColumns(Number(event.target.value))}
        />
      </label>
      <label>
        Rows
        <input
          type="number"
          min={1}
          step={1}
          value={rows}
          onChange={(event) => setRows(Number(event.target.value))}
        />
      </label>
      <label>
        Layers
        <input
          type="number"
          min={1}
          max={MAX_LAYERS}
          step={1}
          value={layers}
          onChange={(event) => setLayers(Number(event.target.value))}
        />
      </label>
      {innerMissing ? (
        <p className="muted">
          Inner layers need a wider outer ring. Layer 1 is skipped until columns is large enough (try 12+).
        </p>
      ) : null}
      <button type="button" onClick={onGenerate}>
        Generate
      </button>
    </section>
  );
}
