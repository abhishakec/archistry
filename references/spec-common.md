# Spec fields shared by every diagram type

A spec is one JSON object. `type` selects the diagram; everything else is
content.

```json
{
  "type": "solution-architecture",
  "title": "Order Management — Solution Architecture",
  "subtitle": "One or two sentences on purpose, scope and message",
  "header": "card",
  "meta": {
    "status": "Draft",
    "version": "0.3",
    "date": "2026-11-15",
    "author": "Solution Architecture",
    "client": "Acme"
  },
  "legend": true,
  "brand": "brand.json",
  "viewer": { "highlight": false, "animate": false }
}
```

| Field               | Values                                                                                                           | Notes                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`              | a name from `archistry types`                                                                                    | Aliases are accepted (`erd`, `swimlane`, `gantt`, `aim`, …)                                                                                                                                                                                                                                                                      |
| `title`, `subtitle` | text                                                                                                             | `subtitle` is the header card's Description: purpose, scope and message in one or two sentences (`description` is accepted as an alias). Without a title no header is drawn and the build prints a NOTE                                                                                                                          |
| `header`            | `"card"` (default), `"banner"`, `"title"`, `false`                                                               | `card` is the Salesforce Architects header: a full-width grey band at least 10% of the diagram height, title and description on a white panel with a curved edge, and the Key on a white panel to the right in even rows. `banner` is a navy band with `meta` on the right; `title` is plain text with the key under the diagram |
| `meta`              | `status`, `version`, `date`, `author`, `client`, `logo` (icon key)                                               | Card: under the description, or in the key panel when there is no key; `logo` sits by the title                                                                                                                                                                                                                                  |
| `legend`            | omitted (automatic), `true`, `false`, or `[{ "kind": "data", "label": "…" }, { "line": "batch", "label": "…" }]` | Automatic: a key appears when two or more colours or line styles carry meaning. With the card header it sits in the header, otherwise under the diagram                                                                                                                                                                          |
| `legendLabels`      | `{ "salesforce": "In scope", "sync": "Replaces" }`                                                               | Rename automatic key entries: colour kinds and line styles (`sync`, `async`, `batch`, `reference`, …)                                                                                                                                                                                                                            |
| `viewer`            | `{ "highlight": bool, "animate": bool }`, both optional, default `false`                                         | HTML defaults only: `highlight` fades all but the hovered or clicked box and its connections, `animate` moves dashes along connectors. `animate` also adds `flowAnimation=1` to every connector in the .drawio. CLI `--highlight` / `--animate` override it                                                                      |
| `brand`             | path or object, `false` to ignore a `brand.json` beside the spec                                                 | See `assets/brand/brand.example.json`                                                                                                                                                                                                                                                                                            |

A top-level field no diagram type reads (a typo such as `direcion`) is ignored,
and `build` and `validate` print a `NOTE` with a "did you mean" suggestion. The
note never fails a build.

## Kinds (the colour vocabulary)

Every `kind` is a light tint plus a solid stroke of the same hue. Colour is
classification: a kind you use shows up in the key, so do not use one for
decoration.

| `kind`        | Meaning                             | Aliases                           |
| ------------- | ----------------------------------- | --------------------------------- |
| `salesforce`  | Salesforce core clouds and platform | `sf`, `core`, `crm`               |
| `data`        | Data Cloud / Data 360               | `datacloud`, `data-cloud`         |
| `ai`          | Agentforce, Einstein, AI            | `agentforce`, `agent`, `einstein` |
| `integration` | MuleSoft, middleware, APIs          | `mulesoft`, `middleware`, `api`   |
| `engagement`  | Marketing, commerce, engagement     | `marketing`, `commerce`           |
| `analytics`   | Analytics, reporting                |                                   |
| `security`    | Identity, security, trust           | `identity`                        |
| `external`    | Non-Salesforce and legacy systems   | `ext`, `legacy`, `third-party`    |
| `user`        | People and channels                 | `actor`, `person`, `channel`      |
| `success`     | Live, done, fit                     | `live`, `done`, `fit`             |
| `warning`     | At risk, planned, partial           | `risk`, `planned`, `partial`      |
| `danger`      | Blocked, gap, error                 | `gap`, `blocked`, `error`         |
| `muted`       | Out of scope, future                | `future`, `out-of-scope`          |
| `purple`      | Neutral emphasis / custom           | `custom`                          |
| `neutral`     | White card, grey border (default)   |                                   |

A kind may also be an object:
`"kind": { "fill": "#fff0f6", "stroke": "#c2255c" }`.

## Icons

`"icon": "<category>/<name>"`. Around 200 icons ship with the skill and are
embedded in the output, so they render anywhere with nothing to install.

| Category    | Contents                                         | Examples                                                                                                                                                                                |
| ----------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product/`  | Salesforce cloud logos                           | `product/sales_cloud`, `product/service_cloud`, `product/mulesoft`, `product/tableau`, `product/experience_cloud`                                                                       |
| `cloud/`    | Product icons                                    | `cloud/field_service`, `cloud/heroku`, `cloud/analytics`, `cloud/loyalty`                                                                                                               |
| `standard/` | SLDS object icons                                | `standard/account`, `standard/case`, `standard/flow`, `standard/apex`, `standard/data_cloud`, `standard/agent_astro`, `standard/prompt_builder`, `standard/knowledge`, `standard/slack` |
| `utility/`  | Monochrome glyphs                                | `utility/user`, `utility/database`, `utility/integration`, `utility/lock`, `utility/event`, `utility/desktop`                                                                           |
| `platform/` | Architecture kit: experience, intelligence, data | `platform/web`, `platform/apps_mobile`, `platform/channel`, `platform/automation`, `platform/data`                                                                                      |
| `industry/` | Industry icons                                   | `industry/financial_services`, `industry/health`, `industry/retail`                                                                                                                     |
| `doctype/`  | File types                                       | `doctype/csv`, `doctype/pdf`, `doctype/excel`                                                                                                                                           |

