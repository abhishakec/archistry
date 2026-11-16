// validate.mjs — structural + geometric lint for any draw.io file (engine-built or hand-written).
// Level 1 (ERROR) = the file is broken. Level 2 (WARNING) = the file is ugly or hard to read.
import { indexPage, absBounds, edgePath, measureLabel, normColor } from './mx.mjs';

const num = (v, d) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const shapeOf = (st) => st.shape || ['swimlane', 'ellipse', 'rhombus', 'text', 'image', 'triangle', 'line', 'group'].find((k) => k in st && st[k] === '') || 'rectangle';

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }

export function validatePage(page, findings, pageLabel) {
  const add = (level, code, message, cell) => findings.push({ level, code, message, cell: cell || null, page: pageLabel });
  const ids = new Set();
  const cells = page.cells;
  if (!cells.some((c) => c.id === '0')) add('ERROR', 'missing-layer', 'root cell id="0" is missing');
  if (!cells.some((c) => c.id === '1')) add('ERROR', 'missing-layer', 'default layer cell id="1" is missing');
  for (const c of cells) {
    if (c.id === undefined || c.id === null || c.id === '') { add('ERROR', 'missing-id', 'a cell has no id'); continue; }
    if (ids.has(c.id)) add('ERROR', 'dup-id', `duplicate id "${c.id}"`, c.id);
    ids.add(c.id);
  }
  const idx = indexPage(page);
  for (const c of cells) {
    if (c.id === '0') continue;
    if (c.parent === undefined || c.parent === null || !idx.byId.has(c.parent)) add('ERROR', 'bad-parent', `cell "${c.id}" has a parent that does not exist ("${c.parent}")`, c.id);
    if (c.vertex && !c.geo) add('ERROR', 'no-geometry', `vertex "${c.id}" has no geometry`, c.id);
    if (c.edge) {
      for (const end of ['source', 'target']) {
        if (c[end] && !idx.byId.has(c[end])) add('ERROR', 'bad-edge-ref', `edge "${c.id}" ${end} "${c[end]}" does not exist`, c.id);
        else if (!c[end] && !(c.geo && c.geo[end + 'Point'])) add('WARNING', 'dangling-edge', `edge "${c.id}" has no ${end} and no ${end} point`, c.id);
      }
    }
  }
  if (findings.some((f) => f.level === 'ERROR' && f.page === pageLabel)) return { nodes: 0, edges: 0, crossings: 0 };

  const bounds = absBounds(page, idx);
  const isPart = (c) => c.style.part === '1';
  const realKids = (c) => (idx.kids.get(c.id) || []).filter((k) => k.vertex && !isPart(k) && k.connectable !== '0');
  const isContent = (c) => c.vertex && c.geo && !isPart(c) && c.connectable !== '0' && !['text', 'group', 'umlLifeline', 'line'].includes(shapeOf(c.style)) && realKids(c).length === 0 && !(idx.byId.get(c.parent) || {}).edge;
  const content = cells.filter(isContent);
  const ancestors = (c) => { const out = new Set(); let p = idx.byId.get(c.parent), g = 0; while (p && g++ < 40) { out.add(p.id); p = idx.byId.get(p.parent); } return out; };
  const pw = num(page.attrs && page.attrs.pageWidth, 0), ph = num(page.attrs && page.attrs.pageHeight, 0);

  // outside page / negative
  for (const c of cells) {
    if (!c.vertex) continue;
    const b = bounds.get(c.id);
    if (!b) continue;
    if (b.x < -0.5 || b.y < -0.5) add('WARNING', 'negative-coords', `"${c.id}" sits at negative coordinates (${Math.round(b.x)}, ${Math.round(b.y)})`, c.id);
    else if (pw && ph && (b.x + b.w > pw + 1 || b.y + b.h > ph + 1)) add('WARNING', 'outside-page', `"${c.id}" extends beyond the page (${pw}x${ph}) — enlarge pageWidth/pageHeight`, c.id);
  }
  // children escaping their container
  for (const c of cells) {
    if (!c.vertex || !c.geo || isPart(c) || c.geo.relative) continue;
    const p = idx.byId.get(c.parent);
    if (!p || !p.vertex) continue;
    const b = bounds.get(c.id), pb = bounds.get(p.id);
    if (!b || !pb) continue;
    const tol = 2;
    if (b.x < pb.x - tol || b.y < pb.y - tol || b.x + b.w > pb.x + pb.w + tol || b.y + b.h > pb.y + pb.h + tol) add('ERROR', 'escapes-container', `"${c.id}" extends outside its container "${p.id}"`, c.id);
  }
  // overlaps + tight spacing between content boxes
  for (let i = 0; i < content.length; i++) {
    const a = content[i], ba = bounds.get(a.id);
    if (!ba) continue;
    const anc = ancestors(a);
    for (let j = i + 1; j < content.length; j++) {
      const b = content[j], bb = bounds.get(b.id);
      if (!bb || anc.has(b.id) || ancestors(b).has(a.id)) continue;
      const ox = Math.min(ba.x + ba.w, bb.x + bb.w) - Math.max(ba.x, bb.x), oy = Math.min(ba.y + ba.h, bb.y + bb.h) - Math.max(ba.y, bb.y);
      if (ox > 1 && oy > 1) {
        const area = ox * oy, small = Math.min(ba.w * ba.h, bb.w * bb.h);
        if (area > 0.08 * small) add('ERROR', 'overlap', `"${a.id}" and "${b.id}" overlap`, a.id);
        else add('WARNING', 'overlap-slight', `"${a.id}" and "${b.id}" touch or slightly overlap`, a.id);
      } else if (a.parent === b.parent && ((ox > 1 && oy > -8 && oy <= 1) || (oy > 1 && ox > -8 && ox <= 1)) && !(Math.abs(ox) < 0.01 || Math.abs(oy) < 0.01)) {
        add('WARNING', 'tight-spacing', `"${a.id}" and "${b.id}" are less than 8px apart`, a.id);
      }
    }
  }
  // labels that do not fit
  for (const c of content) {
    if (!c.value || c.style.noLabel === '1') continue;
    const sh = shapeOf(c.style);
    if (sh === 'image' || c.style.labelPosition || c.style.verticalLabelPosition) continue;
    const b = bounds.get(c.id);
    const sp = num(c.style.spacing, 2);
    const padX = sp * 2 + num(c.style.spacingLeft, 0) + num(c.style.spacingRight, 0), padY = sp * 2 + num(c.style.spacingTop, 0) + num(c.style.spacingBottom, 0);
    const factor = sh === 'rhombus' ? 0.66 : 1;
    const m = measureLabel(c.value, c.style, c.style.whiteSpace === 'wrap' ? Math.max(8, b.w * factor - padX) : 0);
    if (m.h > b.h - padY + 6 && m.h > 16) add('WARNING', 'label-clipped', `label of "${c.id}" is taller than its box (${Math.round(m.h)}px text in ${Math.round(b.h)}px) — make it taller or wider`, c.id);
    else if (c.style.whiteSpace !== 'wrap' && m.w > b.w * factor - padX + 10) add('WARNING', 'label-clipped', `label of "${c.id}" is wider than its box (${Math.round(m.w)}px text in ${Math.round(b.w)}px)`, c.id);
    const fs = num(c.style.fontSize, 12);
    if (fs < 8) add('WARNING', 'tiny-font', `"${c.id}" uses a ${fs}px font — unreadable when exported`, c.id);
    const fc = normColor(c.style.fontColor || '#000000'), bg = normColor(c.style.fillColor === undefined ? '#ffffff' : c.style.fillColor);
    if (fc && bg && contrast(fc, bg) < 3) add('WARNING', 'low-contrast', `text ${fc} on fill ${bg} in "${c.id}" has low contrast`, c.id);
  }
  // edges through boxes + crossings
  const segs = [];
  let edgeCount = 0;
  for (const e of cells) {
    if (!e.edge) continue;
    if (e.source || e.target) edgeCount++;
    let ep = null;
    try { ep = edgePath(e, idx, bounds); } catch { ep = null; }
    if (!ep || ep.pts.length < 2) continue;
    if (!e.source && !e.target) continue; // decorative line
    const skip = new Set();
    for (const end of [e.source, e.target]) { if (!end) continue; skip.add(end); const ec = idx.byId.get(end); if (ec) { for (const a of ancestors(ec)) skip.add(a); for (const k of idx.kids.get(end) || []) skip.add(k.id); } }
    const pts = ep.pts;
    const hit = new Set();
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], b = pts[s];
      if (!ep.curved) segs.push({ a, b, id: e.id });
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      for (const c of content) {
        if (skip.has(c.id) || hit.has(c.id)) continue;
        const bb = bounds.get(c.id);
        const m = 2;
        if (x1 <= bb.x + m || x0 >= bb.x + bb.w - m || y1 <= bb.y + m || y0 >= bb.y + bb.h - m) continue;
        if (ep.curved || (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5)) {
          // diagonal / curve: sample
          let inside = false;
          for (let t = 0.1; t < 1; t += 0.1) { const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t; if (px > bb.x + m && px < bb.x + bb.w - m && py > bb.y + m && py < bb.y + bb.h - m) { inside = true; break; } }
          if (!inside) continue;
        }
        hit.add(c.id);
        add('WARNING', 'edge-through-box', `edge "${e.id}" runs through "${c.id}" — add waypoints or move the box`, e.id);
      }
    }
  }
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const p = segs[i], q = segs[j];
    if (p.id === q.id) continue;
    const ph2 = Math.abs(p.a.y - p.b.y) < 0.5, qh = Math.abs(q.a.y - q.b.y) < 0.5;
    if (ph2 === qh) continue;
    const hz = ph2 ? p : q, vt = ph2 ? q : p;
    if (Math.abs(vt.a.x - vt.b.x) > 0.5) continue;
    const hx0 = Math.min(hz.a.x, hz.b.x), hx1 = Math.max(hz.a.x, hz.b.x), vy0 = Math.min(vt.a.y, vt.b.y), vy1 = Math.max(vt.a.y, vt.b.y);
    if (vt.a.x > hx0 + 1 && vt.a.x < hx1 - 1 && hz.a.y > vy0 + 1 && hz.a.y < vy1 - 1) crossings++;
  }
  if (crossings > 14) add('WARNING', 'many-crossings', `${crossings} connector crossings — regroup zones or split the diagram`);
  if (content.length > 60) add('WARNING', 'too-dense', `${content.length} boxes on one page — split into several diagrams (aim for 25 or fewer primary elements)`);
  return { nodes: content.length, edges: edgeCount, crossings };
}

export function validateFile(file) {
  const findings = [];
  const stats = [];
  if (!file.pages.length) findings.push({ level: 'ERROR', code: 'no-pages', message: 'the file has no diagram pages', cell: null, page: null });
  file.pages.forEach((p, i) => { const s = validatePage(p, findings, p.name || 'Page-' + (i + 1)); stats.push(Object.assign({ page: p.name || 'Page-' + (i + 1) }, s)); });
  const errors = findings.filter((f) => f.level === 'ERROR').length, warnings = findings.filter((f) => f.level === 'WARNING').length;
  return { ok: errors === 0, errors, warnings, findings, stats };
}
