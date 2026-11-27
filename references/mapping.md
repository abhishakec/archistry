# mapping — field-level mapping between stages

Type: `data-cloud-mapping` (aliases `field-mapping`, `data-mapping`,
`data-migration-mapping`). Use it for source → DLO → DMO in Data Cloud, legacy →
Salesforce in a migration, or API payload → object in an integration.

From a spreadsheet:

```bash
archistry mapping-from-csv mappings.csv -o diagrams/mapping.json --title "CRM to Data Cloud Mapping"
```

CSV header (case-insensitive, extra columns ignored): `source_object`,
`source_field`, `target_dmo`, `target_field` are required; `source_system`,
`category`, `mapping_type` are optional. `mapping_type` of `direct` or empty
draws a plain line; anything else becomes the label (`formula: TRIM` → "TRIM").
If the user's sheet has other column names, rewrite a conforming CSV.

Hand-written:

```json
{
  "type": "data-cloud-mapping",
  "title": "Customer Profile — Data Cloud Field Mapping",
  "stages": [
    {
      "label": "Source",
      "sub": "Data streams",
      "kind": "salesforce",
      "tables": [
        {
          "id": "crm",
          "label": "Contact",
          "api": "Sales Cloud",
          "icon": "standard/contact",
          "fields": [
            { "name": "Id", "type": "Id", "key": true },
            "FirstName",
            "Email"
          ]
        }
      ]
    },
    {
      "label": "Data Lake Objects",
      "sub": "DLO",
      "kind": "data",
      "tables": [
        {
          "id": "dlo",
          "label": "Contact_Home",
          "api": "__dll",
          "fields": [
            { "name": "Id__c", "key": true },
            "FirstName__c",
            "Email__c"
          ]
        }
      ]
    },
    {
      "label": "Data Model Objects",
      "sub": "DMO",
      "kind": "purple",
      "tables": [
        {
          "id": "ind",
          "label": "Individual",
          "api": "ssot__Individual__dlm",
          "fields": [{ "name": "Individual Id", "key": true }, "First Name"]
        }
      ]
    }
  ],
  "maps": [
    { "from": "crm.Id", "to": "dlo.Id__c", "kind": "key" },
    { "from": "crm.Email", "to": "dlo.Email__c" },
    {
      "from": "dlo.FirstName__c",
      "to": "ind.First Name",
      "label": "TRIM()",
      "kind": "transform"
    }
  ]
}
```

| Field    | Meaning                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------- |
| `stages` | Two or more columns, left to right: `{ label, sub, kind, tables }`                                |
| `tables` | `{ id, label, api, icon, fields }`. `api` is a small second line (system, API name, DMO category) |
| `fields` | Strings or `{ name, type, key }`. Every field is a row that a map can attach to                   |
| `maps`   | `{ from: "<tableId>.<field name>", to: "<tableId>.<field name>", label, kind, note }`             |
| `gap`    | Space between stages (default 200)                                                                |

| Map `kind`              | Drawn as                                  | Use for                                                                |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `direct` (default)      | blue line                                 | Copy as is                                                             |
| `transform` / `formula` | orange dashed line with the rule as label | Formula, concatenation, format change. Default when a `label` is given |
| `key`                   | thick purple line                         | Primary key and identity fields                                        |
| `lookup`                | teal dotted line                          | Foreign key resolved to another object                                 |
| `default`               | grey dotted line                          | Constant or default value                                              |

Rules:

- List every field you want the reader to see, mapped or not. Unmapped fields
  are greyed, which is how the diagram shows what is left behind.
- Keep labels to the rule itself (`LOWER()`, `ISO → name`). Longer logic goes in
  `note`.
- Order fields so most lines run straight across.
- About 30 mappings per page. Split by source object or by DMO beyond that.
- For Data Cloud, name DMOs as they appear in the data model (`Individual`,
  `Contact Point Email`, `Unified Individual`) and show the API name in `api`.
