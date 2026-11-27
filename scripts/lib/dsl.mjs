// dsl.mjs — diagram construction helpers shared by every builder:
// Salesforce palette + brand override, text sizing, cards, icons, edges, header/legend, page finishing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureLabel, textWidth } from './mx.mjs';
import { route } from './router.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(HERE, '..', '..');

/* -------------------------------------------------------------- palette -- */

export const INK = { text: '#032d60', sub: '#5c5c5c', line: '#514f4d', border: '#969492', canvas: '#ffffff', muted: '#f3f3f3' };
// Colour is classification, never decoration. Every kind is a light tint + a solid stroke of the same hue.
export const KINDS = {
  salesforce: { fill: '#eaf5fe', stroke: '#0176d3', label: 'Salesforce core' },
  data: { fill: '#f6f2fb', stroke: '#5a1ba9', label: 'Data Cloud / Data 360' },
  ai: { fill: '#eef1ff', stroke: '#3a49da', label: 'AI / Agentforce' },
  integration: { fill: '#def9f3', stroke: '#0b827c', label: 'Integration / MuleSoft' },
  engagement: { fill: '#ffece3', stroke: '#dd5a1b', label: 'Marketing / engagement' },
  success: { fill: '#ebf7e6', stroke: '#2e844a', label: 'Live / done' },
  warning: { fill: '#fbf3e0', stroke: '#ca8501', label: 'At risk / attention' },
  danger: { fill: '#fef1ee', stroke: '#ba0517', label: 'Blocked / gap' },
  external: { fill: '#f3f3f3', stroke: '#747474', label: 'External system' },
  neutral: { fill: '#ffffff', stroke: '#969492', label: 'Neutral' },
  user: { fill: '#ffffff', stroke: '#032d60', label: 'People / channels' },
  purple: { fill: '#f6f2fb', stroke: '#9050e9', label: 'Emphasis' },
  security: { fill: '#fdf0f7', stroke: '#b60554', label: 'Security / identity' },
  analytics: { fill: '#e7f8fb', stroke: '#0b6d8a', label: 'Analytics' },
  muted: { fill: '#fafaf9', stroke: '#c9c7c5', label: 'Out of scope / future' },
};
const KIND_ALIASES = {
  sf: 'salesforce', core: 'salesforce', crm: 'salesforce', primary: 'salesforce', standard: 'salesforce',
  datacloud: 'data', data360: 'data', 'data-cloud': 'data',
  agentforce: 'ai', einstein: 'ai', agent: 'ai',
  mulesoft: 'integration', middleware: 'integration', api: 'integration',
  marketing: 'engagement', commerce: 'engagement',
  done: 'success', live: 'success', green: 'success', fit: 'success',
  risk: 'warning', amber: 'warning', partial: 'warning', planned: 'warning',
  error: 'danger', red: 'danger', gap: 'danger', blocked: 'danger',
  ext: 'external', thirdparty: 'external', 'third-party': 'external', legacy: 'external', gray: 'external', grey: 'external',
  actor: 'user', person: 'user', people: 'user', channel: 'user',
  identity: 'security', future: 'muted', 'out-of-scope': 'muted',
  custom: 'purple',
};
const ACCENT_ORDER = ['salesforce', 'data', 'integration', 'engagement', 'success', 'warning'];

export function makePalette(brand) {
  const kinds = JSON.parse(JSON.stringify(KINDS));
  const ink = Object.assign({}, INK);
  let font = 'Helvetica';
  let name = null;
  if (brand) {
    name = brand.name || 'custom brand';
    const c = brand.colors || {};
    (c.accents || []).forEach((a, i) => { if (ACCENT_ORDER[i] && a && a.fill && a.stroke) Object.assign(kinds[ACCENT_ORDER[i]], { fill: a.fill, stroke: a.stroke }); });
    if (c.neutral && c.neutral.fill) Object.assign(kinds.external, { fill: c.neutral.fill, stroke: c.neutral.stroke || kinds.external.stroke });
    if (c.kinds) for (const k of Object.keys(c.kinds)) kinds[k] = Object.assign({}, kinds[k] || { label: k }, c.kinds[k]);
    if (c.text) ink.text = c.text;
    if (c.secondaryText) ink.sub = c.secondaryText;
    if (c.background) ink.canvas = c.background;
    if (brand.fonts && brand.fonts.family) font = brand.fonts.family;
  }
  const resolve = (k) => {
    if (k && typeof k === 'object') return Object.assign({ fill: '#ffffff', stroke: ink.border }, k);
    const key = String(k || 'neutral').toLowerCase();
    return kinds[key] || kinds[KIND_ALIASES[key]] || kinds.neutral;
  };
  const kindKey = (k) => { if (k && typeof k === 'object') return null; const key = String(k || 'neutral').toLowerCase(); return kinds[key] ? key : (KIND_ALIASES[key] || 'neutral'); };
  return { kinds, ink, font, name, resolve, kindKey };
}
export function loadBrand(spec, cwd) {
  let b = spec.brand;
  const tryFile = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
  if (typeof b === 'string') { const r = tryFile(path.resolve(cwd || '.', b)); if (!r) throw new Error(`brand file not found or invalid JSON: ${b}`); return r; }
  if (b && typeof b === 'object') return b;
  if (b === false) return null;
  for (const p of ['brand.json', 'brand/brand.json']) { const r = tryFile(path.resolve(cwd || '.', p)); if (r) return r; }
  return null;
}

