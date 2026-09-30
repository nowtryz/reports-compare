import {
  Box,
  Button,
  Group,
  Paper,
  Popover,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconHelpCircle } from "@tabler/icons-react";
import { useMemo } from "react";

import { formatScore, mean } from "../data";
import type { Filters, ScoredFile, Scores, SectionScope, Study, Thresholds } from "../types";
import { ScoreDot } from "./ScoreDot";

interface Props {
  data: ScoredFile;
  filtered: Study[];
  filters: Filters;
  isFiltered: boolean;
  metric: string;
  thresholds: Thresholds;
  /** Owned by App (browser history); App switches it to "disease" when a disease is picked. */
  scope: SectionScope;
  onScopeChange: (scope: SectionScope) => void;
}

type SectionMeans = { bySection: Record<string, Scores>; all: Scores };

/** Per-section (and all-section) means of the sentence-level scores, plus pair counts `n`. */
function sectionMeans(data: ScoredFile, studies: Study[]): SectionMeans {
  const collect = (pairs: Scores[]): Scores => {
    const out: Scores = { n: pairs.length };
    for (const { key } of data.metrics) {
      const value = mean(pairs.map((p) => p[key]));
      if (value !== undefined) out[key] = value;
    }
    return out;
  };
  const bySection: Record<string, Scores> = {};
  for (const { key } of data.sections) {
    bySection[key] = collect(studies.flatMap((s) => (s.scores[key] ? [s.scores[key]] : [])));
  }
  return { bySection, all: collect(studies.flatMap((s) => Object.values(s.scores))) };
}

// Native MathML (rendered by the browser, no math library to inline).
const meanOver = (set: string, term: string) =>
  `<mfrac><mn>1</mn><mrow><mo>|</mo><msub><mi>${set}</mi><mtext>sec</mtext></msub><mo>|</mo></mrow></mfrac>` +
  `<munder><mo>∑</mo><mrow><mi>s</mi><mo>∈</mo><msub><mi>${set}</mi><mtext>sec</mtext></msub></mrow></munder>` +
  term;
const DELTA_MATHML =
  `<math display="block"><mrow><msub><mi>Δ</mi><mtext>sec</mtext></msub><mo>=</mo>` +
  meanOver("D", "<mi>m</mi><mo>(</mo><mi>s</mi><mo>,</mo><mtext>sec</mtext><mo>)</mo>") +
  `<mo>−</mo>` +
  meanOver("F", "<mi>m</mi><mo>(</mo><mi>s</mi><mo>,</mo><mtext>sec</mtext><mo>)</mo>") +
  `</mrow></math>`;
const BLEU_MATHML =
  `<math display="block"><mrow>` +
  `<msub><mtext>BLEU</mtext><mtext>corpus</mtext></msub><mo>(</mo><msub><mi>F</mi><mtext>sec</mtext></msub><mo>)</mo>` +
  `<mo>≠</mo>` +
  meanOver("F", "<mtext>BLEU</mtext><mo>(</mo><mi>s</mi><mo>,</mo><mtext>sec</mtext><mo>)</mo>") +
  `</mrow></math>`;

function MathBlock({ mathml }: { mathml: string }) {
  return <Box fz="md" my={4} dangerouslySetInnerHTML={{ __html: mathml }} />;
}

