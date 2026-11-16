# Spec fields shared by every diagram type

A spec is one JSON object. `type` selects the diagram; everything else is content.

```json
{
  "type": "solution-architecture",
  "title": "Order Management — Solution Architecture",
  "subtitle": "One line on scope and intent",
  "header": "banner",
  "meta": { "status": "Draft", "version": "0.3", "date": "2026-11-15", "author": "Solution Architecture", "client": "Acme" },
  "legend": true,
  "brand": "brand.json"
}
```

| Field | Values | Notes |
|---|---|---|
| `type` | a name from `archistry types` | Aliases are accepted (`erd`, `swimlane`, `gantt`, `aim`, …) |
| `title`, `subtitle` | text | Without a title no header is drawn |
| `header` | `"title"` (default), `"banner"`, `false` | The banner is a navy band with `meta` on the right; use it for client-ready documents |
| `meta` | `status`, `version`, `date`, `author`, `client`, `logo` (icon key) | Shown in the header |
| `legend` | omitted (automatic), `true`, `false`, or `[{ "kind": "data", "label": "…" }, { "line": "batch", "label": "…" }]` | Automatic: a key appears when two or more colours or line styles carry meaning |
| `legendLabels` | `{ "salesforce": "In scope" }` | Rename automatic key entries |
| `brand` | path or object, `false` to ignore a `brand.json` beside the spec | See `assets/brand/brand.example.json` |

## Kinds (the colour vocabulary)

Every `kind` is a light tint plus a solid stroke of the same hue. Colour is classification: a kind
you use shows up in the key, so do not use one for decoration.

| `kind` | Meaning | Aliases |
|---|---|---|
| `salesforce` | Salesforce core clouds and platform | `sf`, `core`, `crm` |
| `data` | Data Cloud / Data 360 | `datacloud`, `data-cloud` |
| `ai` | Agentforce, Einstein, AI | `agentforce`, `agent`, `einstein` |
| `integration` | MuleSoft, middleware, APIs | `mulesoft`, `middleware`, `api` |
| `engagement` | Marketing, commerce, engagement | `marketing`, `commerce` |
| `analytics` | Analytics, reporting | |
| `security` | Identity, security, trust | `identity` |
| `external` | Non-Salesforce and legacy systems | `ext`, `legacy`, `third-party` |
| `user` | People and channels | `actor`, `person`, `channel` |
| `success` | Live, done, fit | `live`, `done`, `fit` |
| `warning` | At risk, planned, partial | `risk`, `planned`, `partial` |
| `danger` | Blocked, gap, error | `gap`, `blocked`, `error` |
| `muted` | Out of scope, future | `future`, `out-of-scope` |
| `purple` | Neutral emphasis / custom | `custom` |
| `neutral` | White card, grey border (default) | |

A kind may also be an object: `"kind": { "fill": "#fff0f6", "stroke": "#c2255c" }`.

## Icons

`"icon": "<category>/<name>"`. Around 200 icons ship with the skill and are embedded in the output,
so they render anywhere with nothing to install.

| Category | Contents | Examples |
|---|---|---|
| `product/` | Salesforce cloud logos | `product/sales_cloud`, `product/service_cloud`, `product/mulesoft`, `product/tableau`, `product/experience_cloud` |
| `cloud/` | Product icons | `cloud/field_service`, `cloud/heroku`, `cloud/analytics`, `cloud/loyalty` |
| `standard/` | SLDS object icons | `standard/account`, `standard/case`, `standard/flow`, `standard/apex`, `standard/data_cloud`, `standard/agent_astro`, `standard/prompt_builder`, `standard/knowledge`, `standard/slack` |
| `utility/` | Monochrome glyphs | `utility/user`, `utility/database`, `utility/integration`, `utility/lock`, `utility/event`, `utility/desktop` |
| `platform/` | Architecture kit: experience, intelligence, data | `platform/web`, `platform/apps_mobile`, `platform/channel`, `platform/automation`, `platform/data` |
| `industry/` | Industry icons | `industry/financial_services`, `industry/health`, `industry/retail` |
| `doctype/` | File types | `doctype/csv`, `doctype/pdf`, `doctype/excel` |

```bash
archistry icons search knowledge      # find a key
archistry icons list product          # one category
archistry icons show standard/flow    # raw draw.io style, for hand-written XML
```

Short names resolve too (`"icon": "flow"`, `"mulesoft"`, `"data-cloud"`, `"agentforce"`). An unknown
key produces an `icon not found` note and the card is drawn without an icon.

## Cards

Most engines draw the same card. Fields accepted wherever a card appears:

| Field | Meaning |
|---|---|
| `id` | Unique, used by links. Keep ids short and meaningful (`sales`, `erp`, `t_order`) |
| `label` | Title, 1 to 4 words |
| `sub` | One grey line under the title (product edition, API name, owner) |
| `items` | Short bullet list inside the card |
| `icon`, `kind` | As above |
| `badge` | Small pill on the top-right corner (`"New"`, `"Phase 2"`) |
| `status` | `live`, `in scope`, `planned`, `future`, `gap` … colours the card and adds a status key |
| `note` / `tooltip` | Hover text in HTML and draw.io |
| `link` | URL opened on click, or `data:page/id,<pageId>` for a page in the same file |
| `dashed` | `true` for a dashed border (proposed, optional) |

## Line styles (links)

| `style` | Drawn as | Use for |
|---|---|---|
| `sync` (default) | solid arrow | real-time request or API call |
| `async` / `event` | dotted arrow | events, pub/sub, fire-and-forget |
| `batch` | dashed arrow | scheduled or bulk transfer |
| `bidirectional` | arrows at both ends | two-way sync |
| `reference` | dashed, open arrow | dependency, grounding, lookup |
| `manual` | dash-dot | manual or file-based hand-off |
| `plain` | no arrow | association only |

Link fields: `from`, `to`, `label`, `style`, `step` (a number, or `true` to auto-number: turns a
static landscape into a walkthrough), `note` (second small line), `color` (a kind), `fromSide` /
`toSide` (`"E"`, `"W"`, `"N"`, `"S"` to force a side; rarely needed).

## Writing for the layout engine

- Order matters: children are placed in the order written. Put things that talk to each other next
  to each other and most crossings disappear.
- Flow direction follows the data or the process: sources and people on the left, consumers on the
  right, or top to bottom for layered landscapes.
- Gaps grow automatically to fit link labels, so a long link label makes the whole diagram wider.
  Keep them short and move detail to `note`.
- All geometry is snapped to a 10px grid and every connector is routed around boxes with explicit
  waypoints, so draw.io, the HTML page and exported images show the same lines.