/* ---------------------------------------------------------------- icons -- */

let CATALOG = null;
export function iconCatalog() {
  if (!CATALOG) CATALOG = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'icons', 'catalog.json'), 'utf8'));
  return CATALOG;
}
const ICON_ALIASES = {
  salesforce: 'product/platform', sales: 'product/sales_cloud', 'sales-cloud': 'product/sales_cloud', service: 'product/service_cloud', 'service-cloud': 'product/service_cloud',
  marketing: 'product/marketing_cloud', commerce: 'product/commerce_cloud', experience: 'product/experience_cloud', 'experience-cloud': 'product/experience_cloud',
  mulesoft: 'product/mulesoft', tableau: 'product/tableau', einstein: 'product/einstein_ai', industries: 'product/industries', platform: 'product/platform',
  'data-cloud': 'standard/data_cloud', datacloud: 'standard/data_cloud', agentforce: 'standard/agent_astro', agent: 'standard/agent_astro', flow: 'standard/flow', apex: 'standard/apex',
  slack: 'standard/slack', heroku: 'cloud/heroku', 'field-service': 'cloud/field_service', loyalty: 'cloud/loyalty', analytics: 'cloud/analytics',
  user: 'utility/user', users: 'utility/groups', database: 'utility/database', api: 'utility/integration', integration: 'utility/integration', mobile: 'utility/phone_portrait', web: 'utility/world', desktop: 'utility/desktop',
  email: 'utility/email', chat: 'utility/chat', lock: 'utility/lock', key: 'utility/key', settings: 'utility/settings', event: 'utility/event', bot: 'standard/bot', prompt: 'standard/prompt_builder',
  account: 'standard/account', contact: 'standard/contact', lead: 'standard/lead', opportunity: 'standard/opportunity', case: 'standard/case', knowledge: 'standard/knowledge',
};
export function resolveIcon(key) {
  if (!key) return null;
  const cat = iconCatalog();
  if (cat[key]) return { key, entry: cat[key] };
  const k = String(key).toLowerCase().replace(/\s+/g, '-');
  if (ICON_ALIASES[k] && cat[ICON_ALIASES[k]]) return { key: ICON_ALIASES[k], entry: cat[ICON_ALIASES[k]] };
  const u = k.replace(/-/g, '_');
  for (const c of ['standard', 'product', 'cloud', 'utility', 'platform', 'industry', 'doctype']) if (cat[c + '/' + u]) return { key: c + '/' + u, entry: cat[c + '/' + u] };
  return null;
}
// draw.io keeps data URIs in styles without ";base64" because ';' separates style entries.
export const styleImage = (uri) => uri.replace(/^(data:image\/[a-z+.-]+);base64,/, '$1,');

/* ----------------------------------------------------------------- text -- */

export const h = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const snap10 = (v) => Math.round(v / 10) * 10;
export const up10 = (v) => Math.ceil(v / 10 - 1e-9) * 10;
export const up20 = (v) => Math.ceil(v / 20 - 1e-9) * 20;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function small(text, color, size = 11) { return `<font style="font-size:${size}px" color="${color}">${text}</font>`; }
// Wrap a plain-text edge label onto several lines so long conditions do not force huge gaps.
export function wrapPlain(text, maxW = 150, size = 11) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && textWidth(t, size) > maxW) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
export function measure(value, style, wrapW) { return measureLabel(value, Object.assign({ html: '1' }, style), wrapW); }
export { textWidth };

/* -------------------------------------------------------------- diagram -- */

