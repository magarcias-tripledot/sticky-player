import { isStickyColorCode } from "../sticky/colors";
import { StickyLevelError } from "../sticky/types";
import type { GeneratedBall, GeometryGenerator } from "./types";

const REQUIRED_HEADERS = ["x", "y", "z", "color", "layer"] as const;

function splitCsvRows(text: string): string[] {
  return text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (inQuotes) {
    throw new StickyLevelError("CSV has an unclosed quoted field.");
  }
  fields.push(current);
  return fields;
}

function readNumber(value: string, field: string, row: number): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    throw new StickyLevelError(`CSV row ${row}: ${field} must be a finite number.`);
  }
  return parsed;
}

export function parseCsvPlacements(text: string): GeneratedBall[] {
  const lines = splitCsvRows(text);
  let headerIndex = 0;
  while (headerIndex < lines.length && lines[headerIndex].trim() === "") {
    headerIndex += 1;
  }
  if (headerIndex >= lines.length) {
    throw new StickyLevelError("CSV is empty.");
  }

  const headers = parseCsvLine(lines[headerIndex]).map((header) => header.trim().toLowerCase());
  const indexes: Record<(typeof REQUIRED_HEADERS)[number], number> = {
    x: -1,
    y: -1,
    z: -1,
    color: -1,
    layer: -1,
  };
  for (const header of REQUIRED_HEADERS) {
    indexes[header] = headers.indexOf(header);
    if (indexes[header] < 0) {
      throw new StickyLevelError(`CSV is missing required header "${header}".`);
    }
  }

  const balls: GeneratedBall[] = [];
  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line.trim() === "") {
      continue;
    }
    const row = lineIndex + 1;
    const fields = parseCsvLine(line);
    const needed = Math.max(...Object.values(indexes)) + 1;
    if (fields.length < needed) {
      throw new StickyLevelError(`CSV row ${row}: expected at least ${needed} columns.`);
    }
    const colorRaw = fields[indexes.color].trim();
    if (!isStickyColorCode(colorRaw)) {
      throw new StickyLevelError(`CSV row ${row}: color "${colorRaw}" is not a Sticky color code.`);
    }
    readNumber(fields[indexes.layer], "layer", row);
    balls.push({
      position: {
        x: readNumber(fields[indexes.x], "x", row),
        y: readNumber(fields[indexes.y], "y", row),
        z: readNumber(fields[indexes.z], "z", row),
      },
      color: colorRaw,
    });
  }

  if (balls.length === 0) {
    throw new StickyLevelError("CSV has no ball rows.");
  }
  return balls;
}

export const csvImportGenerator: GeometryGenerator = {
  id: "csv-import",
  generate(params?: unknown) {
    if (typeof params !== "string") {
      return [];
    }
    try {
      return parseCsvPlacements(params);
    } catch {
      return [];
    }
  },
};
