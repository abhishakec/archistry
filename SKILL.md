---
name: archistry
description: >
  Salesforce project diagrams for architects, business analysts and consultants, generated from a
  short JSON spec as an editable draw.io file AND a standalone interactive HTML page, with PNG/JPG/SVG
  export. Use whenever the user asks to create, draw, diagram, visualize, map or chart anything on a
  Salesforce project: system landscape, solution or integration architecture, Data Cloud architecture
  or DLO/DMO field mapping, data model / ERD, OAuth or integration sequence, sharing model, role
  hierarchy, permission matrix, BPMN swimlane process, flowchart, record lifecycle, customer journey,
  service blueprint, user story map, capability map, stakeholder map, RACI, fit-gap, org chart,
  Lightning page wireframe, Apex class diagram, Agentforce Agent Interaction Map or Agent Instruction
  Diagram, environment strategy, CI/CD pipeline, branching strategy, Flow logic, test strategy,
  traceability matrix, roadmap, gantt, cutover plan or risk matrix. Also use when the user mentions
  ".drawio", "draw.io", "diagrams.net", wants an HTML diagram, wants a diagram exported to an image,
  or wants an existing .drawio file validated or converted. Not for Mermaid output.
metadata:
  version: "1.0"
  requires: "Node.js 18+ (no npm install). PNG/JPG export also needs Chrome, Edge or Chromium."
---

# Archistry: Salesforce diagrams (draw.io + HTML)

You write a small JSON spec that says **what** is in the diagram. The engine decides **where**
everything goes, routes the connectors, applies Salesforce notation and icons, validates the result
and writes two editable outputs from the same model:

- `name.drawio` — opens in draw.io desktop, app.diagrams.net and the VS Code draw.io extension.
- `name.html` — one offline file with pan/zoom, search, connection tracing, dark mode, an edit mode,
  and export to PNG / JPG / SVG / .drawio.

Do not hand-place coordinates and do not write Mermaid. If the user gives Mermaid, PlantUML, a
screenshot or prose as input, read it for meaning and author a spec.

In every command below, `archistry` means `node <this skill's folder>/scripts/archistry.mjs`. Call it
by its absolute path from any directory; the spec and output paths you pass resolve from the
directory you run it in.

## Workflow

1. **Pick the type** from the catalogue below by the question the diagram answers. One diagram
   answers one question; a request such as "document this solution" becomes several specs.
2. **Read the starter and the reference.** `archistry init <type>` prints a complete, valid starter spec.
   The engine's reference lists every field (the engine is in the catalogue: engine `blocks` is
   [references/blocks.md](references/blocks.md), `flow` is `references/flow.md`, and so on). Read both
   before writing; the starter teaches shape, not facts. When a generator already wrote the spec,
   skip `init` and read just the reference.
3. **Gather facts.** Use what the user gave you and what the repo shows. For a real project, prefer
   the generators over guessing (see Generators). Ask for facts you cannot find, such as object API
   names, dates or owners; do not invent them. If nobody can answer (a non-interactive run), use
   plausible placeholders and say so in the subtitle ("illustrative, confirm with the org").
4. **Write the spec** next to the user's work, for example `diagrams/order-to-cash-architecture.json`
   (lowercase, hyphenated). Common fields are in [references/spec-common.md](references/spec-common.md).
5. **Build:** `archistry build diagrams/<name>.json` writes `.drawio` and `.html` beside the spec. Add
   `--format drawio,html,png` (or `jpg`, `svg`) when the user wants an image for a document.