export class Diagram {
  constructor(spec = {}, opts = {}) {
    this.spec = spec;
    this.palette = opts.palette || makePalette(null);
    this.cells = [];
    this.ids = new Set(['0', '1']);
    this.usedKinds = new Map(); // kindKey -> label
    this.usedLines = new Map(); // lineKey -> {label, style}
    this.legendExtra = [];
    this.soft = [];
    this.warnings = [];
    this.name = opts.name || spec.title || 'Page-1';
  }
  get ink() { return this.palette.ink; }
  font() { return this.palette.font && this.palette.font !== 'Helvetica' ? { fontFamily: this.palette.font } : {}; }
  uid(base) {
    let s = String(base || 'c').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'c';
    if (/^[0-9]/.test(s)) s = 'n_' + s;
    let id = s, i = 2;
    while (this.ids.has(id)) id = s + '_' + i++;
    this.ids.add(id);
    return id;
  }
  kind(k, track = true) {
    const r = this.palette.resolve(k);
    if (track) { const key = this.palette.kindKey(k); if (key && key !== 'neutral') this.usedKinds.set(key, this.palette.kinds[key].label); }
    return r;
  }
  node({ id, x = 0, y = 0, w = 120, h: hh = 60, value = '', style = {}, parent = '1', link, tooltip, connectable }) {
    const c = { id: id || this.uid('n'), value, style: Object.assign({ html: '1', whiteSpace: 'wrap' }, this.font(), style), vertex: true, parent, geo: { x, y, w, h: hh } };
    if (id) this.ids.add(id);
    if (link) c.link = link;
    if (tooltip) c.tooltip = tooltip;
    if (connectable !== undefined) c.connectable = connectable;
    this.cells.push(c);
    return c;
  }
  text(x, y, w, hh, value, style = {}, parent = '1') {
    return this.node({ id: this.uid('t'), x, y, w, h: hh, value, parent, style: Object.assign({ text: '', strokeColor: 'none', fillColor: 'none', align: 'left', verticalAlign: 'top', fontColor: this.ink.text, fontSize: 12 }, style) });
  }
  icon(key, x, y, size, parent = '1', id) {
    const r = resolveIcon(key);
    if (!r) { this.warnings.push(`icon not found: ${key}`); return null; }
    return this.node({ id: id || this.uid('ico'), x, y, w: size, h: size, value: '', parent, connectable: '0', style: { shape: 'image', html: '1', whiteSpace: undefined, aspect: 'fixed', imageAspect: '1', image: styleImage(r.entry.uri), part: '1', pointerEvents: '0' } });
  }
  edge({ id, source, target, value = '', style = {}, points, exit, entry, sourcePoint, targetPoint, labelT, labelOffset, parent = '1', tooltip }) {
    const st = Object.assign({ html: '1', rounded: '1', strokeColor: this.ink.line, strokeWidth: 1.5, fontSize: 11, fontColor: this.ink.text, endArrow: 'block', endFill: '1', endSize: 6 }, this.font(), style);
    if (exit) { st.exitX = round4(exit.fx); st.exitY = round4(exit.fy); st.exitDx = exit.dx || 0; st.exitDy = exit.dy || 0; }
    if (entry) { st.entryX = round4(entry.fx); st.entryY = round4(entry.fy); st.entryDx = entry.dx || 0; st.entryDy = entry.dy || 0; }
    if (value && st.labelBackgroundColor === undefined) st.labelBackgroundColor = this.ink.canvas;
    const geo = { x: 0, y: 0, w: 0, h: 0, relative: true };
    if (labelT !== undefined && labelT !== null) geo.x = Math.round((labelT * 2 - 1) * 1000) / 1000;
    if (points && points.length) geo.points = points.map((p) => ({ x: p.x, y: p.y }));
    if (labelOffset) geo.offset = { x: labelOffset.x || 0, y: labelOffset.y || 0 };
    if (sourcePoint) geo.sourcePoint = sourcePoint;
    if (targetPoint) geo.targetPoint = targetPoint;
    const c = { id: id || this.uid('e'), value, style: st, edge: true, parent, source: source || null, target: target || null, geo };
    if (id) this.ids.add(id);
    if (tooltip) c.tooltip = tooltip;
    this.cells.push(c);
    return c;
  }
  // Absolute bounds of a vertex created through this diagram (walks parents).
  abs(cell) {
    let x = cell.geo.x, y = cell.geo.y, p = cell.parent;
    let guard = 0;
    while (p && p !== '1' && guard++ < 30) { const pc = this.cells.find((c) => c.id === p); if (!pc || !pc.vertex) break; x += pc.geo.x; y += pc.geo.y; p = pc.parent; }
    return { id: cell.id, x, y, w: cell.geo.w, h: cell.geo.h };
  }
  // Route a batch of links with the orthogonal router and add them as edges.
  // links: [{from,to,label,style,fromSides,toSides,id,tooltip}]  obstacles: cells (absolute bounds are derived)
  routeEdges(links, obstacles, opts = {}) {
    const nodes = obstacles.map((c) => this.abs(c));
    const ids = new Set(nodes.map((n) => n.id));
    const req = [];
    for (const l of links) {
      if (!ids.has(l.from) || !ids.has(l.to)) { this.warnings.push(`link skipped — unknown endpoint: ${l.from} -> ${l.to}`); continue; }
      l._id = l.id || this.uid(`e_${l.from}_${l.to}`);
      const fs = (l.style && l.style.fontSize) || 11;
      const m = l.label ? measure(l.label, { fontSize: fs }, 0) : null;
      req.push({ id: l._id, from: l.from, to: l.to, fromSides: l.fromSides, toSides: l.toSides, labelW: m ? m.w + 8 : 0, labelH: m ? m.h + 4 : 0 });
    }
    const res = route({ nodes, edges: req, soft: (opts.soft || []).concat(this.soft), bendCost: opts.bendCost, bounds: opts.bounds });
    const made = [];
    for (const l of links) {
      if (!l._id) continue;
      const r = res.get(l._id);
      if (!r) {
        this.warnings.push(`no clean route for ${l.from} -> ${l.to}; drawn with draw.io auto-routing`);
        made.push(this.edge({ id: l._id, source: l.from, target: l.to, value: l.label || '', style: Object.assign({ edgeStyle: 'orthogonalEdgeStyle' }, l.style), tooltip: l.tooltip }));
        continue;
      }
      made.push(this.edge({ id: l._id, source: l.from, target: l.to, value: l.label || '', style: Object.assign({ edgeStyle: 'orthogonalEdgeStyle' }, l.style), points: r.points, exit: r.exit, entry: r.entry, labelT: r.label ? r.label.t : undefined, tooltip: l.tooltip }));
    }
    return made;
  }
}
const round4 = (v) => Math.round(v * 10000) / 10000;

