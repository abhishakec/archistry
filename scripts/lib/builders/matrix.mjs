// matrix.mjs — grids: table (RACI, fit-gap, traceability, permission matrix, test strategy),
// quadrant (prioritisation, stakeholder map), heat grid (risk matrix) and board (MoSCoW, story map, SWOT).
import { Diagram, finishPage, measure, h, small, up10, up20, snap10, clamp, textWidth } from '../dsl.mjs';

const VALUE_PRESETS = {
  raci: { kinds: { R: 'salesforce', A: 'danger', C: 'warning', I: 'external', S: 'purple' }, labels: { R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed', S: 'Supports' }, solid: true },
  'fit-gap-analysis': { kinds: { Fit: 'success', Standard: 'success', OOTB: 'success', Config: 'salesforce', Configure: 'salesforce', Custom: 'warning', Customise: 'warning', AppExchange: 'purple', Gap: 'danger', Partial: 'warning', 'N/A': 'muted' }, labels: {} },
  'traceability-matrix': { kinds: { '✓': 'success', Pass: 'success', Fail: 'danger', Blocked: 'danger', 'In progress': 'warning', 'Not run': 'muted', Planned: 'muted', '—': 'muted' }, labels: {} },
  'permission-matrix': { kinds: { CRUD: 'success', CRU: 'salesforce', CR: 'salesforce', RU: 'salesforce', R: 'warning', '—': 'muted', None: 'muted', Private: 'danger', 'Public Read Only': 'warning', 'Public Read/Write': 'success', 'Controlled by Parent': 'purple' }, labels: {} },
  'test-strategy': { kinds: {}, labels: {} },
};

function cellText(v) { return v === null || v === undefined ? '' : typeof v === 'object' ? String(v.text === undefined ? '' : v.text) : String(v); }

function buildTable(d, spec) {
  const preset = VALUE_PRESETS[spec.type] || { kinds: {}, labels: {} };
  const valueKinds = Object.assign({}, preset.kinds, spec.valueKinds || {});
  const valueLabels = Object.assign({}, preset.labels, spec.valueLabels || {});
  const solid = spec.solidChips !== undefined ? spec.solidChips : !!preset.solid;
  const cols = (spec.columns || spec.roles || []).map((c) => (typeof c === 'string' ? { label: c } : c));
  const rows = spec.rows || [];
  if (!cols.length || !rows.length) throw new Error('a table needs "columns" and "rows"');
  const headFS = 12;
  const firstW = clamp(up20(Math.max(...rows.map((r) => textWidth(r.label || r.section || '', 12, !!r.section)), textWidth(spec.rowHeader || '', 12, true)) + 30), 160, spec.rowHeaderWidth || 320);
  const colW = cols.map((c, i) => {
    if (c.width) return up20(c.width);
    const texts = rows.filter((r) => !r.section).map((r) => cellText((r.cells || r.values || [])[i]));
    const mx = Math.max(textWidth(c.label, headFS, true) + 24, ...texts.map((t) => Math.min(textWidth(t, 11) + 30, spec.maxColWidth || 220)));
    return clamp(up20(mx), 80, spec.maxColWidth || 220);
  });
  const headH = up10(Math.max(40, ...cols.map((c, i) => measure(`<b>${h(c.label)}</b>${c.sub ? '<br>' + small(h(c.sub), '#d8e6fe', 10) : ''}`, { fontSize: headFS }, colW[i] - 12).h + 16)));
  const totalW = firstW + colW.reduce((s, v) => s + v, 0);
  let y = 0;
  // header row
  d.node({ id: d.uid('th_rows'), x: 0, y, w: firstW, h: headH, value: spec.rowHeader ? `<b>${h(spec.rowHeader)}</b>` : '', connectable: '0', style: { fillColor: '#032d60', strokeColor: '#ffffff', fontColor: '#ffffff', fontSize: headFS, align: 'left', spacingLeft: 12 } });
  let x = firstW;
  cols.forEach((c, i) => {
    const k = c.kind ? d.kind(c.kind, false) : null;
    d.node({ id: d.uid('th_' + c.label), x, y, w: colW[i], h: headH, value: `<b>${h(c.label)}</b>${c.sub ? '<br>' + small(h(c.sub), k ? d.ink.sub : '#d8e6fe', 10) : ''}`, connectable: '0', style: { fillColor: k ? k.fill : '#032d60', strokeColor: '#ffffff', fontColor: k ? d.ink.text : '#ffffff', fontSize: headFS } });
    x += colW[i];
  });
  y += headH;
  const used = new Set();
  let stripe = 0;
  for (const r of rows) {
    if (r.section) {
      d.node({ id: d.uid('sec_' + r.section), x: 0, y, w: totalW, h: 30, value: `<b>${h(r.section)}</b>`, connectable: '0', style: { fillColor: '#eaf5fe', strokeColor: '#ffffff', fontColor: d.ink.text, fontSize: 12, align: 'left', spacingLeft: 12 } });
      y += 30; stripe = 0; continue;
    }
    const vals = r.cells || r.values || [];
    let rh = measure(`${h(r.label || '')}${r.sub ? '<br>' + small(h(r.sub), d.ink.sub, 10) : ''}`, { fontSize: 12 }, firstW - 24).h + 16;
    vals.forEach((v, i) => { if (i < cols.length && !(cellText(v) in valueKinds)) rh = Math.max(rh, measure(h(cellText(v)), { fontSize: 11 }, colW[i] - 16).h + 14); });
    rh = up10(Math.max(36, rh));
    const bg = stripe++ % 2 ? '#fafaf9' : '#ffffff';
    d.node({ id: d.uid('rh_' + (r.id || r.label)), x: 0, y, w: firstW, h: rh, value: `${r.bold ? '<b>' + h(r.label || '') + '</b>' : h(r.label || '')}${r.sub ? '<br>' + small(h(r.sub), d.ink.sub, 10) : ''}`, connectable: '0', style: { fillColor: bg, strokeColor: '#e5e5e5', fontColor: d.ink.text, fontSize: 12, align: 'left', spacingLeft: 12, spacingRight: 6 }, tooltip: r.note });
    x = firstW;
    cols.forEach((c, i) => {
      const v = vals[i];
      const t = cellText(v);
      const explicitKind = v && typeof v === 'object' ? v.kind : null;
      const vk = explicitKind || valueKinds[t];
      const cell = d.node({ id: d.uid('c'), x, y, w: colW[i], h: rh, value: vk ? '' : h(t), connectable: '0', style: { fillColor: bg, strokeColor: '#e5e5e5', fontColor: d.ink.text, fontSize: 11, container: vk ? '1' : undefined, collapsible: vk ? '0' : undefined } });
      if (vk && t) {
        used.add(t);
        const k = d.kind(vk, false);
        const cw = clamp(up10(textWidth(t, 11, true) + 18), 30, colW[i] - 12);
        d.node({ id: d.uid('chip'), x: snap10((colW[i] - cw) / 2), y: Math.round((rh - 22) / 2), w: cw, h: 22, value: `<b>${h(t)}</b>`, parent: cell.id, connectable: '0', style: { rounded: '1', arcSize: 22, absoluteArcSize: '1', fillColor: solid ? k.stroke : k.fill, strokeColor: k.stroke, fontColor: solid ? '#ffffff' : d.ink.text, fontSize: 11, whiteSpace: undefined, part: '1' } });
      }
      x += colW[i];
    });
    y += rh;
  }
  d.node({ id: d.uid('frame'), x: 0, y: 0, w: totalW, h: y, value: '', connectable: '0', style: { fillColor: 'none', strokeColor: d.ink.border, strokeWidth: 1.5, rounded: '0', pointerEvents: '0' } });
  for (const t of Object.keys(valueKinds)) if (used.has(t)) { const k = d.kind(valueKinds[t], false); d.legendExtra.push({ swatch: { text: t.length <= 2 ? t : '', style: { fillColor: solid ? k.stroke : k.fill, strokeColor: k.stroke, fontColor: solid ? '#ffffff' : d.ink.text } }, label: valueLabels[t] || t }); }
}

function buildQuadrant(d, spec) {
  const n = spec.grid || 2;
  const heat = n > 2 || spec.heat;
  const CW = spec.cellWidth || (n === 2 ? 340 : 170), CH = spec.cellHeight || (n === 2 ? 240 : 100);
  const W = CW * n, H = CH * n;
  const xa = spec.xAxis || {}, ya = spec.yAxis || {};
  const AX = up10(Math.max(70, 46 + Math.max(0, ...(ya.labels || [ya.low || 'Low', ya.high || 'High']).map((t) => textWidth(String(t), 11)))));
  // cells
  const q = spec.quadrants || [];
  const heatKind = (i, j) => { const s = (i + (n - 1 - j)) / (2 * (n - 1)); return s < 0.34 ? 'success' : s < 0.67 ? 'warning' : 'danger'; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let k, label = '';
    if (heat) k = d.kind(heatKind(i, j), false);
    else { const qi = j * 2 + i; const qd = q[qi] || {}; k = d.kind(typeof qd === 'object' && qd.kind ? qd.kind : ['warning', 'success', 'muted', 'salesforce'][qi], false); label = typeof qd === 'string' ? qd : qd.label || ''; if (qd.sub) label = `<b>${h(label)}</b><br>${small(h(qd.sub), d.ink.sub, 10)}`; else label = `<b>${h(label)}</b>`; }
    d.node({ id: d.uid(`q_${i}_${j}`), x: AX + i * CW, y: j * CH, w: CW, h: CH, value: label, connectable: '0', style: { fillColor: k.fill, strokeColor: '#ffffff', strokeWidth: 2, fontColor: d.ink.text, fontSize: 12, align: 'left', verticalAlign: 'top', spacingLeft: 10, spacingTop: 8 } });
  }
  d.node({ id: d.uid('qframe'), x: AX, y: 0, w: W, h: H, value: '', connectable: '0', style: { fillColor: 'none', strokeColor: d.ink.border, strokeWidth: 1.5, pointerEvents: '0' } });
  // axes
  d.node({ id: d.uid('yaxis'), x: 0, y: 0, w: 30, h: H, value: `<b>${h(ya.label || '')}</b>`, connectable: '0', style: { text: '', fillColor: 'none', strokeColor: 'none', horizontal: '0', fontColor: d.ink.text, fontSize: 13, whiteSpace: undefined } });
  d.text(AX, H + 34, W, 22, `<b>${h(xa.label || '')}</b>`, { align: 'center', fontSize: 13, whiteSpace: undefined });
  const xl = xa.labels || (n === 2 ? [xa.low || 'Low', xa.high || 'High'] : []), yl = ya.labels || (n === 2 ? [ya.low || 'Low', ya.high || 'High'] : []);
  for (let i = 0; i < n; i++) {
    if (xl[i] !== undefined) d.text(AX + i * CW, H + 8, CW, 20, small(h(xl[i]), d.ink.sub, 11), { align: 'center', whiteSpace: undefined });
    if (yl[i] !== undefined) d.text(30, (n - 1 - i) * CH, AX - 36, CH, small(h(yl[i]), d.ink.sub, 11), { align: 'right', verticalAlign: 'middle' });
  }
  // items
  const placed = [];
  if (!heat) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) placed.push({ x: AX + i * CW, y: j * CH, w: 190, h: 34 });
  const items = (spec.items || []).map((it, i) => Object.assign({ _i: i }, it));
  const perCell = new Map();
  for (const it of items) {
    const label = it.label || it.id || '';
    const w = clamp(up10(textWidth(label, 11, true) + 22), 60, heat ? CW - 16 : 180);
    const m = measure(`<b>${h(label)}</b>`, { fontSize: 11 }, w - 14);
    const hh = up10(m.h + 10);
    let px, py;
    if (heat || (Number.isInteger(it.x) && Number.isInteger(it.y) && it.x >= 1 && it.y >= 1 && n > 2)) {
      const ci = clamp(it.x, 1, n) - 1, cj = n - clamp(it.y, 1, n);
      const key = ci + ',' + cj;
      const cnt = perCell.get(key) || 0;
      perCell.set(key, cnt + 1);
      px = AX + ci * CW + 8; py = cj * CH + 8 + cnt * (hh + 4);
      if (py + hh > (cj + 1) * CH - 2) { d.warnings.push(`risk grid cell (${it.x},${it.y}) is crowded — "${label}" may overlap`); }
    } else {
      const fx = clamp(it.x === undefined ? 0.5 : it.x, 0, 1), fy = clamp(it.y === undefined ? 0.5 : it.y, 0, 1);
      px = snap10(AX + fx * W - w / 2); py = snap10((1 - fy) * H - hh / 2);
      if (n === 2) { const qi = fx >= 0.5 ? 1 : 0, qj = fy >= 0.5 ? 0 : 1; px = clamp(px, AX + qi * CW + 8, AX + (qi + 1) * CW - w - 8); py = clamp(py, qj * CH + 40, (qj + 1) * CH - hh - 8); }
      else { px = clamp(px, AX + 6, AX + W - w - 6); py = clamp(py, 30, H - hh - 6); }
      let guard = 0;
      const clash = () => placed.some((p) => px < p.x + p.w + 6 && p.x < px + w + 6 && py < p.y + p.h + 6 && p.y < py + hh + 6);
      while (clash() && guard++ < 40) { py += 10; if (py > H - hh - 6) { py = 30; px = clamp(px + 20, AX + 6, AX + W - w - 6); } }
    }
    placed.push({ x: px, y: py, w, h: hh });
    const k = d.kind(it.kind || 'neutral', !heat && !!it.kind);
    d.node({ id: d.uid('item_' + (it.id || label)), x: px, y: py, w, h: hh, value: `<b>${h(label)}</b>`, style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: it.kind ? k.fill : '#ffffff', strokeColor: it.kind ? k.stroke : d.ink.text, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 11, shadow: '1' }, tooltip: it.note });
  }
  if (heat) for (const [kind, label] of [['success', 'Low'], ['warning', 'Medium'], ['danger', 'High']]) { const k = d.kind(kind, false); d.legendExtra.push({ swatch: { style: { fillColor: k.fill, strokeColor: k.stroke } }, label: (spec.heatLabels && spec.heatLabels[kind]) || label }); }
}

