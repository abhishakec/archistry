// tables.mjs — entity boxes + notated relationships.
// Powers: data-model (Salesforce ERD notation) and class-diagram (UML, for Apex).
import { Diagram, finishPage, measure, h, small, up20, snap10, clamp, textWidth, resolveIcon } from '../dsl.mjs';

const ENTITY_KINDS = {
  standard: { kind: 'salesforce', label: 'Standard object' },
  custom: { kind: 'engagement', label: 'Custom object' },
  external: { kind: 'external', label: 'External object / system' },
  data: { kind: 'data', label: 'Data Cloud object (DLO / DMO)' },
  dmo: { kind: 'data', label: 'Data Cloud object (DLO / DMO)' },
  dlo: { kind: 'data', label: 'Data Cloud object (DLO / DMO)' },
  bigobject: { kind: 'analytics', label: 'Big object / platform event / metadata type' },
  event: { kind: 'analytics', label: 'Big object / platform event / metadata type' },
  metadata: { kind: 'analytics', label: 'Big object / platform event / metadata type' },
  managed: { kind: 'integration', label: 'Managed package object' },
  junction: { kind: 'engagement', label: 'Custom object' },
  interface: { kind: 'purple', label: 'Interface' },
  abstract: { kind: 'analytics', label: 'Abstract class' },
  class: { kind: 'salesforce', label: 'Class' },
  test: { kind: 'success', label: 'Test class' },
  trigger: { kind: 'warning', label: 'Trigger' },
  enum: { kind: 'external', label: 'Enum' },
};
// Salesforce data-model notation: crow's foot on the many (child) end; diamond on the parent of a master-detail.
const REL = {
  lookup: { style: { startArrow: 'ERzeroToMany', startFill: '0', endArrow: 'ERzeroToOne', endFill: '0' }, label: 'Lookup (optional parent)' },
  'required-lookup': { style: { startArrow: 'ERzeroToMany', startFill: '0', endArrow: 'ERmandOne', endFill: '0' }, label: 'Required lookup' },
  'master-detail': { style: { startArrow: 'ERzeroToMany', startFill: '0', endArrow: 'diamond', endFill: '0' }, label: 'Master-detail (parent-child)' },
  'many-to-many': { style: { startArrow: 'ERzeroToMany', startFill: '0', endArrow: 'ERzeroToMany', endFill: '0' }, label: 'Many-to-many' },
  'one-to-one': { style: { startArrow: 'ERmandOne', startFill: '0', endArrow: 'ERmandOne', endFill: '0' }, label: 'One-to-one' },
  external: { style: { startArrow: 'ERzeroToMany', startFill: '0', endArrow: 'ERzeroToOne', endFill: '0', dashed: '1', dashPattern: '6 4' }, label: 'External / indirect lookup' },
  hierarchy: { style: { startArrow: 'ERzeroToMany', startFill: '0', endArrow: 'ERzeroToOne', endFill: '0' }, label: 'Lookup (optional parent)' },
  // UML
  extends: { style: { endArrow: 'block', endFill: '0', endSize: 10, startArrow: 'none' }, label: 'Extends' },
  implements: { style: { endArrow: 'block', endFill: '0', endSize: 10, startArrow: 'none', dashed: '1', dashPattern: '6 4' }, label: 'Implements' },
  uses: { style: { endArrow: 'open', endSize: 8, startArrow: 'none', dashed: '1', dashPattern: '6 4' }, label: 'Uses / depends on' },
  association: { style: { endArrow: 'open', endSize: 8, startArrow: 'none' }, label: 'Association' },
  composition: { style: { startArrow: 'diamond', startFill: '1', endArrow: 'open', endSize: 8 }, label: 'Composition (owns)' },
  aggregation: { style: { startArrow: 'diamond', startFill: '0', endArrow: 'open', endSize: 8 }, label: 'Aggregation' },
};
const REL_ALIAS = { md: 'master-detail', masterdetail: 'master-detail', lk: 'lookup', 'm:n': 'many-to-many', junction: 'many-to-many', '1:1': 'one-to-one', required: 'required-lookup', dependency: 'uses', inherits: 'extends', realizes: 'implements', 'external-lookup': 'external', 'indirect-lookup': 'external', self: 'hierarchy' };