/* ---------------------------------------------------------------- cards -- */

// Card spec: { id,label,sub,icon,kind,items[],badge,status,link,tooltip }
export function cardLabel(d, c, o = {}) {
  const titleSize = o.titleSize || 13;
  let s = `<b>${h(c.label || c.id || '')}</b>`;
  if (titleSize !== 13) s = `<font style="font-size:${titleSize}px">${s}</font>`;
  if (c.sub) s += `<br>${small(h(c.sub), d.ink.sub, 11)}`;
  if (c.items && c.items.length) s += c.items.map((it) => `<br>${small('• ' + h(it), d.ink.sub, 11)}`).join('');
  return s;
}
export function measureCard(d, c, o = {}) {
  const icon = c.icon && resolveIcon(c.icon) ? (o.iconSize || 32) : 0;
  const padL = icon ? icon + 22 : 12, padR = 12;
  const value = cardLabel(d, c, o);
  const natural = measure(value, { fontSize: 13 }, 0).w;
  const minW = o.minW || 160, maxW = o.maxW || 240;
  const w = clamp(up20(natural * 1.06 + padL + padR), minW, maxW);
  const m = measure(value, { fontSize: 13 }, w - padL - padR - 4);
  const hh = Math.max(o.minH || (icon ? 60 : 40), up20(m.h + 22));
  return { w, h: hh };
}
export function drawCard(d, c, box, parent = '1', o = {}) {
  const k = d.kind(c.kind || o.kind || 'neutral');
  const iconR = c.icon ? resolveIcon(c.icon) : null;
  if (c.icon && !iconR && d.warnings && !d.warnings.includes(`icon not found: ${c.icon}`)) d.warnings.push(`icon not found: ${c.icon}`);
  const iconSize = o.iconSize || 32;
  const hasBody = !!(c.sub || (c.items && c.items.length));
  const style = Object.assign({
    rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13,
    align: iconR || hasBody || o.align === 'left' ? 'left' : 'center', verticalAlign: 'middle', spacingLeft: iconR ? iconSize + 20 : (hasBody || o.align === 'left' ? 10 : 2), spacingRight: iconR || hasBody ? 8 : 2,
  }, c.dashed ? { dashed: '1' } : {}, o.style || {}, c.style || {});
  if (iconR || (c.badge)) Object.assign(style, { container: '1', collapsible: '0', recursiveResize: '0' });
  const cell = d.node({ id: c.id ? d.uid(c.id) : d.uid('card'), x: box.x, y: box.y, w: box.w, h: box.h, value: cardLabel(d, c, o), parent, style, link: c.link, tooltip: c.tooltip || c.note });
  if (iconR) d.icon(iconR.key, 10, Math.round((box.h - iconSize) / 2), iconSize, cell.id);
  if (c.badge) {
    const bk = d.kind(c.badgeKind || (c.kind ? c.kind : 'salesforce'), false);
    const bw = up10(textWidth(String(c.badge), 9, true) + 16);
    d.node({ id: d.uid(cell.id + '_badge'), x: box.w - bw - 8, y: -8, w: bw, h: 16, value: `<b>${h(c.badge)}</b>`, parent: cell.id, connectable: '0', style: { rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: bk.stroke, strokeColor: 'none', fontColor: '#ffffff', fontSize: 9, whiteSpace: undefined, part: '1' } });
  }
  return cell;
}

