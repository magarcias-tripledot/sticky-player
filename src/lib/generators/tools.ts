"use client";

import { BoostedGridPanel } from "@/components/BoostedGridPanel";
import { boostedGridGenerator } from "@/lib/generators/boostedGrid";
import type { GeometryGenerator } from "@/lib/generators/types";
import type { ComponentType } from "react";

export type AuthoringTool = {
  id: string;
  label: string;
  Panel: ComponentType;
};

export const authoringTools: AuthoringTool[] = [
  { id: "boosted-grid", label: "Boosted grid", Panel: BoostedGridPanel },
];

export const geometryGenerators: GeometryGenerator[] = [boostedGridGenerator];
