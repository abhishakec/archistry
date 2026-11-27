# Archistry evals

Three layers, from cheapest to most expensive. Run them before changing
SKILL.md, a reference or a script, and again after.

1. **Regression** (`node evals/regress.mjs . out.json`). Builds all 49 types and
   the shipped examples, validates them, round-trips draw.io and HTML, and runs
   the CLI commands. It prints a summary and writes a JSON of exit codes and
   output hashes. Run it on the old and the new copy and compare the two JSON
   files: any difference is a functional change. It needs only Node.
2. **Trigger evals** (`trigger-evals.json`). 35 realistic prompts: 25 that
   should load this skill and 10 near-misses that should not (Mermaid, AWS,
   Apex, charts, slides, user stories). Run each in a fresh `claude -p` session
   in a project that has the skill installed, stop at the first tool calls and
   check whether the Skill tool loaded `archistry`. Run each prompt more than
   once; the result varies. Measured on the shipped description (2026-11-27): 25
   of 25 should-trigger and 9 of 10 should-not. The one known miss is the AWS
   data-lake prompt, which loads the skill in a project where it is the only
   diagram skill; an explicit "not for AWS" in the description did not change
   that (0 of 3), so it was left out.
3. **Behaviour evals** (`cases.json`). Eleven realistic requests with what a
   good result contains. Run each with the skill and with the previous version,
   and compare: the diagram type chosen, the build line, the files produced, the
   honesty of the reply. Subjective quality (does the picture read well) needs a
   human looking at the exported image.

Things the evals found, kept here so they are not forgotten: PNG/JPG export can
fail on Windows when the Edge launcher returns before the headless browser
writes its output, while `archistry doctor` still reports the browser as found.
SKILL.md step 6 says what to do.

About the description: the Agent Skills spec limits it to 1,024 characters, and
a longer one stopped the skill loading in some harnesses, so it is kept at about
1,000. Triggering is sensitive to wording: earlier shorter rewrites lowered
triggering on service blueprint, branching strategy and similar prompts, and
adding "or document" plus "lead or case handling" was what brought
process-documentation requests in. Do not reword it without re-running these
prompts, several times each.

Behaviour on 2026-11-27 (Sonnet, one run per case): 6 of 11 cases pass every
automatic check. The misses: a "data model for the BA team" request answered as
Markdown without loading the skill (case 2), an ERD built by reading the XML
instead of `erd-from-sfdx` (case 4), the lead process drawn without its state
lifecycle (case 5), and invented detail not flagged as illustrative (cases 7 and
9 vary run to run). In a real project, `archistry setup` puts the "always use
Archistry" rule in the agent's instructions, which these skill-only eval
projects do not have.

## Recording results (picked up by Command Centre)

Command Centre finds evals for any skill and derives a quality score from the
saved results, so save each run under `evals/results/`:

- Trigger: `node evals/trigger-run.mjs <project> evals/trigger-evals.json`
  writes `results/trigger-latest.json` by default.
- Behaviour:
  `node evals/behaviour-run.mjs <skill-dir> evals/cases.json <out-dir> 2`, then
  `node evals/behaviour-score.mjs <out-dir>` grades the cases and writes
  `results/behaviour-latest.json`.

The score is behaviour pass rate (45), trigger recall (25), trigger precision
(15) and description fit (15). No saved results, no score.

## Running on Windows

- An npm install of Claude Code has no `claude.exe`, so set `CLAUDE_CLI` to its
  `cli.js` (for example
  `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js`); both runners
  then start sessions through Node.
- Do not run the trigger and behaviour suites at the same time. Under that load
  sessions time out before their first tool call, and the Claude Code CLI can
  crash at start-up (`Maximum call stack size exceeded`, with a stderr file of
  several GB). Run them one after the other at concurrency 2, and re-run any
  case that ended with `timeout` or no turns before you read the score.