/* -------------------------------------------------------- line semantics -- */

export const LINE_STYLES = {
  sync: { label: 'Real-time / API call', style: {} },
  async: { label: 'Async / event', style: { dashed: '1', dashPattern: '1 3' } },
  event: { label: 'Async / event', style: { dashed: '1', dashPattern: '1 3' } },
  batch: { label: 'Batch / scheduled', style: { dashed: '1', dashPattern: '6 4' } },
  bidirectional: { label: 'Bi-directional sync', style: { startArrow: 'block', startFill: '1', startSize: 6 } },
  reference: { label: 'Reference / dependency', style: { endArrow: 'open', dashed: '1', dashPattern: '4 4' } },
  plain: { label: 'Association', style: { endArrow: 'none' } },
  manual: { label: 'Manual / file', style: { dashed: '1', dashPattern: '8 3 2 3' } },
};
export function lineStyle(d, kind) {
  const key = LINE_STYLES[kind] ? kind : 'sync';
  d.usedLines.set(key === 'event' ? 'async' : key, LINE_STYLES[key]);
  return Object.assign({}, LINE_STYLES[key].style);
}

/* ------------------------------------------------------ finishing touches -- */

function contentBBox(d) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of d.cells) {
    if (c.vertex && c.parent === '1') { x0 = Math.min(x0, c.geo.x); y0 = Math.min(y0, c.geo.y); x1 = Math.max(x1, c.geo.x + c.geo.w); y1 = Math.max(y1, c.geo.y + c.geo.h); }
    if (c.edge) for (const p of [...(c.geo.points || []), c.geo.sourcePoint, c.geo.targetPoint]) if (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 400, y1: 200 };
  return { x0, y0, x1, y1 };
}
function shiftAll(d, dx, dy) {
  for (const c of d.cells) {
    if (c.vertex && c.parent === '1') { c.geo.x += dx; c.geo.y += dy; }
    if (c.edge) for (const p of [...(c.geo.points || []), c.geo.sourcePoint, c.geo.targetPoint]) if (p) { p.x += dx; p.y += dy; }
  }
}
// Key entries for the diagram: custom list, or the colour kinds / line styles / extras the builder used.
// Returns [] when the key would not carry meaning (fewer than two colours and two line styles).
function legendItems(d) {
  const spec = d.spec;
  if (spec.legend === false) return [];
  const items = [];
  const custom = Array.isArray(spec.legend) ? spec.legend : null;
  if (custom) { for (const it of custom) items.push({ kind: it.kind, label: it.label, line: it.line }); return items.filter((i) => i.label); }
  for (const [k, label] of d.usedKinds) items.push({ kind: k, label: (spec.legendLabels && spec.legendLabels[k]) || label });
  for (const [k, v] of d.usedLines) items.push({ line: k, label: (spec.legendLabels && spec.legendLabels[k]) || v.label });
  for (const it of d.legendExtra) items.push(it);
  const colourItems = items.filter((i) => i.kind || i.swatch).length, lineItems = items.filter((i) => i.line).length;
  if (colourItems < 2 && lineItems < 2 && !d.legendExtra.length && spec.legend !== true) return [];
  return items;
}
const KEY_ROW = 24;
const keyItemW = (it) => (it.line ? 34 : 16) + 6 + up10(textWidth(it.label, 11) + 12);
// Even-row grid (Salesforce kit of parts: "the key should be grouped into even rows when possible").
// Each column is as wide as its widest item; the most columns that fit in maxW win.
function keyGrid(items, maxW) {
  if (!items.length) return { cols: 0, rows: 0, colWs: [], colW: 0, w: 0, h: 0 };
  const widths = items.map(keyItemW);
  for (let cols = Math.min(items.length, 6); cols >= 1; cols--) {
    const rows = Math.ceil(items.length / cols);
    const c = Math.ceil(items.length / rows); // balance: same number of items per row
    const colWs = Array.from({ length: c }, (_, ci) => Math.max(...widths.filter((_, i) => i % c === ci)) + 18);
    const w = colWs.reduce((a, b) => a + b, 0) - 18;
    if (w <= maxW || cols === 1) return { cols: c, rows, colWs, colW: Math.max(...colWs), w, h: rows * KEY_ROW };
  }
}
// Draws key items in a grid. Coordinates are relative to `parent` (or absolute when parent is '1').
function drawKeyItems(d, items, grid, x, y, parent = '1') {
  const colX = grid.colWs.map((_, i) => grid.colWs.slice(0, i).reduce((a, b) => a + b, 0));
  items.forEach((it, i) => {
    const ci = i % grid.cols;
    const cx = x + colX[ci], cy = y + Math.floor(i / grid.cols) * KEY_ROW;
    const iw = it.line ? 34 : 16;
    const tw = Math.max(40, grid.colWs[ci] - 18 - iw - 6);
    if (it.line) {
      const st = Object.assign({ endArrow: 'block', endFill: '1', endSize: 5 }, LINE_STYLES[it.line] ? LINE_STYLES[it.line].style : (it.style || {}));
      d.edge({ id: d.uid('key_line'), style: st, sourcePoint: { x: cx, y: cy + 12 }, targetPoint: { x: cx + iw, y: cy + 12 }, parent });
    } else if (it.swatch) {
      d.node({ id: d.uid('key_sw'), x: cx, y: cy + 4, w: 16, h: 16, value: it.swatch.text || '', parent, connectable: '0', style: Object.assign({ rounded: '1', arcSize: 6, absoluteArcSize: '1', fontSize: 9, fontStyle: 1, whiteSpace: undefined }, it.swatch.style) });
    } else {
      const k = d.kind(it.kind, false);
      d.node({ id: d.uid('key_sw'), x: cx, y: cy + 4, w: 16, h: 16, value: '', parent, connectable: '0', style: { rounded: '1', arcSize: 6, absoluteArcSize: '1', fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5 } });
    }
    d.text(cx + iw + 6, cy + 3, tw, 18, h(it.label), { fontSize: 11, fontColor: d.ink.sub, whiteSpace: undefined }, parent);
  });
}
// Classic key under the diagram (used by the "title" and "banner" headers).
function legendCells(d, x, y, maxW) {
  const items = legendItems(d);
  if (!items.length) return 0;
  d.text(x, y + 3, 44, 18, '<b>Key</b>', { fontSize: 11, fontColor: d.ink.sub });
  const grid = keyGrid(items, maxW - 46);
  drawKeyItems(d, items, grid, x + 46, y);
  return grid.h;
}

