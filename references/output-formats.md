# Output formats: draw.io, HTML, images and the round trip

One model, several outputs. The model is uncompressed draw.io XML; the HTML page
embeds that XML; images are rendered from it. Nothing is uploaded anywhere.

```
spec.json ──build──▶ name.drawio  ◀──convert──▶  name.html
                          │                          │
                          └──────export──────▶ name.png / .jpg / .svg
```

## Commands

```bash
archistry build spec.json                                  # name.drawio + name.html
archistry build spec.json --format drawio,html,png         # also an image
archistry build spec.json --format all -o out/order-flow   # drawio + html + png + svg under another base name
archistry build spec.json --theme dark --scale 3           # dark HTML and images, 3x pixel density

archistry export name.drawio -o name.png                   # image from a (possibly hand-edited) file
archistry export name.html --format png,jpg,svg            # same, from the HTML
archistry export name.drawio -o page2.png --page 2         # one page of a multi-page file
archistry export name.drawio -o name.png --transparent     # PNG without a background

archistry convert name.drawio -o name.html                 # any draw.io file -> interactive HTML
archistry build spec.json --highlight --animate            # HTML opens with Highlight and Animate on (also adds flowAnimation to the .drawio)
archistry convert name.drawio -o name.html --animate      # same flags on convert
archistry convert name.html -o name.drawio                 # HTML saved from the browser -> draw.io
archistry validate name.drawio                             # lint: also accepts .html and spec .json
```

`build` exits 0 when the diagram passed, 2 when it failed, and 3 with `--strict`
when warnings remain. `--json` prints a machine-readable receipt (files, stats,
findings).

## draw.io file

- Uncompressed XML: readable in a diff, reviewable in a pull request.
- Opens in draw.io desktop, app.diagrams.net, and VS Code with the draw.io
  Integration extension (`hediet.vscode-drawio`).
- Icons are embedded as data, so the file renders on any machine with no shape
  library installed.
- Connectors are attached to their boxes with fixed ports and explicit
  waypoints. Moving a box in draw.io keeps its connectors attached and
  orthogonal.
- Multi-page files (an Agent Interaction Map with instruction diagrams) use
  draw.io pages and page links.

## HTML file

A single offline file. No server, no network, no dependencies.

| Explore                                                                    | Edit (press E)                                                       | Export                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- |
| Drag to pan, Ctrl + wheel to zoom, `0` to fit                              | Drag to move (10px grid), corner handles to resize                   | PNG (2×), JPG, SVG      |
| Click a box to see what it connects to; `H` turns on Highlight (see below) | Double-click to edit text; change fill, line, text colour, font size | Copy PNG to clipboard   |
| `/` to find a box by name                                                  | One-click Salesforce palette swatches                                | Download .drawio        |
| `L` Animate: moving dashes show flow direction on every connector          | Add cards, shapes, notes, zones, icons already used in the diagram   | Save HTML (keeps edits) |
| `T` light / dark, `P` presentation mode                                    | Connect two boxes (`C`), restyle or re-route a connector             | Print / save as PDF     |
| Page tabs and drill-down links                                             | Undo / redo, duplicate, delete, arrange                              |                         |

**Highlight** is a toolbar toggle (key `H`), off by default. When on, hovering
or clicking a box fades everything except that box, its contents and the
connectors attached to it. Boxes with no connectors and no contents (a lone
wireframe widget) fade nothing, and hovering a container does not fade the page.
With Highlight off, clicking a box still shows its details in the side panel,
and search still highlights matches.

**Animate** is a toolbar toggle (key `L`), off by default. It moves dashes along
each connector from source to target, like draw.io flow animation.
Reduced-motion settings are respected: a build-time default of "on" is skipped
for those users, who can still press the button.

Choose the defaults when generating:

- Spec: `"viewer": { "highlight": true, "animate": true }` (both optional,
  default `false`).
- CLI: `--highlight` and `--animate` on `build` and `convert` (they override the
  spec; `--animate=false` switches a spec default off).
- The choice is stored on the `<html>` element (`data-highlight="on"`,
  `data-animate="on"`) and Save HTML keeps the current state of both toggles.
- With animate on, every connector in the .drawio also gets `flowAnimation=1;`
  so draw.io animates it too. Without the option the .drawio file is unchanged.

Edits live in the page until the user chooses Export → **Save HTML** (a new copy
of the file with the edits inside) or **Download .drawio**. Both carry the same
model, so a diagram edited in the browser opens in draw.io and the other way
round.

## Images

- **SVG** is rendered by Node directly: no browser needed, scales without loss,
  text stays text.
- **PNG and JPG** are rasterised by a locally installed Chromium-based browser
  in headless mode (Chrome, Edge, Chromium or Brave; found automatically, or set
  `ARCHISTRY_BROWSER` to the executable). Default scale is 2× for sharp slides
  and documents. Where the browser launcher returns before the render finishes
  (Edge on Windows), the exporter falls back to a headless screenshot of each
  image and waits for the file. The result is the same size; JPG uses the
  browser's own JPEG encoder, and PNG stays transparent only with
  `--transparent`.
- The HTML page can also export PNG, JPG and SVG itself, which is the path for
  someone without Node.
- For PowerPoint: insert the SVG, then right-click → Convert to Shape for native
  editable shapes. For Word, Confluence, Google Docs and READMEs use PNG or SVG.

## Limits to state honestly

- The HTML viewer and the image exporter draw the shapes this skill emits
  (cards, zones, swimlanes, ellipses, diamonds, cylinders, notes, documents,
  lifelines, images, ER and UML markers, orthogonal and curved connectors). A
  file hand-edited in draw.io with other stencils (AWS, BPMN 2.0 library,
  mockups) still opens and saves correctly in draw.io, but those stencils appear
  as plain rectangles in HTML and in `archistry export`. `archistry validate`
  and `archistry export` list them. With draw.io desktop installed,
  `archistry export` uses it automatically for such files.
- Connectors are routed around boxes when a spec is built. After a box is
  dragged by hand, in the browser or in draw.io, its connectors re-route with a
  simple elbow that does not avoid other boxes; nudge the box, or select the
  connector and use "Straighten / re-route". Rebuilding from the spec restores
  full routing but discards manual moves.
- Fonts: text is laid out with Helvetica / Arial metrics. A machine without
  either substitutes a similar font and wrapping can shift slightly.
- Compressed `.drawio` files are read and re-saved uncompressed by `convert`.
- Automated checks cover structure and geometry (overlaps, lines through boxes,
  clipped labels, contrast, crossings). They do not judge whether the diagram
  says the right thing.
