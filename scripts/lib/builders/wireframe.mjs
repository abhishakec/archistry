// wireframe.mjs — low-fidelity Lightning page / screen wireframes with numbered annotations.
import { Diagram, finishPage, measure, h, small, up10, snap10, clamp, textWidth } from '../dsl.mjs';

const GREY = { line: '#c9c7c5', soft: '#e5e5e5', skel: '#dddbda', bg: '#f3f3f3', head: '#fafaf9' };
const TYPE_TAG = { highlights: 'Highlights Panel', path: 'Path', tabs: 'Tabs', 'record-detail': 'Record Detail', fields: 'Record Detail', 'related-list': 'Related List', 'related-lists': 'Related Lists', chart: 'Report Chart', feed: 'Chatter', activity: 'Activity', flow: 'Screen Flow', lwc: 'Custom LWC', agent: 'Agentforce', knowledge: 'Knowledge', list: 'List View', text: 'Rich Text', buttons: 'Actions', kpi: 'Metrics', form: 'Form', image: 'Image', map: 'Map', search: 'Search' };

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const mobile = (spec.device || 'desktop') === 'mobile';
  const W = spec.width || (mobile ? 380 : 1200);
  const PAD = mobile ? 10 : 14, GAP = mobile ? 10 : 14;
  const notes = [];
  let y = 0;
  const frame = d.node({ id: d.uid('frame'), x: 0, y: 0, w: W, h: 100, value: '', connectable: '0', style: { rounded: '1', arcSize: mobile ? 36 : 14, absoluteArcSize: '1', fillColor: GREY.bg, strokeColor: '#747474', strokeWidth: 2, container: '1', collapsible: '0', recursiveResize: '0' } });
  const box = (x, yy, w, hh, value, style, tip) => d.node({ id: d.uid('w'), x, y: yy, w, h: hh, value: value || '', parent: frame.id, connectable: '0', style: Object.assign({ fillColor: '#ffffff', strokeColor: GREY.line, fontColor: d.ink.text, fontSize: 11 }, style), tooltip: tip });
  const skel = (x, yy, w, hh = 8, c = GREY.skel) => box(x, yy, Math.max(4, w), hh, '', { fillColor: c, strokeColor: 'none', rounded: '1', arcSize: 6, absoluteArcSize: '1' });
  // global header
  if (spec.chrome !== false) {
    box(0, 0, W, 44, '', { fillColor: '#ffffff', strokeColor: GREY.line, rounded: '1', arcSize: mobile ? 36 : 14, absoluteArcSize: '1' });
    for (let i = 0; i < 9; i++) box(16 + (i % 3) * 7, 13 + Math.floor(i / 3) * 7, 4, 4, '', { fillColor: '#747474', strokeColor: 'none' });
    box(46, 8, mobile ? 150 : 220, 28, `<b>${h(spec.app || 'Salesforce')}</b>`, { strokeColor: 'none', fillColor: 'none', align: 'left', fontSize: 13, whiteSpace: undefined });
    if (!mobile) box(W / 2 - 180, 9, 360, 26, small('Search...', '#939393', 11), { rounded: '1', arcSize: 26, absoluteArcSize: '1', align: 'left', spacingLeft: 14 });
    box(W - 44, 9, 26, 26, '', { ellipse: '', fillColor: GREY.skel, strokeColor: 'none' });
    y = 44;
    const tabs = spec.tabs || [];
    if (tabs.length && !mobile) {
      box(0, y, W, 36, '', { fillColor: '#ffffff', strokeColor: GREY.line });
      let tx = 20;
      tabs.forEach((t, i) => { const tw = up10(textWidth(t, 12, i === 0) + 26); box(tx, y + 2, tw, 32, i === (spec.activeTab || 0) ? `<b>${h(t)}</b>` : h(t), { fillColor: 'none', strokeColor: 'none', fontSize: 12, whiteSpace: undefined }); if (i === (spec.activeTab || 0)) box(tx, y + 32, tw, 3, '', { fillColor: '#0176d3', strokeColor: 'none' }); tx += tw + 6; });
      y += 36;
    }
  }
  y += PAD;

  function compHeight(c, w) {
    const t = c.type || 'custom';
    if (c.height) return c.height;
    const fields = c.fields || [];
    switch (t) {
      case 'highlights': return 86;
      case 'path': return 56;
      case 'tabs': { let hh = 44; for (const k of c.components || []) hh += compHeight(k, w - 24) + 10; return hh + 6; }
      case 'record-detail': case 'fields': case 'form': { const cols = c.columns || (w > 420 ? 2 : 1); return 44 + Math.ceil(Math.max(fields.length, 4) / cols) * 40 + 8; }
      case 'related-list': return 44 + ((c.rows || 3) + 1) * 26 + 10;
      case 'related-lists': return 44 + (c.lists || ['Related']).length * 40 + 6;
      case 'chart': return 190;
      case 'kpi': return 96;
      case 'feed': case 'activity': return 44 + 38 + (c.rows || 3) * 44 + 6;
      case 'buttons': return 52;
      case 'text': return 44 + (c.lines || 3) * 16 + 14;
      case 'knowledge': case 'list': case 'search': return 44 + (c.rows || 3) * 30 + 10;
      case 'image': case 'map': return 170;
      default: { const m = c.description ? measure(h(c.description), { fontSize: 11 }, w - 24).h : 30; return 44 + Math.max(50, up10(m + 20)); }
    }
  }
  function drawComp(c, x, yy, w, hh) {
    const t = c.type || 'custom';
    const custom = t === 'lwc' || t === 'flow' || t === 'custom' || t === 'agent';
    const k = t === 'agent' ? d.kind('ai', false) : custom ? d.kind('purple', false) : null;
    box(x, yy, w, hh, '', { rounded: '1', arcSize: 10, absoluteArcSize: '1', strokeColor: k ? k.stroke : GREY.line, dashed: custom ? '1' : '0', dashPattern: '5 3', fillColor: '#ffffff' }, c.note);
    const tag = c.tag || TYPE_TAG[t] || t;
    const title = c.label || tag;
    if (t !== 'path' && t !== 'buttons') {
      box(x + 12, yy + 8, w - 24, 26, `<b>${h(title)}</b>` + (title !== tag && w > 240 ? '  ' + small(h(tag), '#939393', 10) : ''), { fillColor: 'none', strokeColor: 'none', align: 'left', fontSize: 12, whiteSpace: undefined });
      if (t !== 'highlights' && t !== 'tabs') box(x + 1, yy + 38, w - 2, 1, '', { fillColor: GREY.soft, strokeColor: 'none' });
    }
    const ix = x + 12, iw = w - 24;
    let iy = yy + 46;
    const fields = c.fields || [];
    if (t === 'highlights') {
      box(x + 12, yy + 10, 28, 28, '', { rounded: '1', arcSize: 8, absoluteArcSize: '1', fillColor: '#0176d3', strokeColor: 'none' });
      { const tc = d.cells[d.cells.length - 2]; tc.geo.x = x + 50; tc.geo.w = Math.max(60, w - 62 - (c.actions || []).reduce((s, a) => s + up10(textWidth(a, 11) + 22) + 6, 0)); } // title sits after the icon and before the buttons
      const acts = c.actions || [];
      let bx = x + w - 12;
      for (const a of acts.slice().reverse()) { const bw = up10(textWidth(a, 11) + 22); bx -= bw; box(bx, yy + 10, bw, 26, h(a), { rounded: '1', arcSize: 8, absoluteArcSize: '1', strokeColor: '#0176d3', fontColor: '#0176d3', whiteSpace: undefined }); bx -= 6; }
      const n = Math.max(1, Math.min(fields.length || 4, Math.floor(iw / 120)));
      for (let i = 0; i < n; i++) { const fx = ix + i * (iw / n); box(fx, yy + 46, iw / n - 10, 14, small(h(fields[i] || 'Field'), '#747474', 10), { fillColor: 'none', strokeColor: 'none', align: 'left', whiteSpace: undefined }); skel(fx, yy + 64, Math.min(90, iw / n - 20)); }
    } else if (t === 'path') {
      const steps = c.steps || ['New', 'Working', 'Escalated', 'Closed'];
      const sw = (w - 24 - 110) / steps.length;
      steps.forEach((s, i) => box(x + 12 + i * sw, yy + 12, sw - 2, 32, h(s), { shape: 'step', size: 12, fixedSize: '1', perimeter: 'stepPerimeter', fillColor: i < (c.current === undefined ? 1 : c.current) ? '#2e844a' : i === (c.current === undefined ? 1 : c.current) ? '#032d60' : GREY.soft, strokeColor: 'none', fontColor: i <= (c.current === undefined ? 1 : c.current) ? '#ffffff' : d.ink.text, fontSize: 10, whiteSpace: undefined }));
      box(x + w - 112, yy + 12, 100, 32, 'Mark Complete', { rounded: '1', arcSize: 32, absoluteArcSize: '1', fillColor: '#0176d3', strokeColor: 'none', fontColor: '#ffffff', fontSize: 10, whiteSpace: undefined });
    } else if (t === 'tabs') {
      let tx = x + 12;
      const labels = c.tabs || ['Details', 'Related'];
      d.cells[d.cells.length - 1].value = '';
      labels.forEach((l, i) => { const tw = up10(textWidth(l, 12, i === 0) + 24); box(tx, yy + 6, tw, 28, i === 0 ? `<b>${h(l)}</b>` : h(l), { fillColor: 'none', strokeColor: 'none', fontSize: 12, whiteSpace: undefined }); if (i === 0) box(tx, yy + 34, tw, 3, '', { fillColor: '#0176d3', strokeColor: 'none' }); tx += tw + 4; });
      box(x + 1, yy + 37, w - 2, 1, '', { fillColor: GREY.soft, strokeColor: 'none' });
      let cy = yy + 46;
      for (const kid of c.components || []) { const kh = compHeight(kid, w - 24); drawComp(kid, x + 12, cy, w - 24, kh); cy += kh + 10; }
    } else if (t === 'record-detail' || t === 'fields' || t === 'form') {
      const cols = c.columns || (w > 420 ? 2 : 1);
      const list = fields.length ? fields : ['Field', 'Field', 'Field', 'Field'];
      list.forEach((f, i) => { const fx = ix + (i % cols) * (iw / cols), fy = iy + Math.floor(i / cols) * 40; box(fx, fy, iw / cols - 12, 14, small(h(f), '#747474', 10), { fillColor: 'none', strokeColor: 'none', align: 'left', whiteSpace: undefined }); if (t === 'form') box(fx, fy + 15, iw / cols - 14, 20, '', { rounded: '1', arcSize: 6, absoluteArcSize: '1' }); else { skel(fx, fy + 20, Math.min(160, iw / cols - 30) * (0.5 + ((i * 37) % 50) / 100)); box(fx, fy + 34, iw / cols - 14, 1, '', { fillColor: GREY.soft, strokeColor: 'none' }); } });
    } else if (t === 'related-list' || t === 'knowledge' || t === 'list' || t === 'search') {
      const cols = c.columns || (t === 'related-list' ? ['Name', 'Status', 'Date'] : null);
      const rh = t === 'related-list' ? 26 : 30;
      if (cols) { box(x + 1, iy - 6, w - 2, rh, '', { fillColor: GREY.head, strokeColor: 'none' }); cols.forEach((cn, i) => box(ix + i * (iw / cols.length), iy - 2, iw / cols.length - 6, 16, small(`<b>${h(cn)}</b>`, '#5c5c5c', 10), { fillColor: 'none', strokeColor: 'none', align: 'left', whiteSpace: undefined })); iy += rh; }
      for (let r = 0; r < (c.rows || 3); r++) { const n = cols ? cols.length : 1; for (let i = 0; i < n; i++) skel(ix + i * (iw / n), iy + r * rh + 4, (iw / n - 24) * (0.45 + (((r + 1) * (i + 3) * 29) % 50) / 100), 8, i === 0 ? '#aacbff' : GREY.skel); box(x + 1, iy + r * rh + rh - 6, w - 2, 1, '', { fillColor: GREY.soft, strokeColor: 'none' }); }
    } else if (t === 'related-lists') {
      (c.lists || ['Related']).forEach((l, i) => { box(ix, iy + i * 40, iw, 32, `<b>${h(l)}</b>  ${small('(3)', '#939393', 10)}`, { rounded: '1', arcSize: 8, absoluteArcSize: '1', fillColor: GREY.head, align: 'left', spacingLeft: 10, whiteSpace: undefined }); });
    } else if (t === 'chart') {
      const bars = [0.5, 0.8, 0.35, 0.95, 0.6, 0.75];
      const bw = Math.min(46, (iw - 20) / bars.length - 10);
      bars.forEach((v, i) => box(ix + 14 + i * (bw + 10), yy + hh - 16 - v * 110, bw, v * 110, '', { fillColor: i % 2 ? '#aacbff' : '#0176d3', strokeColor: 'none' }));
      box(ix, yy + hh - 16, iw, 1, '', { fillColor: GREY.line, strokeColor: 'none' });
    } else if (t === 'kpi') {
      const items = c.items || ['Open Cases', 'Avg Handle Time', 'CSAT'];
      items.forEach((it, i) => { const fx = ix + i * (iw / items.length); box(fx, iy, iw / items.length - 10, 14, small(h(it), '#747474', 10), { fillColor: 'none', strokeColor: 'none', align: 'left', whiteSpace: undefined }); skel(fx, iy + 20, 60, 16, '#032d60'); });
    } else if (t === 'feed' || t === 'activity') {
      box(ix, iy, iw, 30, small(t === 'feed' ? 'Share an update...' : 'Log a call, new task, email...', '#939393', 11), { rounded: '1', arcSize: 8, absoluteArcSize: '1', align: 'left', spacingLeft: 10 });
      for (let r = 0; r < (c.rows || 3); r++) { const ry = iy + 40 + r * 44; box(ix, ry, 26, 26, '', { ellipse: '', fillColor: GREY.skel, strokeColor: 'none' }); skel(ix + 36, ry + 4, iw * 0.4); skel(ix + 36, ry + 18, iw * (0.5 + ((r * 31) % 30) / 100), 6, GREY.soft); }
    } else if (t === 'buttons') {
      let bx = x + 12;
      for (const a of c.actions || [c.label || 'Action']) { const bw = up10(textWidth(a, 11) + 26); box(bx, yy + 12, bw, 28, h(a), { rounded: '1', arcSize: 8, absoluteArcSize: '1', strokeColor: '#0176d3', fontColor: '#0176d3', whiteSpace: undefined }); bx += bw + 8; }
    } else if (t === 'text') {
      for (let r = 0; r < (c.lines || 3); r++) skel(ix, iy + r * 16, iw * (r === (c.lines || 3) - 1 ? 0.55 : 0.92), 7, GREY.soft);
    } else if (t === 'image' || t === 'map') {
      box(ix, iy, iw, hh - 58, small(t === 'map' ? 'Map' : 'Image', '#939393', 11), { fillColor: GREY.bg, strokeColor: GREY.soft, rounded: '1', arcSize: 8, absoluteArcSize: '1' });
    } else {
      box(ix, iy, iw, hh - 56, c.description ? small(h(c.description), '#5c5c5c', 11) : '', { fillColor: k ? k.fill : GREY.head, strokeColor: 'none', rounded: '1', arcSize: 8, absoluteArcSize: '1', align: 'left', verticalAlign: 'top', spacingLeft: 8, spacingTop: 6, spacingRight: 8 });
    }
    if (c.note) {
      notes.push(c.note);
      box(x + w - 13, yy - 11, 24, 24, `<b>${notes.length}</b>`, { ellipse: '', fillColor: '#ba0517', strokeColor: '#ffffff', strokeWidth: 2, fontColor: '#ffffff', fontSize: 11, whiteSpace: undefined, part: '1' });
    }
  }

  if (spec.page && !mobile) { box(PAD, y, W - PAD * 2, 22, small(h(spec.page), '#747474', 11), { fillColor: 'none', strokeColor: 'none', align: 'left', whiteSpace: undefined }); y += 26; }
  for (const row of spec.rows || []) {
    const cols = mobile ? [{ width: 12, components: (row.columns || []).flatMap((c) => c.components || []) }] : (row.columns || [row]);
    const total = cols.reduce((s, c) => s + (c.width || 1), 0);
    const avail = W - PAD * 2 - GAP * (cols.length - 1);
    let x = PAD, rowH = 0;
    let used = 0;
    cols.forEach((c, ci) => {
      const cw = ci === cols.length - 1 ? avail - used : snap10((avail * (c.width || 1)) / total);
      used += cw;
      let cy = y;
      for (const comp of c.components || []) { const ch = compHeight(comp, cw); drawComp(comp, x, cy, cw, ch); cy += ch + GAP; }
      rowH = Math.max(rowH, cy - y);
      x += cw + GAP;
    });
    y += rowH;
  }
  frame.geo.h = up10(y + PAD - GAP + (mobile ? 16 : 0));
  // annotations panel
  if (notes.length) {
    const nx = W + 40, nw = 300;
    d.text(nx, 0, nw, 24, '<b>Annotations</b>', { fontSize: 14 });
    let ny = 34;
    notes.forEach((n, i) => {
      const m = measure(h(n), { fontSize: 11 }, nw - 44);
      const hh = Math.max(30, up10(m.h + 10));
      d.node({ id: d.uid('ann_n'), x: nx, y: ny + 3, w: 24, h: 24, value: `<b>${i + 1}</b>`, connectable: '0', style: { ellipse: '', fillColor: '#ba0517', strokeColor: 'none', fontColor: '#ffffff', fontSize: 11, whiteSpace: undefined } });
      d.text(nx + 34, ny, nw - 34, hh, h(n), { fontSize: 11, verticalAlign: 'middle' });
      ny += hh + 8;
    });
  }
  void clamp;
  return [finishPage(d)];
}
