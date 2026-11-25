# Contributing to Archistry

Thanks for helping. Archistry is a small, dependency-free Node.js tool that turns a JSON spec into a draw.io file and an interactive HTML page. You do not need to be a developer to help: a wrong Salesforce notation, a missing icon or a confusing sentence in `SKILL.md` is a real contribution.

## Ways to contribute

- **A new diagram type.** The best additions come from real project work: what do you draw on Salesforce projects that is not here yet?
- **Notation and accuracy.** A relationship drawn wrongly, an outdated product name, a better default for a type.
- **Layout engines and the viewer.** Overlaps, clipped labels, odd routing, the HTML viewer and editor (`assets/viewer/`).
- **Icons.** Missing Salesforce product or cloud icons (see `assets/icons/` and the licence note there).
- **Examples and docs.** Better examples, clearer `references/*.md`, README fixes.
- **Evals.** Prompts where the skill is not picked up, or where an agent goes wrong (see [`evals/`](evals/README.md)).
- **Bug reports.** A spec that fails, a diagram that looks wrong, a command that errors. Use the issue templates.

## Set up

You need Node.js 18 or later. There is nothing to install.

```bash
git clone https://github.com/abhishakec/archistry.git
cd archistry
node scripts/archistry.mjs doctor      # checks Node, the browser and runs a self-test
node scripts/archistry.mjs types       # lists every diagram type
```

PNG and JPG export need Chrome, Edge or Chromium. Everything else needs only Node.

## The checks every change must pass

Run these before you open a pull request. CI runs the same ones on Linux and Windows.

```bash
# 1. Every example still builds and validates (also rewrites previews and the README gallery)
node scripts/build-examples.mjs --no-png

# 2. Nothing that already worked has changed
node evals/regress.mjs . after.json
```

`evals/regress.mjs` builds every type and the shipped examples, validates them, round-trips draw.io and HTML, and runs the CLI commands. It writes a JSON of exit codes and output hashes. To prove a change is safe, run it on a clean checkout of `main` too (`node evals/regress.mjs <path-to-main-checkout> before.json`) and compare the two files: for every existing type the `drawio`, `svg`, `validate` and `roundTrip` fields must match. **Existing diagrams must stay byte-identical** unless your change is meant to alter them, and then say so in the pull request. New types and HTML viewer changes naturally add or change entries.

If you changed what the agent is told (`SKILL.md`, `references/`), also run the evals in [`evals/README.md`](evals/README.md). Triggering is sensitive to wording: even a shorter description with the same keywords has made the skill load less often, so check before and after.

## Adding a diagram type

A type is a name, a stage, a layout engine and a question it answers. Prefer an existing engine (`blocks`, `flow`, `tree`, `matrix`, `timeline`, `journey`, `sequence`, `tables`, `mapping`, `aim`, `wireframe`) with different defaults over a new one.

1. **Register it** in `scripts/lib/types.mjs`: add a `T(...)` line to `TYPES` (name, stage, engine, the question it answers, engine defaults, aliases) and a one-sentence request to `ASKS`. Aliases must not collide with existing ones.
2. **Write the example** `examples/<type>.json`. `archistry init <type>` prints this file as the starter, so make it realistic, short-labelled and clearly illustrative (see the authoring rules in `SKILL.md`).
3. **Build it clean:** `node scripts/archistry.mjs build examples/<type>.json` must print `OK` with no `WARNING` lines, and `archistry validate examples/<type>.drawio` must pass.
4. **Document it** in the matching `references/<engine>.md`: when to use it, the fields that matter, a compact example.
5. **List it** in the `SKILL.md` catalogue table and, if it belongs in a typical set, the paragraph below it.
6. **Regenerate the gallery:** `node scripts/build-examples.mjs <type>` writes the `.drawio`, `.html` and preview PNG. Run it without arguments (with `--no-png` if you have no browser) to refresh the README gallery and counts.
7. **Add evals:** one or two prompts in `evals/trigger-evals.json` and a case in `evals/cases.json`.

## Style and rules of thumb

- **No dependencies.** The tool runs on plain Node.js. Do not add npm packages.
- **Specs say what, not where.** No coordinates in specs. The engine places everything.
- **Short labels.** Titles of one to four words; detail goes in `sub`, `items` or `note`.
- **Real Salesforce names.** Current product names, real API names, the right relationship type.
- **Default output does not change.** New viewer or export behaviour is opt-in unless there is a strong reason.
- **Explain the why** in comments and docs; short and plain.
- **Keep SKILL.md lean.** Detail belongs in `references/`; `SKILL.md` should stay well under 500 lines.

## Pull requests

1. Fork, then branch from `main` (`git switch -c add-persona-map`).
2. Keep a pull request to one idea. Small is easy to review.
3. Fill in the pull request template: what changed, why, how you checked it.
4. Add a screenshot or the preview PNG when a diagram looks different.
5. By contributing you agree your work is released under the repository's [MIT licence](LICENSE).

Bundled icons and fonts keep their own licences ([THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)). Do not add artwork or text you do not have the right to share, and do not copy another project's diagrams or code.

## Reporting a problem

Open an [issue](https://github.com/abhishakec/archistry/issues/new/choose). For a build problem include the spec (or a cut-down one), the command you ran and the full output. For a security problem, see [SECURITY.md](SECURITY.md).

## Community

Be kind and constructive. See the [Code of Conduct](CODE_OF_CONDUCT.md).
