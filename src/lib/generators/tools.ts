"use client";

import { BoostedGridPanel } from "@/components/BoostedGridPanel";
import { CsvImportPanel } from "@/components/CsvImportPanel";
import { boostedGridGenerator } from "@/lib/generators/boostedGrid";
import { csvImportGenerator } from "@/lib/generators/csvImport";
import type { GeometryGenerator } from "@/lib/generators/types";
import type { ComponentType } from "react";

export type AuthoringTool = {
  id: string;
  label: string;
  Panel: ComponentType;
};

export const authoringTools: AuthoringTool[] = [
  { id: "boosted-grid", label: "Boosted grid", Panel: BoostedGridPanel },
  { id: "csv-import", label: "CSV", Panel: CsvImportPanel },
];

export const geometryGenerators: GeometryGenerator[] = [boostedGridGenerator, csvImportGenerator];
