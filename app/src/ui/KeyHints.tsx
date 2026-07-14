import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { gradientColor, hueColor, theme, SPARKLE_GRADIENT, SPINNER_FRAMES } from "../theme.js";

/**
 * Renders a hint string ("/ query · ↑↓ move · s save") with the key cap
 * of every chunk in the bold accent color and the description dimmed —
 * so the available commands read at a glance instead of being one dim
 * line. Chunks are "key description"; the first token is the key.
 */
export function KeyHints({ hints }: { hints: string }) {
  const chunks = hints.split(" · ").filter(Boolean);
  return (
    <Text>
      {chunks.map((chunk, i) => {
        const space = chunk.indexOf(" ");
        const key = space === -1 ? chunk : chunk.slice(0, space);
        const label = space === -1 ? "" : chunk.slice(space + 1);
        return (
          <Text key={i}>
            {i > 0 ? <Text color={theme.rule}> · </Text> : null}
            <Text bold color={theme.accent}>
              {key}
            </Text>
            {label ? <Text dimColor> {label}</Text> : null}
          </Text>
        );
      })}
    </Text>
  );
}

/**
 * Animated rainbow text for the MAX-cap warning: each character cycles
 * through the hue wheel. Animates only on a real TTY (a piped one-frame
 * render gets a static warning color so CI output stays deterministic).
 */
export function RainbowText({ children }: { children: string }) {
  const animate = Boolean(process.stdout.isTTY);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setOffset((o) => (o + 14) % 360), 90);
    return () => clearInterval(timer);
  }, [animate]);
  if (!animate) {
    return (
      <Text bold color={theme.danger}>
        {children}
      </Text>
    );
  }
  return (
    <Text bold>
      {Array.from(children).map((ch, i) => (
        <Text key={i} color={hueColor(offset + i * 16)}>
          {ch}
        </Text>
      ))}
    </Text>
  );
}

// Ping-pong period for SPARKLE_GRADIENT (5 stops -> 2*(5-1) = 8) — offset
// wraps here purely to keep the float from growing unbounded over a long
// session; gradientColor's own modulo makes the exact value harmless.
const SPARKLE_PERIOD = 2 * (SPARKLE_GRADIENT.length - 1);

/**
 * Animated sparkle text for AUTO mode: each character cycles through a
 * purple → white blend (SPARKLE_GRADIENT, the same two colors UpdateBox's
 * traveling border ring uses — see theme.ts) rather than the full hue
 * wheel, so "AUTO" reads as calm/purposeful instead of alarming. Same
 * animate-only-on-a-real-TTY fallback as RainbowText — a piped one-frame
 * render gets a static warn color.
 */
export function AutoSparkleText({ children }: { children: string }) {
  const animate = Boolean(process.stdout.isTTY);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setOffset((o) => (o + 0.35) % SPARKLE_PERIOD), 90);
    return () => clearInterval(timer);
  }, [animate]);
  if (!animate) {
    return (
      <Text bold color={theme.warn}>
        {children}
      </Text>
    );
  }
  return (
    <Text bold>
      {Array.from(children).map((ch, i) => (
        <Text key={i} color={gradientColor(offset + i * 0.6, SPARKLE_GRADIENT)}>
          {ch}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Cycling "working" glyph (SPINNER_FRAMES: . -> · -> • -> * -> • -> ·),
 * the Claude-Code-style activity indicator — a symbol that visibly
 * changes on its own, not just a color animation, so "something is
 * happening" reads even for someone not looking closely at hue shifts.
 * Non-TTY fallback renders the first frame statically, matching the
 * other animated components' pattern.
 */
export function SpinnerGlyph({ color }: { color?: string } = {}) {
  const animate = Boolean(process.stdout.isTTY);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 140);
    return () => clearInterval(timer);
  }, [animate]);
  return (
    <Text bold color={color ?? theme.accent}>
      {SPINNER_FRAMES[animate ? frame : 0]}
    </Text>
  );
}
