// flow.mjs — ranked flows with optional swimlanes.
// Powers: business-process (BPMN-style swimlanes), flowchart, decision-tree, state-lifecycle, approval flows,
// devops-pipeline, branching-strategy, flow-logic, and the Agent Instruction Diagram (UPN-style).
import { Diagram, finishPage, measureCard, drawCard, measure, h, small, up20, snap10, clamp, textWidth, wrapPlain, resolveIcon } from '../dsl.mjs';

const TASK_KINDS = new Set(['task', 'user', 'system', 'manual', 'service', 'script', 'ai']);
const UPN_KINDS = { instruction: { color: 'ai', res: 'AI Agent', icon: 'standard/agent_astro' }, action: { color: 'salesforce', res: 'Action', icon: 'standard/flow' }, prompt: { color: 'data', res: 'Prompt Template', icon: 'standard/prompt_builder' }, handoff: { color: 'warning', res: 'Human handoff', icon: 'utility/user' } };

function sizeNode(d, n) {
  const k = n.kind || 'task';
  const label = n.label || '';
  if (k === 'start' || k === 'end') {
    if (!label) return { w: 40, h: 40 };
    const w = clamp(up20(textWidth(label, 12, true) + 36), 80, 180);
    const m = measure(`<b>${h(label)}</b>`, { fontSize: 12 }, w - 24);
    return { w, h: Math.max(40, up20(m.h + 14)) };
  }
  if (k === 'gateway' || k === 'decision') {
    if (label.length <= 2) return { w: 60, h: 60 };
    let w = 140, hh = 80;
    let m = measure(h(label), { fontSize: 12 }, w * 0.62);
    if (m.h > 30) { w = 180; hh = 100; m = measure(h(label), { fontSize: 12 }, w * 0.62); }
    if (m.h > 46) { w = 220; hh = 120; }
    return { w, h: hh };
  }
  if (k === 'event') return { w: 60, h: 60 };
  if (k === 'commit') return { w: 20, h: 20 };
  if (k === 'data') { const m = measure(h(label), { fontSize: 12 }, 104); return { w: 120, h: Math.max(80, up20(m.h + 44)) }; }
  if (k === 'document') { const m = measure(h(label), { fontSize: 12 }, 124); return { w: 140, h: Math.max(80, up20(m.h + 40)) }; }
  if (k === 'note') { const m = measure(h(label), { fontSize: 11 }, 150); return { w: 180, h: Math.max(60, up20(m.h + 20)) }; }
  if (k === 'state') {
    const w = clamp(up20(textWidth(label, 13, true) + 44), 120, 220);
    const m = measure(`<b>${h(label)}</b>${n.sub ? '<br>' + small(h(n.sub), '#5c5c5c', 11) : ''}`, { fontSize: 13 }, w - 28);
    return { w, h: Math.max(40, up20(m.h + 16)) };
  }
  if (UPN_KINDS[k]) {
    const w = n.width ? up20(n.width) : 200;
    const m = measure(h(label), { fontSize: 13 }, w - 28);
    return { w, h: Math.max(60, up20(m.h + 22)) + 20 };
  }
  const o = { minW: 160, maxW: 220, minH: 60 };
  return measureCard(d, n, o);
}

