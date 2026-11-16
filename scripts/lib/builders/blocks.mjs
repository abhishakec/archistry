// blocks.mjs — nested zones + cards + routed connectors.
// Powers: system-landscape, solution-architecture, integration-architecture, data-cloud-architecture,
// data-flow, system-context, capability-map, environment-strategy, sharing-model, and friends.
import { Diagram, finishPage, measureCard, drawCard, lineStyle, measure, h, small, up10, up20, snap10, resolveIcon, textWidth } from '../dsl.mjs';

const STATUS_KIND = {
  live: 'success', existing: 'success', done: 'success', 'in scope': 'salesforce', 'in-scope': 'salesforce', mvp: 'salesforce', 'phase 1': 'salesforce', new: 'salesforce',
  planned: 'warning', 'phase 2': 'warning', enhance: 'warning', 'in progress': 'warning', future: 'muted', 'out of scope': 'muted', 'phase 3': 'purple', gap: 'danger', retire: 'danger', replace: 'danger',
};

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const hasLinks = !!(spec.links && spec.links.length);
  const compact = spec.compact !== undefined ? !!spec.compact : !hasLinks;
  const cardOpts = Object.assign({ minW: compact ? 140 : 180, maxW: compact ? 200 : 240, minH: compact ? 40 : 60 }, spec.card || {});
  const statusSeen = new Map();
  const isZone = (n) => Array.isArray(n.children);

  // ---- measure
  function measureNode(n, depth) {
    n._depth = depth;
    if (!isZone(n)) {
      if (n.status && !n.kind) { const key = String(n.status).toLowerCase(); n.kind = STATUS_KIND[key] || 'neutral'; statusSeen.set(String(n.status), n.kind); }
      const m = measureCard(d, n, cardOpts);
      n._w = n.width ? up20(n.width) : m.w; n._h = n.height ? up20(n.height) : m.h;
      return;
    }
    const label = n.zone !== undefined ? n.zone : n.label;
    n._label = label;
    const framed = depth > 0 && n.frame !== false;
    n._framed = framed;
    const leafOnly = n.children.every((c) => !isZone(c));
    const layout = n.layout || (depth === 0 ? 'row' : leafOnly ? 'column' : 'row');
    n._layout = layout;
    const base = n.gap !== undefined ? n.gap : hasLinks ? (depth === 0 ? 80 : leafOnly ? 40 : 60) : (leafOnly ? (compact ? 10 : 20) : 30);
    const gx = n.gap !== undefined ? n.gap : Math.max(base, n._needX || 0), gy = n.gap !== undefined ? n.gap : Math.max(base, n._needY || 0);
    n._gx = gx; n._gy = gy;
    n._pad = framed ? (n.padding !== undefined ? n.padding : hasLinks ? 30 : 20) : 0;
    n._head = framed && label ? (n.sub ? 56 : 40) : 0;
    for (const c of n.children) measureNode(c, depth + 1);
    // uniform cards among leaf siblings
    const leaves = n.children.filter((c) => !isZone(c));
    if (leaves.length && n.uniform !== false) {
      const mw = Math.max(...leaves.map((c) => c._w));
      for (const c of leaves) if (!c.width) c._w = mw;
    }
    const kids = n.children;
    if (layout === 'row') {
      const mh = Math.max(...kids.map((c) => c._h));
      n._cw = kids.reduce((s, c) => s + c._w, 0) + gx * (kids.length - 1); n._ch = mh;
    } else if (layout === 'column') {
      const mw = Math.max(...kids.map((c) => c._w));
      n._cw = mw; n._ch = kids.reduce((s, c) => s + c._h, 0) + gy * (kids.length - 1);
    } else { // grid
      const cols = Math.max(1, n.columns || Math.ceil(Math.sqrt(kids.length)));
      n._cols = cols;
      const colW = [], rowH = [];
      kids.forEach((c, i) => { const cc = i % cols, rr = Math.floor(i / cols); colW[cc] = Math.max(colW[cc] || 0, c._w); rowH[rr] = Math.max(rowH[rr] || 0, c._h); });
      n._colW = colW; n._rowH = rowH;
      n._cw = colW.reduce((s, v) => s + v, 0) + gx * (colW.length - 1); n._ch = rowH.reduce((s, v) => s + v, 0) + gy * (rowH.length - 1);
    }
    let minW = 0;
    if (framed && label) minW = up20(textWidth(String(label), 13, true) + (n.icon ? 34 : 0) + 40);
    n._w = Math.max(up20(n._cw + n._pad * 2), minW, n.width ? up20(n.width) : 0);
    n._h = Math.max(up20(n._ch + n._pad * 2 + n._head), n.height ? up20(n.height) : 0);
  }

  // ---- place
  const cellOf = new Map(); // spec id -> cell
  const leafCells = [];
  const zoneCells = [];
  function placeNode(n, x, y, w, hh, parentCell, parentKind) {
    if (!isZone(n)) {
      const zk = parentKind ? d.palette.kindKey(parentKind) : null;
      const ck = n.kind ? d.palette.kindKey(n.kind) : null;
      const o = Object.assign({}, cardOpts);
      if (!n.kind && parentKind) { const pk = d.palette.resolve(parentKind); o.style = { fillColor: '#ffffff', strokeColor: pk.stroke }; }
      else if (ck && ck === zk && parentCell && parentCell._tinted) o.style = { fillColor: '#ffffff' };
      const cell = drawCard(d, n, { x, y, w, h: hh }, parentCell ? parentCell.id : '1', o);
      if (n.id) cellOf.set(n.id, cell);
      leafCells.push(cell);
      return;
    }
    let cell = parentCell;
    let kind = n.kind || parentKind;
    let ox = x, oy = y;
    if (n._framed) {
      const k = d.kind(n.kind || 'neutral');
      const tinted = n._depth === 1 && n.kind && n.fill !== 'none';
      let label = n._label ? `<b>${h(n._label)}</b>` : '';
      if (n.sub) label += `<br>${small(h(n.sub), d.ink.sub, 11)}`;
      const iconR = n.icon ? resolveIcon(n.icon) : null;
      cell = d.node({
        id: n.id ? d.uid(n.id) : d.uid('zone_' + (n._label || '')), x, y, w, h: hh, value: label, parent: parentCell ? parentCell.id : '1',
        style: Object.assign({ rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: tinted ? k.fill : '#ffffff', strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13, align: 'left', verticalAlign: 'top', spacingLeft: iconR ? 44 : 14, spacingTop: 9, container: '1', collapsible: '0', recursiveResize: '0' }, n._depth > 1 || n.dashed ? { dashed: '1', dashPattern: '6 4' } : {}, n.style || {}),
        link: n.link, tooltip: n.tooltip,
      });
      cell._tinted = tinted;
      if (iconR) d.icon(iconR.key, 12, 8, 24, cell.id);
      if (n.id) cellOf.set(n.id, cell);
      zoneCells.push({ cell, n });
      if (n._head) { const a = d.abs(cell); d.soft.push({ x: a.x, y: a.y, w: Math.min(a.w, textWidth(String(n._label), 13, true) + (iconR ? 60 : 30)), h: n._head - 6, cost: 14 }); }
      { const a = d.abs(cell); for (const r of [{ x: a.x - 5, y: a.y, w: 10, h: a.h }, { x: a.x + a.w - 5, y: a.y, w: 10, h: a.h }, { x: a.x, y: a.y - 5, w: a.w, h: 10 }, { x: a.x, y: a.y + a.h - 5, w: a.w, h: 10 }]) d.soft.push(Object.assign(r, { cost: 3 })); }
      ox = 0; oy = 0;
    }
    const iw = w - n._pad * 2, ih = hh - n._pad * 2 - n._head;
    const bx = ox + n._pad, by = oy + n._pad + n._head;
    const kids = n.children, gx = n._gx, gy = n._gy;
    if (n._layout === 'row') {
      let cx = bx + snap10((iw - n._cw) / 2);
      const leafH = Math.max(0, ...kids.filter((c) => !isZone(c)).map((c) => c._h));
      for (const c of kids) {
        const ch = isZone(c) ? ih : leafH;
        placeNode(c, cx, isZone(c) ? by : by + snap10((ih - ch) / 2), c._w, ch, n._framed ? cell : parentCell, kind); cx += c._w + gx;
      }
    } else if (n._layout === 'column') {
      let cy = by;
      for (const c of kids) { placeNode(c, bx, cy, iw, c._h, n._framed ? cell : parentCell, kind); cy += c._h + gy; }
    } else {
      const colX = [], rowY = [];
      let acc = bx + snap10((iw - n._cw) / 2);
      for (let i = 0; i < n._colW.length; i++) { colX.push(acc); acc += n._colW[i] + gx; }
      acc = by;
      for (let i = 0; i < n._rowH.length; i++) { rowY.push(acc); acc += n._rowH[i] + gy; }
      kids.forEach((c, i) => { const cc = i % n._cols, rr = Math.floor(i / n._cols); placeNode(c, colX[cc], rowY[rr], n._colW[cc], n._rowH[rr], n._framed ? cell : parentCell, kind); });
    }
  }

  const rootNode = { children: spec.children || [], layout: spec.layout || 'row', gap: spec.gap, columns: spec.columns, frame: false };
  if (!rootNode.children.length) throw new Error('spec.children is empty — add at least one zone or card');
  // gaps must fit the labels of the links that run through them
  const parentOf = new Map(), nodeById = new Map();
  (function walk(n, p) { parentOf.set(n, p); if (n.id) nodeById.set(n.id, n); if (isZone(n)) for (const c of n.children) walk(c, n); })(rootNode, null);
  for (const l of spec.links || []) {
    const a = nodeById.get(l.from), b = nodeById.get(l.to);
    if (!a || !b) continue;
    const chain = (n) => { const o = []; for (let x = n; x; x = parentOf.get(x)) o.push(x); return o; };
    const ca = chain(a), cb = new Set(chain(b));
    const lca = ca.find((x) => cb.has(x) && x !== a && x !== b) || rootNode;
    const text = (l.step ? '00 · ' : '') + (l.label || '');
    const lw = text ? textWidth(text, 11, true) + 8 : 0;
    lca._needX = Math.max(lca._needX || 0, up20(lw + 50));
    lca._needY = Math.max(lca._needY || 0, l.note ? 80 : 60);
  }
  measureNode(rootNode, 0);
  placeNode(rootNode, 0, 0, rootNode._w, rootNode._h, null, null);

  // ---- links
  const links = [];
  let autoStep = 0;
  for (const l of spec.links || []) {
    const a = cellOf.get(l.from), b = cellOf.get(l.to);
    if (!a || !b) { d.warnings.push(`link skipped — unknown id: ${!a ? l.from : l.to}`); continue; }
    const st = lineStyle(d, l.style || l.kind || 'sync');
    if (l.color) st.strokeColor = d.kind(l.color, false).stroke;
    let label = l.label ? h(l.label) : '';
    const step = l.step === true ? ++autoStep : l.step;
    if (step) label = `<b>${h(step)}</b>${label ? ' · ' + label : ''}`;
    if (l.note) label += `<br>${small(h(l.note), d.ink.sub, 10)}`;
    links.push({ from: a.id, to: b.id, label, style: st, tooltip: l.tooltip, fromSides: l.fromSide, toSides: l.toSide });
  }
  if (links.length) {
    const endpointIds = new Set(links.flatMap((l) => [l.from, l.to]));
    const obstacles = leafCells.slice();
    for (const z of zoneCells) if (endpointIds.has(z.cell.id)) obstacles.push(z.cell);
    d.routeEdges(links, obstacles);
  }
  for (const [label, kind] of statusSeen) { const k = d.palette.resolve(kind); d.usedKinds.delete(d.palette.kindKey(kind)); d.legendExtra.push({ swatch: { style: { fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5 } }, label: label.charAt(0).toUpperCase() + label.slice(1) }); }
  if (statusSeen.size) for (const k of [...d.usedKinds.keys()]) if ([...statusSeen.values()].includes(k)) d.usedKinds.delete(k);
  return [finishPage(d)];
}
void measure; void up10;
