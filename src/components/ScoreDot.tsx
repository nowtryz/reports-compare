import { Box, Tooltip } from "@mantine/core";

import { formatScore, level, LEVEL_COLORS } from "../data";
import type { Range } from "../types";

interface Props {
  value: number | undefined;
  range: Range;
  label?: string;
  size?: number;
}

/** Red / orange / green dot for a score against [lower, upper] cutoffs; hollow when absent. */
export function ScoreDot({ value, range, label, size = 12 }: Props) {
  const absent = value === undefined;
  const tip = absent ? `${label ?? "section"}: absent` : `${label ? `${label}: ` : ""}${formatScore(value)}`;
  return (
    <Tooltip label={tip} withArrow openDelay={150}>
      <Box
        component="span"
        aria-label={tip}
        style={{
          display: "inline-block",
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: "50%",
          background: absent ? "transparent" : LEVEL_COLORS[level(value, range)],
          border: absent ? "1.5px solid var(--mantine-color-dimmed)" : undefined,
          opacity: absent ? 0.5 : 1,
        }}
      />
    </Tooltip>
  );
}
