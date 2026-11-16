// sequence.mjs — UML sequence diagrams: integration call order, OAuth flows, agent conversations.
import { Diagram, finishPage, measure, h, small, up10, up20, snap10, clamp, textWidth, wrapPlain, resolveIcon } from '../dsl.mjs';

const HEAD_H = 60;

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const parts = (spec.participants || []).map((p) => (typeof p === 'string' ? { id: p, label: p } : Object.assign({}, p)));
  if (parts.length < 2) throw new Error('a sequence diagram needs at least two participants');
  const idx = new Map(parts.map((p, i) => [p.id, i]));
  const auto = spec.autonumber !== false;
  let counter = 0;

  // ---- flatten messages into rows
  const rows = [];
  const frames = [];
  function walk(list, depth) {
    for (const m of list || []) {
      if (m.fragment) {
        const fr = { kind: m.fragment, label: m.label || '', depth, start: rows.length, seps: [], lo: Infinity, hi: -Infinity };
        rows.push({ type: 'fragStart', fr });
        frames.push(fr);
        walk(m.messages, depth + 1);
        for (const alt of m.else || []) { rows.push({ type: 'fragSep', fr, label: alt.label || 'else' }); walk(alt.messages, depth + 1); }
        rows.push({ type: 'fragEnd', fr });
        continue;
      }
      if (m.divider !== undefined) { rows.push({ type: 'divider', label: m.divider }); continue; }
      if (m.note !== undefined && !m.from) { rows.push({ type: 'note', text: m.note, over: [].concat(m.over || parts[0].id) }); continue; }
      if (!idx.has(m.from) || !idx.has(m.to)) throw new Error(`message refers to unknown participant: ${m.from} -> ${m.to}`);
      const kind = m.kind || 'sync';
      const n = auto && kind !== 'reply' ? ++counter : (auto ? ++counter : null);
      const lines = wrapPlain(m.label || '', m.from === m.to ? 170 : 230, 11);
      rows.push({ type: 'msg', m, kind, n, lines, a: idx.get(m.from), b: idx.get(m.to) });
    }
  }
  walk(spec.messages, 0);
  // which lifelines each fragment spans
  const stack = [];
  for (const r of rows) {
    if (r.type === 'fragStart') stack.push(r.fr);
    else if (r.type === 'fragEnd') stack.pop();
    else if (r.type === 'msg') for (const f of stack) { f.lo = Math.min(f.lo, r.a, r.b); f.hi = Math.max(f.hi, r.a, r.b); }
    else if (r.type === 'note') for (const f of stack) for (const o of r.over) if (idx.has(o)) { f.lo = Math.min(f.lo, idx.get(o)); f.hi = Math.max(f.hi, idx.get(o)); }
  }

  // ---- horizontal layout
  for (const p of parts) {
    const iconR = p.icon ? resolveIcon(p.icon) : null;
    p._icon = iconR;
    const lw = Math.max(textWidth(p.label || p.id, 13, true), p.sub ? textWidth(p.sub, 11) : 0);
    p._w = clamp(up20(lw + (iconR ? 56 : 28)), 120, 220);
  }
  const dist = [];
  for (let i = 0; i < parts.length - 1; i++) dist.push(Math.max(180, (parts[i]._w + parts[i + 1]._w) / 2 + 40));
  let rightPad = 0;
  const labelW = (r) => Math.max(0, ...r.lines.map((t) => textWidth((r.n ? r.n + '. ' : '') + t, 11))) ;
  for (const r of rows) {
    if (r.type !== 'msg') continue;
    const lw = labelW(r) + 44;
    if (r.a === r.b) { if (r.a === parts.length - 1) rightPad = Math.max(rightPad, lw + 40); else dist[r.a] = Math.max(dist[r.a], lw + 60); continue; }
    const lo = Math.min(r.a, r.b), hi = Math.max(r.a, r.b);
    let span = 0;
    for (let i = lo; i < hi; i++) span += dist[i];
    if (span < lw) { const add = (lw - span) / (hi - lo); for (let i = lo; i < hi; i++) dist[i] += add; }
  }
  const cx = [up20(parts[0]._w / 2 + 20)];
  for (let i = 0; i < dist.length; i++) cx.push(cx[i] + up20(dist[i]));

  // ---- vertical layout
  let y = HEAD_H + 30;
  for (const r of rows) {
    r.y0 = y;
    if (r.type === 'msg') { const lh = r.lines.length * 13.2; r.h = r.a === r.b ? up10(Math.max(50, lh + 24)) : up10(Math.max(40, lh + 22)); r.y = r.a === r.b ? y + 14 : y + r.h - 12; }
    else if (r.type === 'note') { const w = r.over.length > 1 ? Math.abs(cx[idx.get(r.over[r.over.length - 1])] - cx[idx.get(r.over[0])]) + 120 : 180; r.w = w; const m = measure(h(r.text), { fontSize: 11 }, w - 24); r.hh = up10(m.h + 22); r.h = r.hh + 16; }
    else if (r.type === 'divider') r.h = 40;
    else if (r.type === 'fragStart') { r.h = 34; r.fr.y0 = y; }
    else if (r.type === 'fragSep') { r.h = 28; r.fr.seps.push({ y: y + 4, label: r.label }); }
    else if (r.type === 'fragEnd') { r.h = 14; r.fr.y1 = y + 4; }
    y += r.h;
  }
  const total = up20(y + 30);

  // ---- frames first (behind lifelines)
  const left = cx[0] - parts[0]._w / 2, right = cx[cx.length - 1] + parts[parts.length - 1]._w / 2 + rightPad;
  for (const f of frames) {
    const lo = Number.isFinite(f.lo) ? f.lo : 0, hi = Number.isFinite(f.hi) ? f.hi : parts.length - 1;
    const inset = f.depth * 10;
    const x0 = snap10(Math.max(left - 30, cx[lo] - 90) + inset), x1 = snap10(Math.min(right + 30, cx[hi] + 90 + (hi === parts.length - 1 ? rightPad : 0)) - inset);
    const k = d.kind('external', false);
    d.node({ id: d.uid('frag'), x: x0, y: f.y0, w: x1 - x0, h: f.y1 - f.y0, value: '', connectable: '0', style: { rounded: '1', arcSize: 8, absoluteArcSize: '1', fillColor: '#fafaf9', strokeColor: k.stroke, strokeWidth: 1, dashed: '1', dashPattern: '4 3' } });
    const tagW = up10(textWidth(f.kind, 10, true) + 16);
    d.node({ id: d.uid('fragtag'), x: x0, y: f.y0, w: tagW, h: 20, value: `<b>${h(f.kind)}</b>`, connectable: '0', style: { rounded: '1', arcSize: 8, absoluteArcSize: '1', fillColor: k.stroke, strokeColor: 'none', fontColor: '#ffffff', fontSize: 10, whiteSpace: undefined } });
    if (f.label) d.text(x0 + tagW + 6, f.y0 + 2, x1 - x0 - tagW - 12, 18, small(`[${h(f.label)}]`, d.ink.sub, 10), { fontSize: 10, whiteSpace: undefined });
    for (const s of f.seps) {
      d.edge({ id: d.uid('fragsep'), style: { endArrow: 'none', dashed: '1', dashPattern: '4 3', strokeColor: k.stroke, strokeWidth: 1 }, sourcePoint: { x: x0, y: s.y }, targetPoint: { x: x1, y: s.y } });
      d.text(x0 + 8, s.y + 2, x1 - x0 - 16, 18, small(`[${h(s.label)}]`, d.ink.sub, 10), { fontSize: 10, whiteSpace: undefined });
    }
  }

  // ---- lifelines
  const life = parts.map((p, i) => {
    const k = d.kind(p.kind || 'neutral');
    let v = `<b>${h(p.label || p.id)}</b>`;
    if (p.sub) v += `<br>${small(h(p.sub), d.ink.sub, 11)}`;
    const cell = d.node({ id: d.uid(p.id), x: cx[i] - p._w / 2, y: 0, w: p._w, h: total, value: v, style: { shape: 'umlLifeline', perimeter: 'lifelinePerimeter', size: HEAD_H, container: '1', collapsible: '0', recursiveResize: '0', rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13, align: p._icon ? 'left' : 'center', spacingLeft: p._icon ? 46 : 4, spacingRight: 4 } });
    if (p._icon) d.icon(p._icon.key, 10, (HEAD_H - 28) / 2, 28, cell.id);
    return cell;
  });

  // ---- activations
  const open = parts.map(() => []);
  const bars = [];
  for (const r of rows) {
    if (r.type !== 'msg' || r.a === r.b) continue;
    if (r.kind === 'sync') open[r.b].push({ y: r.y, caller: r.a });
    else if (r.kind === 'reply' || r.kind === 'error') { const st = open[r.a]; if (st.length) { const o = st.pop(); bars.push({ p: r.a, y0: o.y, y1: r.y }); } }
  }
  open.forEach((st, p) => st.forEach((o) => bars.push({ p, y0: o.y, y1: Math.min(total - 20, o.y + 30) })));
  for (const b of bars) {
    const p = parts[b.p], k = d.kind(p.kind || 'neutral', false);
    d.node({ id: d.uid('act'), x: p._w / 2 - 5, y: b.y0, w: 10, h: Math.max(10, b.y1 - b.y0), value: '', parent: life[b.p].id, connectable: '0', style: { fillColor: k.fill === '#ffffff' ? '#f3f3f3' : k.fill, strokeColor: k.stroke, strokeWidth: 1, part: '1' } });
  }
  const active = (p, yy) => bars.some((b) => b.p === p && yy >= b.y0 - 0.5 && yy <= b.y1 + 0.5);

  // ---- messages, notes, dividers
  for (const r of rows) {
    if (r.type === 'divider') {
      d.edge({ id: d.uid('div'), style: { endArrow: 'none', dashed: '1', dashPattern: '8 4', strokeColor: d.ink.border, strokeWidth: 1 }, sourcePoint: { x: left - 20, y: r.y0 + 20 }, targetPoint: { x: right + 20, y: r.y0 + 20 } });
      const w = up10(textWidth(r.label, 11, true) + 24);
      d.node({ id: d.uid('divl'), x: snap10((left + right) / 2 - w / 2), y: r.y0 + 10, w, h: 20, value: `<b>${h(r.label)}</b>`, connectable: '0', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: d.ink.border, fontSize: 11, fontColor: d.ink.sub, whiteSpace: undefined } });
      continue;
    }
    if (r.type === 'note') {
      const ids = r.over.filter((o) => idx.has(o)).map((o) => idx.get(o));
      const mid = ids.reduce((s, i) => s + cx[i], 0) / ids.length;
      d.node({ id: d.uid('note'), x: snap10(mid - r.w / 2), y: r.y0 + 6, w: r.w, h: r.hh, value: h(r.text), connectable: '0', style: { shape: 'note', size: 12, fillColor: '#fff8dc', strokeColor: '#ca8501', strokeWidth: 1, fontSize: 11, fontColor: d.ink.text, align: 'left', spacingLeft: 8, spacingRight: 12 } });
      continue;
    }
    if (r.type !== 'msg') continue;
    const { a, b, kind, m } = r;
    const st = { edgeStyle: 'none', rounded: '0', strokeColor: d.ink.line, strokeWidth: 1.5, fontSize: 11, verticalAlign: 'bottom' };
    if (kind === 'async') Object.assign(st, { endArrow: 'open', endSize: 8 });
    else if (kind === 'reply') Object.assign(st, { endArrow: 'open', endSize: 8, dashed: '1', dashPattern: '6 4' });
    else if (kind === 'error') Object.assign(st, { endArrow: 'open', endSize: 8, dashed: '1', dashPattern: '6 4', strokeColor: d.kind('danger', false).stroke, fontColor: d.kind('danger', false).stroke });
    else if (kind === 'create') Object.assign(st, { endArrow: 'open', endSize: 8, dashed: '1', dashPattern: '2 3' });
    const label = r.lines.map((t, i) => (i === 0 && r.n ? `<b>${r.n}.</b> ` : '') + h(t)).join('<br>');
    const lh = r.lines.length * 13.2;
    if (a === b) {
      const fy0 = r.y / total, fy1 = (r.y + r.h - 26) / total;
      const off = active(a, r.y) ? 5 : 0;
      const px = cx[a] + 40;
      d.edge({ id: d.uid(`m_${r.n || 'self'}`), source: life[a].id, target: life[a].id, value: label, style: Object.assign(st, { align: 'left' }), exit: { fx: 0.5, fy: fy0, dx: off }, entry: { fx: 0.5, fy: fy1, dx: off }, points: [{ x: px, y: r.y }, { x: px, y: r.y + r.h - 26 }], labelOffset: { x: labelW(r) / 2 + 10, y: 0 }, tooltip: m.note });
      continue;
    }
    const dir = b > a ? 1 : -1;
    const fy = r.y / total;
    d.edge({ id: d.uid(`m_${r.n || 'x'}`), source: life[a].id, target: life[b].id, value: label, style: st, exit: { fx: 0.5, fy, dx: active(a, r.y) ? dir * 5 : 0 }, entry: { fx: 0.5, fy, dx: active(b, r.y) ? -dir * 5 : 0 }, labelOffset: { x: 0, y: -(lh / 2 + 4) }, tooltip: m.note });
  }
  if (spec.legend !== false) {
    const kinds = new Set(rows.filter((r) => r.type === 'msg').map((r) => r.kind));
    if (kinds.size > 1) {
      if (kinds.has('sync')) d.legendExtra.push({ line: 'x', style: {}, label: 'Synchronous call' });
      if (kinds.has('async')) d.legendExtra.push({ line: 'x', style: { endArrow: 'open' }, label: 'Asynchronous message' });
      if (kinds.has('reply')) d.legendExtra.push({ line: 'x', style: { endArrow: 'open', dashed: '1', dashPattern: '6 4' }, label: 'Response' });
      if (kinds.has('error')) d.legendExtra.push({ line: 'x', style: { endArrow: 'open', dashed: '1', dashPattern: '6 4', strokeColor: d.kind('danger', false).stroke }, label: 'Error' });
    }
  }
  return [finishPage(d)];
}