6. **Read the result line.** `OK` means it built and passed. `FAILED` (exit code 2) means there are
   errors: fix the spec and rebuild. Never hand over a failed build. Treat `WARNING` and `NOTE` lines
   as a fix list (see Repairing). An image can fail on its own: a build that prints `OK` and then
   `ERROR image export` still exits with code 2, and the `.drawio` and `.html` are written. That is a
   browser problem, not a spec problem, so do not edit the spec. Fall back to `--format svg` (needs
   no browser), or tell the user to open the HTML and use Export > PNG, and say that the PNG was not
   produced. If the user needs a PNG and the built-in export keeps failing, render the SVG
   yourself: put it in a small HTML page and run the browser once, for example
   `msedge --headless=new --user-data-dir=<fresh temp folder> --window-size=W,H --screenshot=out.png
   file:///page.html`. On Windows the Edge launcher can return before the file is written, so wait
   for `out.png` to appear, then look at it before you hand it over.
7. **Reply briefly** (see Reply).

## Diagram catalogue

`archistry types` prints this list; `archistry types --stage design` filters it.

| Stage | Type | Engine | Answers |
|---|---|---|---|
| Discover | `stakeholder-map` | matrix | Who has influence and interest? |
| Discover | `org-chart` | tree | Who reports to whom? |
| Discover | `raci` | matrix | Who is responsible, accountable, consulted, informed? |
| Discover | `capability-map` | blocks | Which capabilities are live, in scope or a gap? |
| Discover | `business-process` | flow | Who does which step, in what order? (BPMN-style swimlanes) |
| Discover | `customer-journey` | journey | What does the persona do, think and feel per stage? |
| Discover | `service-blueprint` | journey | What sits behind each customer step? |
| Discover | `user-story-map` | matrix | Which stories sit under which activity and release? |
| Discover | `system-context` | blocks | Who and what surrounds the solution? |
| Discover | `fit-gap-analysis` | matrix | Standard, config, custom or gap for each requirement? |
| Discover | `prioritization-matrix` | matrix | What gives most value for least effort? |
| Architect | `system-landscape` | blocks | Which systems exist and how are they grouped? |
| Architect | `solution-architecture` | blocks | Which products and components make up this solution? |
| Architect | `integration-architecture` | blocks | Which interfaces, with what pattern, protocol and timing? |
| Architect | `sequence` | sequence | In what order do systems message each other? |
| Architect | `oauth-flow` | sequence | How does this OAuth / SSO flow work step by step? |
| Architect | `data-model` | tables | Which objects, fields and relationships? (Salesforce ERD notation) |
| Architect | `data-flow` | blocks | Where does data come from, change and land? |
| Architect | `data-cloud-architecture` | blocks | Ingest, harmonise, unify, analyse, activate |
| Architect | `data-cloud-mapping` | mapping | Which source field maps to which DLO / DMO field? |
| Architect | `sharing-model` | blocks | How is record access opened up layer by layer? |
| Architect | `role-hierarchy` | tree | How does visibility roll up? |
| Architect | `permission-matrix` | matrix | Which persona gets which object access? |
| Design | `state-lifecycle` | flow | Which statuses, and what triggers each transition? |
| Design | `flowchart` | flow | What is the logic, decision by decision? |
| Design | `lightning-page-wireframe` | wireframe | What goes where on the page? |
| Design | `class-diagram` | tables | Which Apex classes and dependencies? |
| Agentforce | `agent-interaction-map` | aim | Channels, reasoning, topics, actions and grounding of an agent |
| Agentforce | `agent-instruction-diagram` | flow | Instruction steps, actions, prompts and guardrails in one topic |
| Build | `environment-strategy` | blocks | Which orgs and sandboxes, and the promotion path? |
| Build | `devops-pipeline` | flow | Commit to production, with gates |
| Build | `branching-strategy` | flow | Which branches, and how do they merge? |
| Build | `flow-logic` | flow | What does this Flow or trigger do, element by element? |
| Test | `test-strategy` | matrix | Which test levels, owners, environments, exit criteria? |
| Test | `traceability-matrix` | matrix | Is every requirement tested, and what is the status? |
| Test | `defect-lifecycle` | flow | How does a defect move from raised to closed? |
| Release | `roadmap` | timeline | What is delivered when, across workstreams? |
| Release | `project-plan` | timeline | Tasks, durations, dependencies, milestones (gantt) |
| Release | `cutover-plan` | timeline | Hour-by-hour go-live steps and owners |
| Release | `risk-matrix` | matrix | Which risks are most likely and most damaging? |

