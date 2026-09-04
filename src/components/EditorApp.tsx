"use client";

import { Inspector } from "@/components/Inspector";
import { useEditorStore } from "@/state/editorStore";
import dynamic from "next/dynamic";
import { useEffect } from "react";

const Viewport = dynamic(
  () => import("@/components/Viewport").then((module) => ({ default: module.Viewport })),
  { ssr: false },
);

export function EditorApp() {
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (!modifier || event.key.toLowerCase() !== "z") {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  return (
    <div className="app-shell">
      <div className="viewport-pane">
        <Viewport />
      </div>
      <Inspector />
    </div>
  );
}