function drawNode(d, n, box, parent) {
  const k = n.kind || 'task';
  const col = n.color ? d.kind(n.color) : null;
  const id = d.uid(n.id);
  const base = { fontColor: d.ink.text, fontSize: 12, strokeWidth: 1.5 };
  const mk = (style, value) => d.node({ id, x: box.x, y: box.y, w: box.w, h: box.h, value: value === undefined ? h(n.label || '') : value, parent, style: Object.assign({}, base, style, n.style || {}), link: n.link, tooltip: n.tooltip || n.note });
  if (k === 'start') { const c = col || d.kind('success', false); return mk({ rounded: '1', arcSize: 100, absoluteArcSize: '1', fillColor: c.fill, strokeColor: c.stroke, strokeWidth: 2 }, n.label ? `<b>${h(n.label)}</b>` : ''); }
  if (k === 'end') { const c = col || { fill: '#f3f3f3', stroke: d.ink.text }; return mk({ rounded: '1', arcSize: 100, absoluteArcSize: '1', fillColor: c.fill, strokeColor: c.stroke, strokeWidth: 3 }, n.label ? `<b>${h(n.label)}</b>` : ''); }
  if (k === 'gateway' || k === 'decision') { const c = col || d.kind('warning', false); return mk({ rhombus: '', fillColor: c.fill, strokeColor: c.stroke, fontSize: (n.label || '').length <= 2 ? 18 : 12, fontStyle: (n.label || '').length <= 2 ? 1 : 0 }); }
  if (k === 'event') { const c = col || d.kind('purple', false); return mk({ shape: 'doubleEllipse', perimeter: 'ellipsePerimeter', fillColor: c.fill, strokeColor: c.stroke, fontSize: 10 }); }
  if (k === 'commit') { const c = col || d.kind('salesforce', false); return mk({ ellipse: '', fillColor: c.stroke, strokeColor: c.stroke, noLabel: '1' }, ''); }
  if (k === 'data') { const c = col || d.kind('data', false); return mk({ shape: 'cylinder3', size: 12, boundedLbl: '1', fillColor: c.fill, strokeColor: c.stroke, spacingTop: 14 }); }
  if (k === 'document') { const c = col || d.kind('neutral', false); return mk({ shape: 'document', size: 0.25, boundedLbl: '1', fillColor: c.fill, strokeColor: c.stroke, spacingBottom: 12 }); }
  if (k === 'note') return mk({ shape: 'note', size: 14, fillColor: '#fff8dc', strokeColor: '#ca8501', fontSize: 11, align: 'left', spacingLeft: 8, spacingRight: 12, strokeWidth: 1 });
  if (k === 'state') { const c = col || d.kind('salesforce', false); return mk({ rounded: '1', arcSize: 100, absoluteArcSize: '1', fillColor: c.fill, strokeColor: c.stroke, fontSize: 13 }, `<b>${h(n.label || '')}</b>${n.sub ? '<br>' + small(h(n.sub), d.ink.sub, 11) : ''}`); }
  if (k === 'subprocess') { const c = col || d.kind('salesforce', false); return mk({ shape: 'process', size: 0.06, rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: c.fill, strokeColor: c.stroke, spacingLeft: 14, spacingRight: 14 }, `<b>${h(n.label || '')}</b>${n.sub ? '<br>' + small(h(n.sub), d.ink.sub, 11) : ''}`); }
  if (UPN_KINDS[k]) {
    const u = UPN_KINDS[k];
    const c = d.kind(n.color || u.color, false);
    const cell = mk({ rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: c.stroke, fontSize: 13, verticalAlign: 'top', spacingTop: 8, spacingLeft: 8, spacingRight: 8, spacingBottom: 24, container: '1', collapsible: '0', recursiveResize: '0' });
    let res = n.resource || u.res;
    if (!/:/.test(res) && n.resource && k !== 'instruction') res = `${u.res}: ${res}`;
    d.node({ id: d.uid(id + '_res'), x: 0, y: box.h - 20, w: box.w, h: 20, value: h(res), parent: cell.id, connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: c.fill, strokeColor: c.stroke, strokeWidth: 1.5, fontSize: 10, fontColor: d.ink.text, align: 'left', spacingLeft: 26, whiteSpace: undefined, part: '1' } });
    let ic = u.icon;
    if (k === 'action' && /apex/i.test(res)) ic = 'standard/apex';
    if (k === 'action' && /api|mule|http|rest/i.test(res)) ic = 'utility/integration';
    d.icon(n.icon || ic, 6, box.h - 18, 16, cell.id);
    if (n.number !== undefined) d.node({ id: d.uid(id + '_num'), x: box.w - 24, y: -8, w: 20, h: 16, value: `<b>${h(n.number)}</b>`, parent: cell.id, connectable: '0', style: { rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: c.stroke, strokeColor: 'none', fontColor: '#ffffff', fontSize: 9, whiteSpace: undefined, part: '1' } });
    return cell;
  }
  // task family
  const dflt = k === 'system' || k === 'service' || k === 'script' ? 'salesforce' : k === 'ai' ? 'ai' : k === 'manual' ? 'external' : null;
  const o = { minW: 160, maxW: 220, minH: 60 };
  const spec = Object.assign({}, n, { kind: n.color || dflt || 'neutral' });
  if (!n.color && !dflt) o.style = { fillColor: '#ffffff', strokeColor: d.kind('salesforce', false).stroke };
  const cell = drawCard(d, Object.assign(spec, { id: n.id }), box, parent, o);
  return cell;
}