Common mix-ups: object relationships are a `data-model`, never a flowchart. Call order between
systems is a `sequence`, not arrows numbered on an architecture. A status field is a
`state-lifecycle`. A process that also has statuses (lead handling, case handling) is two diagrams:
a `business-process` for who does what and a `state-lifecycle` for the statuses. An agent's overall design is an `agent-interaction-map`; the logic inside one
topic is an `agent-instruction-diagram` (put `steps` on a topic and the map links to it as a second
page).

## Authoring rules

- **Semantic, not geometric.** Specs carry ids, labels, kinds and relationships. No coordinates.
- **Colour is classification.** `kind` picks a palette role (`salesforce`, `data`, `ai`,
  `integration`, `engagement`, `external`, `security`, `success`, `warning`, `danger`, …). The key is
  generated from the kinds you use, so use a kind only when it means something.
- **Icons.** `"icon": "product/sales_cloud"`. Find keys with `archistry icons search <text>`. If nothing
  fits, omit the icon; a wrong icon is worse than none.
- **Short labels.** Card titles of 1 to 4 words, a `sub` line for detail, link labels of 1 to 4
  words. Long text belongs in `sub`, `items`, `note` or the surrounding document.
- **Size.** About 25 boxes or fewer per page. Split bigger subjects by domain or level and say which
  file is which.
- **Salesforce accuracy.** Use real API names (`Account`, `Promotion__c`, `ssot__Individual__dlm`),
  current product names, and the correct relationship type (lookup vs master-detail). Mark anything
  illustrative as illustrative in the subtitle.
- **Header.** A title and subtitle are drawn by default. Use `"header": "banner"` with `meta`
  (status, version, date, author) for client-ready documents.

## Generators (use real metadata when it exists)

| Input | Command |
|---|---|
| SFDX project → `data-model` spec | `archistry erd-from-sfdx <project-dir> -o diagrams/data-model.json [--objects A,B__c] [--include-fields 8]` |
| Mapping CSV → `data-cloud-mapping` spec | `archistry mapping-from-csv mappings.csv -o diagrams/mapping.json` |
| Flow metadata → `flow-logic` spec | `archistry flow-from-metadata force-app/.../My_Flow.flow-meta.xml -o diagrams/my-flow.json` |

Each writes a spec you can edit (retitle, trim, regroup) before `archistry build`. The title comes
from the folder or file name, so set `title` and `subtitle` yourself. The output folder must
already exist (`mkdir -p diagrams`). For Apex, read the
classes and write a `class-diagram` or `sequence` spec yourself.

## Repairing

| Message | Fix in the spec |
|---|---|
| `unknown diagram type` | Use a name from the catalogue; the error suggests close matches |
| `link skipped — unknown id` | A `from` / `to` does not match any `id`; ids are case-sensitive |
| `no clean route for A -> B` | Too many links on one box, or boxes boxed in: regroup zones, or drop minor links |
| `label-clipped` | Shorten the label or move detail into `sub` |
| `edge-through-box`, `many-crossings` | Reorder children so connected items are adjacent, or split the diagram |
| `overlap`, `escapes-container` | Only expected in hand-written draw.io XML: move or resize the cells |
| `too-dense` | Split into two diagrams |
| `icon not found` | `archistry icons search <text>`, or remove the icon |

Rebuild after every change. If two rounds do not clear a warning, keep the diagram that reads best
and tell the user what remains.

## Output formats and editing

- **Both by default.** `--format drawio`, `html`, `png`, `jpg`, `svg` or any comma list; `all` means
  drawio + html + png + svg. `--theme dark` and `--scale 3` apply to HTML and images.
