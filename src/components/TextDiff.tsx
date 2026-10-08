import { Box, Group, Text } from "@mantine/core";
import { diffArrays } from "diff";
import { Fragment, type ReactNode, useMemo } from "react";

import type { TokenizerState } from "../tokenizer";
import type { DisplayOptions } from "../types";
import { tokenPieces } from "../tokenizer";

const REMOVED_STYLE = {
  background: "var(--mantine-color-red-light)",
  color: "var(--mantine-color-red-light-color)",
  textDecoration: "line-through",
  borderRadius: 3,
  padding: "0 2px",
} as const;

const ADDED_STYLE = {
  background: "var(--mantine-color-green-light)",
  color: "var(--mantine-color-green-light-color)",
  borderRadius: 3,
  padding: "0 2px",
} as const;

/** A token, or the part of one left after splitting off its whitespace. */
type Piece = {
  text: string;
  /** The tokenizer token it is (part of), null for a word of the word diff. */
  token: string | null;
  /** First piece of its token: where a token boundary is drawn. */
  start: boolean;
};

type Part = { pieces: Piece[]; added?: boolean; removed?: boolean };

const join = (pieces: Piece[]) => pieces.map((p) => p.text).join("");

// Words, punctuation and whitespace runs, for the word diff.
const WORD_PIECES = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

/**
 * The text model's tokens when its tokenizer round-trips the text, else words. Tokens carry the
 * whitespace the tokenizer attaches to them (" significant" after a space, "\nsignificant" or "\n",
 * "significant" after a newline): kept with `showWhitespace`, to see what the model produced;
 * otherwise split off into their own pieces, so a whitespace change never hides a matching word.
 */
function pieces(text: string, tokenizer: TokenizerState, showWhitespace = true): Piece[] {
  const tokens = tokenizer.status === "ready" ? tokenPieces(tokenizer.tokenizer, text) : null;
  if (!tokens) {
    return (text.match(WORD_PIECES) ?? []).map((w) => ({ text: w, token: null, start: true }));
  }
  return tokens.flatMap((token) =>
    (showWhitespace ? [token] : token.split(/(\s+)/).filter(Boolean)).map((t, i) => ({
      text: t,
      token,
      start: i === 0,
    })),
  );
}

/**
 * Case-insensitive, as the metrics are. Unless `showWhitespace`, whitespace changes are not
 * highlighted (the generated whitespace is kept as plain text, the reference's dropped) and the
 * caller collapses whitespace.
 */
function diffParts(
  reference: string,
  generated: string,
  tokenizer: TokenizerState,
  showWhitespace: boolean,
): Part[] {
  const sameText = (a: Piece, b: Piece) => a.text.toLowerCase() === b.text.toLowerCase();
  const changes = diffArrays(
    pieces(reference, tokenizer, showWhitespace),
    pieces(generated, tokenizer, showWhitespace),
    { comparator: sameText },
  ).flatMap((c): Part[] => {
    if (!showWhitespace && !join(c.value).trim()) return c.removed ? [] : [{ pieces: c.value }];
    return [{ pieces: c.value, added: c.added, removed: c.removed }];
  });
  return coalesce(changes);
}

/**
 * Merges the changes on either side of an unchanged whitespace run into one removed and one added
 * part, so a replaced phrase reads as a block ("Redundant mitral" -> "Normal appearance") rather
 * than word by word, split at each space both texts happen to share.
 */
function coalesce(changes: Part[]): Part[] {
  const out: Part[] = [];
  let removed: Piece[] = [];
  let added: Piece[] = [];
  const flush = () => {
    if (removed.length) out.push({ pieces: removed, removed: true });
    if (added.length) out.push({ pieces: added, added: true });
    removed = [];
    added = [];
  };
  changes.forEach((part, i) => {
    const next = changes[i + 1];
    const pending = removed.length || added.length;
    if (part.removed) removed.push(...part.pieces);
    else if (part.added) added.push(...part.pieces);
    else if (pending && !join(part.pieces).trim() && (next?.removed || next?.added)) {
      removed.push(...part.pieces);
      added.push(...part.pieces);
    } else {
      flush();
      out.push(part);
    }
  });
  flush();
  return out;
}

const BREAK_MARK_STYLE = {
  fontSize: "0.85em",
  marginInlineStart: 2,
  userSelect: "none",
} as const;

