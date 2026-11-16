# tree — hierarchies

Types: `org-chart` (aliases `team-structure`, `governance-model`) and `role-hierarchy` (alias
`territory-hierarchy`).

```json
{
  "type": "org-chart",
  "title": "Delivery Organisation",
  "root": {
    "label": "Programme Sponsor", "sub": "Chief Customer Officer", "icon": "utility/user",
    "children": [
      { "id": "po", "label": "Product Owner", "sub": "Service Operations", "children": [
        { "label": "Business Analysts", "sub": "2 FTE" }, { "label": "UAT Lead" } ] },
      { "id": "arch", "label": "Solution Architect", "kind": "ai" }
    ]
  },
  "links": [ { "from": "arch", "to": "po", "label": "advises" } ]
}
```

| Field | Meaning |
|---|---|
| `root` (or `roots`) | The tree. Each node is a card (`label`, `sub`, `icon`, `kind`, `badge`, `id`) with optional `children` |
| `direction` | `TB` (default) or `LR` |
| `compactLeaves` | Default `true`: four or more leaf children are stacked vertically under their parent, the usual org-chart convention. `false` spreads them in a row |
| `stackAt` | The threshold for stacking (default 4) |
| `nodeWidth` | Fixed card width in px |
| `arrows` | `true` to draw arrowheads (off by default: lines mean "reports to") |
| `dotted` (on a child) | Dashed line to its parent: dotted-line reporting |
| `edgeLabel` (on a child) | Text on the line to its parent |
| `links` | Extra dashed relationships between nodes with an `id` |

The root is blue by default; other nodes are neutral unless you set `kind`. Cards on the same level
share one size.

Rules:

- **org-chart:** `label` is the role, `sub` is the person or team size. Colour by function or by
  organisation (client, partner) and let the key explain it.
- **role-hierarchy:** one node per role, named as in Setup. Say in the subtitle what the
  organization-wide default is, because that is what makes the hierarchy matter. Keep it to roles;
  permissions belong in a `permission-matrix`.
- About 30 nodes per page. Past that, cut the tree at a level and draw each branch on its own page.