```bash
archistry icons search knowledge      # find a key
archistry icons list product          # one category
archistry icons show standard/flow    # raw draw.io style, for hand-written XML
```

Short names resolve too (`"icon": "flow"`, `"mulesoft"`, `"data-cloud"`,
`"agentforce"`). An unknown key produces an `icon not found` note and the card
is drawn without an icon.

## Cards

Most engines draw the same card. Fields accepted wherever a card appears:

| Field              | Meaning                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| `id`               | Unique, used by links. Keep ids short and meaningful (`sales`, `erp`, `t_order`)        |
| `label`            | Title, 1 to 4 words                                                                     |
| `sub`              | One grey line under the title (product edition, API name, owner)                        |
| `items`            | Short bullet list inside the card                                                       |
| `icon`, `kind`     | As above                                                                                |
| `badge`            | Small pill on the top-right corner (`"New"`, `"Phase 2"`)                               |
| `status`           | `live`, `in scope`, `planned`, `future`, `gap` … colours the card and adds a status key |
| `note` / `tooltip` | Hover text in HTML and draw.io                                                          |
| `link`             | URL opened on click, or `data:page/id,<pageId>` for a page in the same file             |
| `dashed`           | `true` for a dashed border (proposed, optional)                                         |

## Line styles (links)

| `style`           | Drawn as            | Use for                          |
| ----------------- | ------------------- | -------------------------------- |
| `sync` (default)  | solid arrow         | real-time request or API call    |
| `async` / `event` | dotted arrow        | events, pub/sub, fire-and-forget |
| `batch`           | dashed arrow        | scheduled or bulk transfer       |
| `bidirectional`   | arrows at both ends | two-way sync                     |
| `reference`       | dashed, open arrow  | dependency, grounding, lookup    |
| `manual`          | dash-dot            | manual or file-based hand-off    |
| `plain`           | no arrow            | association only                 |

Link fields: `from`, `to`, `label`, `style`, `step` (a number, or `true` to
auto-number: turns a static landscape into a walkthrough), `note` (second small
line), `color` (a kind), `fromSide` / `toSide` (`"E"`, `"W"`, `"N"`, `"S"` to
force a side; rarely needed).

## Writing for the layout engine

- Order matters: children are placed in the order written. Put things that talk
  to each other next to each other and most crossings disappear.
- Flow direction follows the data or the process: sources and people on the
  left, consumers on the right, or top to bottom for layered landscapes.
- Gaps grow automatically to fit link labels, so a long link label makes the
  whole diagram wider. Keep them short and move detail to `note`.
- All geometry is snapped to a 10px grid and every connector is routed around
  boxes with explicit waypoints, so draw.io, the HTML page and exported images
  show the same lines.
