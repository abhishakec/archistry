// tree.mjs — tidy hierarchies: org-chart, role-hierarchy, governance model, work/process breakdown.
import { Diagram, finishPage, measureCard, drawCard, h, snap10, up20 } from '../dsl.mjs';

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const TB = (spec.direction || 'TB').toUpperCase() !== 'LR';
  const roots = spec.roots || (spec.root ? [spec.root] : null);
  if (!roots || !roots.length) throw new Error('tree spec needs "root" (or "roots")');
  const gapSib = spec.gapX || 30, gapLevel = spec.gapY || 60;
  const stackAt = spec.compactLeaves === false ? Infinity : (spec.stackAt || 4);
  const o = { minW: spec.nodeWidth || 160, maxW: spec.nodeWidth || 220, minH: 60 };
  const all = [];
  (function prep(n, depth, parent) {
    n._depth = depth; n._parent = parent; n._kids = n.children || [];
    const m = measureCard(d, n, o);
    n._w = m.w; n._h = m.h;
    all.push(n);
    for (const c of n._kids) prep(c, depth + 1, n);
  })({ _virtual: true, children: roots, label: '' }, -1, null);
  const vroot = all[0];
  // uniform size per depth keeps levels tidy
  const byDepth = new Map();
  for (const n of all) { if (n._virtual) continue; if (!byDepth.has(n._depth)) byDepth.set(n._depth, []); byDepth.get(n._depth).push(n); }
  for (const list of byDepth.values()) { const mw = Math.max(...list.map((n) => n._w)), mh = Math.max(...list.map((n) => n._h)); for (const n of list) { n._w = mw; n._h = mh; } }
  const main = (n) => (TB ? n._h : n._w), cross = (n) => (TB ? n._w : n._h);

  // subtree extents on the cross axis; stacked leaf groups hang under their parent
  const INDENT = 30;
  function measureTree(n) {
    const kids = n._kids;
    n._stack = !n._virtual && kids.length >= stackAt && kids.every((k) => !(k.children && k.children.length));
    if (!kids.length) { n._span = n._virtual ? 0 : cross(n); n._deep = n._virtual ? 0 : main(n); return; }
    for (const k of kids) measureTree(k);
    if (n._stack) {
      if (TB) { n._span = Math.max(cross(n), INDENT + Math.max(...kids.map((k) => k._w))); n._deep = main(n) + kids.reduce((s, k) => s + k._h + 20, 0) + 10; }
      else { n._span = Math.max(cross(n), kids.reduce((s, k) => s + k._h + 16, -16)); n._deep = main(n) + gapLevel + Math.max(...kids.map((k) => k._w)); }
      return;
    }
    const sum = kids.reduce((s, k) => s + k._span, 0) + gapSib * (kids.length - 1);
    n._span = Math.max(n._virtual ? 0 : cross(n), sum);
    n._deep = (n._virtual ? 0 : main(n) + gapLevel) + Math.max(...kids.map((k) => k._deep));
  }
  measureTree(vroot);
  const levelMain = [];
  for (const [dep, list] of byDepth) levelMain[dep] = Math.max(...list.map(main));
  const levelPos = [];
  let acc = 0;
  for (let i = 0; i < levelMain.length; i++) { levelPos[i] = acc; acc += (levelMain[i] || 0) + gapLevel; }

  const pos = new Map();
  function placeTree(n, c0) {
    const kids = n._kids;
    if (!n._virtual) {
      let c;
      if (n._stack && TB) c = c0;
      else c = c0 + (n._span - cross(n)) / 2;
      pos.set(n, { m: levelPos[n._depth], c: snap10(c) });
    }
    if (!kids.length) return;
    if (n._stack) {
      const p = pos.get(n);
      if (TB) { let y = p.m + main(n) + 20; for (const k of kids) { pos.set(k, { m: y, c: p.c + INDENT }); y += k._h + 20; } }
      else { const total = kids.reduce((s, k) => s + k._h + 16, -16); let y = p.c + cross(n) / 2 - total / 2; for (const k of kids) { pos.set(k, { m: levelPos[n._depth + 1], c: snap10(y) }); y += k._h + 16; } }
      return;
    }
    const sum = kids.reduce((s, k) => s + k._span, 0) + gapSib * (kids.length - 1);
    let c = c0 + (n._span - sum) / 2;
    for (const k of kids) { placeTree(k, c); c += k._span + gapSib; }
  }
  placeTree(vroot, 0);

  const cells = new Map();
  for (const n of all) {
    if (n._virtual) continue;
    const p = pos.get(n);
    const box = TB ? { x: p.c, y: p.m, w: n._w, h: n._h } : { x: p.m, y: p.c, w: n._w, h: n._h };
    const cell = drawCard(d, Object.assign({}, n, { kind: n.kind || (n._depth === 0 ? 'salesforce' : 'neutral') }), box, '1', o);
    cells.set(n, cell);
    if (n.id) cells.set(n.id, cell);
  }
  const line = { edgeStyle: 'orthogonalEdgeStyle', endArrow: spec.arrows ? 'block' : 'none', strokeColor: d.ink.border, strokeWidth: 1.5, rounded: '1' };
  for (const n of all) {
    if (n._virtual) continue;
    const a = cells.get(n).geo;
    for (const k of n._kids) {
      const b = cells.get(k).geo;
      let exit, entry, points;
      if (n._stack && TB) { const x = a.x + 15; exit = { fx: 15 / a.w, fy: 1 }; entry = { fx: 0, fy: 0.5 }; points = [{ x, y: b.y + b.h / 2 }]; }
      else if (TB) { const my = snap10(a.y + a.h + gapLevel / 2); exit = { fx: 0.5, fy: 1 }; entry = { fx: 0.5, fy: 0 }; points = Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) < 1 ? [] : [{ x: a.x + a.w / 2, y: my }, { x: b.x + b.w / 2, y: my }]; }
      else { const mx = snap10(a.x + a.w + gapLevel / 2); exit = { fx: 1, fy: 0.5 }; entry = { fx: 0, fy: 0.5 }; points = Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < 1 ? [] : [{ x: mx, y: a.y + a.h / 2 }, { x: mx, y: b.y + b.h / 2 }]; }
      d.edge({ id: d.uid('t'), source: cells.get(n).id, target: cells.get(k).id, style: Object.assign({}, line, k.dotted ? { dashed: '1', dashPattern: '4 4' } : {}), exit, entry, points, value: k.edgeLabel ? h(k.edgeLabel) : '' });
    }
  }
  for (const l of spec.links || []) {
    const a = cells.get(l.from), b = cells.get(l.to);
    if (!a || !b) { d.warnings.push(`link skipped — unknown id: ${l.from} -> ${l.to}`); continue; }
    d.edge({ id: d.uid('dl'), source: a.id, target: b.id, value: l.label ? h(l.label) : '', style: { edgeStyle: 'orthogonalEdgeStyle', dashed: '1', dashPattern: '4 4', endArrow: 'open', strokeColor: d.kind(l.color || 'purple', false).stroke, strokeWidth: 1.5 } });
  }
  void up20;
  return [finishPage(d)];
}
