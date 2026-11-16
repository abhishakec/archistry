// mapping.mjs — field-level mapping between stages (source -> DLO -> DMO, legacy -> Salesforce, API payload -> object).
import { Diagram, finishPage, h, small, up20, textWidth, resolveIcon } from '../dsl.mjs';

const MAP_KINDS = {
  direct: { color: 'salesforce', label: 'Direct mapping', style: {} },
  transform: { color: 'engagement', label: 'Transformation / formula', style: { dashed: '1', dashPattern: '6 3' } },
  formula: { color: 'engagement', label: 'Transformation / formula', style: { dashed: '1', dashPattern: '6 3' } },
  key: { color: 'data', label: 'Key / identity field', style: { strokeWidth: 2.5 } },
  lookup: { color: 'integration', label: 'Lookup / reference resolution', style: { dashed: '1', dashPattern: '2 3' } },
  default: { color: 'external', label: 'Default / constant value', style: { dashed: '1', dashPattern: '1 3' } },
};
const ROW = 26;

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const stages = spec.stages || [];
  if (stages.length < 2) throw new Error('a mapping diagram needs at least two stages');
  const rowCell = new Map();
  const mapped = new Set();
  for (const m of spec.maps || []) { mapped.add(m.from); mapped.add(m.to); }
  const tableW = (t) => {
    const fw = Math.max(0, ...(t.fields || []).map((f) => { const o = typeof f === 'string' ? { name: f } : f; return textWidth(o.name, 12) + (o.type ? textWidth(o.type, 10) + 16 : 0); }));
    return Math.min(340, Math.max(200, up20(Math.max(fw + 30, Math.max(textWidth(t.label || t.id, 13, true), t.api ? textWidth(t.api, 10) : 0) + (t.icon ? 60 : 30)))));
  };
  const gap = spec.gap || 200;
  const HEAD = stages.some((st) => (st.tables || []).some((t) => t.api && t.api !== t.label)) ? 46 : 34;
  let x = 0;
  let maxH = 0;
  const frames = [];
  for (const st of stages) {
    const k = d.kind(st.kind || 'neutral', false);
    const w = Math.max(...(st.tables || []).map(tableW), 200);
    let y = 60;
    const zoneX = x;
    const made = [];
    for (const t of st.tables || []) {
      const fields = (t.fields || []).map((f) => (typeof f === 'string' ? { name: f } : f));
      const hh = HEAD + fields.length * ROW + 6;
      const iconR = t.icon ? resolveIcon(t.icon) : null;
      let label = `<b>${h(t.label || t.id)}</b>`;
      if (t.api && t.api !== t.label) label += '<br>' + small(h(t.api), d.ink.sub, 10);
      const cell = d.node({ id: d.uid(t.id || t.label), x: zoneX + 20, y, w, h: hh, value: label, style: { swimlane: '', startSize: HEAD, rounded: '1', arcSize: 14, absoluteArcSize: '1', fillColor: k.fill, swimlaneFillColor: '#ffffff', strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13, fontStyle: 0, align: iconR ? 'left' : 'center', spacingLeft: iconR ? 36 : 4, collapsible: '0', container: '1', recursiveResize: '0', whiteSpace: undefined } });
      if (iconR) d.icon(iconR.key, 8, Math.round((HEAD - 22) / 2), 22, cell.id);
      fields.forEach((f, i) => {
        const ref = `${t.id || t.label}.${f.name}`;
        const isMapped = mapped.has(ref);
        let v = (f.key ? '<b>' + h(f.name) + '</b>' : h(f.name));
        if (f.type) v += '  ' + small(h(f.type), d.ink.sub, 10);
        const rc = d.node({ id: d.uid(ref), x: 0, y: HEAD + i * ROW, w, h: ROW, value: v, parent: cell.id, style: { text: '', fillColor: i % 2 ? '#fafaf9' : 'none', strokeColor: 'none', align: 'left', verticalAlign: 'middle', spacingLeft: 12, fontSize: 12, fontColor: isMapped || !(spec.maps || []).length ? d.ink.text : '#a0a0a0', whiteSpace: undefined, part: '1', points: '[[0,0.5],[1,0.5]]', portConstraint: 'eastwest' } });
        rowCell.set(ref, rc);
      });
      made.push(cell);
      y += hh + 30;
    }
    frames.push({ st, k, x: zoneX, w: w + 40, bottom: y - 10 });
    maxH = Math.max(maxH, y - 10);
    x += w + 40 + gap;
  }
  // stage frames go behind the tables
  const frameCells = frames.map((f) => ({ id: d.uid('stage_' + (f.st.label || 's')), value: `<b>${h(f.st.label || '')}</b>${f.st.sub ? '<br>' + small(h(f.st.sub), d.ink.sub, 11) : ''}`, style: { html: '1', whiteSpace: 'wrap', rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: '#fafaf9', strokeColor: f.k.stroke, strokeWidth: 1, dashed: '1', dashPattern: '6 4', fontColor: d.ink.text, fontSize: 13, align: 'left', verticalAlign: 'top', spacingLeft: 14, spacingTop: 10 }, vertex: true, parent: '1', connectable: '0', geo: { x: f.x, y: 0, w: f.w, h: maxH + 10 } }));
  d.cells.unshift(...frameCells);

  const seen = new Map();
  for (const m of spec.maps || []) {
    const a = rowCell.get(m.from), b = rowCell.get(m.to);
    if (!a || !b) { d.warnings.push(`map skipped — unknown field: ${!a ? m.from : m.to}`); continue; }
    const mk = MAP_KINDS[m.kind] || MAP_KINDS[m.label ? 'transform' : 'direct'];
    seen.set(mk.label, mk);
    const col = d.kind(mk.color, false).stroke;
    const pa = d.abs(a), pb = d.abs(b);
    const leftToRight = pa.x <= pb.x;
    const sx = leftToRight ? pa.x + pa.w : pa.x, tx = leftToRight ? pb.x : pb.x + pb.w;
    const sy = pa.y + pa.h / 2, ty = pb.y + pb.h / 2;
    const k = Math.min(80, Math.abs(tx - sx) / 2.5) * (leftToRight ? 1 : -1);
    d.edge({ id: d.uid('map'), source: a.id, target: b.id, value: m.label ? h(m.label) : '', style: Object.assign({ curved: '1', rounded: '0', strokeColor: col, strokeWidth: 1.5, endArrow: 'block', endFill: '1', endSize: 5, fontSize: 10, fontColor: d.ink.text }, mk.style), exit: { fx: leftToRight ? 1 : 0, fy: 0.5 }, entry: { fx: leftToRight ? 0 : 1, fy: 0.5 }, points: Math.abs(sy - ty) < 1 ? [] : [{ x: sx + k, y: sy }, { x: tx - k, y: ty }], labelT: m.label ? 0.16 : undefined, tooltip: m.note });
  }
  for (const [label, mk] of seen) d.legendExtra.push({ line: 'x', style: Object.assign({ strokeColor: d.kind(mk.color, false).stroke }, mk.style), label });
  return [finishPage(d)];
}
