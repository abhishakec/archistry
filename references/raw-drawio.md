# Hand-written draw.io XML (escape hatch)

Use a spec whenever a diagram type fits; the engine places and routes better
than hand-typed coordinates. Write XML directly only for a one-off that no type
covers, or to change an existing `.drawio` file. Then always run
`archistry validate file.drawio` and fix every ERROR.

## Skeleton (non-negotiable)

```xml
<mxfile host="app.diagrams.net" type="device">
  <diagram id="page-1" name="Page-1">
    <mxGraphModel
      dx="1600"
      dy="1000"
      grid="1"
      gridSize="10"
      guides="1"
      tooltips="1"
      connect="1"
      arrows="1"
      fold="1"
      page="1"
      pageScale="1"
      pageWidth="1600"
      pageHeight="1000"
      math="0"
      shadow="0"
    >
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- content -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

- Never emit compressed or base64 `<diagram>` payloads.
- Cells `0` and `1` always exist; everything else parents to `1` or to a
  container cell.
- Every id unique and meaningful (`sys_crm`, `edge_crm_dc`): validator messages
  quote ids.
- Escape label text: `&amp;` `&lt;` `&gt;` `&quot;`. With `html=1` labels may
  use `<b>`, `<i>`, `<u>`, `<br>`, `<hr>` and
  `<font color="#5c5c5c" style="font-size:11px">`.
- Child coordinates are relative to their parent container.
- Snap to the 10px grid. Size `pageWidth` / `pageHeight` to the content plus
  40px margin.

## Shapes the HTML viewer and image export understand

Stay inside this vocabulary so all three outputs match.

| Style                                                                         | Shape                                                             |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `rounded=1;arcSize=16;absoluteArcSize=1;`                                     | Card (corner radius = arcSize / 2)                                |
| `ellipse;` · `shape=doubleEllipse;` · `rhombus;` · `triangle;`                | Circle / oval, double circle (event), diamond, triangle           |
| `shape=hexagon;` · `shape=parallelogram;` · `shape=step;size=14;fixedSize=1;` | Hexagon, parallelogram, chevron                                   |
| `shape=cylinder3;size=12;boundedLbl=1;`                                       | Data store                                                        |
| `shape=document;` · `shape=note;` · `shape=process;`                          | Document, note, sub-process                                       |
| `swimlane;startSize=40;horizontal=0;`                                         | Lane with a rotated title strip (`horizontal=1` for a top header) |
| `shape=umlLifeline;size=60;` · `shape=umlActor;`                              | Sequence lifeline, stick figure                                   |
| `shape=image;image=data:image/svg+xml,<base64>;`                              | Embedded icon (get the style from `archistry icons show <key>`)   |
| `text;` · `shape=line;` · `group;`                                            | Text only, rule, invisible group                                  |

Common keys: `fillColor`, `strokeColor`, `strokeWidth`, `dashed`, `dashPattern`,
`fontColor`, `fontSize`, `fontStyle` (1 bold, 2 italic, 4 underline), `align`,
`verticalAlign`, `spacing*`, `whiteSpace=wrap`, `html=1`, `opacity`, `shadow`,
`rotation`, `container=1;collapsible=0`.

A card:

```xml
<mxCell
  id="sys_crm"
  value="&lt;b&gt;Sales Cloud&lt;/b&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot; color=&quot;#5c5c5c&quot;&gt;Accounts, orders&lt;/font&gt;"
  style="html=1;whiteSpace=wrap;rounded=1;arcSize=16;absoluteArcSize=1;fillColor=#eaf5fe;strokeColor=#0176d3;strokeWidth=1.5;fontColor=#032d60;fontSize=13;"
  vertex="1"
  parent="1"
><mxGeometry x="100" y="200" width="180" height="60" as="geometry" /></mxCell>
```

A connector with fixed ports and one bend:

```xml
<mxCell
  id="edge_crm_dc"
  value="Hourly"
  edge="1"
  parent="1"
  source="sys_crm"
  target="sys_dc"
  style="html=1;edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#514f4d;strokeWidth=1.5;endArrow=block;endFill=1;endSize=6;fontSize=11;fontColor=#032d60;labelBackgroundColor=#ffffff;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;"
>
  <mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint
        x="340"
        y="230"
      /><mxPoint x="340" y="330" /></Array></mxGeometry>
</mxCell>
```

Arrowheads: `none`, `block`, `open`, `classic`, `diamond`, `oval`, and the ER
set `ERone`, `ERmandOne`, `ERmany`, `ERoneToMany`, `ERzeroToOne`, `ERzeroToMany`
(set `startFill=0;endFill=0` and `startSize=10;endSize=10` with ER markers).
`curved=1` draws a smooth curve through the points.

## Palette

Text `#032d60`, secondary text `#5c5c5c`, connector `#514f4d`, neutral border
`#969492`.

| Role                   | Fill      | Stroke    |
| ---------------------- | --------- | --------- |
| Salesforce core        | `#eaf5fe` | `#0176d3` |
| Data Cloud / Data 360  | `#f6f2fb` | `#5a1ba9` |
| AI / Agentforce        | `#eef1ff` | `#3a49da` |
| Integration / MuleSoft | `#def9f3` | `#0b827c` |
| Marketing / engagement | `#ffece3` | `#dd5a1b` |
| Success                | `#ebf7e6` | `#2e844a` |
| Warning                | `#fbf3e0` | `#ca8501` |
| Danger                 | `#fef1ee` | `#ba0517` |
| Security / identity    | `#fdf0f7` | `#b60554` |
| External               | `#f3f3f3` | `#747474` |

Light fills, dark text, a key whenever two or more colours carry meaning.

## Salesforce notation reminders

- **Data model:** draw relationships child → parent. Lookup:
  `startArrow=ERzeroToMany` at the child, `endArrow=ERzeroToOne` at the parent.
  Required lookup: `endArrow=ERmandOne`. Master-detail:
  `endArrow=diamond;endFill=0`. Entity = swimlane with the logical name in bold,
  the API name in italics, `#` before key fields.
- **Architecture:** cards in zones, zones on one axis, every connector labelled;
  solid = real-time, dashed = batch, dotted = event.
- **Process:** one lane per role or system, one direction of flow, labelled
  exits on every decision.

## Validation

```bash
archistry validate file.drawio            # human output
archistry validate file.drawio --json     # machine output
archistry validate file.drawio --strict   # exit 3 if warnings remain
```

| Level                          | Codes                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ERROR (file is broken)         | `missing-layer`, `missing-id`, `dup-id`, `bad-parent`, `bad-edge-ref`, `no-geometry`, `overlap`, `escapes-container`                                                                   |
| WARNING (file is hard to read) | `edge-through-box`, `label-clipped`, `tight-spacing`, `overlap-slight`, `outside-page`, `negative-coords`, `dangling-edge`, `low-contrast`, `tiny-font`, `many-crossings`, `too-dense` |

Loop: write → validate → fix → validate, until there are no errors. Most
geometry findings are fixed by widening the page and spreading the boxes. Cells
that are decoration rather than content (backgrounds, frames, header strips)
should carry `connectable="0"` so the overlap checks skip them; badges and icons
inside a card carry `part=1` in their style.