/**
 * `text` with a ↵ at each line break, in the surrounding color (so tinted inside a diff highlight),
 * left out of copies and screen readers. Faint unless `changed`: a break the diff highlights.
 * `breakLines: false` shows the mark without breaking the line: a removed break in the diff, whose
 * layout is the generated text's.
 */
function withBreakMarks(text: string, { changed = false, breakLines = true } = {}): ReactNode {
  if (!text.includes("\n")) return text;
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          <span style={{ ...BREAK_MARK_STYLE, opacity: changed ? 1 : 0.4 }} aria-hidden>
            ↵
          </span>
          {breakLines && "\n"}
        </>
      )}
      {line}
    </Fragment>
  ));
}

// A hairline before each token, in the surrounding color: takes no room, so the text does not
// move, and stays visible inside the diff highlights.
const TOKEN_BOUNDARY_STYLE = {
  borderInlineStart: "1px solid color-mix(in srgb, currentColor 35%, transparent)",
} as const;

/** Renders pieces, with their line-break marks and token boundaries as `options` ask. */
function renderPieces(
  pieces: Piece[],
  { showWhitespace, showTokens }: DisplayOptions,
  { changed = false, removed = false } = {},
): ReactNode {
  const text = (value: string) =>
    showWhitespace ? withBreakMarks(value, { changed, breakLines: !removed }) : value;
  if (!showTokens || !pieces.some((p) => p.token !== null)) return text(join(pieces));
  return pieces.map((p, i) => (
    <span
      key={i}
      style={p.start ? TOKEN_BOUNDARY_STYLE : undefined}
      title={p.token === null ? undefined : JSON.stringify(p.token)}
    >
      {text(p.text)}
    </span>
  ));
}

/** One text on its own (split view), with line-break marks and token boundaries as asked. */
export function TokenText({
  text,
  tokenizer,
  options,
}: {
  text: string;
  tokenizer: TokenizerState;
  options: DisplayOptions;
}) {
  const textPieces = useMemo(
    () => (options.showTokens ? pieces(text, tokenizer) : null),
    [text, tokenizer, options.showTokens],
  );
  return renderPieces(textPieces ?? [{ text, token: null, start: true }], options);
}

/**
 * Inline diff, like `git diff --word-diff` but on the text model's tokens when its tokenizer is
 * loaded: reference-only pieces struck through in red, generated-only pieces in green.
 */
export function TextDiff({
  reference,
  generated,
  tokenizer,
  options,
}: {
  reference: string;
  generated: string;
  tokenizer: TokenizerState;
  options: DisplayOptions;
}) {
  const { showWhitespace } = options;
  const parts = useMemo(
    () => diffParts(reference, generated, tokenizer, showWhitespace),
    [reference, generated, tokenizer, showWhitespace],
  );
  return (
    <Text style={{ whiteSpace: showWhitespace ? "pre-wrap" : "normal" }}>
      {parts.map((part, i) => {
        const value = join(part.pieces);
        const flags = { changed: part.added || part.removed, removed: part.removed };
        return part.removed ? (
          <Box component="del" key={i} style={REMOVED_STYLE} aria-label={`missing: ${value}`}>
            {renderPieces(part.pieces, options, flags)}
          </Box>
        ) : part.added ? (
          <Box component="ins" key={i} style={{ ...ADDED_STYLE, textDecoration: "none" }} aria-label={`added: ${value}`}>
            {renderPieces(part.pieces, options, flags)}
          </Box>
        ) : (
          <span key={i}>{renderPieces(part.pieces, options)}</span>
        );
      })}
    </Text>
  );
}

function unitLabel(tokenizer: TokenizerState): string {
  switch (tokenizer.status) {
    case "ready":
      return `${tokenizer.modelId} tokens`;
    case "loading":
      return `words (loading the ${tokenizer.modelId} tokenizer…)`;
    case "error":
      return `words (no ${tokenizer.modelId} tokenizer: ${tokenizer.error})`;
    case "none":
      return "words (no text_model in the file)";
  }
}

export function DiffLegend({ tokenizer }: { tokenizer: TokenizerState }) {
  return (
    <Group gap="md">
      <Text size="sm" c="dimmed">
        Diff of generated against reference, by {unitLabel(tokenizer)}:
      </Text>
      <Text size="sm">
        <Box component="del" style={REMOVED_STYLE}>
          missing
        </Box>{" "}
        in generated
      </Text>
      <Text size="sm">
        <Box component="ins" style={{ ...ADDED_STYLE, textDecoration: "none" }}>
          added
        </Box>{" "}
        by the model
      </Text>
    </Group>
  );
}