/* ------------------------------------------------- Salesforce header card -- */
// Salesforce Architects kit of parts: every diagram has a Header with a Title and a Description
// (purpose, scope, message), at least 10% of the diagram height and 100% of its width, description
// font at least half the title size, and a Key on the right for anything not labelled on the diagram.
// Drawn as: grey band (frame) > white title panel with a curved right edge > white rounded key panel.
const CARD = { title: 24, desc: 13, meta: 11, band: '#e5e5e5', frame: '#c9c7c5', minW: 760, minH: 140, pad: 28 };
function headerCard(d, M, width, contentH, metaLine) {
  const spec = d.spec;
  const desc = spec.subtitle || spec.description || '';
  const items = legendItems(d);
  const logo = spec.meta && spec.meta.logo ? resolveIcon(spec.meta.logo) : null;
  let W = Math.max(width, CARD.minW);
  // A big key on a narrow diagram: widen the header (and page) rather than stacking the key tall.
  const bulgeGuess = 36;
  const keyFit = (w) => keyGrid(items, w - (clamp(Math.round(w * 0.42), 340, 560) + bulgeGuess + 24) - 52);
  while (items.length && keyFit(W).rows > 4 && W < 1800) W += 40;
  const leftW = clamp(Math.round(W * 0.42), 340, 560);
  const textPadL = CARD.pad + (logo ? 56 : 0);
  let v = `<font style="font-size:${CARD.title}px">${h(spec.title)}</font>`;
  if (desc) v += `<br><font style="font-size:4px"> </font><br>${small(h(desc), d.ink.text, CARD.desc)}`;
  if (metaLine.length && items.length) v += `<br>${small(metaLine.map((t) => h(t)).join(' · '), d.ink.sub, CARD.meta)}`;
  const tm = measure(v, { fontSize: CARD.desc }, leftW - textPadL - 24);
  // right panel: the key, else meta (status, version, date, author), else nothing
  const keyLines = !items.length && metaLine.length ? metaLine : null;
  const keyX = leftW + bulgeGuess + 24;
  let keyInnerW = W - keyX - 20 - 32;
  let grid = keyGrid(items, keyInnerW);
  if (items.length && grid.w > keyInnerW) { W = keyX + grid.w + 52; keyInnerW = grid.w; }
  const keyH = items.length ? grid.h + 44 : keyLines ? keyLines.length * 18 + 40 : 0;
  const H = up10(Math.max(CARD.minH, tm.h + 56, keyH + 40, contentH / 9));
  const bulge = Math.round(clamp(H * 0.2, 24, 60));
  const frame = d.node({ id: d.uid('hdr'), x: M, y: M, w: W, h: H, value: '', connectable: '0', style: { rounded: '0', fillColor: CARD.band, strokeColor: CARD.frame, strokeWidth: 3, container: '1', collapsible: '0', recursiveResize: '0' } });
  const panel = { fillColor: d.ink.canvas, strokeColor: 'none', connectable: '0' };
  d.node({ id: d.uid('hdr_curve'), x: leftW - bulge, y: 2, w: bulge * 2, h: H - 4, value: '', parent: frame.id, connectable: '0', style: { ellipse: '', fillColor: panel.fillColor, strokeColor: 'none', part: '1' } });
  d.node({ id: d.uid('hdr_title'), x: 2, y: 2, w: leftW - 2, h: H - 4, value: v, parent: frame.id, connectable: '0', style: { fillColor: panel.fillColor, strokeColor: 'none', fontColor: d.ink.text, fontSize: CARD.desc, align: 'left', verticalAlign: 'middle', spacingLeft: textPadL, spacingRight: 8, part: '1' } });
  if (logo) d.icon(logo.key, CARD.pad, Math.round((H - 40) / 2), 40, frame.id);
  if (keyH) {
    const kx = leftW + bulge + 24, kw = W - kx - 20;
    const kp = d.node({ id: d.uid('hdr_key'), x: kx, y: 20, w: kw, h: H - 40, value: '', parent: frame.id, connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: panel.fillColor, strokeColor: 'none', container: '1', collapsible: '0', recursiveResize: '0' } });
    const top = Math.max(12, Math.round((H - 40 - keyH) / 2) + 8);
    d.text(16, top, 60, 18, '<b>Key</b>', { fontSize: 11, fontColor: d.ink.sub }, kp.id);
    if (items.length) drawKeyItems(d, items, grid, 16, top + 22, kp.id);
    else d.text(16, top + 22, kw - 32, keyLines.length * 18, keyLines.map((t) => h(t)).join('<br>'), { fontSize: CARD.meta, fontColor: d.ink.sub }, kp.id);
  }
  // keep the header first so it paints underneath everything
  const at = d.cells.indexOf(frame);
  d.cells.unshift(...d.cells.splice(at));
  return { id: frame.id, W, H };
}