function buildBoard(d, spec) {
  const cols = (spec.columns || []).map((c) => (typeof c === 'string' ? { label: c } : c));
  if (!cols.length) throw new Error('a board needs "columns"');
  const rows = spec.rows && spec.rows.length ? spec.rows : [{ label: '', cells: cols.map((c) => c.cards || []) }];
  const hasRowLabels = rows.some((r) => r.label);
  const CW = spec.cardWidth || 180, PAD = 14, GAP = 10;
  const perRow = spec.cardsPerRow || 1;
  const colW = PAD * 2 + CW * perRow + GAP * (perRow - 1);
  const LW = hasRowLabels ? 130 : 0;
  const HEADH = 46;
  const norm = (c) => (typeof c === 'string' ? { label: c } : c);
  const cardH = (c) => { let v = `<b>${h(c.label || '')}</b>`; if (c.sub) v += `<br>${small(h(c.sub), d.ink.sub, 10)}`; return Math.max(40, up10(measure(v, { fontSize: 11 }, CW - 20).h + 16)); };
  // header
  cols.forEach((c, i) => {
    const k = d.kind(c.kind || 'salesforce', false);
    d.node({ id: d.uid('bh_' + c.label), x: LW + i * colW, y: 0, w: colW, h: HEADH, value: `<b>${h(c.label)}</b>${c.sub ? '<br>' + small(h(c.sub), '#ffffff', 10) : ''}`, connectable: '0', style: { fillColor: k.stroke, strokeColor: '#ffffff', strokeWidth: 2, fontColor: '#ffffff', fontSize: 13, rounded: '1', arcSize: 12, absoluteArcSize: '1' } });
  });
  let y = HEADH + 6;
  for (const r of rows) {
    const cells = (r.cells || []).map((list) => (list || []).map(norm));
    let rh = 60;
    cells.forEach((list) => {
      let colH = PAD, lineH = 0;
      list.forEach((c, i) => { c._h = cardH(c); lineH = Math.max(lineH, c._h); if (i % perRow === perRow - 1 || i === list.length - 1) { colH += lineH + GAP; lineH = 0; } });
      rh = Math.max(rh, colH + PAD - GAP);
    });
    rh = up10(rh);
    if (hasRowLabels) { const rk = d.kind(r.kind || 'external', false); d.node({ id: d.uid('br_' + r.label), x: 0, y, w: LW - 6, h: rh, value: `<b>${h(r.label || '')}</b>${r.sub ? '<br>' + small(h(r.sub), d.ink.sub, 10) : ''}`, connectable: '0', style: { fillColor: rk.fill, strokeColor: rk.stroke, fontColor: d.ink.text, fontSize: 12, rounded: '1', arcSize: 12, absoluteArcSize: '1' } }); }
    cols.forEach((c, i) => {
      const k = d.kind(c.kind || 'salesforce', false);
      const zone = d.node({ id: d.uid('bz'), x: LW + i * colW, y, w: colW, h: rh, value: '', connectable: '0', style: { fillColor: k.fill, strokeColor: '#ffffff', strokeWidth: 2, rounded: '1', arcSize: 12, absoluteArcSize: '1', container: '1', collapsible: '0', fillOpacity: 55 } });
      let cy = PAD, lineH = 0;
      (cells[i] || []).forEach((card, ci) => {
        const col = ci % perRow;
        const ck = card.kind ? d.kind(card.kind, false) : null;
        let v = `<b>${h(card.label || '')}</b>`;
        if (card.sub) v += `<br>${small(h(card.sub), d.ink.sub, 10)}`;
        const cc = d.node({ id: d.uid('card_' + (card.id || card.label)), x: PAD + col * (CW + GAP), y: cy, w: CW, h: card._h, value: v, parent: zone.id, style: { rounded: '1', arcSize: 10, absoluteArcSize: '1', fillColor: ck ? ck.fill : '#ffffff', strokeColor: ck ? ck.stroke : k.stroke, strokeWidth: 1.2, fontColor: d.ink.text, fontSize: 11, align: 'left', spacingLeft: 8, spacingRight: card.badge ? 34 : 6, container: card.badge ? '1' : undefined, collapsible: card.badge ? '0' : undefined }, tooltip: card.note });
        if (card.badge) { const bw = up10(textWidth(String(card.badge), 9, true) + 12); d.node({ id: d.uid('bb'), x: CW - bw - 6, y: 6, w: bw, h: 16, value: `<b>${h(card.badge)}</b>`, parent: cc.id, connectable: '0', style: { rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: k.stroke, strokeColor: 'none', fontColor: '#ffffff', fontSize: 9, whiteSpace: undefined, part: '1' } }); }
        lineH = Math.max(lineH, card._h);
        if (col === perRow - 1) { cy += lineH + GAP; lineH = 0; }
      });
    });
    y += rh + 6;
  }
}

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const mode = spec.mode || (spec.items || spec.quadrants || spec.grid ? 'quadrant' : spec.rows && (spec.roles || (spec.columns && !(spec.columns || []).some((c) => c && c.cards)) && !(spec.rows || []).some((r) => r.cells && r.cells.some((c) => Array.isArray(c)))) ? 'table' : 'board');
  if (mode === 'quadrant') buildQuadrant(d, spec);
  else if (mode === 'table') buildTable(d, spec);
  else buildBoard(d, spec);
  return [finishPage(d)];
}
