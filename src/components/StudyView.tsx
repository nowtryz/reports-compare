import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Group,
  Kbd,
  Paper,
  SimpleGrid,
  Spoiler,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconChevronLeft, IconChevronRight, IconCopy, IconDice5 } from "@tabler/icons-react";

import { formatScore, severityLabel } from "../data";
import type { ScoredFile, Study, TextMode, Thresholds } from "../types";
import { ScoreDot } from "./ScoreDot";
import { DiffLegend, WordDiff } from "./WordDiff";

interface Props {
  data: ScoredFile;
  study: Study;
  metric: string;
  thresholds: Thresholds;
  textMode: TextMode;
  position: number | null; // index in the filtered list, null when the study is filtered out
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onRandom: () => void;
}

export function StudyView({
  data,
  study,
  metric,
  thresholds,
  textMode,
  position,
  total,
  onPrev,
  onNext,
  onRandom,
}: Props) {
  const metricLabel = data.metrics.find((m) => m.key === metric)?.label ?? metric;
  const sections = data.sections.filter(({ key }) => key in study.ground_truth);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={6}>
          <Group gap="sm">
            <ScoreDot value={study.report_scores[metric]} range={thresholds.report[metric]} size={18} />
            <Title order={3} ff="monospace">
              {study.study_id}
            </Title>
            <CopyButton value={study.study_id}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy study id"}>
                  <ActionIcon variant="subtle" onClick={copy} aria-label="Copy study id">
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Text>
            Report {metricLabel} (macro mean of {sections.length} sections):{" "}
            <Text span fw={700} ff="monospace">
              {formatScore(study.report_scores[metric])}
            </Text>
          </Text>
        </Stack>
        <Group gap="xs">
          <Button variant="default" leftSection={<IconChevronLeft size={16} />} onClick={onPrev} disabled={position === null}>
            Prev
          </Button>
          <Text size="sm" c="dimmed" miw={70} ta="center">
            {position === null ? "not in filter" : `${position + 1} / ${total}`}
          </Text>
          <Button variant="default" rightSection={<IconChevronRight size={16} />} onClick={onNext} disabled={position === null}>
            Next
          </Button>
          <Button leftSection={<IconDice5 size={16} />} rightSection={<Kbd size="xs">R</Kbd>} onClick={onRandom}>
            Random
          </Button>
        </Group>
      </Group>

      <Group gap="xs">
        {study.subsets.map((s) => (
          <Badge key={s} color="grape" variant="light" tt="none">
            {s}
          </Badge>
        ))}
        {Object.entries(study.presents).map(([disease, severity]) => (
          <Badge key={disease} variant="light" tt="none">
            {disease} · {severityLabel(severity)}
          </Badge>
        ))}
        {!Object.keys(study.presents).length && (
          <Badge color="gray" variant="light" tt="none">
            No disease listed
          </Badge>
        )}
      </Group>
      <Spoiler maxHeight={22} showLabel="Show all views" hideLabel="Hide views" fz="sm">
        <Text size="sm" c="dimmed">
          Views ({study.views.length}): {study.views.join(", ")}
        </Text>
      </Spoiler>
      {textMode === "diff" && <DiffLegend />}

      {sections.map(({ key, title }) => {
        const scores = study.scores[key] ?? {};
        return (
          <Paper key={key} withBorder p="md">
            <Group justify="space-between" mb="sm" wrap="nowrap" align="flex-start">
              <Group gap="sm" wrap="nowrap">
                <ScoreDot value={scores[metric]} range={thresholds.section[metric]} size={14} />
                <Title order={5} style={{ whiteSpace: "nowrap" }}>
                  {title}
                </Title>
                <Text ff="monospace" fz="sm" fw={700}>
                  {formatScore(scores[metric])}
                </Text>
              </Group>
              <Group gap="md" visibleFrom="sm">
                {data.metrics
                  .filter((m) => m.key !== metric)
                  .map((m) => (
                    <Text key={m.key} size="xs" c="dimmed" ff="monospace">
                      {m.label} {formatScore(scores[m.key])}
                    </Text>
                  ))}
              </Group>
            </Group>
            {textMode === "diff" ? (
              <WordDiff reference={study.ground_truth[key]} generated={study.generated[key] ?? ""} />
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Stack gap={4}>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                    Reference
                  </Text>
                  <Text>{study.ground_truth[key]}</Text>
                </Stack>
                <Stack gap={4}>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                    Generated
                  </Text>
                  <Text>{study.generated[key] || <Text span c="dimmed">(empty)</Text>}</Text>
                </Stack>
              </SimpleGrid>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
