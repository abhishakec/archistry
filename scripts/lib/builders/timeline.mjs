// timeline.mjs — time-accurate plans: roadmap, project-plan (gantt), release-plan, cutover-plan.
import { Diagram, finishPage, h, small, up10, snap10, clamp, textWidth } from '../dsl.mjs';

const DAY = 86400000;
const parseDate = (s) => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) throw new Error(`invalid date "${s}" — use YYYY-MM-DD`); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_KIND = { done: 'success', complete: 'success', 'in progress': 'salesforce', active: 'salesforce', planned: 'external', 'at risk': 'warning', risk: 'warning', blocked: 'danger', late: 'danger' };

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const lanes = spec.lanes || [];
  if (!lanes.length) throw new Error('a timeline needs "lanes"');
  const stepAxis = Array.isArray(spec.axis) ? spec.axis : null;
  const LW = spec.laneWidth || 180, ROWH = 30, ROWGAP = 10, LPAD = 15;
  let X, totalW, headerRows = [];
  if (stepAxis) {
    const cw = spec.columnWidth || 120;
    totalW = cw * stepAxis.length;
    const pos = (v, end) => { let i = typeof v === 'number' ? v : stepAxis.indexOf(v) + 1; if (!i || i < 0) throw new Error(`"${v}" is not on the axis`); return (i - (end ? 0 : 1)) * cw; };
    X = { start: (v) => pos(v, false), end: (v) => pos(v, true), point: (v) => (typeof v === 'number' ? (v - 0.5) * cw : pos(v, false) + cw / 2) };
    headerRows.push(stepAxis.map((label, i) => ({ x: i * cw, w: cw, label })));
    if (Array.isArray(spec.axisGroups)) { let gx = 0; headerRows.unshift(spec.axisGroups.map((g) => { const o = { x: gx, w: g.span * cw, label: g.label, group: true }; gx += g.span * cw; return o; })); }
  } else {
    let t0 = spec.start ? parseDate(spec.start) : Infinity, t1 = spec.end ? parseDate(spec.end) : -Infinity;
    const all = [];
    for (const l of lanes) { for (const b of l.bars || []) all.push(parseDate(b.start), parseDate(b.end)); for (const m of l.milestones || []) all.push(parseDate(m.date)); }
    for (const m of spec.milestones || []) all.push(parseDate(m.date));
    if (!spec.start) t0 = Math.min(...all);
    if (!spec.end) t1 = Math.max(...all);
    // snap to month boundaries
    const d0 = new Date(t0), d1 = new Date(t1);
    t0 = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1);
    t1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + 1, 1);
    const days = (t1 - t0) / DAY;
    const ppd = spec.pixelsPerDay || clamp(1300 / days, 1.2, 24);
    totalW = snap10(days * ppd);
    const px = (t) => ((t - t0) / DAY) * (totalW / days);
    X = { start: (v) => px(parseDate(v)), end: (v) => px(parseDate(v) + DAY), point: (v) => px(parseDate(v) + DAY / 2) };
    const months = [];
    for (let t = t0; t < t1;) { const dt = new Date(t); const nx = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1); months.push({ x: px(t), w: px(nx) - px(t), label: MONTHS[dt.getUTCMonth()] + (dt.getUTCMonth() === 0 || t === t0 ? ' ' + dt.getUTCFullYear() : ''), y: dt.getUTCFullYear(), q: Math.floor(dt.getUTCMonth() / 3) + 1 }); t = nx; }
    const useQuarters = spec.unit === 'quarter' || (spec.unit !== 'month' && months.length > 15);
    if (useQuarters || months.length > 5) {
      const qs = [];
      for (const m of months) { const last = qs[qs.length - 1]; const label = `Q${m.q} ${m.y}`; if (last && last.label === label) last.w += m.w; else qs.push({ x: m.x, w: m.w, label, group: true }); }
      headerRows.push(qs);
    }
    if (!useQuarters) headerRows.push(months.map((m) => ({ x: m.x, w: m.w, label: m.w < 46 ? m.label.slice(0, 1) : m.label })));
    if (spec.sprints) {
      const s0 = parseDate(spec.sprints.start), len = spec.sprints.lengthDays || 14;
      const row = [];
      for (let i = 0; i < (spec.sprints.count || 99); i++) { const a = s0 + i * len * DAY, b = a + len * DAY; if (a >= t1) break; row.push({ x: px(a), w: px(Math.min(b, t1)) - px(a), label: `${spec.sprints.prefix || 'S'}${i + (spec.sprints.first || 1)}`, sprint: true }); }
      headerRows.push(row);
    } else if (spec.unit === 'week' || (!spec.unit && ppd >= 6)) {
      const row = [];
      let t = t0; const dow = new Date(t0).getUTCDay(); t += ((8 - dow) % 7) * DAY;
      let wn = 1;
      for (; t < t1; t += 7 * DAY) row.push({ x: px(t), w: px(Math.min(t + 7 * DAY, t1)) - px(t), label: 'W' + wn++, sprint: true });
      headerRows.push(row);
    }
  }
  const HROW = 30;
  const headH = headerRows.length * HROW;
  // header cells
  headerRows.forEach((row, ri) => {
    for (const c of row) d.node({ id: d.uid('hd'), x: LW + c.x, y: ri * HROW, w: c.w, h: HROW, value: c.group ? `<b>${h(c.label)}</b>` : h(c.label), connectable: '0', style: { fillColor: c.group ? '#032d60' : c.sprint ? '#fafaf9' : '#eaf5fe', strokeColor: '#ffffff', fontColor: c.group ? '#ffffff' : d.ink.text, fontSize: c.sprint ? 10 : 11, whiteSpace: undefined } });
  });
  // lanes
  let y = headH;
  const barCells = new Map();
  const laneBoxes = [];
  const deferred = [];
  const allBars = [];
  const labelCells = []; // labels drawn outside bars / beside milestones: dependency lines must avoid them
  const grid = headerRows[headerRows.length - 1] || [];
  lanes.forEach((lane, li) => {
    const k = d.kind(lane.kind || 'salesforce', false);
    // pack bars into sub-rows
    const subs = [];
    const items = [];
    for (const b of lane.bars || []) {
      const x0 = X.start(b.start), x1 = Math.max(X.end(b.end === undefined ? b.start : b.end), x0 + 8);
      const label = String(b.label || '');
      const lw = textWidth(label, 11, true) + 14;
      // Label placement: inside; else wrapped on two lines inside; else outside on the side with room.
      let mode = 'inside', lines = null;
      if (lw > x1 - x0) {
        const two = twoLines(label, 10);
        if (two && two.w + 12 <= x1 - x0) { mode = 'wrap'; lines = two.lines; }
        else mode = x1 + lw + 4 <= totalW || x0 - lw - 4 < 0 ? 'right' : 'left';
      }
      const extL = mode === 'left' ? x0 - lw - 4 : x0;
      const extR = mode === 'right' ? x1 + lw + 4 : x1;
      let r = b.row !== undefined ? b.row : subs.findIndex((end) => end <= extL - 4);
      if (r < 0) { r = subs.length; subs.push(0); }
      while (subs.length <= r) subs.push(0);
      subs[r] = Math.max(subs[r], extR);
      items.push({ b, x0, x1, r, mode, lines, lw });
    }
    const ms = [];
    for (const m of lane.milestones || []) {
      const mx = X.point(m.date !== undefined ? m.date : m.at);
      const lw = textWidth(m.label || '', 10, true) + 12;
      // label right of the diamond, or left of it when it would run past the end of the grid
      const left = mx + 14 + lw > totalW && mx - 14 - lw >= 0;
      const extL = left ? mx - 14 - lw : mx - 14;
      let r = subs.findIndex((end) => end <= extL - 4);
      if (r < 0) { r = subs.length; subs.push(0); }
      subs[r] = Math.max(subs[r], left ? mx + 14 : mx + 14 + lw);
      ms.push({ m, mx, r, left, lw });
    }
    const rowsN = Math.max(1, subs.length);
    const lh = LPAD * 2 + rowsN * ROWH + (rowsN - 1) * ROWGAP;
    const bg = li % 2 ? '#fafaf9' : '#ffffff';
    d.node({ id: d.uid('lane_bg'), x: LW, y, w: totalW, h: lh, value: '', connectable: '0', style: { fillColor: bg, strokeColor: '#e5e5e5', pointerEvents: '0' } });
    d.node({ id: d.uid('lane_' + (lane.label || li)), x: 0, y, w: LW, h: lh, value: `<b>${h(lane.label || '')}</b>${lane.sub ? '<br>' + small(h(lane.sub), d.ink.sub, 10) : ''}`, connectable: '0', style: { fillColor: k.fill, strokeColor: k.stroke, fontColor: d.ink.text, fontSize: 12, align: 'left', spacingLeft: 12, spacingRight: 6 } });
    laneBoxes.push({ y, h: lh });
    const y0 = y;
    deferred.push(() => { const y = y0;
    for (const it of items) {
      const b = it.b;
      const bk = d.kind(b.kind || (b.status && STATUS_KIND[String(b.status).toLowerCase()]) || lane.kind || 'salesforce', false);
      const by = y + LPAD + it.r * (ROWH + ROWGAP);
      const w = it.x1 - it.x0;
      const value = it.mode === 'inside' ? `<b>${h(b.label || '')}</b>` : it.mode === 'wrap' ? `<b>${it.lines.map(h).join('<br>')}</b>` : '';
      const cell = d.node({ id: d.uid(b.id || 'bar_' + (b.label || '')), x: LW + it.x0, y: by, w, h: ROWH, value, style: { rounded: '1', arcSize: 10, absoluteArcSize: '1', fillColor: bk.fill, strokeColor: bk.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: it.mode === 'wrap' ? 10 : 11, whiteSpace: undefined, spacing: it.mode === 'wrap' ? 0 : undefined, container: b.progress ? '1' : undefined, collapsible: b.progress ? '0' : undefined }, tooltip: b.note });
      if (b.progress) d.node({ id: d.uid('prog'), x: 0, y: ROWH - 6, w: Math.max(4, w * clamp(b.progress, 0, 1)), h: 6, value: '', parent: cell.id, connectable: '0', style: { rounded: '1', arcSize: 6, absoluteArcSize: '1', fillColor: bk.stroke, strokeColor: 'none', part: '1' } });
      if (it.mode === 'right') labelCells.push(d.text(LW + it.x1 + 6, by, it.lw - 2, ROWH, `<b>${h(b.label || '')}</b>`, { fontSize: 11, verticalAlign: 'middle', whiteSpace: undefined }));
      if (it.mode === 'left') labelCells.push(d.text(LW + it.x0 - it.lw - 2, by, it.lw - 2, ROWH, `<b>${h(b.label || '')}</b>`, { fontSize: 11, verticalAlign: 'middle', align: 'right', whiteSpace: undefined }));
      if (b.id) barCells.set(b.id, cell);
      allBars.push(cell);
    }
    for (const it of ms) {
      const mk = d.kind(it.m.kind || 'danger', false);
      const by = y + LPAD + it.r * (ROWH + ROWGAP);
      const c = d.node({ id: d.uid(it.m.id || 'ms_' + (it.m.label || '')), x: LW + it.mx - 11, y: by + 4, w: 22, h: 22, value: '', style: { rhombus: '', fillColor: mk.stroke, strokeColor: mk.stroke }, tooltip: it.m.note });
      if (it.m.id) barCells.set(it.m.id, c);
      allBars.push(c);
      labelCells.push(it.left
        ? d.text(LW + it.mx - 14 - it.lw, by, it.lw, ROWH, `<b>${h(it.m.label || '')}</b>`, { fontSize: 10, verticalAlign: 'middle', align: 'right', whiteSpace: undefined })
        : d.text(LW + it.mx + 14, by, it.lw, ROWH, `<b>${h(it.m.label || '')}</b>`, { fontSize: 10, verticalAlign: 'middle', whiteSpace: undefined }));
    }
    });
    y += lh;
  });
  const bottom = y;
  // grid lines for the finest header row
  for (const c of grid.slice(1)) d.edge({ id: d.uid('gl'), style: { endArrow: 'none', strokeColor: '#e5e5e5', strokeWidth: 1, dashed: '1', dashPattern: '2 3', rounded: '0' }, sourcePoint: { x: LW + c.x, y: headH }, targetPoint: { x: LW + c.x, y: bottom } });
  for (const fn of deferred) fn();
  // phases band (above header)
  if (spec.phases && spec.phases.length) {
    for (const p of spec.phases) {
      const k = d.kind(p.kind || 'purple', false);
      const x0 = X.start(p.start), x1 = X.end(p.end);
      d.node({ id: d.uid('phase_' + p.label), x: LW + x0, y: -30, w: x1 - x0, h: 24, value: `<b>${h(p.label)}</b>`, connectable: '0', style: { shape: 'step', size: 10, fixedSize: '1', perimeter: 'stepPerimeter', fillColor: k.fill, strokeColor: k.stroke, fontColor: d.ink.text, fontSize: 11, whiteSpace: undefined } });
    }
  }
  // global milestones + today
  const vline = (x, label, color, dashed) => {
    d.edge({ id: d.uid('vl'), style: { endArrow: 'none', strokeColor: color, strokeWidth: 1.5, dashed: dashed ? '1' : '0', dashPattern: '5 4', rounded: '0' }, sourcePoint: { x: LW + x, y: headH - 4 }, targetPoint: { x: LW + x, y: bottom + 8 } });
    const w = up10(textWidth(label, 10, true) + 16);
    d.node({ id: d.uid('vl_tag'), x: snap10(LW + x - w / 2), y: bottom + 8, w, h: 20, value: `<b>${h(label)}</b>`, connectable: '0', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: color, strokeColor: 'none', fontColor: '#ffffff', fontSize: 10, whiteSpace: undefined } });
  };
  for (const m of spec.milestones || []) vline(X.point(m.date !== undefined ? m.date : m.at), m.label || '', d.kind(m.kind || 'danger', false).stroke, true);
  if (spec.today) vline(X.point(spec.today), spec.todayLabel || 'Today', '#032d60', false);
  // dependencies: routed around the bars
  const deps = [];
  for (const dep of spec.dependencies || []) {
    const a = barCells.get(dep.from), b = barCells.get(dep.to);
    if (!a || !b) { d.warnings.push(`dependency skipped — unknown bar id: ${!a ? dep.from : dep.to}`); continue; }
    deps.push({ from: a.id, to: b.id, fromSides: { E: 0, S: 6, N: 6 }, toSides: { W: 0, N: 6, S: 6 }, style: { strokeColor: '#747474', strokeWidth: 1, endArrow: 'block', endSize: 4, arcSize: 8 } });
  }
  if (deps.length) d.routeEdges(deps, allBars.concat(labelCells), { bendCost: 8, soft: [{ x: 0, y: 0, w: LW + totalW, h: headH, cost: 60 }, { x: 0, y: 0, w: LW, h: bottom, cost: 60 }] });
  d.node({ id: d.uid('frame'), x: 0, y: 0, w: LW + totalW, h: bottom, value: '', connectable: '0', style: { fillColor: 'none', strokeColor: d.ink.border, strokeWidth: 1.5, pointerEvents: '0' } });
  const statuses = new Set();
  for (const l of lanes) for (const b of l.bars || []) if (b.status && STATUS_KIND[String(b.status).toLowerCase()]) statuses.add(String(b.status).toLowerCase());
  for (const s of statuses) { const k = d.kind(STATUS_KIND[s], false); d.legendExtra.push({ swatch: { style: { fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5 } }, label: s.charAt(0).toUpperCase() + s.slice(1) }); }
  if (lanes.some((l) => (l.milestones || []).length)) d.legendExtra.push({ swatch: { style: { rhombus: '', rounded: '0', fillColor: d.kind('danger', false).stroke, strokeColor: d.kind('danger', false).stroke } }, label: 'Milestone' });
  void up10;
  return [finishPage(d)];
}

// Best split of a label over two lines (bold): returns { lines, w } or null for a single word.
function twoLines(label, size) {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const w = Math.max(textWidth(a, size, true), textWidth(b, size, true));
    if (!best || w < best.w) best = { lines: [a, b], w };
  }
  return best;
}
