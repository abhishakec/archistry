# timeline — roadmaps, gantt plans and cutover plans

Types: `roadmap`, `project-plan` (aliases `gantt`, `release-plan`, `sprint-plan`), `cutover-plan`.
Bars are drawn to scale; overlapping bars in a lane stack onto extra rows.

## Date axis (roadmap, project plan)

```json
{
  "type": "roadmap",
  "title": "Customer 360 Programme — Roadmap",
  "start": "2027-01-04", "end": "2027-09-30",
  "today": "2027-03-10",
  "phases": [ { "label": "Release 1 — Foundation", "start": "2027-02-15", "end": "2027-05-14", "kind": "salesforce" } ],
  "lanes": [
    { "label": "Sales Cloud", "kind": "salesforce", "bars": [
      { "id": "s1", "label": "Design", "start": "2027-01-11", "end": "2027-02-19", "status": "done" },
      { "id": "s2", "label": "Build", "start": "2027-02-22", "end": "2027-04-16", "status": "in progress", "progress": 0.45 }
    ], "milestones": [ { "label": "Go-live R1", "date": "2027-05-14" } ] }
  ],
  "milestones": [ { "label": "Budget review", "date": "2027-06-30" } ],
  "dependencies": [ { "from": "s1", "to": "s2" } ]
}
```

| Field | Meaning |
|---|---|
| `start`, `end` | `YYYY-MM-DD`. Optional; derived from the bars when omitted. The axis snaps to whole months |
| `unit` | `month` (default), `quarter` (default beyond 15 months), `week` |
| `sprints` | `{ start, lengthDays, count, prefix, first }` adds a sprint row under the months |
| `today` | Draws a "Today" line (`todayLabel` renames it) |
| `phases` | Chevrons above the axis: `{ label, start, end, kind }` |
| `lanes` | Workstreams: `{ label, sub, kind, bars, milestones }` |
| bar | `{ id, label, start, end, status, kind, progress, note, row }`. `end` is inclusive. `progress` is 0 to 1 |
| lane milestone | `{ id, label, date, kind }` — a diamond in the lane |
| `milestones` | Programme-level: a dashed vertical line across all lanes with a tag |
| `dependencies` | `{ from, to }` bar or milestone ids, drawn finish → start and routed around other bars |
| `laneWidth`, `pixelsPerDay` | Layout overrides |

Bar `status` colours: `done` / `complete` green, `in progress` / `active` blue, `planned` grey,
`at risk` amber, `blocked` / `late` red. Without a status the bar takes its `kind` or the lane's.

## Step axis (cutover plan, sprint boards)

```json
{
  "type": "cutover-plan",
  "axis": ["Fri 18:00", "Fri 22:00", "Sat 02:00", "Sat 08:00"],
  "axisGroups": [ { "label": "Freeze & deploy", "span": 2 }, { "label": "Migrate", "span": 2 } ],
  "lanes": [ { "label": "Release manager", "bars": [ { "id": "freeze", "label": "Change freeze", "start": 1, "end": 1 }, { "id": "deploy", "label": "Deploy metadata", "start": 2, "end": 3 } ],
               "milestones": [ { "label": "Go / no-go", "at": 4 } ] } ],
  "milestones": [ { "label": "Rollback decision", "at": 3.5, "kind": "danger" } ]
}
```

With `axis`, bars use column numbers (1-based, inclusive) or the axis label itself for `start` and
`end`; milestones use `at` (a half value such as `3.5` sits on the boundary). `columnWidth` sets
the column size.

## Rules

- **roadmap:** lanes are workstreams or products; bars are outcomes or phases, not tasks. Five to
  eight lanes; quarters or months.
- **project-plan:** lanes are disciplines (Design, Build, Data, Test, Release); bars are work
  packages with `status` and `progress`; show the critical dependencies only.
- **cutover-plan:** lanes are owners; every bar is a step somebody is named for; mark the freeze,
  the go / no-go and the rollback decision point.
- Dates are facts. Ask for them; if you must illustrate, say so in the subtitle.
- Bar labels of one to three words; a bar too narrow for its label gets the label beside it.
