"use client";

import { STICKY_COLOR_CODES, STICKY_COLOR_HEX, STICKY_COLOR_LABELS } from "@/lib/sticky/colors";
import { BALL_DIAMETER } from "@/lib/sticky/constants";
import { findInvalidBallIds, minCenterDistanceFor } from "@/lib/sticky/validateSpacing";
import { selectSelectedBall, useEditorStore } from "@/state/editorStore";
import { useMemo, useRef } from "react";

function formatCoord(value: number): string {
  return value.toFixed(3);
}

export function Inspector() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const document = useEditorStore((state) => state.document);
  const selectedBall = useEditorStore(selectSelectedBall);
  const importError = useEditorStore((state) => state.importError);
  const pastLength = useEditorStore((state) => state.past.length);
  const futureLength = useEditorStore((state) => state.future.length);
  const importJson = useEditorStore((state) => state.importJson);
  const setBallColor = useEditorStore((state) => state.setBallColor);
  const deleteBall = useEditorStore((state) => state.deleteBall);
  const updateMetadata = useEditorStore((state) => state.updateMetadata);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const exportJson = useEditorStore((state) => state.exportJson);
  const spacingTolerance = useEditorStore((state) => state.spacingTolerance);
  const setSpacingTolerance = useEditorStore((state) => state.setSpacingTolerance);

  const invalidIds = useMemo(
    () => findInvalidBallIds(document.payload.balls, spacingTolerance),
    [document.payload.balls, spacingTolerance],
  );
  const spacingValid = invalidIds.size === 0;
  const minDistance = minCenterDistanceFor(spacingTolerance);

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

  return (
    <aside className="inspector">
      <header className="inspector-header">
        <h1>Sticky Authoring</h1>
        <p>
          Placements JSON · diameter {BALL_DIAMETER.toFixed(2)} · min distance{" "}
          {minDistance.toFixed(3)}
        </p>
      </header>

      <section className="panel">
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
            {minDistance.toFixed(3)}. Export is disabled.
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
          Minimum distance is {BALL_DIAMETER.toFixed(2)} + tolerance, same as Unity. Use 0 to accept
          balls packed at exact contact.
        </p>
      </section>

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
        <h2>Selected ball</h2>
        {selectedBall ? (
          <>
            <div className="xyz">
              <span>X {formatCoord(selectedBall.position.x)}</span>
              <span>Y {formatCoord(selectedBall.position.y)}</span>
              <span>Z {formatCoord(selectedBall.position.z)}</span>
            </div>
            <div className="swatches">
              {STICKY_COLOR_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={selectedBall.color === code ? "swatch selected" : "swatch"}
                  style={{ background: STICKY_COLOR_HEX[code] }}
                  title={STICKY_COLOR_LABELS[code]}
                  onClick={() => setBallColor(selectedBall.id, code)}
                >
                  {code}
                </button>
              ))}
            </div>
            <button type="button" className="danger" onClick={() => deleteBall(selectedBall.id)}>
              Delete ball
            </button>
          </>
        ) : (
          <p className="muted">Click a sphere to select it.</p>
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
