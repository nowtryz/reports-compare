import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Kbd,
  MultiSelect,
  RangeSlider,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowRight,
  IconArrowsShuffle,
  IconDice5,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo } from "react";

import { countBy, formatScore, severityLabel } from "../data";
import type { Filters, Range, ScoredFile, Thresholds } from "../types";

interface Props {
  data: ScoredFile;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  filteredCount: number;
  onRandomStudy: () => void;
  /** Study id when the id search narrows the list to exactly one study, else null. */
  singleMatch: string | null;
  onOpenStudy: (studyId: string) => void;
  onRandomDisease: () => void;
  metric: string;
  thresholds: Thresholds;
  onThresholdsChange: (thresholds: Thresholds) => void;
}

export function Sidebar({
  data,
  filters,
  onFiltersChange,
  filteredCount,
  onRandomStudy,
  singleMatch,
  onOpenStudy,
  onRandomDisease,
  metric,
  thresholds,
  onThresholdsChange,
}: Props) {
  const set = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  const subsets = useMemo(
    () => countBy(data.studies.flatMap((s) => s.subsets)),
    [data],
  );
  // Disease options are counted within the selected subset so "random disease" stays in it.
  const inSubset = useMemo(
    () =>
      filters.subset ? data.studies.filter((s) => s.subsets.includes(filters.subset!)) : data.studies,
    [data, filters.subset],
  );
  const diseases = useMemo(
    () =>
      countBy(inSubset.flatMap((s) => Object.keys(s.presents))).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    [inSubset],
  );
  const severities = useMemo(
    () =>
      filters.disease
        ? countBy(
            inSubset
              .filter((s) => filters.disease! in s.presents)
              .map((s) => severityLabel(s.presents[filters.disease!])),
          )
        : [],
    [inSubset, filters.disease],
  );

  const metricLabel = data.metrics.find((m) => m.key === metric)?.label ?? metric;
  const setRange = (kind: keyof Thresholds, range: Range) =>
    onThresholdsChange({ ...thresholds, [kind]: { ...thresholds[kind], [metric]: range } });
  const resetRanges = () =>
    onThresholdsChange({
      section: { ...thresholds.section, [metric]: data.thresholds.section[metric] },
      report: { ...thresholds.report, [metric]: data.thresholds.report[metric] },
    });

  return (
    <Stack gap="md">
      <Text fw={600} size="sm" tt="uppercase" c="dimmed">
        Filters
      </Text>
      <Select
        label="Subset"
        placeholder={`All studies (${data.studies.length})`}
        data={subsets.map(([name, n]) => ({ value: name, label: `${name} (${n})` }))}
        value={filters.subset}
        onChange={(subset) => set({ subset, disease: null, severities: [] })}
        clearable
      />
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <Select
          label="Disease"
          placeholder="Any"
          data={diseases.map(([name, n]) => ({ value: name, label: `${name} (${n})` }))}
          value={filters.disease}
          onChange={(disease) => set({ disease, severities: [] })}
          searchable
          clearable
          style={{ flex: 1 }}
        />
        <Tooltip
          label={
            <>
              Random disease and one of its studies <Kbd size="xs">D</Kbd>
            </>
          }
        >
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Random disease"
            disabled={!diseases.length}
            onClick={onRandomDisease}
          >
            <IconArrowsShuffle size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {filters.disease && (
        <MultiSelect
          label="Severity"
          placeholder="Any"
          data={severities.map(([name, n]) => ({ value: name, label: `${name} (${n})` }))}
          value={filters.severities}
          onChange={(severities) => set({ severities })}
          clearable
        />
      )}
      <TextInput
        label="Study id"
        placeholder="st-…"
        leftSection={<IconSearch size={16} />}
        value={filters.query}
        onChange={(e) => set({ query: e.currentTarget.value })}
        onKeyDown={(e) => e.key === "Enter" && singleMatch && onOpenStudy(singleMatch)}
      />
      <Text size="sm" c="dimmed">
        {filteredCount} of {data.studies.length} studies
      </Text>
      {singleMatch ? (
        <Button
          leftSection={<IconArrowRight size={18} />}
          onClick={() => onOpenStudy(singleMatch)}
          rightSection={<Kbd size="xs">Enter</Kbd>}
        >
          Go to study
        </Button>
      ) : (
        <Button
          leftSection={<IconDice5 size={18} />}
          onClick={onRandomStudy}
          disabled={!filteredCount}
          rightSection={<Kbd size="xs">R</Kbd>}
        >
          Random study
        </Button>
      )}

      <Divider />

      <Group justify="space-between">
        <Text fw={600} size="sm" tt="uppercase" c="dimmed">
          {metricLabel} thresholds
        </Text>
        <Tooltip label="Reset to the file's percentiles">
          <ActionIcon variant="subtle" aria-label="Reset thresholds" onClick={resetRanges}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {(["section", "report"] as const).map((kind) => {
        const range = thresholds[kind][metric];
        return (
          <Stack key={kind} gap={6}>
            <Text size="sm">
              {kind === "section" ? "Sections" : "Reports (macro mean)"}:{" "}
              <Text span c="red.6" fw={600}>
                &lt; {formatScore(range[0])}
              </Text>{" "}
              ·{" "}
              <Text span c="green.6" fw={600}>
                ≥ {formatScore(range[1])}
              </Text>
            </Text>
            <RangeSlider
              min={0}
              max={1}
              step={0.005}
              minRange={0}
              value={range}
              onChange={(value) => setRange(kind, value)}
              label={(v) => v.toFixed(3)}
              color="orange"
              mb="xs"
            />
          </Stack>
        );
      })}
      <Text size="xs" c="dimmed">
        Defaults are the 33rd / 67th percentiles over the whole file.
      </Text>
    </Stack>
  );
}