/** Lays out and draws a flow into diagram d. Returns { cells: Map(id->cell) }. */
export function drawFlow(d, spec, opts = {}) {
  const LR = (spec.direction || opts.direction || 'LR').toUpperCase() !== 'TB';
  const lanes = (spec.lanes || []).map((l) => (typeof l === 'string' ? { id: l, label: l } : l));
  const laneIds = new Set(lanes.map((l) => l.id));
  const nodes = (spec.nodes || []).map((n) => Object.assign({}, n));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = (spec.edges || []).map((e) => Object.assign({}, e));
  // implicit terminals
  for (const e of edges) for (const end of ['from', 'to']) {
    const id = e[end];
    if (!byId.has(id) && (id === 'start' || id === 'end')) { const n = { id, kind: id, label: '' }; if (lanes.length) n.lane = (byId.get(end === 'from' ? e.to : e.from) || {}).lane; byId.set(id, n); if (id === 'start') nodes.unshift(n); else nodes.push(n); }
  }
  if (!nodes.length) throw new Error('flow spec has no nodes');
  for (const e of edges) { if (!byId.has(e.from)) throw new Error(`edge refers to unknown node "${e.from}"`); if (!byId.has(e.to)) throw new Error(`edge refers to unknown node "${e.to}"`); }
  for (const n of nodes) { if (!n.id) throw new Error('every flow node needs an id'); if (lanes.length && !laneIds.has(n.lane)) n.lane = lanes[0].id; Object.assign(n, { _s: sizeNode(d, n) }); }

  // ---- ranks (longest path over forward edges)
  const out = new Map(nodes.map((n) => [n.id, []]));
  const layoutEdges = edges.filter((e) => e.kind !== 'note' && e.layout !== false && e.from !== e.to);
  for (const e of layoutEdges) out.get(e.from).push(e);
  const state = new Map(), back = new Set();
  const dfs = (u) => { state.set(u, 1); for (const e of out.get(u)) { const s = state.get(e.to); if (s === 1) back.add(e); else if (!s) dfs(e.to); } state.set(u, 2); };
  const indeg0 = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of layoutEdges) indeg0.set(e.to, indeg0.get(e.to) + 1);
  for (const n of nodes) if (!indeg0.get(n.id) && !state.get(n.id)) dfs(n.id);
  for (const n of nodes) if (!state.get(n.id)) dfs(n.id);
  const fwd = layoutEdges.filter((e) => !back.has(e));
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of fwd) indeg.set(e.to, indeg.get(e.to) + 1);
  const rank = new Map();
  const queue = nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id);
  for (const id of queue) rank.set(id, byId.get(id).rank !== undefined ? byId.get(id).rank : 0);
  while (queue.length) {
    const u = queue.shift();
    for (const e of out.get(u)) {
      if (back.has(e)) continue;
      const r = Math.max(rank.get(e.to) || 0, rank.get(u) + (e.sameRank ? 0 : 1), byId.get(e.to).rank !== undefined ? byId.get(e.to).rank : 0);
      rank.set(e.to, r);
      indeg.set(e.to, indeg.get(e.to) - 1);
      if (!indeg.get(e.to)) queue.push(e.to);
    }
  }
  for (const n of nodes) { n._r = rank.get(n.id) || 0; }
  // notes sit in the rank of the node they annotate
  for (const e of edges) if (e.kind === 'note') { const a = byId.get(e.from), b = byId.get(e.to); const note = a.kind === 'note' ? a : b, other = a.kind === 'note' ? b : a; if (note.rank === undefined) note._r = other._r; if (lanes.length && !note.lane) note.lane = other.lane; }
  const maxRank = Math.max(...nodes.map((n) => n._r));
  const wrap = !lanes.length && spec.wrap > 0 ? spec.wrap : 0;
  const colOf = (r) => (wrap ? r % wrap : r), bandOf = (r) => (wrap ? Math.floor(r / wrap) : 0);
  const nCols = wrap ? Math.min(wrap, maxRank + 1) : maxRank + 1;
  const mainSize = (n) => (LR ? n._s.w : n._s.h), crossSize = (n) => (LR ? n._s.h : n._s.w);

  // ---- main axis
  const colMain = new Array(nCols).fill(0);
  for (const n of nodes) colMain[colOf(n._r)] = Math.max(colMain[colOf(n._r)], mainSize(n));
  const gapAfter = new Array(nCols).fill(spec.gap || (LR ? 60 : 60));
  for (const e of fwd) {
    if (!e.label) continue;
    const lines = wrapPlain(e.label, 150, 11);
    e._lines = lines;
    const lw = Math.max(...lines.map((t) => textWidth(t, 11))), lh = lines.length * 13.2;
    const a = byId.get(e.from), b = byId.get(e.to);
    if (b._r <= a._r) continue;
    const need = LR ? up20(lw + 56) : up20(lh + 46);
    for (let r = a._r; r < b._r; r++) { const c = colOf(r); if (b._r - a._r === 1 || r === a._r) gapAfter[c] = Math.max(gapAfter[c], need); }
  }
  for (const e of edges) if (e.label && !e._lines) e._lines = wrapPlain(e.label, 150, 11);
  const colPos = [];
  let acc = 0;
  for (let c = 0; c < nCols; c++) { colPos.push(acc); acc += colMain[c] + gapAfter[c]; }
  const mainTotal = acc - gapAfter[nCols - 1];

  // ---- cross axis
  const sep = spec.spacing || (LR ? 40 : 60);
  const pos = new Map(); // id -> {m, c} top-left in abstract axes
  const laneBox = new Map();
  if (lanes.length) {
    let off = 0;
    for (const L of lanes) {
      const stacks = new Map();
      for (const n of nodes) if (n.lane === L.id) { if (!stacks.has(n._r)) stacks.set(n._r, []); stacks.get(n._r).push(n); }
      let maxStack = 0;
      for (const st of stacks.values()) maxStack = Math.max(maxStack, st.reduce((s, n) => s + crossSize(n), 0) + sep * (st.length - 1));
      const size = Math.max(L.size || 0, up20(maxStack + 60), 120);
      for (const [r, st] of stacks) {
        const total = st.reduce((s, n) => s + crossSize(n), 0) + sep * (st.length - 1);
        let c = off + snap10((size - total) / 2);
        for (const n of st) { pos.set(n.id, { m: colPos[r] + snap10((colMain[r] - mainSize(n)) / 2), c }); c += crossSize(n) + sep; }
      }
      laneBox.set(L.id, { off, size });
      off += size;
    }
  } else {
    const preds = new Map(nodes.map((n) => [n.id, []]));
    for (const e of fwd) preds.get(e.to).push(e.from);
    let bandOff = 0;
    const nBands = bandOf(maxRank) + 1;
    for (let b = 0; b < nBands; b++) {
      let lo = Infinity, hi = -Infinity;
      const placedBand = [];
      for (let r = b * (wrap || maxRank + 1); r <= Math.min(maxRank, (b + 1) * (wrap || maxRank + 1) - 1); r++) {
        const col = nodes.filter((n) => n._r === r);
        if (!col.length) continue;
        for (const n of col) {
          const ps = preds.get(n.id).map((p) => pos.get(p)).filter((p, i) => p && bandOf(byId.get(preds.get(n.id)[i])._r) === b);
          n._want = ps.length ? ps.reduce((s, p) => s + p._center, 0) / ps.length : null;
        }
        const anyWant = col.some((n) => n._want !== null);
        col.forEach((n, i) => { if (n._want === null) n._want = anyWant ? 0 : 0; n._i = i; });
        col.sort((p, q) => (p._want - q._want) || (p._i - q._i));
        const cs = [];
        let prevEnd = -Infinity;
        for (const n of col) { let c = n._want - crossSize(n) / 2; if (c < prevEnd + sep) c = prevEnd + sep; cs.push(c); prevEnd = c + crossSize(n); }
        let shift = 0;
        col.forEach((n, i) => { shift += cs[i] + crossSize(n) / 2 - n._want; });
        shift /= col.length;
        col.forEach((n, i) => {
          const c = snap10(cs[i] - shift);
          const p = { m: colPos[colOf(r)] + snap10((colMain[colOf(r)] - mainSize(n)) / 2), c, _center: c + crossSize(n) / 2 };
          pos.set(n.id, p); placedBand.push([n, p]);
          lo = Math.min(lo, c); hi = Math.max(hi, c + crossSize(n));
        });
      }
      for (const [, p] of placedBand) { p.c = p.c - lo + bandOff; p._center = p._center - lo + bandOff; }
      bandOff += hi - lo + (spec.bandGap || 100);
    }
  }

  // ---- draw
  const cells = new Map();
  const laneCells = new Map();
  const HEAD = 40;
  if (lanes.length) {
    const pad = 30;
    for (const L of lanes) {
      const lb = laneBox.get(L.id);
      const k = d.kind(L.kind || 'neutral', !!L.kind);
      const geo = LR ? { x: -HEAD - pad, y: lb.off, w: mainTotal + HEAD + pad * 2, h: lb.size } : { x: lb.off, y: -HEAD - pad, w: lb.size, h: mainTotal + HEAD + pad * 2 };
      const cell = d.node({ id: d.uid('lane_' + L.id), x: geo.x, y: geo.y, w: geo.w, h: geo.h, value: `<b>${h(L.label || L.id)}</b>`, style: { swimlane: '', startSize: HEAD, horizontal: LR ? '0' : '1', fillColor: L.kind ? k.fill : '#f3f3f3', swimlaneFillColor: '#ffffff', strokeColor: L.kind ? k.stroke : d.ink.border, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13, collapsible: '0', whiteSpace: 'wrap', recursiveResize: '0' }, connectable: '0' });
      laneCells.set(L.id, { cell, geo });
      d.soft.push(LR ? { x: geo.x, y: geo.y, w: HEAD, h: geo.h, cost: 40 } : { x: geo.x, y: geo.y, w: geo.w, h: HEAD, cost: 40 });
    }
  }
  for (const n of nodes) {
    const p = pos.get(n.id);
    const ax = LR ? p.m : p.c, ay = LR ? p.c : p.m;
    let parent = '1', bx = ax, by = ay;
    if (lanes.length) { const lc = laneCells.get(n.lane); parent = lc.cell.id; bx = ax - lc.geo.x; by = ay - lc.geo.y; }
    cells.set(n.id, drawNode(d, n, { x: bx, y: by, w: n._s.w, h: n._s.h }, parent));
  }
  // ---- edges
  const links = [];
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    const st = {};
    if (e.kind === 'note') Object.assign(st, { endArrow: 'none', dashed: '1', dashPattern: '2 3', strokeColor: '#ca8501', strokeWidth: 1 });
    else if (e.kind === 'exception' || e.kind === 'error') Object.assign(st, { strokeColor: d.kind('danger', false).stroke });
    else if (e.kind === 'message' || e.kind === 'async') Object.assign(st, { dashed: '1', dashPattern: '6 4', endArrow: 'open' });
    else if (e.kind === 'optional') Object.assign(st, { dashed: '1', dashPattern: '4 4' });
    if (e.color) st.strokeColor = d.kind(e.color, false).stroke;
    let fromSides, toSides;
    const isBack = back.has(e) || b._r < a._r;
    const gw = a.kind === 'gateway' || a.kind === 'decision';
    if (e.fromSide) fromSides = e.fromSide;
    if (e.toSide) toSides = e.toSide;
    if (!fromSides && !toSides && e.kind !== 'note') {
      if (wrap && bandOf(a._r) !== bandOf(b._r)) { fromSides = LR ? { S: 0, E: 4 } : { E: 0, S: 4 }; toSides = LR ? { N: 0, W: 4 } : { W: 0, N: 4 }; }
      else if (!isBack && b._r > a._r) {
        if (LR) { fromSides = gw ? { E: 0, N: 1, S: 1 } : { E: 0, N: 10, S: 10 }; toSides = { W: 0, N: 10, S: 10 }; }
        else { fromSides = gw ? { S: 0, E: 1, W: 1 } : { S: 0, E: 10, W: 10 }; toSides = { N: 0, E: 10, W: 10 }; }
      } else if (isBack) {
        if (LR) { fromSides = { N: 0, S: 0, W: 6 }; toSides = { N: 0, S: 0, E: 6 }; } else { fromSides = { E: 0, W: 0, N: 6 }; toSides = { E: 0, W: 0, S: 6 }; }
      }
    }
    links.push({ from: cells.get(e.from).id, to: cells.get(e.to).id, label: e._lines ? e._lines.map(h).join('<br>') : '', style: st, fromSides, toSides, tooltip: e.tooltip });
  }
  if (links.length) d.routeEdges(links, [...cells.values()]);
  return { cells, LR };
}

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  drawFlow(d, spec);
  return [finishPage(d)];
}

