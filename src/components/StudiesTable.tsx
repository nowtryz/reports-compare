import { Badge, Group, Pagination, Stack, Table, Text, UnstyledButton } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconSelector } from "@tabler/icons-react";
import { useMemo } from "react";

import { formatScore, severityLabel } from "../data";
import type { ScoredFile, Study, TableState, Thresholds } from "../types";
import { ScoreDot } from "./ScoreDot";

const PAGE_SIZE = 50;

type Sort = TableState["sort"];

interface Props {
  data: ScoredFile;
  studies: Study[];
  metric: string;
  thresholds: Thresholds;
  /** Owned by App so it is saved in the browser history; the page resets on filter/metric change there. */
  table: TableState;
  onTableChange: (table: TableState) => void;
  onOpen: (studyId: string) => void;
}

export function StudiesTable({
  data,
  studies,
  metric,
  thresholds,
  table,
  onTableChange,
  onOpen,
}: Props) {
  const { sort } = table;

  const sorted = useMemo(() => {
    const out = [...studies];
    out.sort((a, b) =>
      sort.by === "score"
        ? a.report_scores[metric] - b.report_scores[metric]
        : a.study_id.localeCompare(b.study_id),
    );
    return sort.desc ? out.reverse() : out;
  }, [studies, sort, metric]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(table.page, pages);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setPage = (next: number) => onTableChange({ ...table, page: next });

  const toggle = (by: Sort["by"]) =>
    onTableChange({
      sort: sort.by === by ? { by, desc: !sort.desc } : { by, desc: by === "score" },
      page: 1,
    });
  const SortIcon = ({ by }: { by: Sort["by"] }) => {
    const Icon = sort.by !== by ? IconSelector : sort.desc ? IconArrowDown : IconArrowUp;
    return <Icon size={14} />;
  };

  const metricLabel = data.metrics.find((m) => m.key === metric)?.label ?? metric;

  return (
    <Stack gap="md">
      <Table.ScrollContainer minWidth={900}>
        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>
                <UnstyledButton onClick={() => toggle("id")}>
                  <Group gap={4}>
                    Study <SortIcon by="id" />
                  </Group>
                </UnstyledButton>
              </Table.Th>
              <Table.Th>
                <UnstyledButton onClick={() => toggle("score")}>
                  <Group gap={4} wrap="nowrap">
                    Report {metricLabel} <SortIcon by="score" />
                  </Group>
                </UnstyledButton>
              </Table.Th>
              <Table.Th>Sections</Table.Th>
              <Table.Th>Diseases</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((s) => (
              <Table.Tr key={s.study_id} onClick={() => onOpen(s.study_id)} style={{ cursor: "pointer" }}>
                <Table.Td ff="monospace" fz="sm" style={{ whiteSpace: "nowrap" }}>
                  {s.study_id}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <ScoreDot value={s.report_scores[metric]} range={thresholds.report[metric]} size={14} />
                    <Text ff="monospace" fz="sm">
                      {formatScore(s.report_scores[metric])}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    {data.sections.map(({ key, title }) => (
                      <ScoreDot
                        key={key}
                        value={s.scores[key]?.[metric]}
                        range={thresholds.section[metric]}
                        label={title}
                        size={10}
                      />
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {Object.entries(s.presents).map(([disease, severity]) => (
                      <Badge key={disease} variant="light" size="sm" tt="none">
                        {disease} · {severityLabel(severity)}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {!rows.length && (
        <Text c="dimmed" ta="center">
          No study matches the filters.
        </Text>
      )}
      {pages > 1 && <Pagination value={page} onChange={setPage} total={pages} withEdges />}
    </Stack>
  );
}
