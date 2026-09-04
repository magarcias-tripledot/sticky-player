"use client";

import { generateBoostedGrid } from "@/lib/generators/boostedGrid";
import { enumerateLatticeSlots, innerColumnsFor, MAX_LAYERS, normalizeLattice } from "@/lib/generators/cylindricalLattice";
import type { StickyColorCode } from "@/lib/sticky/colors";
import { BOOSTED_GRID_SESSION, useEditorStore } from "@/state/editorStore";
import { useEffect, useRef, useState } from "react";

const DEFAULT_DRAFT = { columns: 8, rows: 6, layers: 1 };

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
  const lattice = useEditorStore((state) => state.lattice);
  const beginGeneratorSession = useEditorStore((state) => state.beginGeneratorSession);
  const rebuildGeneratedBalls = useEditorStore((state) => state.rebuildGeneratedBalls);
  const setLattice = useEditorStore((state) => state.setLattice);

  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const live = generatorSession === BOOSTED_GRID_SESSION && lattice !== null;
  const skipLive = useRef(true);
  const previousLattice = useRef(lattice);

  const columns = lattice?.columns ?? draft.columns;
  const rows = lattice?.rows ?? draft.rows;
  const layers = lattice?.layers ?? draft.layers;
  const innerMissing = layers > 1 && innerColumnsFor(Math.max(3, Math.trunc(columns)), 1) === null;
  const innerWidths = Array.from({ length: Math.max(0, layers - 1) }, (_, index) =>
    innerColumnsFor(Math.max(3, Math.trunc(columns)), index + 1),
  );

  function commitParams(next: { columns: number; rows: number; layers: number }) {
    const normalized = normalizeLattice(next);
    if (lattice) {
      setLattice(normalized);
      return;
    }
    setDraft(normalized);
  }

  function onGenerate() {
    const spec = normalizeLattice({ columns, rows, layers });
    const next = generateBoostedGrid({
      ...spec,
      colorsBySlot: colorsBySlotFromBalls(balls),
    });
    if (live) {
      previousLattice.current = spec;
      rebuildGeneratedBalls(next, spec);
      return;
    }
    beginGeneratorSession(BOOSTED_GRID_SESSION, next, spec);
  }

  useEffect(() => {
    if (!live || !lattice) {
      skipLive.current = true;
      previousLattice.current = lattice;
      return;
    }
    if (skipLive.current) {
      skipLive.current = false;
      previousLattice.current = lattice;
      return;
    }
    const previous = previousLattice.current ?? lattice;
    const current = useEditorStore.getState().lattice;
    if (!current) {
      return;
    }
    rebuildGeneratedBalls(
      generateBoostedGrid({
        ...current,
        colorsBySlot: colorsBySlotFromBalls(useEditorStore.getState().document.payload.balls),
        previousSlots: enumerateLatticeSlots(previous),
      }),
    );
    previousLattice.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lattice object identity must not retrigger rebuild
  }, [lattice?.columns, lattice?.rows, lattice?.layers, live, rebuildGeneratedBalls]);

  return (
    <section className="panel">
      <h2>Boosted grid</h2>
      <p className="muted">
        Cylindrical lattice (Unity Boosted). Generate once, then columns / rows / layers update live and keep slot
        colors. Export uses format &quot;grid&quot;.
      </p>
      <label>
        Columns
        <input
          type="number"
          min={3}
          step={1}
          value={columns}
          onChange={(event) => commitParams({ columns: Number(event.target.value), rows, layers })}
        />
      </label>
      <label>
        Rows
        <input
          type="number"
          min={1}
          step={1}
          value={rows}
          onChange={(event) => commitParams({ columns, rows: Number(event.target.value), layers })}
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
          onChange={(event) => commitParams({ columns, rows, layers: Number(event.target.value) })}
        />
      </label>
      {layers > 1 ? (
        <p className="muted">
          Inner widths:{" "}
          {innerWidths
            .map((width, index) => `L${index + 1}=${width ?? "skipped"}`)
            .join(", ")}
        </p>
      ) : null}
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