/* ------------------------------------------------ Agent Instruction Diagram -- */
// UPN-style rendition of a single Agentforce topic: guardrails, instruction steps, deterministic actions,
// prompt templates and the conditions on the lines between them.
export function drawAid(d, spec) {
  const steps = (spec.steps || spec.nodes || []).map((s, i) => Object.assign({ kind: 'instruction' }, s, { number: s.number !== undefined ? s.number : i + 1 }));
  for (const s of steps) if (['start', 'end', 'gateway', 'decision', 'note'].includes(s.kind)) delete s.number;
  const flowSpec = { direction: spec.direction || 'LR', nodes: steps, edges: spec.flows || spec.edges || [], wrap: spec.wrap === undefined ? 4 : spec.wrap, gap: spec.gap, bandGap: 110 };
  drawFlow(d, flowSpec);
  // bounding box of what we just drew
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity;
  for (const c of d.cells) { if (c.vertex && c.parent === '1') { x0 = Math.min(x0, c.geo.x); y0 = Math.min(y0, c.geo.y); x1 = Math.max(x1, c.geo.x + c.geo.w); } if (c.edge) for (const p of c.geo.points || []) { y0 = Math.min(y0, p.y); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); } }
  const t = spec.topic || {};
  const panels = [];
  if (t.name || t.classification || t.scope) {
    let v = `${small('TOPIC · JOB TO BE DONE', d.ink.sub, 10)}<br><b><font style="font-size:15px">${h(t.name || spec.title || 'Topic')}</font></b>`;
    if (t.classification) v += `<br>${small('<b>Classification description</b>', d.ink.sub, 10)}<br>${small(h(t.classification), d.ink.text, 11)}`;
    if (t.scope) v += `<br>${small('<b>Scope</b>', d.ink.sub, 10)}<br>${small(h(t.scope), d.ink.text, 11)}`;
    panels.push({ v, w: 440, kind: 'ai', icon: 'standard/agent_astro' });
  }
  const guard = spec.guardrails || [];
  if (guard.length) {
    const v = `${small('GUARDRAILS · ALWAYS / NEVER', d.ink.sub, 10)}` + guard.map((g) => `<br>${small('• ' + h(g), d.ink.text, 11)}`).join('');
    panels.push({ v, w: 380, kind: 'security', icon: 'utility/lock' });
  }
  const io = [];
  if (spec.inputs && spec.inputs.length) io.push(`${small('<b>Variables / inputs</b>', d.ink.sub, 10)}<br>${small(spec.inputs.map(h).join(' · '), d.ink.text, 11)}`);
  if (spec.data && spec.data.length) io.push(`${small('<b>Grounding data</b>', d.ink.sub, 10)}<br>${small(spec.data.map(h).join(' · '), d.ink.text, 11)}`);
  if (io.length) panels.push({ v: `${small('CONTEXT', d.ink.sub, 10)}<br>` + io.join('<br>'), w: 300, kind: 'data', icon: 'standard/data_cloud' });
  if (panels.length) {
    for (const p of panels) p.h = up20(measure(p.v, { fontSize: 12 }, p.w - 62).h + 24);
    const ph = Math.max(...panels.map((p) => p.h));
    let px = snap10(x0);
    const py = snap10(y0) - ph - 50;
    for (const p of panels) {
      const k = d.kind(p.kind, false);
      const cell = d.node({ id: d.uid('panel'), x: px, y: py, w: p.w, h: ph, value: p.v, connectable: '0', style: { rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 12, align: 'left', verticalAlign: 'top', spacingLeft: 48, spacingTop: 8, spacingRight: 10, container: '1', collapsible: '0' } });
      d.icon(p.icon, 12, 12, 26, cell.id);
      px += p.w + 30;
    }
  }
  const used = new Set(steps.map((s) => s.kind));
  for (const k of ['instruction', 'action', 'prompt', 'handoff']) if (used.has(k)) { const c = d.kind(UPN_KINDS[k].color, false); d.legendExtra.push({ swatch: { style: { fillColor: c.fill, strokeColor: c.stroke, strokeWidth: 1.5 } }, label: { instruction: 'Agent instruction step (LLM reasoning)', action: 'Agent action (deterministic: Flow / Apex / API)', prompt: 'Prompt template', handoff: 'Human handoff' }[k] }); }
  void x1; void resolveIcon;
}
export function buildAid(spec, ctx) {
  const d = new Diagram(spec, ctx);
  drawAid(d, spec);
  return [finishPage(d)];
}
