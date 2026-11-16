# journey — customer journey maps and service blueprints

Types: `customer-journey` (aliases `journey-map`, `user-journey`) and `service-blueprint`.
Both are a grid of phases (columns) by rows.

```json
{
  "type": "customer-journey",
  "title": "Broadband Fault — Customer Journey (As-Is)",
  "persona": { "name": "Priya, home-working customer", "role": "Residential broadband", "goal": "Get my connection back today", "scenario": "Internet drops before a client call" },
  "phases": ["Notice the problem", "Seek help", "Diagnose", "Resolution"],
  "rows": [
    { "label": "Doing", "cells": ["Restarts router", "Calls support", "Repeats details", "Engineer fixes line"] },
    { "label": "Touchpoints", "style": "chips", "cells": [["Router app"], ["IVR", "Phone"], ["Phone"], ["Engineer"]] },
    { "emotion": true },
    { "label": "Pain points", "kind": "danger", "cells": ["No outage alert", "22 min wait", "No shared history", ""] },
    { "label": "Opportunities", "kind": "success", "cells": ["Proactive notification", "Agentforce self-service", "Single case timeline", "Automatic credit"] }
  ],
  "emotion": [ { "score": -1, "label": "Worried" }, { "score": -2, "label": "Frustrated" }, -2, 1 ]
}
```

| Field | Meaning |
|---|---|
| `persona` | Optional banner: `name`, `role`, `goal`, `scenario`, `icon` |
| `phases` | Strings or `{ label, sub, kind }`. Four to seven |
| `rows` | In display order. Each row has one cell per phase |
| row `cells` | A string, or a list of strings (bullets; with `"style": "chips"` they become pills) |
| row `kind` | Tints the row: `danger` for pain points, `success` for opportunities, `salesforce` / `external` for stage rows |
| row `chipKind` | Colour of the chips |
| `{ "emotion": true }` | Where the emotion curve goes among the rows (at the end if omitted) |
| `emotion` | One entry per phase: a number from -2 to 2, or `{ score, label }` |
| `{ "divider": "Line of visibility" }` | A dashed line between rows (service blueprint) |
| `phaseLabel`, `emotionLabel`, `labelWidth`, `columnWidth` | Wording and sizing |

## Customer journey

Rows that earn their place: **Doing**, **Thinking**, **Touchpoints** (chips), the emotion curve,
**Pain points**, **Opportunities**, and for a Salesforce project **Systems** (chips with the
product that will serve each stage). One persona and one scenario per map. As-is and to-be are two
maps. Write cells from the customer's side, in their words.

## Service blueprint

```json
{ "type": "service-blueprint", "phaseLabel": "Step", "phases": ["Report fault", "Diagnose", "Repair"],
  "rows": [
    { "label": "Customer actions", "kind": "user", "cells": ["…", "…", "…"] },
    { "label": "Evidence", "style": "chips", "cells": [["Mobile app"], ["Chat"], ["Service report"]] },
    { "divider": "Line of interaction" },
    { "label": "Front stage", "sub": "Visible to customer", "kind": "salesforce", "cells": ["…", "…", "…"] },
    { "divider": "Line of visibility" },
    { "label": "Back stage", "sub": "Not visible", "kind": "external", "cells": ["…", "…", "…"] },
    { "divider": "Line of internal interaction" },
    { "label": "Systems", "style": "chips", "chipKind": "data", "cells": [["Agentforce"], ["Service Cloud"], ["Field Service"]] }
  ] }
```

Keep the three lines in that order. Every customer action should have something under it; an empty
column under a step is a finding worth pointing out.
