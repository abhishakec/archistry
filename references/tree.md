# tree — hierarchies

Types: `org-chart` (aliases `team-structure`, `governance-model`) and
`role-hierarchy` (alias `territory-hierarchy`).

```json
{
  "type": "org-chart",
  "title": "Delivery Organisation",
  "root": {
    "label": "Programme Sponsor",
    "sub": "Chief Customer Officer",
    "icon": "utility/user",
    "children": [
      {
        "id": "po",
        "label": "Product Owner",
        "sub": "Service Operations",
        "children": [
          { "label": "Business Analysts", "sub": "2 FTE" },
          { "label": "UAT Lead" }
        ]
      },
      { "id": "arch", "label": "Solution Architect", "kind": "ai" }
    ]
  },
  "links": [{ "from": "arch", "to": "po", "label": "advises" }]
}
```

| Field                    | Meaning                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root` (or `roots`)      | The tree. Each node is a card (`label`, `sub`, `icon`, `kind`, `badge`, `id`) with optional `children`                                              |
| `direction`              | `TB` (default) or `LR`                                                                                                                              |
| `compactLeaves`          | Default `true`: four or more leaf children are stacked vertically under their parent, the usual org-chart convention. `false` spreads them in a row |
| `stackAt`                | The threshold for stacking (default 4)                                                                                                              |
| `nodeWidth`              | Fixed card width in px                                                                                                                              |
| `arrows`                 | `true` to draw arrowheads (off by default: lines mean "reports to")                                                                                 |
| `dotted` (on a child)    | Dashed line to its parent: dotted-line reporting                                                                                                    |
| `edgeLabel` (on a child) | Text on the line to its parent                                                                                                                      |
| `links`                  | Extra dashed relationships between nodes with an `id`                                                                                               |

The root is blue by default; other nodes are neutral unless you set `kind`.
Cards on the same level share one size.

Rules:

- **org-chart:** `label` is the role, `sub` is the person or team size. Colour
  by function or by organisation (client, partner) and let the key explain it.
- **role-hierarchy:** one node per role, named as in Setup. Say in the subtitle
  what the organization-wide default is, because that is what makes the
  hierarchy matter. Keep it to roles; permissions belong in a
  `permission-matrix`.
- About 30 nodes per page. Past that, cut the tree at a level and draw each
  branch on its own page.

## Discovery trees: process-hierarchy and discovery-mind-map

- **process-hierarchy** (aliases `process-decomposition`, `l0-l1-process-map`,
  `value-chain`): root = L0 value chain, children = L1 processes, grandchildren
  = L2 sub-processes; put the level in `sub` ("L1"). Show scope with `kind`
  (`success` in scope, `data` later phase, `muted` out of scope) and `badge`
  ("Phase 2", "Out of scope"); say what the colours mean in the subtitle. Four
  or more leaf children stack vertically. Stop at L2; detail goes in a
  `business-process`.
- **discovery-mind-map** (aliases `mind-map`, `workshop-map`, `scope-map`):
  draws top-down, with each branch's leaves stacked in a column under it
  (`stackAt: 2`); set `"direction": "LR"` for a left-to-right map. Root = the
  programme, first-level branches = business context, objectives, stakeholders,
  current state, pain points, scope, constraints, open questions, each with its
  own `kind`; two or three short leaves per branch.

```json
{
  "type": "process-hierarchy",
  "root": {
    "label": "Serve the Customer",
    "sub": "L0",
    "children": [
      {
        "label": "Handle Enquiries",
        "sub": "L1",
        "kind": "success",
        "children": [{ "label": "Log case", "sub": "L2", "kind": "success" }]
      },
      {
        "label": "Bill and Collect",
        "sub": "L1",
        "kind": "muted",
        "badge": "Out of scope"
      }
    ]
  }
}
```

## Sales territories and site maps: territory-model and experience-site-map

- **territory-model** (aliases `territory-management`, `ett`,
  `sales-territories`; for a role-based view use `role-hierarchy`): Enterprise
  Territory Management. Root = the territory model (name the plan in `sub`),
  then regions, countries and segments. Put the owner or the assignment rule and
  the account count in `sub` ("Rule: Country in UK, IE | 640 accts"). Show phase
  with `kind` (`success` phase 1, `data` later phase) and `badge` ("Phase 2");
  use another `kind` for manually assigned named-account territories, and say
  what each colour means in the subtitle or `legendLabels`. Rules go in `sub`;
  the full rule logic belongs in a document.
- **experience-site-map** (aliases `site-map`, `portal-map`,
  `community-site-map`): root = the Experience Cloud site, first level =
  audiences (guest, customer, partner) coloured by `kind`, leaves = pages with
  the key components or flows in `sub` ("Case List, Case Detail", "Screen Flow:
  Create Case"). Four or more pages under an audience stack in a column
  (`stackAt: 3` by default). Say who sees what with the first-level `sub`
  (profile or licence); use `legendLabels` to name the colours.

```json
{
  "type": "experience-site-map",
  "root": {
    "label": "Northwind Portal",
    "sub": "Experience Cloud site",
    "children": [
      {
        "label": "Public pages",
        "sub": "Guest user",
        "kind": "success",
        "children": [
          { "label": "Help Centre", "sub": "Knowledge, Article Detail" }
        ]
      },
      {
        "label": "Customer area",
        "sub": "Customer Community Plus",
        "kind": "salesforce",
        "children": [{ "label": "My Cases", "sub": "Case List, Case Detail" }]
      }
    ]
  }
}
```
