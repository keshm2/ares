import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { listResumeFiles, resumesDir, type ResumeFile } from "../resumes.js";
import { openPath, convertResumePdf, helperError } from "../helpers.js";
import { theme, statusGlyph } from "../theme.js";

/**
 * Resumes screen: shows what's in data/resumes/ against the 6 filenames
 * resume-tailor.md actually reads (agents/bodies/resume-tailor.md "Step 1
 * — Select base resume"), lets the user open that folder in the OS file
 * manager, and offers to convert a PDF that's missing its markdown
 * counterpart — the case that otherwise silently leaves the tailoring
 * agent unable to use a resume the user thinks they've already added.
 */
export function ResumesScreen({
  root,
  active,
  contentRows = 20,
}: {
  root: string;
  active: boolean;
  contentRows?: number;
}) {
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [nonce, setNonce] = useState(0); // re-scan the folder after open/convert

  const files: ResumeFile[] = listResumeFiles(root);
  const clampedCursor = Math.min(cursor, Math.max(0, files.length - 1));
  const selected = files[clampedCursor];
  const pendingCount = files.filter((f) => f.needsConversion).length;

  const rowStatus = (f: ResumeFile): { glyph: string; color?: string; text: string } => {
    if (f.hasMarkdown) return { glyph: statusGlyph.applied, color: theme.good, text: `${f.stem}.md` };
    if (f.needsConversion)
      return { glyph: statusGlyph.needs_review, color: theme.warn, text: "PDF found — press c to convert" };
    return { glyph: "—", text: "not added yet" };
  };

  useInput(
    (input, key) => {
      if (key.downArrow || input === "j") {
        setCursor((c) => Math.min(files.length - 1, c + 1));
        return;
      }
      if (key.upArrow || input === "k") {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (input === "o") {
        try {
          openPath(resumesDir(root));
          setMessage(`Opened ${resumesDir(root)}`);
          setMessageIsError(false);
        } catch (err) {
          setMessage(`Could not open the folder: ${helperError(err)}`);
          setMessageIsError(true);
        }
        return;
      }
      if ((input === "c" || key.return) && selected) {
        if (!selected.needsConversion) {
          setMessage(
            selected.hasMarkdown
              ? `${selected.stem}.md already exists — nothing to convert.`
              : `No PDF for ${selected.category ?? selected.stem} yet — add one to data/resumes/ first.`,
          );
          setMessageIsError(false);
          return;
        }
        setMessage(`Converting ${selected.stem}.pdf…`);
        setMessageIsError(false);
        const result = convertResumePdf(root, selected.stem);
        if (result.ok) {
          setMessage(`Converted — wrote ${selected.stem}.md (${result.chars} chars).`);
          setMessageIsError(false);
        } else {
          setMessage(`Conversion failed: ${result.error}`);
          setMessageIsError(true);
        }
        setNonce((n) => n + 1);
      }
    },
    { isActive: active && Boolean(process.stdin.isTTY) },
  );

  void nonce; // listResumeFiles re-reads the directory every render; nonce forces one after actions

  const listRows = Math.max(3, Math.min(files.length, contentRows - 8));

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        Resumes{" "}
        <Text dimColor>
          {pendingCount > 0 ? `${pendingCount} need${pendingCount === 1 ? "s" : ""} conversion` : "data/resumes/"}
        </Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        {files.slice(0, listRows).map((f, i) => {
          const focused = i === clampedCursor;
          const status = rowStatus(f);
          const label = f.category ?? f.stem;
          return (
            <Text key={f.stem} color={focused ? theme.accent : status.color} bold={focused} wrap="truncate-end">
              {focused ? ">" : " "} [{focused ? "x" : " "}] {label.padEnd(20)} {status.glyph} {status.text}
            </Text>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Folder: {resumesDir(root)}</Text>
        {selected && !selected.expected ? (
          <Text dimColor wrap="wrap">
            "{selected.stem}" isn't one of the filenames resume-tailor reads automatically — see docs/SETUP.md for the
            expected names.
          </Text>
        ) : null}
      </Box>

      {message ? (
        <Box marginTop={1}>
          <Text color={messageIsError ? theme.danger : undefined} dimColor={!messageIsError}>
            {message}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

export const RESUMES_HINTS = "↑↓ move · o open folder · c convert";