function fieldLine(d, f, isClass) {
  if (typeof f === 'string') {
    const m = f.match(/^([#+*~-])\s*(.*)$/);
    const mark = m ? m[1] : (isClass ? '' : '+');
    const body = m ? m[2] : f;
    const parts = body.split(/\s*:\s*/);
    return `${mark ? h(mark) + ' ' : ''}${h(parts[0])}${parts.length > 1 ? small(' : ' + h(parts.slice(1).join(': ')), d.ink.sub, 11) : ''}`;
  }
  const key = f.key === true || ['pk', 'ext', 'id', 'key', 'unique'].includes(String(f.key || '').toLowerCase());
  const mark = isClass ? (f.visibility === 'private' ? '-' : f.visibility === 'protected' ? '#' : '+') : (key ? '#' : '+');
  let s = `${h(mark)} ${key && !isClass ? '<b>' + h(f.name) + '</b>' : h(f.name)}`;
  if (f.type) s += small(' : ' + h(f.type), d.ink.sub, 11);
  if (f.required && !isClass) s += small(' *', d.kind('danger', false).stroke, 11);
  return s;
}

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const isClass = spec.type === 'class-diagram' || spec.mode === 'class';
  const ents = (spec.entities || spec.classes || []).map((e) => (typeof e === 'string' ? { id: e, label: e } : Object.assign({}, e)));
  if (!ents.length) throw new Error('spec.entities is empty');
  const maxFields = spec.maxFields || 12;
  const byId = new Map();
  const kindsSeen = new Map();
  for (const e of ents) {
    e.id = e.id || e.api || e.label;
    if (!e.label) e.label = e.id;
    byId.set(e.id, e);
    let kind = String(e.kind || (isClass ? 'class' : (/__c$/.test(e.api || e.id) ? 'custom' : /__x$/.test(e.api || e.id) ? 'external' : /__(dlm|dll)$/.test(e.api || e.id) ? 'data' : /__(e|mdt|b)$/.test(e.api || e.id) ? 'bigobject' : 'standard'))).toLowerCase();
    if (!ENTITY_KINDS[kind]) kind = isClass ? 'class' : 'standard';
    e._ek = ENTITY_KINDS[kind];
    kindsSeen.set(e._ek.label, e._ek.kind);
    // header + body text
    const api = e.api && e.api !== e.label ? e.api : null;
    let head = '';
    const stereo = e.stereotype || (isClass && ['interface', 'abstract', 'enum', 'trigger', 'test'].includes(kind) ? kind : null);
    if (stereo) head += small('«' + h(stereo) + '»', d.ink.sub, 10) + '<br>';
    head += `<b>${h(e.label)}</b>`;
    if (api) head += `<br><i>${small(h(api), d.ink.sub, 11)}</i>`;
    e._head = head;
    const fields = (e.fields || []).slice(0, maxFields);
    const hidden = (e.fields || []).length - fields.length + (e.more || 0);
    const lines = fields.map((f) => fieldLine(d, f, isClass));
    if (hidden > 0) lines.push(small(`… +${hidden} more`, d.ink.sub, 11));
    let body = lines.join('<br>');
    if (isClass && e.methods && e.methods.length) body += (body ? '<hr>' : '') + e.methods.slice(0, maxFields).map((f) => fieldLine(d, typeof f === 'string' ? f : Object.assign({}, f, { name: f.name + (/\)$/.test(f.name) ? '' : '()') }), true)).join('<br>');
    e._body = body;
    const hm = measure(head, { fontSize: 13 }, 0), bm = body ? measure(body, { fontSize: 12 }, 0) : { w: 0, h: 0 };
    const iconR = e.icon ? resolveIcon(e.icon) : null;
    e._icon = iconR;
    e._w = clamp(up20(Math.max(hm.w + (iconR ? 60 : 28), bm.w + 28)), 180, 320);
    e._hh = up20(hm.h + 14);
    if (e._hh < 40) e._hh = 40;
    e._bh = body ? up20(bm.h + 14) : 0;
    e._h = e._hh + e._bh;
  }
  const rels = (spec.relationships || spec.relations || []).map((r) => Object.assign({}, r)).filter((r) => {
    if (!byId.has(r.from) || !byId.has(r.to)) { d.warnings.push(`relationship skipped — unknown entity: ${r.from} -> ${r.to}`); return false; }
    const t = String(r.type || (isClass ? 'association' : 'lookup')).toLowerCase();
    r._t = REL[t] ? t : (REL_ALIAS[t] && REL[REL_ALIAS[t]] ? REL_ALIAS[t] : (isClass ? 'association' : 'lookup'));
    return true;
  });

  // ---- placement
  const labelNeed = Math.max(0, ...rels.map((r) => (r.label ? textWidth(r.label, 10) + 60 : 0)));
  const gapX = up20(Math.max(spec.gapX || 100, labelNeed)), gapY = spec.gapY || 100;
  const place = new Map();
  const groups = [...new Set(ents.map((e) => e.group).filter(Boolean))];
  const explicit = ents.every((e) => e.row !== undefined && e.col !== undefined);
  const zoneFrames = [];
  if (explicit) {
    const colW = [], rowH = [];
    for (const e of ents) { colW[e.col] = Math.max(colW[e.col] || 0, e._w); rowH[e.row] = Math.max(rowH[e.row] || 0, e._h); }
    const colX = [], rowY = [];
    let acc = 0;
    for (let i = 0; i < colW.length; i++) { colX[i] = acc; acc += (colW[i] || 0) + (colW[i] ? gapX : 0); }
    acc = 0;
    for (let i = 0; i < rowH.length; i++) { rowY[i] = acc; acc += (rowH[i] || 0) + (rowH[i] ? gapY : 0); }
    for (const e of ents) place.set(e.id, { x: colX[e.col] + snap10((colW[e.col] - e._w) / 2), y: rowY[e.row] });
  } else if (groups.length > 1) {
    // one framed column per domain
    let x = 0;
    const order = [...groups, null];
    for (const g of order) {
      const members = ents.filter((e) => (e.group || null) === g);
      if (!members.length) continue;
      const cols = members.length > (spec.groupRows || 4) ? 2 : 1;
      const colW = [0, 0];
      members.forEach((e, i) => { colW[i % cols] = Math.max(colW[i % cols], e._w); });
      const ys = [50, 50];
      const inner = 60;
      members.forEach((e, i) => { const c = i % cols; place.set(e.id, { x: x + 30 + (c ? colW[0] + inner : 0) + snap10((colW[c] - e._w) / 2), y: ys[c] + 10 }); ys[c] += e._h + 60; });
      const w = 60 + colW[0] + (cols > 1 ? inner + colW[1] : 0), hh = Math.max(ys[0], ys[1]) - 20;
      if (g) zoneFrames.push({ label: g, x, y: 0, w, h: hh });
      x += w + gapX;
    }
    const maxH = Math.max(...zoneFrames.map((z) => z.h), 0);
    for (const z of zoneFrames) z.h = maxH;
  } else {
    // layered: parents above children
    const parents = new Map(ents.map((e) => [e.id, []])), children = new Map(ents.map((e) => [e.id, []]));
    for (const r of rels) {
      if (r.from === r.to) continue;
      const up = ['composition', 'aggregation'].includes(r._t) ? r.from : r.to, down = up === r.to ? r.from : r.to;
      if (r._t === 'many-to-many' || r._t === 'one-to-one' || r._t === 'association' || r._t === 'uses') { parents.get(r.to).push(r.from); children.get(r.from).push(r.to); continue; }
      parents.get(down).push(up); children.get(up).push(down);
    }
    const level = new Map(), state = new Map();
    const visit = (id) => {
      if (state.get(id) === 2) return level.get(id);
      if (state.get(id) === 1) return 0;
      state.set(id, 1);
      let l = 0;
      for (const p of parents.get(id)) l = Math.max(l, visit(p) + 1);
      state.set(id, 2); level.set(id, l);
      return l;
    };
    for (const e of ents) visit(e.id);
    const maxRow = spec.maxPerRow || 4;
    let rows = [];
    for (const e of ents) { const l = level.get(e.id); (rows[l] = rows[l] || []).push(e); }
    rows = rows.filter(Boolean);
    // split over-wide rows
    const split = [];
    for (const r of rows) for (let i = 0; i < r.length; i += maxRow) split.push(r.slice(i, i + maxRow));
    rows = split;
    const xOf = new Map();
    const cellW = Math.max(...ents.map((e) => e._w)) + gapX;
    rows.forEach((r) => r.forEach((e, i) => xOf.set(e.id, i)));
    for (let sweep = 0; sweep < 4; sweep++) {
      const seq = sweep % 2 === 0 ? rows : rows.slice().reverse();
      for (const r of seq) {
        const bary = new Map();
        for (const e of r) { const nb = [...parents.get(e.id), ...children.get(e.id)].filter((n) => xOf.has(n) && !r.some((x) => x.id === n)); bary.set(e.id, nb.length ? nb.reduce((s, n) => s + xOf.get(n), 0) / nb.length : xOf.get(e.id)); }
        r.sort((a, b) => bary.get(a.id) - bary.get(b.id));
        const widest = Math.max(...rows.map((x) => x.length));
        const off = (widest - r.length) / 2;
        r.forEach((e, i) => xOf.set(e.id, i + off));
      }
    }
    let y = 0;
    for (const r of rows) {
      const rh = Math.max(...r.map((e) => e._h));
      for (const e of r) place.set(e.id, { x: snap10(xOf.get(e.id) * cellW + (cellW - gapX - e._w) / 2), y });
      y += rh + gapY;
    }
  }

  // ---- draw
  for (const z of zoneFrames) {
    d.node({ id: d.uid('domain_' + z.label), x: z.x, y: z.y, w: z.w, h: z.h, value: `<b>${h(z.label)}</b>`, connectable: '0', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: '#fafaf9', strokeColor: '#c9c7c5', dashed: '1', dashPattern: '6 4', fontColor: d.ink.sub, fontSize: 13, align: 'left', verticalAlign: 'top', spacingLeft: 14, spacingTop: 10 } });
    d.soft.push({ x: z.x, y: z.y, w: Math.min(z.w, textWidth(z.label, 13, true) + 30), h: 36, cost: 14 });
  }
  const cells = new Map();
  for (const e of ents) {
    const p = place.get(e.id);
    const k = d.kind(e._ek.kind, false);
    const cell = d.node({ id: d.uid(e.id), x: p.x, y: p.y, w: e._w, h: e._h, value: e._head, style: { swimlane: '', startSize: e._hh, horizontal: '1', rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: k.fill, swimlaneFillColor: '#ffffff', strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13, fontStyle: 0, align: e._icon ? 'left' : 'center', spacingLeft: e._icon ? 44 : 4, collapsible: '0', recursiveResize: '0', container: '1' }, link: e.link, tooltip: e.description || e.tooltip });
    if (e._icon) d.icon(e._icon.key, 10, Math.round((e._hh - 26) / 2), 26, cell.id);
    if (e._body) d.node({ id: d.uid(e.id + '_fields'), x: 0, y: e._hh, w: e._w, h: e._bh, value: e._body, parent: cell.id, connectable: '0', style: { text: '', fillColor: 'none', strokeColor: 'none', align: 'left', verticalAlign: 'top', spacingLeft: 10, spacingTop: 5, fontSize: 12, fontColor: d.ink.text, whiteSpace: undefined, part: '1', overflow: 'hidden' } });
    cells.set(e.id, cell);
  }
  const relSeen = new Map();
  const links = rels.map((r) => {
    relSeen.set(REL[r._t].label, REL[r._t].style);
    const st = Object.assign({ strokeColor: d.ink.line, strokeWidth: 1.5, startSize: 10, endSize: 10, fontSize: 10, fontColor: d.ink.sub }, REL[r._t].style);
    if (r._t === 'diamond') st.endSize = 9;
    return { from: cells.get(r.from).id, to: cells.get(r.to).id, label: r.label ? h(r.label) : '', style: st, tooltip: r.note };
  });
  if (links.length) d.routeEdges(links, [...cells.values()], { bendCost: 18 });
  for (const [label, kind] of kindsSeen) { const k = d.palette.resolve(kind); d.legendExtra.push({ swatch: { style: { fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5 } }, label }); }
  for (const [label, style] of relSeen) d.legendExtra.push({ line: 'x', style: Object.assign({ startSize: 8, endSize: 8 }, style, { _legend: undefined }), label });
  if (!isClass && ents.some((e) => (e.fields || []).length)) d.legendExtra.push({ swatch: { text: '#', style: { fillColor: '#ffffff', strokeColor: d.ink.border, fontColor: d.ink.text } }, label: 'Key / external ID field' });
  return [finishPage(d)];
}
