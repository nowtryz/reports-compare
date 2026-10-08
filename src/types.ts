/** Shape of `<generated>.scored.json` written by scripts/score_generated_reports.py. */

export type Scores = Record<string, number>;
export type Range = [number, number];
export type Thresholds = {
  section: Record<string, Range>;
  report: Record<string, Range>;
};

export interface Study {
  study_id: string;
  subsets: string[];
  views: string[];
  /** disease -> severity ("Mild", "Grade 1", ...) or `true` when the descriptor has no grade */
  presents: Record<string, string | boolean>;
  ground_truth: Record<string, string>;
  generated: Record<string, string>;
  scores: Record<string, Scores>;
  report_scores: Scores;
}

export interface ScoredFile {
  meta: Record<string, unknown>;
  metrics: { key: string; label: string }[];
  sections: { key: string; title: string }[];
  thresholds: Thresholds;
  corpus: { overall: Scores; by_section: Record<string, Scores> };
  studies: Study[];
}

/** How a section's texts are shown: two columns, or one inline word diff. */
export type TextMode = "side-by-side" | "diff";

/** How texts are drawn, in both text modes. */
export interface DisplayOptions {
  /** Line breaks and spacing kept, with a ↵ mark at each break; the diff shows whitespace changes. */
  showWhitespace: boolean;
  /** Token boundaries drawn, the token shown on hover. Needs a loaded tokenizer. */
  showTokens: boolean;
}

/** By-section table of the summary: whole-file corpus scores, or the selected disease's means. */
export type SectionScope = "file" | "disease";

/** Studies table state, kept in the browser history so Back returns to the same page. */
export interface TableState {
  sort: { by: "score" | "id"; desc: boolean };
  page: number;
}

export interface Filters {
  subset: string | null;
  disease: string | null;
  severities: string[];
  query: string;
}
