# Agentforce diagrams — Agent Interaction Map and Agent Instruction Diagram

Two diagram types for designing AI agents before (and after) building them in Agent Builder.

| Type | Level | Answers |
|---|---|---|
| `agent-interaction-map` (AIM) | The whole agent | Who talks to it, how it decides which topic applies, what each topic may do, what grounds it, where it hands off |
| `agent-instruction-diagram` (AID) | One topic | The instruction steps, deterministic actions, prompt templates, guardrails and the conditions between them |

The approach follows the Agent Interaction Map and Agent Instruction Diagram published by
[Elements.cloud](https://elements.cloud/agent-designer/) (their app's menu names the second one
"Agent Instruction Design"). These renditions are independent and unofficial: the layout and
styling here are this skill's own. The ideas carried over are the ones Elements documents:

- A topic is a **job to be done**.
- The topic's **classification description is the text on the line going into the topic box**, and
  its **scope is the text in the box**. The reasoning engine uses name, classification and scope to
  pick a topic, so these three are the design.
- Each topic box **drills down** to its instruction diagram.
- Inside a topic there are three kinds of step: an **agent instruction step** (the LLM reasons), an
  **agent action** (deterministic: Flow, Apex, API) and a **prompt template** (interpretation or
  generation).
- **Guardrails** are absolute "always" / "never" rules, one to three per topic, not business logic.
- **Flowline text is the condition** for the next step: unique and verifiable ("Customer provides
  order number").
- An instruction diagram is guidance for a digital employee, **not a deterministic flow**.

## agent-interaction-map

```json
{
  "type": "agent-interaction-map",
  "title": "Customer Service Agent — Agent Interaction Map",
  "agent": {
    "name": "Retail Service Agent",
    "type": "Agentforce Service Agent",
    "description": "Answers order, delivery and returns questions for signed-in customers.",
    "users": ["Customer", "Service rep (copilot)"],
    "channels": ["Web chat", "WhatsApp"],
    "instructions": ["Be concise and never guess"],
    "guardrails": ["Never reveal another customer's data"],
    "variables": ["Verified Contact Id", "Language"]
  },
  "topics": [
    {
      "name": "Order Status & Delivery",
      "classification": "Customer asks where an order is or when it will arrive.",
      "scope": "Share status and ETA, rebook delivery. Not refunds or pricing.",
      "actions": [
        { "label": "Verify customer identity", "kind": "flow", "target": "Flow: Verify_Customer" },
        { "label": "Get order status", "kind": "apex", "target": "Apex: OrderStatusService", "uses": ["oms"] }
      ],
      "steps": [ … ], "flows": [ … ], "guardrails": [ … ]
    }
  ],
  "escalation": { "label": "Escalation", "target": "Omni-Channel: Tier 2 queue" },
  "data": [ { "id": "oms", "label": "Order Management", "sub": "Orders, shipments" }, { "id": "kb", "label": "Knowledge" } ],
  "trustLayer": ["Dynamic grounding", "Data masking", "Zero data retention", "Toxicity detection", "Audit trail"]
}
```

Reading order, left to right: users and channels → the agent with its reasoning engine, global
instructions, guardrails and variables → topics → the actions each topic can run → grounding data
and systems.

| Field | Meaning |
|---|---|
| `agent.name`, `type`, `description` | The agent card |
| `agent.users`, `agent.channels` | Strings or cards; channel icons are picked from the name |
| `agent.engine`, `agent.reasoning` | Engine name (default "Atlas Reasoning Engine") and its steps |
| `agent.instructions`, `guardrails`, `variables` | Agent-level lists |
| `topics[]` | `name`, `classification` (drawn on the incoming line), `scope` (in the box), `actions`, optional `kind` |
| `topics[].actions[]` | `{ label, kind, target, uses, id }`. `kind`: `flow`, `apex`, `prompt`, `api`, `mulesoft`, `retriever`, `standard`, `handoff`. `uses` lists ids from `data` and draws dashed grounding lines |
| `topics[].steps`, `flows`, `guardrails`, `inputs`, `data` | When `steps` is present the topic gets its own Agent Instruction Diagram page; the topic box shows "Instruction diagram ▸" and links to it |
| `escalation` | `{ label, target, classification, scope }` — drawn as the last, amber topic with a human hand-off |
| `data` (or `grounding`) | Data sources and systems: `{ id, label, sub, icon }` |
| `trustLayer` | Chips in a band along the bottom |

Rules:

- Three to seven topics. More than that usually means two agents, or topics that should merge.
- Write classification descriptions so they do not overlap: if two could match the same utterance,
  the engine will pick inconsistently. Scope says what is in and what is out ("Not refunds").
- Name actions by what they do, with the real asset in `target` ("Flow: Verify_Customer").
- Always show how the agent escalates to a person.
- A multi-page file: page 1 is the map, then one page per topic with `steps`. In HTML, click a topic
  to open its page; in draw.io, use the page tabs or the link on the topic.

## agent-instruction-diagram

Stand-alone, or embedded in a topic of the map (same fields under the topic).

```json
{
  "type": "agent-instruction-diagram",
  "title": "Order Status — Agent Instruction Diagram",
  "topic": { "name": "Order Status & Delivery", "classification": "…", "scope": "…" },
  "guardrails": ["Always verify identity before sharing order details", "Never promise an unconfirmed delivery date"],
  "inputs": ["Verified Contact Id", "Order number"],
  "data": ["Order & OrderItem", "Shipment (carrier API)"],
  "steps": [
    { "id": "ask", "kind": "instruction", "label": "Ask for the order number or the email used at checkout" },
    { "id": "verify", "kind": "action", "label": "Verify customer identity", "resource": "Flow: Verify_Customer" },
    { "id": "explain", "kind": "prompt", "label": "Summarise status and ETA in plain language", "resource": "Order Status Summary" },
    { "id": "handoff", "kind": "handoff", "label": "Transfer to a service rep with the summary", "resource": "Omni-Channel: Tier 2 queue" }
  ],
  "flows": [
    { "from": "start", "to": "ask", "label": "Customer asks about an order" },
    { "from": "ask", "to": "verify", "label": "Customer provides order number" },
    { "from": "verify", "to": "handoff", "label": "Verification fails twice", "kind": "exception" },
    { "from": "verify", "to": "explain", "label": "Identity verified" },
    { "from": "explain", "to": "end", "label": "Customer has what they need" }
  ]
}
```

| Step `kind` | Box footer | Meaning |
|---|---|---|
| `instruction` | AI Agent | Probabilistic: the agent reasons, asks, decides, informs |
| `action` | Flow / Apex / API named in `resource` | Deterministic: retrieve, update, trigger |
| `prompt` | Prompt Template named in `resource` | Interpretation or generation by a prompt template |
| `handoff` | Human handoff, queue in `resource` | Transfer to a person |

Steps are numbered in the order written. `start` and `end` in `flows` create the entry and exit
points; the label on the line from `start` is the trigger. `wrap` (default 4) sets how many steps
sit on a row before the diagram continues underneath.

Rules:

- Start every step with a verb: "Ask…", "Verify…", "Retrieve…", "Summarise…", "Offer…".
- One condition per line, phrased so a tester can check it. Avoid "if needed".
- Use `instruction` for judgement, `action` for anything that must happen the same way every time,
  `prompt` for interpreting or drafting text. If a step must never be skipped, make it an action.
- One to three guardrails, each beginning "Always" or "Never".
- Affirmative phrasing; no hard-coded record names; eight to ten steps at most. Longer topics should
  split into two.
- The diagram maps to Agent Builder: topic name, classification and scope from the header panel,
  one instruction block from the steps and conditions, one action per `action` / `prompt` step.