/** Adds header + legend, normalises coordinates, returns an mx page object. */
export function finishPage(d, opts = {}) {
  const spec = d.spec;
  const M = 40;
  const bb = contentBBox(d);
  // Default is the Salesforce Architects header card (title + description + key).
  let header = spec.header === undefined ? 'card' : spec.header;
  if (header === true) header = 'card';
  if (!['card', 'banner', 'title', false].includes(header)) { d.warnings.push(`unknown header "${header}" — use "card" (default), "banner", "title" or false`); header = 'card'; }
  if (!spec.title) {
    if (header) d.warnings.push('no title, so no header was drawn: Salesforce diagrams need a header with a title and a description (set "title" and "subtitle")');
    header = false;
  } else if (header === 'card' && !(spec.subtitle || spec.description)) {
    d.warnings.push('header card has no description: add "subtitle" with one or two sentences on the purpose, scope and message of the diagram');
  }
  const metaLine = spec.meta ? [spec.meta.status, spec.meta.version && 'v' + String(spec.meta.version).replace(/^v/i, ''), spec.meta.date, spec.meta.author, spec.meta.client].filter(Boolean) : [];
  let headH = 0;
  const cw = Math.max(bb.x1 - bb.x0, opts.minWidth || 480);
  let titleW = cw;
  if (header === 'card') {
    shiftAll(d, M - bb.x0, 0); // x first; y once the card height is known
    const card = headerCard(d, M, cw, bb.y1 - bb.y0, metaLine);
    headH = card.H + 30;
    for (const c of d.cells) {
      if (c.vertex && c.parent === '1' && c.id !== card.id) c.geo.y += M + headH - bb.y0;
      if (c.edge && c.parent === '1') for (const p of [...(c.geo.points || []), c.geo.sourcePoint, c.geo.targetPoint]) if (p) p.y += M + headH - bb.y0;
    }
    const width = Math.max(cw, card.W);
    const pageW = up10(M * 2 + width), pageH = up10(M + headH + (bb.y1 - bb.y0) + M);
    const attrs = { pageWidth: String(pageW), pageHeight: String(pageH), dx: String(pageW), dy: String(pageH) };
    if (d.ink.canvas && d.ink.canvas !== '#ffffff') attrs.background = d.ink.canvas;
    return { id: opts.id || d.uid('page'), name: opts.name || d.name, attrs, cells: [{ id: '0' }, { id: '1', parent: '0' }, ...d.cells], warnings: d.warnings.slice(), brand: d.palette.name };
  }
  if (header === 'banner') headH = spec.subtitle ? 90 : 70;
  else if (header) {
    titleW = Math.max(cw, 360);
    const tm = measure(`<b>${h(spec.title)}</b>`, { fontSize: 20 }, titleW);
    const sm = spec.subtitle ? measure(h(spec.subtitle), { fontSize: 12 }, titleW) : { h: 0 };
    headH = up10(tm.h + sm.h + (metaLine.length ? 18 : 0) + 22);
  }
  shiftAll(d, M - bb.x0, M + headH - bb.y0);
  const width = Math.max(cw, titleW);
  if (header === 'banner') {
    const logo = spec.meta && spec.meta.logo ? resolveIcon(spec.meta.logo) : null;
    const b = d.node({ id: d.uid('hdr'), x: M, y: M, w: width, h: headH - 20, value: `<b><font style="font-size:20px">${h(spec.title)}</font></b>${spec.subtitle ? '<br>' + small(h(spec.subtitle), '#d8e6fe', 12) : ''}`, connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: '#032d60', strokeColor: 'none', fontColor: '#ffffff', align: 'left', verticalAlign: 'middle', spacingLeft: logo ? 66 : 20, spacingRight: metaLine.length ? 230 : 20, container: '1', collapsible: '0' } });
    if (logo) d.icon(logo.key, 16, Math.round((headH - 20 - 38) / 2), 38, b.id);
    if (metaLine.length) d.text(width - 232, 8, 220, headH - 36, metaLine.map((t) => h(t)).join('<br>'), { fontSize: 11, fontColor: '#d8e6fe', align: 'right', verticalAlign: 'middle' }, b.id);
    d.cells.unshift(...d.cells.splice(d.cells.indexOf(b)));
  } else if (header) {
    let v = `<b><font style="font-size:20px">${h(spec.title)}</font></b>`;
    if (spec.subtitle) v += `<br>${small(h(spec.subtitle), d.ink.sub, 12)}`;
    if (metaLine.length) v += `<br>${small(metaLine.map((t) => h(t)).join(' · '), '#8a8a8a', 10)}`;
    d.text(M, M - 4, titleW, headH - 8, v, { fontSize: 12, verticalAlign: 'top' });
  }
  const bottom = M + headH + (bb.y1 - bb.y0);
  const legH = legendCells(d, M, bottom + 24, width);
  const pageW = up10(M * 2 + width), pageH = up10(bottom + (legH ? 24 + legH : 0) + M);
  const attrs = { pageWidth: String(pageW), pageHeight: String(pageH), dx: String(pageW), dy: String(pageH) };
  if (d.ink.canvas && d.ink.canvas !== '#ffffff') attrs.background = d.ink.canvas;
  return { id: opts.id || d.uid('page'), name: opts.name || d.name, attrs, cells: [{ id: '0' }, { id: '1', parent: '0' }, ...d.cells], warnings: d.warnings.slice(), brand: d.palette.name };
}
