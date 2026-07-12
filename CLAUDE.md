# Ares — Claude Code harness rules

**`AGENTS.md` is the canonical behavioral ruleset for this repo.** Read
it before doing anything; everything there binds any agent operating in
this repo, regardless of harness.

## Operator rules (restated from docs/PLAN.md §2 — these bind you)

- Work **one phase at a time**. Do not start a phase (or the next one)
  without the operator's explicit go-ahead; stop after printing the
  phase summary.
- **All state writes go through the helpers** (`scripts/job_state.py`,
  `scripts/append_state_entry.sh`). Never hand-write or hand-edit
  `data/*.json` / `data/*.jsonl`.
- **Gitignored files stay uncommitted**: live configs in
  `config/*.json`, everything in `data/`, `logs/`, `docs/PLAN.md`, and
  `data/resumes/` hold PII/secrets and never enter git.
- Do not introduce a new model name, MCP server, or permission surface
  without explicit operator approval.

## Harness notes

- The agent definitions in `.claude/agents/` and `.opencode/agents/`
  are **generated** from `agents/bodies/` +
  `agents/frontmatter/<harness>/` by
  `scripts/generate_agent_definitions.py`. Edit the sources, then
  regenerate — never the generated files.
- Runtime runs go through `scripts/run_job_agent.sh`, which selects the
  harness (opencode or Claude Code) via `config/harness.json`,
  `$ARES_HARNESS`, or auto-detection. Claude Code is both a supported
  runtime driver and a development harness here.
- Playwright MCP for this project is configured in `.mcp.json`;
  headless permissions in `.claude/settings.json`.
