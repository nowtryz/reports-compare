import { Alert, Center, Code, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconFileAnalytics, IconUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { parseScoredFile } from "../data";
import type { ScoredFile } from "../types";

interface Props {
  onLoad: (data: ScoredFile, fileName: string) => void;
}

export function LoadScreen({ onLoad }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      onLoad(parseScoredFile(await file.text()), file.name);
    } catch (e) {
      setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="100vh" p="md">
      <Stack w="100%" maw={640} gap="lg">
        <Stack gap={4}>
          <Title order={2}>Report viewer</Title>
          <Text c="dimmed">
            Generated vs reference findings, scored with BLEU / ROUGE / METEOR. Nothing leaves
            this browser: the file is read locally.
          </Text>
        </Stack>
        <Dropzone
          onDrop={load}
          onReject={() => setError("expected a single .json file")}
          accept={["application/json", ".json"]}
          multiple={false}
          loading={loading}
        >
          <Group justify="center" gap="lg" mih={180} style={{ pointerEvents: "none" }}>
            <Dropzone.Accept>
              <IconUpload size={48} stroke={1.5} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX size={48} stroke={1.5} />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconFileAnalytics size={48} stroke={1.5} />
            </Dropzone.Idle>
            <Stack gap={4}>
              <Text size="lg">Drop a scored file here, or click to pick one</Text>
              <Text size="sm" c="dimmed">
                <Code>generated-reports.scored.json</Code> from{" "}
                <Code>scripts/score_generated_reports.py</Code>
              </Text>
            </Stack>
          </Group>
        </Dropzone>
        {loading && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm">Parsing…</Text>
          </Group>
        )}
        {error && (
          <Alert color="red" title="Could not load the file">
            {error}
          </Alert>
        )}
      </Stack>
    </Center>
  );
}
