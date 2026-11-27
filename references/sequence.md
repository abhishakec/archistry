# sequence — who calls whom, in what order

Types: `sequence` (integration call order, agent conversations) and
`oauth-flow`.

```json
{
  "type": "sequence",
  "title": "Order Submission — Integration Sequence",
  "participants": [
    {
      "id": "rep",
      "label": "Sales Rep",
      "kind": "user",
      "icon": "utility/user"
    },
    {
      "id": "sf",
      "label": "Salesforce",
      "sub": "Order + Flow",
      "kind": "salesforce",
      "icon": "product/sales_cloud"
    },
    {
      "id": "mule",
      "label": "MuleSoft",
      "sub": "order-papi",
      "kind": "integration",
      "icon": "product/mulesoft"
    }
  ],
  "messages": [
    { "from": "rep", "to": "sf", "label": "Activate order" },
    { "from": "sf", "to": "mule", "label": "POST /credit-checks" },
    { "from": "mule", "to": "sf", "label": "200 approved", "kind": "reply" },
    {
      "fragment": "alt",
      "label": "approved",
      "messages": [
        { "from": "sf", "to": "sf", "label": "Set Status = Activated" },
        {
          "from": "sf",
          "to": "mule",
          "label": "Publish Order_Activated__e",
          "kind": "async"
        }
      ],
      "else": [
        {
          "label": "declined",
          "messages": [
            {
              "from": "sf",
              "to": "rep",
              "label": "Show reason",
              "kind": "error"
            }
          ]
        }
      ]
    },
    { "divider": "Fulfilment" },
    { "note": "Retries use the same idempotency key.", "over": ["mule"] }
  ]
}
```

## Fields

| Field          | Meaning                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `participants` | Left to right in the order written: `{ id, label, sub, kind, icon }`. Put the initiator first and keep the main path flowing right |
| `messages`     | Top to bottom in the order written                                                                                                 |
| `autonumber`   | Default `true`; set `false` to hide step numbers                                                                                   |

Message entries:

| Entry                                 | Meaning                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `{ from, to, label, kind }`           | A message. `from` = `to` draws a self-call                                                                                         |
| `kind: "sync"` (default)              | Solid line, filled arrow: the caller waits. Opens an activation bar on the receiver                                                |
| `kind: "reply"`                       | Dashed line, open arrow: the response. Closes the activation bar                                                                   |
| `kind: "async"`                       | Solid line, open arrow: event, queue, platform event, fire-and-forget                                                              |
| `kind: "error"`                       | Red dashed reply                                                                                                                   |
| `kind: "create"`                      | Dotted: creates the participant                                                                                                    |
| `{ fragment, label, messages, else }` | A frame. `fragment` is `alt`, `opt`, `loop`, `par` or `break`; `label` is the condition; `else` is a list of `{ label, messages }` |
| `{ divider }`                         | A labelled horizontal break between phases                                                                                         |
| `{ note, over }`                      | A note over one participant or spanning several                                                                                    |

## Rules

- A participant is a system, component or person, named as the reader knows it:
  "Salesforce" with `sub` "REST API", not "Server".
- Label messages with the real operation where it helps:
  `POST /services/oauth2/token`, `Publish Order_Activated__e`,
  `Bulk API 2.0 upsert`.
- Pair every `sync` with a `reply` (or an `error`).
- Six participants or fewer; fifteen messages or fewer. Split by phase with a
  second diagram rather than shrinking the first.
- Only `alt` / `opt` / `loop` where the branch matters to the reader.

## OAuth and SSO flows

Use one participant per real actor: the user (browser), the client app, the
Salesforce authorization server, and the resource (Salesforce API, or the
service provider for SSO). Typical sets:

| Flow                                   | Participants                                                      | Key messages                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web server (authorization code) + PKCE | User, Client app, Salesforce authorization server, Salesforce API | redirect to `/services/oauth2/authorize` with `code_challenge`; login + consent; redirect with `code`; `POST /services/oauth2/token` with `code_verifier`; tokens; API call with Bearer token |
| JWT bearer (server to server)          | Integration, Salesforce authorization server, Salesforce API      | sign JWT with the certificate key; `POST /token` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`; access token (no refresh token); API call                                     |
| Client credentials                     | Service, Salesforce authorization server, Salesforce API          | `POST /token` with `grant_type=client_credentials`; access token as the run-as user                                                                                                           |
| Refresh token                          | Client app, Salesforce authorization server                       | `POST /token` with `grant_type=refresh_token`; new access token                                                                                                                               |
| Device                                 | Device, User (second screen), Salesforce authorization server     | device code + verification URL; user approves; device polls `/token`                                                                                                                          |
| SAML SSO, SP-initiated                 | User, Salesforce (service provider), Identity provider            | redirect with `AuthnRequest`; authenticate; `SAMLResponse` posted to the ACS URL; session                                                                                                     |

Say in the subtitle which flow it is and when to use it. Start from
`archistry init oauth-flow`.

## Checklist

- Initiator on the left; main path reads left to right, top to bottom.
- Every sync call has a reply or error.
- Secrets, tokens and keys are named, never shown.
