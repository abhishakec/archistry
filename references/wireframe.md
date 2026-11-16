# wireframe — Lightning page and screen wireframes

Type: `lightning-page-wireframe` (aliases `wireframe`, `page-layout`, `screen-wireframe`).
Low-fidelity on purpose: it settles what goes where and why, before anyone opens Lightning App
Builder.

```json
{
  "type": "lightning-page-wireframe",
  "title": "Case Record Page — Wireframe",
  "app": "Service Console",
  "tabs": ["Home", "Cases", "Accounts"], "activeTab": 1,
  "page": "Cases > 00012345 · Lightning record page: Case_Tier1",
  "rows": [
    { "columns": [ { "width": 12, "components": [
      { "type": "highlights", "label": "Broadband fault", "fields": ["Case Number", "Priority", "Status"], "actions": ["Edit", "Escalate"], "note": "Compact layout shows the SLA countdown." },
      { "type": "path", "steps": ["New", "Diagnosing", "Resolved", "Closed"], "current": 1 }
    ] } ] },
    { "columns": [
      { "width": 8, "components": [ { "type": "tabs", "tabs": ["Details", "Feed"], "components": [
        { "type": "record-detail", "label": "Case Information", "fields": ["Subject", "Type", "Reason", "Product"] } ] } ] },
      { "width": 4, "components": [ { "type": "agent", "label": "Agentforce Assistant", "description": "Suggested reply and next best action." },
        { "type": "related-list", "label": "Assets", "columns": ["Asset", "Status"], "rows": 2 } ] }
    ] }
  ]
}
```

| Field | Meaning |
|---|---|
| `device` | `desktop` (default, 1200px) or `mobile` (380px, single column) |
| `app`, `tabs`, `activeTab`, `page` | The global header, navigation tabs and breadcrumb. `"chrome": false` hides them |
| `rows[].columns[]` | `{ width, components }`. Widths are relative, think of a 12-column grid: `8` + `4`, `3` + `6` + `3` |
| component | `{ type, label, note, … }` |

| `type` | Extra fields | Draws |
|---|---|---|
| `highlights` | `fields`, `actions` | Highlights panel with key fields and buttons |
| `path` | `steps`, `current` | Path with the current stage |
| `tabs` | `tabs`, `components` | Tab set containing other components |
| `record-detail` / `fields` | `fields`, `columns` | Field labels with value placeholders |
| `form` | `fields`, `columns` | Editable inputs |
| `related-list` | `columns`, `rows` | Table with header |
| `related-lists` | `lists` | Collapsed related lists |
| `activity`, `feed` | `rows` | Activity timeline, Chatter |
| `knowledge`, `list`, `search` | `rows` | Result list |
| `chart`, `kpi` | `items` (kpi) | Report chart, metric tiles |
| `buttons` | `actions` | Action bar |
| `text`, `image`, `map` | `lines` (text) | Placeholders |
| `flow` | `description` | Embedded Screen Flow (dashed purple) |
| `lwc`, `custom` | `description` | Custom component (dashed purple) |
| `agent` | `description` | Agentforce panel (dashed indigo) |

Any component accepts `height` (px) and `tag` (the small type label).

**Annotations:** a `note` on a component adds a numbered red marker to it and a numbered list to the
right of the frame. Use notes for behaviour the picture cannot show: visibility rules, what a button
launches, what is custom.

Rules:

- Use the real template regions (header, main, sidebars) so the wireframe can be built as drawn.
- Name fields and related lists as they are, or will be, in the org.
- Mark custom work honestly: standard components solid, custom ones dashed. That line count is the
  build estimate conversation.
- One page per wireframe; one persona or record type per page. Mobile is a separate spec with
  `"device": "mobile"`.
