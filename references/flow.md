# flow — processes, flowcharts, lifecycles, pipelines

Types: `business-process` (BPMN-style swimlanes), `flowchart`, `state-lifecycle`, `flow-logic`,
`devops-pipeline`, `branching-strategy`, `defect-lifecycle`. The Agent Instruction Diagram uses the
same engine with its own step kinds; see [aim.md](aim.md).

## Shape of the spec

```json
{
  "type": "business-process",
  "title": "Quote-to-Order — To-Be",
  "direction": "LR",
  "lanes": [ { "id": "rep", "label": "Sales Rep", "kind": "user" }, { "id": "sf", "label": "Salesforce", "kind": "salesforce" } ],
  "nodes": [
    { "id": "start", "kind": "start", "label": "Opportunity at Proposal", "lane": "rep" },
    { "id": "quote", "kind": "user", "label": "Build quote", "sub": "Products, discounts", "lane": "rep", "icon": "utility/user" },
    { "id": "check", "kind": "gateway", "label": "Discount > 15%?", "lane": "sf" },
    { "id": "end", "kind": "end", "label": "Closed Won", "lane": "rep" }
  ],
  "edges": [
    { "from": "start", "to": "quote" },
    { "from": "quote", "to": "check" },
    { "from": "check", "to": "end", "label": "No" }
  ]
}
```

| Field | Meaning |
|---|---|
| `direction` | `LR` (default for processes, lifecycles, pipelines) or `TB` (default for `flowchart` and `flow-logic`) |
| `lanes` | Optional swimlanes: `{ id, label, kind }`. With lanes, every node needs `lane` |
| `nodes` | `{ id, kind, label, sub, lane, icon, color, note, link }` |
| `edges` | `{ from, to, label, kind }` |
| `wrap` | Without lanes: continue on a new row after this many columns (long linear flows) |
| `gap`, `spacing` | Override column gap and sibling spacing in px |

Layout is automatic: a node sits one column after its latest predecessor; loops back are detected
and routed around. Ids `start` and `end` used in an edge without a matching node are created as
plain terminals.

## Node kinds

| `kind` | Shape | Use for |
|---|---|---|
| `start`, `end` | green pill, bold-bordered pill | Trigger and outcome. Label them ("Order placed", "Case closed") |
| `task` (default) | white card, blue border | A step |
| `user` | card | Manual step by a person; add `"icon": "utility/user"` |
| `system`, `service`, `script` | blue tinted card | Automated step; `sub` names the automation ("Record-triggered Flow", "Apex: OrderService") |
| `ai` | indigo card | Step done by an agent or model |
| `manual` | grey card | Offline or outside any system |
| `subprocess` | card with side bars | A step detailed in another diagram |
| `gateway` / `decision` | diamond | A question. Label ≤ 2 characters (`X`, `+`) draws a small BPMN gateway |
| `event` | double circle | Timer, message, wait |
| `data` | cylinder | Data store |
| `document` | document shape | Document or report |
| `state` | pill | Status in a lifecycle; `sub` for a qualifier |
| `note` | yellow note | Annotation; connect it with an edge of `"kind": "note"` |

`color` takes any kind from spec-common.md and overrides the default colour of the node.

## Edge kinds

| `kind` | Drawn as |
|---|---|
| (default) | solid arrow |
| `exception` / `error` | red arrow: rejection, fault path |
| `message` / `async` | dashed, open arrow: message between participants |
| `optional` | dashed arrow |
| `note` | dotted line, no arrow |

Label every edge that leaves a gateway ("Yes", "No", "> 15%"). Keep labels to a few words; long
labels wrap at about 150px.

## Notation by type

**business-process** — Lanes are roles or systems, not departments' wish lists. One start, one or
more ends. A step lives in the lane of who or what performs it. Automation goes in a `Salesforce`
lane as `system` nodes. Show only decisions that change the path. As-is and to-be are two files.

**flowchart** — `TB`, no lanes. One question per diamond, phrased so the answers are the edge
labels.

**state-lifecycle / defect-lifecycle** — Nodes are `state`; edges are transitions labelled with the
trigger ("Agent accepts", "5 days, no reply"). Colour terminal and exception states (`success`,
`danger`, `external`). Keep to the statuses that exist in the picklist.

**flow-logic** — Generate from metadata when you can:
`archistry flow-from-metadata X.flow-meta.xml -o spec.json`. Decisions become gateways, Get / Create /
Update / Delete Records and actions become `system` nodes, screens become `user` nodes, fault
connectors become `exception` edges. Then retitle and trim.

**devops-pipeline** — Lanes: Developer, CI, Salesforce orgs, Approvals. Quality gates are gateways.

**branching-strategy** — Lanes are branches (`feature/*`, `develop`, `release/*`, `main`,
`hotfix/*`); nodes are `state` pills for commits, merges and tags; edge labels are the git action.

## Checklist

- Every node has a unique `id`; every edge refers to existing ids.
- Gateways have at least two labelled exits.
- Flow reads in one direction; loops back are the exception.
- No more than about 20 nodes; split long processes into sub-processes and link them.

## value-stream-map

Aliases `vsm`, `value-stream`. Draws the end-to-end flow left to right, one step per node, to find where Salesforce removes delay. Put the times in `sub`: `"CT 20 min | WT 1 d"` (cycle time | wait time). Mark bottlenecks and rework with `color` (`danger`, `warning`) and a word in `sub`. Use lanes for customer, team and system; label hand-offs on the edges ("Hand-off 1"); add a `note` node with total cycle time, total wait time and the share that is waiting, and say in the subtitle whether times are measured or illustrative. Draw as-is and to-be as two files.

```json
{ "type": "value-stream-map", "direction": "LR",
  "nodes": [ { "id": "a", "kind": "start", "label": "Fault reported" },
             { "id": "b", "kind": "manual", "label": "Escalate by email", "sub": "CT 10 min | WT 1 d | Bottleneck", "color": "danger" } ],
  "edges": [ { "from": "a", "to": "b", "label": "Hand-off 1" } ] }
```