- **Images later:** `archistry export diagram.drawio -o diagram.png` (also accepts `.html` and spec
  `.json`; `--format png,jpg,svg`, `--page 2`, `--transparent`). This is how a user who edited the
  file gets a fresh image for a document. A multi-page diagram (such as an Agent Interaction Map with
  instruction pages) writes one image per page, `name-1.png`, `name-2.png`, unless you pass `--page N`.
  A larger `--scale` (3) makes a PNG easier to read when it will be shrunk into a document.
- **Round trip:** `archistry convert edited.html -o edited.drawio` and `archistry convert edited.drawio -o
  edited.html`. The HTML embeds the draw.io XML, so nothing is lost either way.
- **Manual editing:** in draw.io, or in the browser (HTML → Edit: move, resize, retext, recolour,
  add shapes, connect, undo; then Export → Save HTML or Download .drawio).
- **Validate anything:** `archistry validate file.drawio|file.html|spec.json [--json] [--strict]`.

Details and limits: [references/output-formats.md](references/output-formats.md).

## Hand-written draw.io (escape hatch)

Use a spec whenever a type fits. For a one-off diagram that no type covers, or when editing an
existing `.drawio` file, write uncompressed draw.io XML following
[references/raw-drawio.md](references/raw-drawio.md), then run `archistry validate` and fix every ERROR.
`archistry convert` turns it into HTML afterwards.

## Brand

Default is the Salesforce palette. If the user supplies a brand (`"brand": "path/brand.json"` in the
spec, or `brand.json` / `brand/brand.json` beside the spec), colours and font are swapped; notation
never changes. Schema: `assets/brand/brand.example.json`. Say which brand was applied.

## Reply

Keep it short; the diagram carries the content.

- Link the files with their paths: the `.html` to open now, the `.drawio` to edit, any image.
- One line on how to change it: "Open the HTML and press E to edit, or open the .drawio in draw.io."
- State what the reader must know to trust it: assumptions, illustrative values, anything left out,
  warnings that remain. Say "built and validated" only when the build line said OK; you have not
  looked at the picture unless you exported an image and viewed it.
- For several diagrams, list them once with one line each.
- If a deliverable the user asked for could not be made (a PNG, say), say so first and give the
  nearest working option, rather than leaving it out.
- For "put it in a doc", build a PNG (or SVG) beside the spec and say how to embed it; the diagram
  is the deliverable, and the document is the user's to assemble unless they ask you to write it.

## Setup check

`archistry doctor` reports the Node version, whether a browser is available for PNG/JPG export, and runs a
self-test. draw.io, HTML and SVG output need only Node. The self-test does not draw an image, so
`doctor` can report a browser as found while PNG/JPG export still fails on that machine; see step 6.

## Reference index

- [spec-common.md](references/spec-common.md) — shared fields, kinds, icons, line styles, legend
- [blocks.md](references/blocks.md) — zones, cards and links (architecture family, capability map)
- [flow.md](references/flow.md) — swimlanes, flowcharts, lifecycles, pipelines
- [sequence.md](references/sequence.md) — sequence diagrams and OAuth flows
- [tables.md](references/tables.md) — data models and class diagrams
- [mapping.md](references/mapping.md) — field mapping
- [tree.md](references/tree.md) — org charts and hierarchies
- [matrix.md](references/matrix.md) — tables, quadrants, heat grids, boards
- [timeline.md](references/timeline.md) — roadmaps, gantt, cutover
- [journey.md](references/journey.md) — journey maps and service blueprints
- [aim.md](references/aim.md) — Agent Interaction Map and Agent Instruction Diagram
- [wireframe.md](references/wireframe.md) — Lightning page wireframes
- [output-formats.md](references/output-formats.md) — HTML viewer, image export, round trip
- [raw-drawio.md](references/raw-drawio.md) — hand-written draw.io XML rules