function ScoresDifferHelp() {
  return (
    <Popover width={420} position="bottom-start" withArrow shadow="md">
      <Popover.Target>
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconHelpCircle size={16} />}
        >
          Why do scores differ between views?
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm">
            <b>Whole file</b> shows corpus scores. <b>Disease</b> shows the mean of the per-study
            section scores for the selected studies.
          </Text>
          <Text size="sm">
            For <b>ROUGE</b> and <b>METEOR</b> these are the same thing: the corpus score is the mean
            over section pairs.
          </Text>
          <Text size="sm">
            <b>BLEU</b> differs: corpus BLEU pools n-gram counts over all studies before computing
            precision, which is not the average of per-study BLEU. The viewer only has per-study
            scores, so it cannot compute corpus BLEU for a subset.
          </Text>
          <MathBlock mathml={BLEU_MATHML} />
          <Text size="sm">
            The <b>±</b> values therefore compare means with means:
          </Text>
          <MathBlock mathml={DELTA_MATHML} />
          <Text size="xs" c="dimmed">
            D: studies matching the filters, F: all studies in the file, restricted to those with
            section sec; m: the selected metric. So a disease's BLEU can look lower than the
            whole-file corpus BLEU and still have Δ &gt; 0.
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function Delta({ value, reference }: { value?: number; reference?: number }) {
  if (value === undefined || reference === undefined) return null;
  const delta = value - reference;
  const zero = Math.abs(delta) < 0.0005; // rounds to 0.000
  return (
    <Text span size="xs" c={zero ? "dimmed" : delta > 0 ? "green.6" : "red.6"} ff="monospace" ml={6}>
      {zero ? "±" : delta > 0 ? "+" : "−"}
      {Math.abs(delta).toFixed(3)}
    </Text>
  );
}

export function SummaryView({
  data,
  filtered,
  filters,
  isFiltered,
  metric,
  thresholds,
  scope,
  onScopeChange,
}: Props) {
  const { overall, by_section } = data.corpus;
  const metricLabel = data.metrics.find((m) => m.key === metric)?.label ?? metric;

  const effectiveScope: SectionScope = filters.disease ? scope : "file";

  // Filtered-set scores can't reproduce corpus BLEU (no n-gram counts client-side), so they are
  // means of the section scores, compared against the same means over the whole file.
  const fileMeans = useMemo(() => sectionMeans(data, data.studies), [data]);
  const filteredMeans = useMemo(() => sectionMeans(data, filtered), [data, filtered]);
  const filteredReport = useMemo(
    () => mean(filtered.map((s) => s.report_scores[metric])),
    [filtered, metric],
  );

  const diseaseLabel = filters.disease
    ? `${filters.disease}${filters.severities.length ? ` · ${filters.severities.join(" / ")}` : ""}`
    : "";

  const meta = data.meta as Record<string, unknown>;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={3}>Corpus scores</Title>
        <Text size="sm" c="dimmed">
          Whole file, {overall.n} section pairs over {data.studies.length} studies. BLEU is corpus
          BLEU (pooled n-grams), ROUGE and METEOR are means over section pairs.
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        {data.metrics.map((m) => (
          <Paper
            key={m.key}
            withBorder
            p="md"
            style={m.key === metric ? { borderColor: "var(--mantine-primary-color-filled)" } : undefined}
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {m.label}
            </Text>
            <Text size="xl" fw={700} ff="monospace">
              {formatScore(overall[m.key])}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      {isFiltered && (
        <Paper withBorder p="md">
          <Group gap="sm">
            <ScoreDot value={filteredReport} range={thresholds.report[metric]} size={14} />
            <Text>
              Filtered set ({filtered.length} studies): mean report {metricLabel}{" "}
              <Text span fw={700} ff="monospace">
                {formatScore(filteredReport)}
              </Text>
            </Text>
          </Group>
        </Paper>
      )}

      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Title order={4}>By section</Title>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {effectiveScope === "file"
                ? "Whole file, corpus scores as above."
                : `Mean scores over ${filtered.length} studies (${diseaseLabel}), ± vs the whole file.`}
            </Text>
            {filters.disease && <ScoresDifferHelp />}
          </Group>
        </Stack>
        {filters.disease && (
          <SegmentedControl
            value={effectiveScope}
            onChange={(value) => onScopeChange(value as SectionScope)}
            data={[
              { value: "file", label: "Whole file" },
              { value: "disease", label: diseaseLabel },
            ]}
          />
        )}
      </Group>

      <Table.ScrollContainer minWidth={720}>
        <Table striped highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Section</Table.Th>
              <Table.Th ta="right">Pairs</Table.Th>
              {data.metrics.map((m) => (
                <Table.Th key={m.key} ta="right" fw={m.key === metric ? 800 : undefined}>
                  {m.label}
                </Table.Th>
              ))}
              {effectiveScope === "file" && isFiltered && (
                <Table.Th ta="right">Filtered mean {metricLabel}</Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.sections.map(({ key, title }) => {
              const scores =
                effectiveScope === "file" ? by_section[key] : filteredMeans.bySection[key];
              if (!scores?.n) return null;
              return (
                <Table.Tr key={key}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" style={{ whiteSpace: "nowrap" }}>
                      <ScoreDot value={scores[metric]} range={thresholds.section[metric]} />
                      {title}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    {scores.n}
                  </Table.Td>
                  {data.metrics.map((m) => (
                    <Table.Td
                      key={m.key}
                      ta="right"
                      ff="monospace"
                      fw={m.key === metric ? 700 : undefined}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {formatScore(scores[m.key])}
                      {effectiveScope === "disease" && (
                        <Delta value={scores[m.key]} reference={fileMeans.bySection[key]?.[m.key]} />
                      )}
                    </Table.Td>
                  ))}
                  {effectiveScope === "file" && isFiltered && (
                    <Table.Td ta="right" ff="monospace">
                      {formatScore(filteredMeans.bySection[key]?.[metric])}
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
            {effectiveScope === "disease" && (
              <Table.Tr fw={700}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" style={{ whiteSpace: "nowrap" }}>
                    <ScoreDot value={filteredMeans.all[metric]} range={thresholds.section[metric]} />
                    All sections
                  </Group>
                </Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {filteredMeans.all.n}
                </Table.Td>
                {data.metrics.map((m) => (
                  <Table.Td key={m.key} ta="right" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                    {formatScore(filteredMeans.all[m.key])}
                    <Delta value={filteredMeans.all[m.key]} reference={fileMeans.all[m.key]} />
                  </Table.Td>
                ))}
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Title order={4}>Run</Title>
      <Table variant="vertical" layout="fixed" withTableBorder>
        <Table.Tbody>
          {["checkpoint", "stage", "text_model", "max_new_tokens", "descriptor", "generated"].map(
            (key) =>
              meta[key] !== undefined && (
                <Table.Tr key={key}>
                  <Table.Th w={160}>{key}</Table.Th>
                  <Table.Td style={{ wordBreak: "break-all" }} ff="monospace" fz="sm">
                    {String(meta[key])}
                  </Table.Td>
                </Table.Tr>
              ),
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
