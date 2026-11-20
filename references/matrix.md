# matrix — tables, quadrants, heat grids and boards

One engine, three modes. The type sets the mode.

| Mode | Types |
|---|---|
| table | `raci`, `fit-gap-analysis`, `permission-matrix`, `traceability-matrix`, `test-strategy` |
| quadrant | `stakeholder-map`, `prioritization-matrix`, `risk-matrix` (5×5 heat grid) |
| board | `user-story-map` (aliases `moscow`, `board`, `swot`, `kanban`) |

## Table

```json
{
  "type": "raci",
  "title": "Service Cloud Rollout — RACI",
  "rowHeader": "Activity",
  "roles": ["Sponsor", "Product Owner", "Architect", "BA"],
  "rows": [
    { "section": "Design" },
    { "label": "Solution design", "values": ["I", "C", "A", "R"] }
  ]
}
```

| Field | Meaning |
|---|---|
| `columns` (or `roles`) | Strings or `{ label, sub, width, kind }` |
| `rows` | `{ label, sub, cells }` (`values` is an alias of `cells`), or `{ "section": "…" }` for a band. `bold: true` emphasises the row label |
| cell | A string, or `{ "text": "…", "kind": "warning" }` to colour one cell's chip |
| `rowHeader` | Heading of the first column |
| `valueKinds` | `{ "Must": "danger" }` — cell values drawn as coloured chips. Merged over the type's preset |
| `valueLabels` | `{ "R": "Responsible" }` — wording for the key |
| `maxColWidth`, `rowHeaderWidth` | Column width limits in px |

Presets:

| Type | Values that become chips |
|---|---|
| `raci` | `R`, `A`, `C`, `I`, `S` (solid chips; key spells them out) |
| `fit-gap-analysis` | `Fit` / `Standard` / `OOTB`, `Config`, `Custom`, `AppExchange`, `Partial`, `Gap`, `N/A` |
| `traceability-matrix` | `Pass`, `Fail`, `Blocked`, `In progress`, `Not run`, `Planned`, `✓`, `—` |
| `permission-matrix` | `CRUD`, `CRU`, `CR`, `RU`, `R`, `—`, and OWD values (`Private`, `Public Read Only`, `Public Read/Write`, `Controlled by Parent`) |

Any other cell is plain wrapped text, so a table can mix chips and prose (see
`archistry init fit-gap-analysis` and `archistry init test-strategy`).

Rules: one `A` per RACI row. Requirement ids in the row label (`REQ-001  Route cases by skill`).
Twelve rows and eight columns is a comfortable page; split by section beyond that.

## Quadrant (2×2)

```json
{
  "type": "prioritization-matrix",
  "xAxis": { "label": "Delivery effort", "low": "Low", "high": "High" },
  "yAxis": { "label": "Business value", "low": "Low", "high": "High" },
  "quadrants": [
    { "label": "Quick wins", "sub": "Do first", "kind": "success" },
    { "label": "Strategic bets", "kind": "salesforce" },
    { "label": "Fill-ins", "kind": "muted" },
    { "label": "Reconsider", "kind": "warning" }
  ],
  "items": [ { "label": "Case auto-routing", "x": 0.18, "y": 0.86 }, { "label": "Data Cloud unification", "x": 0.82, "y": 0.88, "kind": "data" } ]
}
```

`quadrants` are listed top-left, top-right, bottom-left, bottom-right. Item `x` and `y` run from 0
(low) to 1 (high). Items stay inside their quadrant and are nudged apart when they collide. For a
stakeholder map: x = interest, y = influence, quadrants "Keep satisfied", "Manage closely",
"Monitor", "Keep informed".

## Heat grid (risk matrix)

```json
{
  "type": "risk-matrix",
  "grid": 5,
  "xAxis": { "label": "Likelihood", "labels": ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"] },
  "yAxis": { "label": "Impact", "labels": ["Negligible", "Minor", "Moderate", "Major", "Severe"] },
  "items": [ { "label": "R1 Data migration quality", "x": 4, "y": 4, "note": "Duplicates in legacy CRM" } ]
}
```

`x` and `y` are whole numbers from 1 to `grid`. Cells shade green → amber → red toward the
top-right. Give each risk a short id in its label and keep the detail in the RAID log. Three items
fit in one cell.

## Board

```json
{
  "type": "user-story-map",
  "columns": [ { "label": "Plan the day", "sub": "Dispatcher", "kind": "salesforce" }, { "label": "Do the job", "kind": "data" } ],
  "rows": [
    { "label": "MVP", "sub": "Release 1", "kind": "success", "cells": [ [ { "label": "See today's appointments", "badge": "3" } ], [ "Capture work steps" ] ] },
    { "label": "Later", "kind": "muted", "cells": [ [], [ { "label": "Agentforce troubleshooting", "kind": "ai" } ] ] }
  ]
}
```

| Field | Meaning |
|---|---|
| `columns` | `{ label, sub, kind, cards }`. Without `rows`, put `cards` on each column (MoSCoW, kanban) |
| `rows` | `{ label, sub, kind, cells }` where `cells[i]` is the list of cards under column `i` (story map slices, SWOT rows) |
| card | A string or `{ label, sub, badge, kind, note }`. `badge` suits story points or ids |
| `cardWidth`, `cardsPerRow` | Card size and how many sit side by side in a cell |

Story map: columns are the user's activities in order (the backbone); rows are release slices.
MoSCoW: four columns, no rows. SWOT: two columns (helpful, harmful) and two rows (internal,
external).

## Discovery tables: persona-map and workshop-plan

Both use the table mode (aspects or sessions as rows) and the same fields as above.

- **persona-map** (aliases `persona`, `personas`, `user-personas`): one column per persona (`label` = persona, `sub` = headcount or segment, `kind` to tint the header); rows are aspects: Goals, Pains, Key tasks, Channels and devices, "Salesforce must", Priority. Keep each cell to one short line; a priority row can use `{ "text": "Phase 1", "kind": "success" }` chips. Four to five personas fit a page.
- **workshop-plan** (aliases `workshop-agenda`, `discovery-plan`): rows are sessions grouped by `{ "section": "Day 1: Context" }` bands; columns Time, Topic, Attendees, Output. Name the output artefact (for example "As-is swimlanes") so each session maps to a diagram.

```json
{ "type": "persona-map", "rowHeader": "",
  "columns": [ { "label": "Service Agent", "sub": "120 users", "kind": "salesforce" }, { "label": "Field Technician", "kind": "data" } ],
  "rows": [ { "label": "Goals", "bold": true, "cells": ["Resolve on first contact", "Fix in one visit"] },
            { "label": "Pains", "bold": true, "cells": ["Five screens per call", "No parts history"] } ] }
```
