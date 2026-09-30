import { Box, Group, Text } from "@mantine/core";
import { diffWords } from "diff";
import { useMemo } from "react";

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

/**
 * Inline word diff, like `git diff --word-diff`: reference-only words struck through in red,
 * generated-only words in green. Case-insensitive, as the metrics are.
 */
export function WordDiff({ reference, generated }: { reference: string; generated: string }) {
  const parts = useMemo(
    () => diffWords(reference, generated, { ignoreCase: true }),
    [reference, generated],
  );
  return (
    <Text style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((part, i) =>
        part.removed ? (
          <Box component="del" key={i} style={REMOVED_STYLE} aria-label={`missing: ${part.value}`}>
            {part.value}
          </Box>
        ) : part.added ? (
          <Box component="ins" key={i} style={{ ...ADDED_STYLE, textDecoration: "none" }} aria-label={`added: ${part.value}`}>
            {part.value}
          </Box>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </Text>
  );
}

export function DiffLegend() {
  return (
    <Group gap="md">
      <Text size="sm" c="dimmed">
        Diff of generated against reference:
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
