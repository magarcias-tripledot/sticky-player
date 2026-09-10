"use client";

import { parseCsvPlacements } from "@/lib/generators/csvImport";
import { StickyLevelError } from "@/lib/sticky/types";
import { useEditorStore } from "@/state/editorStore";
import { useRef, useState } from "react";

export function CsvImportPanel() {
  const applyGeneratedBalls = useEditorStore((state) => state.applyGeneratedBalls);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function onPickFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setIsError(true);
        setMessage("Could not read that CSV file.");
        return;
      }
      try {
        const balls = parseCsvPlacements(reader.result);
        applyGeneratedBalls(balls, "replace");
        setFileName(file.name);
        setIsError(false);
        setMessage(`Imported ${balls.length} balls as placements.`);
      } catch (error) {
        setIsError(true);
        setMessage(error instanceof StickyLevelError ? error.message : "CSV is invalid.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="panel">
      <h2>CSV import</h2>
      <p className="muted">
        One row per ball: x, y, z, color (R O Y G B P K C), layer. Layer is ignored for now. Replaces
        the current balls and exports as placements.
      </p>
      <div className="row">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import CSV
        </button>
      </div>
      <input
        ref={fileInputRef}
        className="hidden-input"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          onPickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {fileName ? <p className="muted">{fileName}</p> : null}
      {message ? <p className={isError ? "error" : "ok"}>{message}</p> : null}
    </section>
  );
}
