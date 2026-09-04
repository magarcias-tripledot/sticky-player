"use client";

import { canEncodeAsCylindricalGrid } from "@/lib/generators/cylindricalGrid";
import { authoringTools } from "@/lib/generators/tools";
import { STICKY_COLOR_CODES, STICKY_COLOR_HEX, STICKY_COLOR_LABELS } from "@/lib/sticky/colors";
import { BALL_DIAMETER } from "@/lib/sticky/constants";
import { findInvalidBallIds, minCenterDistanceFor, minLayerCenterDistanceFor } from "@/lib/sticky/validateSpacing";
import { useEditorStore } from "@/state/editorStore";
import { useMemo, useRef, useState } from "react";

function formatCoord(value: number): string {
  return value.toFixed(3);
}

export function Inspector() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const document = useEditorStore((state) => state.document);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const importError = useEditorStore((state) => state.importError);
  const pastLength = useEditorStore((state) => state.past.length);
  const futureLength = useEditorStore((state) => state.future.length);
  const importJson = useEditorStore((state) => state.importJson);
  const setSelectedBallsColor = useEditorStore((state) => state.setSelectedBallsColor);
  const deleteSelectedBalls = useEditorStore((state) => state.deleteSelectedBalls);
  const updateMetadata = useEditorStore((state) => state.updateMetadata);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const exportJson = useEditorStore((state) => state.exportJson);
  const newLevel = useEditorStore((state) => state.newLevel);
  const clearBalls = useEditorStore((state) => state.clearBalls);
  const spacingTolerance = useEditorStore((state) => state.spacingTolerance);
  const setSpacingTolerance = useEditorStore((state) => state.setSpacingTolerance);
  const lattice = useEditorStore((state) => state.lattice);

  const selectedBalls = useMemo(() => {
    const selected = new Set(selectedIds);
    return document.payload.balls.filter((ball) => selected.has(ball.id));
  }, [document.payload.balls, selectedIds]);
  const selectedBall = selectedBalls.length === 1 ? selectedBalls[0] : null;

  const invalidIds = useMemo(
    () => findInvalidBallIds(document.payload.balls, spacingTolerance),
    [document.payload.balls, spacingTolerance],
  );
  const spacingValid = invalidIds.size === 0;
  const exportFormat = canEncodeAsCylindricalGrid(document.payload.balls, lattice) ? "grid" : "placements";
  const minDistance = minCenterDistanceFor(spacingTolerance);
  const layerMinDistance = minLayerCenterDistanceFor(spacingTolerance);
  const commonSelectedColor =
    selectedBalls.length > 0 && selectedBalls.every((ball) => ball.color === selectedBalls[0].color)
      ? selectedBalls[0].color
      : null;

  const [toolId, setToolId] = useState(authoringTools[0]?.id ?? "");
  const ActiveToolPanel = authoringTools.find((tool) => tool.id === toolId)?.Panel;

  function onImportFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        importJson(reader.result);
      }
    };
    reader.readAsText(file);
  }

  function onExport() {
    const json = exportJson();
    if (!json) {
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    const slug = document.id.trim() || "sticky-level";
    link.href = url;
    link.download = `${slug}.json`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const canClear = document.payload.balls.length > 0 || document.payload.ballCount > 0;
  const newLevelNeedsConfirm = document.payload.balls.length > 0 || pastLength > 0;

  function onNewLevel() {
    if (newLevelNeedsConfirm && !window.confirm("Create a new untitled level? Unsaved edits and undo history will be discarded.")) {
      return;
    }
    newLevel();
  }

  function onClear() {
    if (!canClear) {
      return;
    }
    if (
      !window.confirm(
        "Clear all balls and reset shot count (ballCount) to 0? Level id, name, and boosters are kept. This can be undone.",
      )
    ) {
      return;
    }
    clearBalls();
  }

  return (
    <aside className="inspector">
      <header className="inspector-header">
        <h1>Sticky Authoring</h1>
        <p>
          Export format {exportFormat} · diameter {BALL_DIAMETER.toFixed(2)} · min distance{" "}
          {minDistance.toFixed(3)}
          {lattice ? ` · shells ${layerMinDistance.toFixed(3)}` : ""}
        </p>
      </header>

      <section className="panel">
        <div className="row">
          <button type="button" onClick={onNewLevel}>
            New Level
          </button>
          <button type="button" className="danger" onClick={onClear} disabled={!canClear}>
            Clear
          </button>
        </div>
        <div className="row">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <button type="button" onClick={onExport} disabled={!spacingValid}>
            Export JSON
          </button>
          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              onImportFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        <div className="row">
          <button type="button" onClick={undo} disabled={pastLength === 0}>
            Undo
          </button>
          <button type="button" onClick={redo} disabled={futureLength === 0}>
            Redo
          </button>
        </div>
        {importError ? <p className="error">{importError}</p> : null}
        {!spacingValid ? (
          <p className="error">
            {invalidIds.size} ball{invalidIds.size === 1 ? "" : "s"} closer than{" "}
            {minDistance.toFixed(3)}
            {lattice ? ` (${layerMinDistance.toFixed(3)} across shells)` : ""}. Export is
            disabled.
          </p>
        ) : (
          <p className="ok">Spacing valid</p>
        )}
        <label>
          Spacing tolerance (authoring only)
          <input
            type="number"
            min={0}
            step={0.01}
            value={spacingTolerance}
            onChange={(event) => setSpacingTolerance(Number(event.target.value))}
          />
        </label>
        <p className="muted">
          Default 0 matches gameplay contact packing (diameter {BALL_DIAMETER.toFixed(2)}). Raise
          this for an extra authoring margin, like Unity&apos;s Spacing Tolerance.
        </p>
      </section>

      <section className="panel">
        <h2>Tools</h2>
        <div className="row">
          {authoringTools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={tool.id === toolId ? "tool-tab selected" : "tool-tab"}
              onClick={() => setToolId(tool.id)}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </section>
      {ActiveToolPanel ? <ActiveToolPanel /> : null}

      <section className="panel">
        <h2>Counts</h2>
        <label>
          Placed balls
          <input value={document.payload.balls.length} readOnly />
        </label>
        <label>
          Shot count (ballCount)
          <input
            type="number"
            min={0}
            value={document.payload.ballCount}
            onChange={(event) => updateMetadata({ ballCount: Number(event.target.value) })}
          />
        </label>
      </section>

      <section className="panel">
        <h2>{selectedBalls.length === 1 ? "Selected ball" : "Selected balls"}</h2>
        {selectedBalls.length > 0 ? (
          <>
            {selectedBall ? (
              <div className="xyz">
                <span>X {formatCoord(selectedBall.position.x)}</span>
                <span>Y {formatCoord(selectedBall.position.y)}</span>
                <span>Z {formatCoord(selectedBall.position.z)}</span>
              </div>
            ) : (
              <p className="muted">{selectedBalls.length} balls selected</p>
            )}
            <div className="swatches">
              {STICKY_COLOR_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={commonSelectedColor === code ? "swatch selected" : "swatch"}
                  style={{ background: STICKY_COLOR_HEX[code] }}
                  title={STICKY_COLOR_LABELS[code]}
                  onClick={() => setSelectedBallsColor(code)}
                >
                  {code}
                </button>
              ))}
            </div>
            <button type="button" className="danger" onClick={deleteSelectedBalls}>
              Delete {selectedBalls.length === 1 ? "ball" : `${selectedBalls.length} balls`}
            </button>
          </>
        ) : (
          <p className="muted">Click a sphere to select it. Shift, Cmd, or Ctrl-click to select multiple.</p>
        )}
      </section>

      <section className="panel">
        <h2>Level</h2>
        <label>
          Id
          <input value={document.id} onChange={(event) => updateMetadata({ id: event.target.value })} />
        </label>
        <label>
          Name
          <input value={document.name} onChange={(event) => updateMetadata({ name: event.target.value })} />
        </label>
        <label>
          Order
          <input
            type="number"
            value={document.order}
            onChange={(event) => updateMetadata({ order: Number(event.target.value) })}
          />
        </label>
        <label>
          Rotation speed
          <input
            type="number"
            value={document.payload.rotationSpeed}
            onChange={(event) => updateMetadata({ rotationSpeed: Number(event.target.value) })}
          />
        </label>
        <label>
          Seed
          <input
            type="number"
            value={document.payload.seed}
            onChange={(event) => updateMetadata({ seed: Number(event.target.value) })}
          />
        </label>
      </section>

      <section className="panel">
        <h2>Boosters</h2>
        {(["bomb", "multiball", "wild", "rainbow"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              type="number"
              min={0}
              max={100}
              value={document.payload.boosters[key]}
              onChange={(event) =>
                updateMetadata({
                  boosters: { [key]: Math.max(0, Math.min(100, Number(event.target.value))) },
                })
              }
            />
          </label>
        ))}
      </section>
    </aside>
  );
}
