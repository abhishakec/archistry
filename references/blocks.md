# blocks — zones, cards and connectors

Types: `system-landscape`, `solution-architecture`, `integration-architecture`,
`data-cloud-architecture`, `data-flow`, `system-context`, `capability-map`, `sharing-model`,
`environment-strategy`.

Follows the Salesforce Diagramming Framework: cards are the only building block, zones group them
by boundary or domain, connectors carry the integration detail.

## Shape of the spec

```json
{
  "type": "solution-architecture",
  "title": "…",
  "layout": "row",
  "children": [
    { "zone": "Customer Channels", "kind": "user", "children": [
      { "id": "portal", "label": "Customer Portal", "sub": "Experience Cloud", "icon": "product/experience_cloud" }
    ] },
    { "zone": "Salesforce Platform", "kind": "salesforce", "layout": "grid", "columns": 2, "children": [
      { "id": "service", "label": "Service Cloud", "icon": "product/service_cloud" },
      { "id": "agent", "label": "Agentforce", "icon": "standard/agent_astro", "kind": "ai", "badge": "New" }
    ] }
  ],
  "links": [ { "from": "portal", "to": "service", "label": "HTTPS", "step": 1 } ]
}
```

A child with `children` is a **zone**; anything else is a **card**. Zones nest (zone → sub-zone →
cards), three levels at most.

| Field | On | Meaning |
|---|---|---|
| `layout` | spec, zone | `row`, `column` or `grid`. Default: top level `row`; a zone of cards `column`; a zone of zones `row` |
| `columns` | zone with `grid` | Cards per row |
| `zone` (or `label`) | zone | Title, top-left |
| `sub` | zone | Grey second line under the title |
| `kind` | zone, card | Zone: tinted background and border. Card: its own colour; cards without a kind take the zone's border on white |
| `icon` | zone, card | |
| `gap`, `padding` | spec, zone | Override spacing in px (rarely needed; gaps already grow to fit link labels) |
| `width`, `height` | card, zone | Minimum size in px |
| `compact` | spec | Small cards, tight spacing. Default when there are no links (capability maps) |
| `links` | spec | See line styles in spec-common.md. Link to cards. A link may target a zone only if no link targets a card inside that zone |

## Choosing the level

| Type | Show | Leave out |
|---|---|---|
| `system-landscape` | Every system in scope, grouped by domain. Unlabelled or coarse connectors. `layout: "column"` with one band per layer reads well | Protocols, objects |
| `solution-architecture` | The systems in ONE solution, with numbered and labelled connectors | Systems not touched by this solution |
| `integration-architecture` | Each interface with pattern, protocol and timing: `label` = "Request-reply · REST", `note` = "Tax quote, < 2 s". Group MuleSoft APIs by layer (experience / process / system) | UI detail |
| `data-flow` / `data-cloud-architecture` | Stages as zones in a row (connect → ingest → harmonise → analyse → act); links carry cadence | Field-level mapping (use `data-cloud-mapping`) |
| `system-context` | People on the left, the solution in the middle, dependencies on the right | Internal components |
| `capability-map` | Domains as zones, capabilities as compact cards with `status`. No links | Systems |
| `sharing-model` | One zone per access layer in a `column`, most restrictive first. `"legend": false` | |
| `environment-strategy` | One zone per stage (develop → integrate → verify → stage → run); links are promotions | |

## Layout guidance

- **Zones on one axis.** Columns for flows that read left to right; stacked bands for layered
  landscapes.
- **Order children by who talks to whom.** The router avoids boxes but cannot fix a bad order.
- **Hub and spoke:** put the hub in its own zone between the spokes.
- **About 25 cards per page.** Past that, split landscape from solution views.
- **Walkthroughs:** add `"step": 1, 2, 3…` to links and narrate the steps in your document.
- **Detail on a link:** `label` for what a reader must see, `note` for the second line, `tooltip`
  for the rest.

## Capability map

```json
{ "type": "capability-map", "layout": "column", "children": [
  { "zone": "Resolve", "kind": "salesforce", "layout": "grid", "columns": 5, "children": [
    { "label": "Case management", "status": "live" },
    { "label": "AI agent deflection", "status": "in scope" },
    { "label": "Returns and refunds", "status": "gap" }
  ] } ] }
```

Statuses and colours: `live` / `existing` / `done` green; `in scope` / `mvp` / `phase 1` / `new`
blue; `planned` / `phase 2` / `enhance` amber; `phase 3` purple; `future` / `out of scope` grey;
`gap` / `retire` / `replace` red. The key lists the statuses you used.

## Checklist

- Every card has an `id` if a link refers to it; ids are unique.
- Salesforce products use product icons or the `salesforce` kind; external systems use `external`.
- Every connector at solution or integration level has a label.
- Line styles mean what the key says (sync, async, batch).
- The diagram answers one question at one level.

## current-future-state

Aliases `as-is-to-be`, `current-vs-future`, `gap-overview`. Two zones in a row: "Current state" (`kind: "external"`) on the left, "Future state" (`kind: "salesforce"`) on the right, each a `column` of cards. Colour current pain points `danger` or `warning`; use product icons on the future cards. Links run left to right and carry the change: `replaces`, `retired`, `new`, `integrated`, `migrated`. Order both columns so the links stay horizontal; one link per current item. About 6 to 8 cards a side.

```json
{ "type": "current-future-state", "children": [
  { "zone": "Current state", "kind": "external", "children": [ { "id": "c1", "label": "Legacy CRM" }, { "id": "c2", "label": "Shared mailbox", "kind": "danger" } ] },
  { "zone": "Future state", "kind": "salesforce", "children": [ { "id": "f1", "label": "Service Cloud", "icon": "product/service_cloud" }, { "id": "f2", "label": "Email-to-Case" } ] } ],
  "links": [ { "from": "c1", "to": "f1", "label": "replaces" }, { "from": "c2", "to": "f2", "label": "retired" } ] }
```
