# tables — data models (ERD) and class diagrams

Types: `data-model` (Salesforce data-model notation) and `class-diagram` (UML, for Apex).

## data-model

With an SFDX project available, generate first and edit after:

```bash
archistry erd-from-sfdx ./ -o diagrams/data-model.json --objects Promotion__c,Merchant__c --include-fields 8
```

Hand-written:

```json
{
  "type": "data-model",
  "title": "Promotions — Data Model",
  "entities": [
    { "id": "Account", "label": "Account", "api": "Account", "icon": "standard/account",
      "fields": ["# Customer_Number__c : Text (Ext ID)", "Name : Text", "Tier__c : Picklist"] },
    { "id": "Promotion__c", "label": "Promotion", "api": "Promotion__c",
      "fields": [ { "name": "Promo_Code__c", "type": "Text", "key": true }, { "name": "Status__c", "type": "Picklist", "required": true } ], "more": 9 }
  ],
  "relationships": [
    { "from": "Promotion__c", "to": "Account", "type": "lookup", "label": "Account__c" }
  ]
}
```

### Entities

| Field | Meaning |
|---|---|
| `id` | Used by relationships; use the API name |
| `label`, `api` | Bold logical name and italic API name |
| `kind` | `standard`, `custom`, `external`, `data` (DLO / DMO), `bigobject`, `event`, `metadata`, `managed`. Inferred from the API suffix when omitted: `__c` custom, `__x` external, `__dlm` / `__dll` Data Cloud, `__e` / `__mdt` / `__b` platform event, metadata type, big object |
| `fields` | Strings `"Name : Type"` (prefix `#` for key or external ID fields), or `{ name, type, key, required }` |
| `more` | Number of fields not shown; draws "… +N more" |
| `icon` | Usually `standard/<object>` |
| `group` | Domain name. When two or more groups are used, each becomes a framed column |
| `row`, `col` | Explicit grid position (set on every entity or on none) |

Spec options: `maxFields` (default 12), `maxPerRow` (default 4), `gapX`, `gapY`.

### Relationships

Written child → parent: `"from"` is the object that holds the relationship field.

| `type` | Notation | When |
|---|---|---|
| `lookup` | crow's foot at the child, circle-and-bar (zero or one) at the parent | Optional lookup |
| `required-lookup` | crow's foot at the child, double bar (exactly one) at the parent | Lookup marked required |
| `master-detail` | crow's foot at the child, diamond at the parent | Master-detail (ownership, cascade delete, roll-ups) |
| `many-to-many` | crow's feet at both ends | Only when the junction object is not drawn; otherwise draw the junction with two master-details |
| `one-to-one` | double bar at both ends | Enforced by a unique lookup |
| `external` | dashed lookup | External or indirect lookup |
| `hierarchy` | lookup to itself | Self-relationship (`"from"` = `"to"`) |

`label` is the relationship field API name. The key at the bottom is generated from the entity
kinds and relationship types used.

### Rules

- 6 to 8 representative fields per entity; keys, relationship fields and the fields the discussion
  is about. Use `more` for the rest.
- Parents are placed above children automatically. For a big model, set `group` per domain (Sales,
  Service, Billing) or split by domain.
- Master-detail vs lookup is a design decision with consequences (sharing, deletion, roll-up
  summaries): draw what is built, not what looks tidy.
- Up to about 12 entities per page.

## class-diagram

```json
{
  "type": "class-diagram",
  "title": "Order Trigger Framework",
  "classes": [
    { "id": "TriggerHandler", "kind": "abstract", "methods": ["+ run() : void", "# beforeInsert() : void"] },
    { "id": "OrderService", "fields": ["- erp : IErpGateway"], "methods": ["+ submitToErp(orderIds) : void"] },
    { "id": "IErpGateway", "kind": "interface", "methods": ["+ createOrder(payload) : ErpResponse"] }
  ],
  "relationships": [
    { "from": "OrderService", "to": "IErpGateway", "type": "association" }
  ]
}
```

Class `kind`: `class` (default), `abstract`, `interface`, `enum`, `trigger`, `test`. Members are
strings with a UML visibility prefix (`+` public, `#` protected, `-` private) or
`{ name, type, visibility }`.

| `type` | Notation | Direction |
|---|---|---|
| `extends` | solid line, hollow triangle | subclass → superclass |
| `implements` | dashed line, hollow triangle | class → interface |
| `uses` | dashed line, open arrow | dependent → dependency |
| `association` | solid line, open arrow | holder → held |
| `composition` | filled diamond at the owner | owner → part |
| `aggregation` | hollow diamond at the owner | owner → part |

Show the classes that explain the design (handler, service, selector, gateway) and only the members
that matter. Eight to ten classes per diagram.
