import {
  ActionIcon,
  AppShell,
  Burger,
  Center,
  Group,
  Kbd,
  ScrollArea,
  SegmentedControl,
  Select,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import {
  IconColumns,
  IconFileUpload,
  IconGitCompare,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { LoadScreen } from "./components/LoadScreen";
import { Sidebar } from "./components/Sidebar";
import { StudiesTable } from "./components/StudiesTable";
import { StudyView } from "./components/StudyView";
import { SummaryView } from "./components/SummaryView";
import { applyFilters, pickRandom } from "./data";
import type {
  Filters,
  ScoredFile,
  SectionScope,
  TableState,
  TextMode,
  Thresholds,
} from "./types";

type Tab = "summary" | "studies" | "study";
type HistoryEntry = {
  tab: Tab;
  currentId: string | null;
  filters: Filters;
  table: TableState;
  sectionScope: SectionScope;
};

const NO_FILTERS: Filters = { subset: null, disease: null, severities: [], query: "" };
const DEFAULT_TABLE: TableState = { sort: { by: "score", desc: false }, page: 1 };

export default function App() {
  const [data, setData] = useState<ScoredFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [metric, setMetric] = useState("bleu4");
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [tab, setTab] = useState<Tab>("summary");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [table, setTable] = useState<TableState>(DEFAULT_TABLE);
  const [sectionScope, setSectionScope] = useState<SectionScope>("disease");
  // App-level so the chosen mode survives moving between studies (and reloading another file).
  const [textMode, setTextMode] = useState<TextMode>("diff");
  const toggleTextMode = () => setTextMode((m) => (m === "diff" ? "side-by-side" : "diff"));
  const [navOpened, { toggle: toggleNav }] = useDisclosure();
  const { setColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("light");

  const filtered = useMemo(() => (data ? applyFilters(data.studies, filters) : []), [data, filters]);
  const byId = useMemo(() => new Map(data?.studies.map((s) => [s.study_id, s])), [data]);
  const current = currentId ? byId.get(currentId) : undefined;
  // "Go to study": the id search matches one study in the whole file, even one the subset /
  // disease filters exclude; failing that, one study within the filtered list.
  const singleMatch = useMemo(() => {
    if (!data || !filters.query.trim()) return null;
    const anywhere = applyFilters(data.studies, { ...NO_FILTERS, query: filters.query });
    if (anywhere.length === 1) return anywhere[0].study_id;
    return filtered.length === 1 ? filtered[0].study_id : null;
  }, [data, filters.query, filtered]);
  const position = useMemo(() => {
    const i = filtered.findIndex((s) => s.study_id === currentId);
    return i < 0 ? null : i;
  }, [filtered, currentId]);

  // ---- Browser history: one entry per navigation (tab / study), carrying the filters too, so
  // Back from a study returns to the (filtered) list it was opened from. The URL never changes.
  const navigate = (next: HistoryEntry) => {
    if (next.tab !== tab || next.currentId !== currentId) window.history.pushState(next, "");
    setTab(next.tab);
    setCurrentId(next.currentId);
    setFilters(next.filters);
    setTable(next.table);
    setSectionScope(next.sectionScope);
  };
  // Picking a (new) disease shows its by-section scores; the summary toggle can switch back.
  const scopeFor = (next: Filters): SectionScope =>
    next.disease && next.disease !== filters.disease ? "disease" : sectionScope;
  // A different study list starts over at page 1 (sorting is kept).
  const changeFilters = (next: Filters) => {
    setFilters(next);
    setTable((t) => ({ ...t, page: 1 }));
    setSectionScope(scopeFor(next));
  };
  // Keeps the current entry up to date, e.g. after editing filters or paging without navigating.
  useEffect(() => {
    if (data) window.history.replaceState(
        { tab, currentId, filters, table, sectionScope } satisfies HistoryEntry,
        "",
      );
  }, [data, tab, currentId, filters, table, sectionScope]);
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const entry = event.state as HistoryEntry | null;
      setTab(entry?.tab ?? "summary");
      setCurrentId(entry?.currentId ?? null);
      setFilters(entry?.filters ?? NO_FILTERS);
      setTable(entry?.table ?? DEFAULT_TABLE);
      setSectionScope(entry?.sectionScope ?? "disease");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Going Back past the first entry would leave the page and drop the loaded file: ask first.
  useEffect(() => {
    if (!data) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [data]);

  const open = (studyId: string, nextFilters: Filters = filters) =>
    navigate({
      tab: "study",
      currentId: studyId,
      filters: nextFilters,
      table: nextFilters === filters ? table : { ...table, page: 1 },
      sectionScope: scopeFor(nextFilters),
    });
  // After the new study has rendered, otherwise the old page's scroll offset is kept.
  // Block body: recent Chromium returns a Promise from scrollTo, which React would call as cleanup.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentId, tab]);
  const openRandom = () => {
    const pick = pickRandom(filtered, current);
    if (pick) open(pick.study_id);
  };
  // Picks a disease present in the selected subset, filters on it and opens one of its studies.
  const openRandomDisease = () => {
    if (!data) return;
    const inSubset = applyFilters(data.studies, { ...NO_FILTERS, subset: filters.subset });
    const disease = pickRandom(
      [...new Set(inSubset.flatMap((s) => Object.keys(s.presents)))],
      filters.disease ?? undefined,
    );
    if (!disease) return;
    const next = { ...filters, disease, severities: [] };
    const pick = pickRandom(applyFilters(data.studies, next));
    if (pick) open(pick.study_id, next);
    else changeFilters(next);
  };
  const step = (delta: number) => {
    if (position === null || !filtered.length) return;
    open(filtered[(position + delta + filtered.length) % filtered.length].study_id);
  };

  useHotkeys([
    ["r", openRandom],
    ["d", openRandomDisease],
    ["v", toggleTextMode],
    ["ArrowLeft", () => tab === "study" && step(-1)],
    ["ArrowRight", () => tab === "study" && step(1)],
  ]);

  if (!data || !thresholds) {
    return (
      <LoadScreen
        onLoad={(loaded, name) => {
          setData(loaded);
          setFileName(name);
          setThresholds(structuredClone(loaded.thresholds));
          setMetric(loaded.metrics.some((m) => m.key === "bleu4") ? "bleu4" : loaded.metrics[0].key);
          setFilters(NO_FILTERS);
          setTable(DEFAULT_TABLE);
          setSectionScope("disease");
          setCurrentId(null);
          setTab("summary");
        }}
      />
    );
  }

  const isFiltered =
    filters.subset !== null || filters.disease !== null || filters.query.trim() !== "";

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 320, breakpoint: "md", collapsed: { mobile: !navOpened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={navOpened} onClick={toggleNav} hiddenFrom="md" size="sm" />
            <Title order={4} style={{ whiteSpace: "nowrap" }} visibleFrom="md">
              Report viewer
            </Title>
            <Text size="sm" c="dimmed" truncate visibleFrom="lg" maw={280}>
              {fileName}
            </Text>
          </Group>
          <SegmentedControl
            size="sm"
            value={tab}
            onChange={(value) => {
              if (value === "study" && !current) openRandom();
              else navigate({ tab: value as Tab, currentId, filters, table, sectionScope });
            }}
            data={[
              { value: "summary", label: "Summary" },
              { value: "studies", label: `Studies · ${filtered.length}` },
              { value: "study", label: "Study" },
            ]}
          />
          <Group gap="xs" wrap="nowrap">
            <Tooltip
              label={
                <>
                  Side-by-side or word diff <Kbd size="xs">V</Kbd>
                </>
              }
            >
              <SegmentedControl
                aria-label="Text display"
                value={textMode}
                onChange={(value) => setTextMode(value as TextMode)}
                data={[
                  {
                    value: "side-by-side",
                    label: (
                      <Center style={{ gap: 6 }}>
                        <IconColumns size={16} />
                        <span>Split</span>
                      </Center>
                    ),
                  },
                  {
                    value: "diff",
                    label: (
                      <Center style={{ gap: 6 }}>
                        <IconGitCompare size={16} />
                        <span>Diff</span>
                      </Center>
                    ),
                  },
                ]}
              />
            </Tooltip>
            <Select
              aria-label="Metric"
              data={data.metrics.map((m) => ({ value: m.key, label: m.label }))}
              value={metric}
              onChange={(value) => {
                if (!value) return;
                setMetric(value);
                setTable((t) => ({ ...t, page: 1 }));
              }}
              allowDeselect={false}
              w={120}
            />
            <Tooltip label="Load another file">
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Load another file"
                onClick={() => {
                  setData(null);
                  setThresholds(null);
                }}
              >
                <IconFileUpload size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Toggle color scheme">
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Toggle color scheme"
                onClick={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")}
              >
                {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Sidebar
            data={data}
            filters={filters}
            onFiltersChange={changeFilters}
            filteredCount={filtered.length}
            onRandomStudy={openRandom}
            singleMatch={singleMatch}
            onOpenStudy={(studyId) => open(studyId)}
            onRandomDisease={openRandomDisease}
            metric={metric}
            thresholds={thresholds}
            onThresholdsChange={setThresholds}
          />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {tab === "summary" && (
          <SummaryView
            data={data}
            filtered={filtered}
            filters={filters}
            isFiltered={isFiltered}
            metric={metric}
            thresholds={thresholds}
            scope={sectionScope}
            onScopeChange={setSectionScope}
          />
        )}
        {tab === "studies" && (
          <StudiesTable
            data={data}
            studies={filtered}
            metric={metric}
            thresholds={thresholds}
            table={table}
            onTableChange={setTable}
            onOpen={open}
          />
        )}
        {tab === "study" &&
          (current ? (
            <StudyView
              data={data}
              study={current}
              metric={metric}
              thresholds={thresholds}
              textMode={textMode}
              position={position}
              total={filtered.length}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onRandom={openRandom}
            />
          ) : (
            <Text c="dimmed">No study matches the filters.</Text>
          ))}
      </AppShell.Main>
    </AppShell>
  );
}
