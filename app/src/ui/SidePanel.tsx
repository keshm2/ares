import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { RainbowText } from "./KeyHints.js";
import type { Heartbeat } from "../state.js";
import { theme, BUILD_MARKER, SIDE_PANEL_WIDTH } from "../theme.js";

type Mode = "manual" | "automatic";

/** Rotating per-launch greetings above the rainbow name. */
const GREETINGS = ["Hello,", "Welcome,", "Nice to see you,", "Hey there,"] as const;

/**
 * Persistent right-side status panel. Shown beside the content region
 * when the terminal is wide and tall enough (see App's showSidebar); on
 * narrower/shorter terminals it hides and the content takes the full
 * width. The panel owns its own 1 s clock state so only it re-renders —
 * the parent App and active screen are unaffected. The parent wraps the
 * panel in a bordered Box whose left border is the separator between
 * main content and sidebar; paddingLeft here pads content away from it.
 *
 * The rainbow greeting shows the user's first name once setup has
 * written safe_fields.first_name; before that it falls back to the
 * placeholder. The clock is local time, 12-hour, with the time zone.
 */
export function SidePanel({
  firstName,
  applied,
  pending,
  failed,
  seen,
  heartbeat,
  screen,
  mode,
}: {
  firstName?: string;
  applied: number;
  pending: number;
  failed: number;
  seen: number;
  heartbeat?: Heartbeat;
  screen: string;
  mode: Mode;
}) {
  // One greeting per app open — chosen when the panel mounts, stable for
  // the whole session so it doesn't flicker on re-renders.
  const [greeting] = useState(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  // Local 12-hour clock with the zone abbreviation (e.g. "03:07:09 PM EDT").
  const timeStr = now.toLocaleTimeString("en-US", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const health = heartbeat
    ? heartbeat.last_run_exit_code === 0
      ? { label: "healthy", color: theme.good }
      : { label: `exit ${heartbeat.last_run_exit_code}`, color: theme.danger }
    : { label: "off", color: undefined };

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <Box>
      <Text dimColor>{label.padEnd(8)}</Text>
      <Text bold color={color} wrap="truncate-end">
        {value}
      </Text>
    </Box>
  );

  return (
    <Box flexDirection="column" width={SIDE_PANEL_WIDTH} paddingLeft={1}>
      <Text dimColor>{greeting}</Text>
      <RainbowText>{firstName ?? "Test User"}</RainbowText>

      <Box marginTop={1} flexDirection="column">
        <Text bold>{dateStr}</Text>
        <Text bold color={theme.accent} wrap="truncate-end">
          {timeStr}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Row label="Screen" value={screen} color={theme.accent} />
        <Row
          label="Mode"
          value={mode === "manual" ? "MANUAL" : "AUTO"}
          color={mode === "manual" ? theme.accent : theme.warn}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Row label="Applied" value={String(applied)} color={theme.good} />
        <Row label="Queue" value={String(pending)} color={pending > 0 ? theme.warn : undefined} />
        <Row label="Failed" value={String(failed)} color={failed > 0 ? theme.danger : undefined} />
        <Row label="Seen" value={String(seen)} />
        <Row label="Sched" value={health.label} color={health.color} />
      </Box>

      {/* Flex spacer pins the build marker to the bottom of the panel. */}
      <Box flexGrow={1} />
      <Box paddingTop={1}>
        <Text dimColor>build {BUILD_MARKER}</Text>
      </Box>
    </Box>
  );
}
