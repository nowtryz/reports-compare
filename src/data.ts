import type { Filters, Range, ScoredFile, Study } from "./types";

export type Level = "good" | "fair" | "poor";

export const LEVEL_COLORS: Record<Level, string> = {
  good: "var(--mantine-color-green-6)",
  fair: "var(--mantine-color-orange-5)",
  poor: "var(--mantine-color-red-6)",
};

/** Green at or above the upper cutoff, orange at or above the lower one, red below. */
export function level(value: number, [lo, hi]: Range): Level {
  if (value >= hi) return "good";
  if (value >= lo) return "fair";
  return "poor";
}

export function formatScore(value: number | undefined): string {
  return value === undefined ? "–" : value.toFixed(3);
}

export function severityLabel(value: string | boolean): string {
  return value === true ? "Present" : String(value);
}

export function parseScoredFile(text: string): ScoredFile {
  const data = JSON.parse(text);
  for (const key of ["studies", "metrics", "sections", "thresholds", "corpus"]) {
    if (!(key in data)) {
      throw new Error(
        `missing "${key}": expected a .scored.json from scripts/score_generated_reports.py`,
      );
    }
  }
  return data as ScoredFile;
}

export function applyFilters(studies: Study[], filters: Filters): Study[] {
  const query = filters.query.trim().toLowerCase();
  return studies.filter((s) => {
    if (filters.subset && !s.subsets.includes(filters.subset)) return false;
    if (filters.disease) {
      if (!(filters.disease in s.presents)) return false;
      const severity = severityLabel(s.presents[filters.disease]);
      if (filters.severities.length && !filters.severities.includes(severity)) {
        return false;
      }
    }
    return !query || s.study_id.toLowerCase().includes(query);
  });
}

/** `{label: count}` sorted by decreasing count. */
export function countBy(values: Iterable<string>): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function pickRandom<T>(items: T[], avoid?: T): T | undefined {
  if (!items.length) return undefined;
  const pool = items.length > 1 && avoid !== undefined ? items.filter((i) => i !== avoid) : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function mean(values: number[]): number | undefined {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}
