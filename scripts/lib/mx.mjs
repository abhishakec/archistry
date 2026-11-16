// mx.mjs — shared core: mxfile (draw.io) model, text metrics, SVG renderer.
// Pure JavaScript with no imports so the same source runs in Node (CLI) and is
// inlined into the standalone HTML viewer/editor. Keep it dependency-free.

/* ------------------------------------------------------------------ XML -- */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(c) ? String.fromCodePoint(c) : m;
    }
    return e in ENT ? ENT[e] : m;
  });
}
export function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;');
}
function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function parseXml(src) {
  const root = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const n = src.length;
  let i = 0;
  const top = () => stack[stack.length - 1];
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { top().text += decodeEntities(src.slice(i)); break; }
    if (lt > i) top().text += decodeEntities(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) {
      const e = src.indexOf(']]>', lt); top().text += src.slice(lt + 9, e < 0 ? n : e); i = e < 0 ? n : e + 3; continue;
    }
    if (src[lt + 1] === '?' || src[lt + 1] === '!') { const e = src.indexOf('>', lt); i = e < 0 ? n : e + 1; continue; }
    if (src[lt + 1] === '/') { const e = src.indexOf('>', lt); if (stack.length > 1) stack.pop(); i = e < 0 ? n : e + 1; continue; }
    let j = lt + 1, q = null;
    while (j < n) { const c = src[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; j++; }
    let body = src.slice(lt + 1, j);
    const selfClose = body.endsWith('/');
    if (selfClose) body = body.slice(0, -1);
    const m = body.match(/^[^\s]+/);
    const node = { tag: m ? m[0] : '', attrs: {}, children: [], text: '' };
    const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    const rest = body.slice(node.tag.length);
    let a;
    while ((a = re.exec(rest))) node.attrs[a[1]] = decodeEntities(a[2] !== undefined ? a[2] : a[3]);
    top().children.push(node);
    if (!selfClose) stack.push(node);
    i = j + 1;
  }
  return root;
}
function findTag(node, tag) {
  if (node.tag === tag) return node;
  for (const c of node.children) { const r = findTag(c, tag); if (r) return r; }
  return null;
}
function findAll(node, tag, out = []) {
  if (node.tag === tag) out.push(node);
  for (const c of node.children) findAll(c, tag, out);
  return out;
}

/* ---------------------------------------------------------------- style -- */

export function parseStyle(s) {
  const o = {};
  if (!s) return o;
  let lastKey = null;
  for (const part of String(s).split(';')) {
    if (!part) continue;
    // tolerate "image=data:image/png;base64,AAAA" (an unescaped ';' inside a data URI)
    if (lastKey === 'image' && /^base64,/.test(part)) { o.image += ',' + part.slice(7); continue; }
    const k = part.indexOf('=');
    if (k < 0) { o[part] = ''; lastKey = part; } else { lastKey = part.slice(0, k); o[lastKey] = part.slice(k + 1); }
  }
  return o;
}
export function styleStr(o) {
  let s = '';
  for (const k of Object.keys(o)) { const v = o[k]; if (v === undefined || v === null) continue; s += v === '' ? k + ';' : k + '=' + v + ';'; }
  return s;
}
const num = (v, d) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };

/* ------------------------------------------------------------- mxfile IO -- */

function readPoint(n) { return { x: num(n.attrs.x, 0), y: num(n.attrs.y, 0) }; }
function readCell(node, wrapper) {
  const a = node.attrs;
  const c = {
    id: wrapper ? wrapper.attrs.id : a.id,
    value: wrapper ? (wrapper.attrs.label || '') : (a.value || ''),
    style: parseStyle(a.style),
    vertex: a.vertex === '1', edge: a.edge === '1',
    parent: a.parent, source: a.source || null, target: a.target || null,
    connectable: a.connectable, geo: null,
  };
  if (wrapper) {
    c.wrapper = wrapper.tag;
    c.data = {};
    for (const k of Object.keys(wrapper.attrs)) if (k !== 'id' && k !== 'label') c.data[k] = wrapper.attrs[k];
    if (c.data.link) c.link = c.data.link;
    if (c.data.tooltip) c.tooltip = c.data.tooltip;
  }
  const g = node.children.find((x) => x.tag === 'mxGeometry');
  if (g) {
    const geo = { x: num(g.attrs.x, 0), y: num(g.attrs.y, 0), w: num(g.attrs.width, 0), h: num(g.attrs.height, 0), relative: g.attrs.relative === '1' };
    for (const ch of g.children) {
      if (ch.tag === 'mxPoint') { const as = ch.attrs.as; if (as === 'sourcePoint') geo.sourcePoint = readPoint(ch); else if (as === 'targetPoint') geo.targetPoint = readPoint(ch); else if (as === 'offset') geo.offset = readPoint(ch); }
      else if (ch.tag === 'Array' && ch.attrs.as === 'points') geo.points = ch.children.filter((p) => p.tag === 'mxPoint').map(readPoint);
    }
    c.geo = geo;
  }
  return c;
}
function readModel(model, diagramNode, idx) {
  const page = {
    id: (diagramNode && diagramNode.attrs.id) || 'page-' + (idx + 1),
    name: (diagramNode && diagramNode.attrs.name) || 'Page-' + (idx + 1),
    attrs: Object.assign({}, model.attrs), cells: [],
  };
  const root = model.children.find((x) => x.tag === 'root');
  if (!root) return page;
  for (const n of root.children) {
    if (n.tag === 'mxCell') page.cells.push(readCell(n, null));
    else if (n.tag === 'UserObject' || n.tag === 'object') {
      const inner = n.children.find((x) => x.tag === 'mxCell');
      if (inner) page.cells.push(readCell(inner, n));
    }
  }
  return page;
}
// opts.inflate(base64) -> xml string, needed only for compressed <diagram> payloads.
export function parseMxfile(xml, opts = {}) {
  const doc = parseXml(xml);
  const file = { attrs: {}, pages: [] };
  const mxfile = findTag(doc, 'mxfile');
  if (mxfile) {
    file.attrs = Object.assign({}, mxfile.attrs);
    const diagrams = mxfile.children.filter((x) => x.tag === 'diagram');
    diagrams.forEach((d, i) => {
      let model = d.children.find((x) => x.tag === 'mxGraphModel');
      if (!model && d.text && d.text.trim()) {
        if (!opts.inflate) throw new Error('compressed draw.io page "' + (d.attrs.name || i) + '" — re-save uncompressed or convert with the CLI');
        model = findTag(parseXml(opts.inflate(d.text.trim())), 'mxGraphModel');
      }
      if (model) file.pages.push(readModel(model, d, i));
    });
  } else {
    const model = findTag(doc, 'mxGraphModel');
    if (!model) throw new Error('not a draw.io file: no <mxfile> or <mxGraphModel> element');
    file.pages.push(readModel(model, null, 0));
  }
  return file;
}

const r2 = (v) => (Math.round(v * 100) / 100).toString();
function geoXml(g, isEdge) {
  let a = '';
  if (!isEdge || g.relative === false) {
    if (g.x) a += ` x="${r2(g.x)}"`;
    if (g.y) a += ` y="${r2(g.y)}"`;
    if (g.w || !isEdge) a += ` width="${r2(g.w || 0)}"`;
    if (g.h || !isEdge) a += ` height="${r2(g.h || 0)}"`;
  } else {
    if (g.x) a += ` x="${r2(g.x)}"`;
    if (g.y) a += ` y="${r2(g.y)}"`;
  }
  if (g.relative) a += ' relative="1"';
  let inner = '';
  if (g.sourcePoint) inner += `<mxPoint x="${r2(g.sourcePoint.x)}" y="${r2(g.sourcePoint.y)}" as="sourcePoint"/>`;
  if (g.targetPoint) inner += `<mxPoint x="${r2(g.targetPoint.x)}" y="${r2(g.targetPoint.y)}" as="targetPoint"/>`;
  if (g.points && g.points.length) inner += '<Array as="points">' + g.points.map((p) => `<mxPoint x="${r2(p.x)}" y="${r2(p.y)}"/>`).join('') + '</Array>';
  if (g.offset) inner += `<mxPoint x="${r2(g.offset.x)}" y="${r2(g.offset.y)}" as="offset"/>`;
  return inner ? `<mxGeometry${a} as="geometry">${inner}</mxGeometry>` : `<mxGeometry${a} as="geometry"/>`;
}
function cellXml(c) {
  const isEdge = !!c.edge;
  let a = '';
  const hasData = c.link || c.tooltip || (c.data && Object.keys(c.data).length);
  if (!hasData) { a += ` id="${escXml(c.id)}"`; if (c.value !== undefined && (c.vertex || c.edge)) a += ` value="${escXml(c.value || '')}"`; }
  if (c.vertex || c.edge) a += ` style="${escXml(styleStr(c.style || {}))}"`;
  if (c.vertex) a += ' vertex="1"';
  if (c.edge) a += ' edge="1"';
  if (c.connectable !== undefined && c.connectable !== null) a += ` connectable="${escXml(c.connectable)}"`;
  if (c.parent !== undefined && c.parent !== null) a += ` parent="${escXml(c.parent)}"`;
  if (c.source) a += ` source="${escXml(c.source)}"`;
  if (c.target) a += ` target="${escXml(c.target)}"`;
  const inner = c.geo ? geoXml(c.geo, isEdge) : '';
  const cell = inner ? `<mxCell${a}>${inner}</mxCell>` : `<mxCell${a}/>`;
  if (!hasData) return cell;
  const data = Object.assign({}, c.data || {});
  if (c.link) data.link = c.link;
  if (c.tooltip) data.tooltip = c.tooltip;
  let w = ` label="${escXml(c.value || '')}"`;
  for (const k of Object.keys(data)) w += ` ${k}="${escXml(data[k])}"`;
  const tag = c.wrapper || 'UserObject';
  return `<${tag}${w} id="${escXml(c.id)}">${cell}</${tag}>`;
}
export function serializeMxfile(file) {
  const out = ['<mxfile host="app.diagrams.net" agent="archistry" type="device">'];
  for (const p of file.pages) {
    const m = Object.assign({ dx: '1000', dy: '700', grid: '1', gridSize: '10', guides: '1', tooltips: '1', connect: '1', arrows: '1', fold: '1', page: '1', pageScale: '1', pageWidth: '1600', pageHeight: '1000', math: '0', shadow: '0' }, p.attrs || {});
    let ma = '';
    for (const k of Object.keys(m)) ma += ` ${k}="${escXml(m[k])}"`;
    out.push(`  <diagram id="${escXml(p.id)}" name="${escXml(p.name)}">`);
    out.push(`    <mxGraphModel${ma}>`);
    out.push('      <root>');
    const hasRoot = p.cells.some((c) => c.id === '0');
    if (!hasRoot) { out.push('        <mxCell id="0"/>'); out.push('        <mxCell id="1" parent="0"/>'); }
    for (const c of p.cells) out.push('        ' + cellXml(c));
    out.push('      </root>');
    out.push('    </mxGraphModel>');
    out.push('  </diagram>');
  }
  out.push('</mxfile>');
  return out.join('\n') + '\n';
}

/* ----------------------------------------------------------------- text -- */

const W_REG = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'.split(' ').map(Number);
const W_BOLD = '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'.split(' ').map(Number);
function charW(code, bold) {
  if (code >= 32 && code <= 126) return (bold ? W_BOLD : W_REG)[code - 32];
  if (code === 0xa0) return 278;
  if (code === 0x2022 || code === 0xb7) return 350;
  if (code === 0x2192 || code === 0x2190 || code === 0x2194 || code === 0x2014) return 1000;
  if (code === 0x2013) return 556;
  if (code === 0x2026) return 1000;
  if (code >= 0x2460 && code <= 0x24ff) return 1000;
  if (code >= 0x2e80) return 1000;
  if (code >= 0x2190 && code <= 0x2bff) return 900;
  return bold ? 600 : 560;
}
export function textWidth(str, size = 12, bold = false) {
  let w = 0;
  for (const ch of String(str)) w += charW(ch.codePointAt(0), bold);
  return (w * size) / 1000;
}

function styleFromCss(css, fmt) {
  const f = Object.assign({}, fmt);
  for (const decl of String(css || '').split(';')) {
    const k = decl.indexOf(':');
    if (k < 0) continue;
    const prop = decl.slice(0, k).trim().toLowerCase();
    const val = decl.slice(k + 1).trim();
    if (prop === 'font-size') { const px = parseFloat(val); if (px) f.size = /pt$/.test(val) ? px * 1.333 : px; }
    else if (prop === 'color') f.color = normColor(val) || f.color;
    else if (prop === 'font-weight') f.bold = /bold|[6-9]00/.test(val);
    else if (prop === 'font-style') f.italic = /italic/.test(val);
    else if (prop === 'text-decoration') f.underline = /underline/.test(val);
  }
  return f;
}
export function normColor(c) {
  if (!c) return null;
  c = String(c).trim();
  if (c === 'none' || c === 'default' || c === 'initial' || c === 'inherit') return null;
  let m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('');
  m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) return '#' + m[1].split('').map((x) => x + x).join('').toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7).toLowerCase();
  const named = { white: '#ffffff', black: '#000000', red: '#ff0000', gray: '#808080', grey: '#808080', blue: '#0000ff', green: '#008000' };
  return named[c.toLowerCase()] || null;
}

// Parse the HTML subset draw.io labels use into paragraphs of formatted runs.
export function parseMarkup(html, base) {
  const paras = [{ runs: [] }];
  const stack = [Object.assign({}, base)];
  const cur = () => stack[stack.length - 1];
  const para = () => paras[paras.length - 1];
  const newPara = (force) => { if (force || para().runs.length || para().rule) paras.push({ runs: [] }); };
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  let m;
  const src = String(html);
  const tagStack = [];
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) {
      const t = decodeEntities(m[4]).replace(/[\t\n\r ]+/g, ' ');
      if (t === ' ' && !para().runs.length) continue;
      para().runs.push(Object.assign({}, cur(), { text: t }));
      continue;
    }
    const close = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
    if (tag === 'br') { newPara(true); continue; }
    if (tag === 'hr') { newPara(false); para().rule = true; paras.push({ runs: [] }); continue; }
    const block = tag === 'div' || tag === 'p' || tag === 'li' || tag === 'blockquote' || /^h[1-6]$/.test(tag) || tag === 'ul' || tag === 'ol';
    if (close) {
      for (let k = tagStack.length - 1; k >= 0; k--) if (tagStack[k] === tag) { tagStack.length = k; stack.length = k + 1; break; }
      if (block) newPara(false);
      continue;
    }
    if (block) newPara(false);
    let f = Object.assign({}, cur());
    if (tag === 'b' || tag === 'strong' || /^h[1-6]$/.test(tag)) f.bold = true;
    else if (tag === 'i' || tag === 'em') f.italic = true;
    else if (tag === 'u') f.underline = true;
    const sm = attrs.match(/style\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (sm) f = styleFromCss(sm[1] !== undefined ? sm[1] : sm[2], f);
    const cm = attrs.match(/(?:^|\s)color\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (cm) f.color = normColor(cm[1] || cm[2] || cm[3]) || f.color;
    if (tag === 'li') para().runs.push(Object.assign({}, f, { text: '• ' }));
    if (!/\/\s*$/.test(attrs)) { tagStack.push(tag); stack.push(f); }
  }
  while (paras.length > 1 && !paras[paras.length - 1].runs.length && !paras[paras.length - 1].rule) paras.pop();
  return paras;
}

function mkLine(runs) {
  let w = 0, size = 0;
  const out = [];
  for (const r of runs) {
    if (!r.text) continue;
    const rw = textWidth(r.text, r.size, r.bold);
    w += rw; size = Math.max(size, r.size);
    const last = out[out.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic && last.underline === r.underline && last.size === r.size && last.color === r.color) { last.text += r.text; last.w += rw; }
    else out.push(Object.assign({}, r, { w: rw }));
  }
  return { runs: out, w, size };
}
function wrapRuns(runs, maxW) {
  const lines = [];
  let cur = [], curW = 0;
  const flush = () => {
    while (cur.length && cur[cur.length - 1].text === ' ') cur.pop();
    lines.push(mkLine(cur)); cur = []; curW = 0;
  };
  for (const r of runs) {
    const parts = r.text.split(/( +)/).filter((p) => p !== '');
    for (let part of parts) {
      const isSpace = /^ +$/.test(part);
      if (isSpace) part = ' ';
      let pw = textWidth(part, r.size, r.bold);
      if (isSpace) { if (cur.length) { cur.push(Object.assign({}, r, { text: ' ' })); curW += pw; } continue; }
      if (curW + pw > maxW + 0.5 && cur.length) flush();
      // hard-break words longer than the line
      while (pw > maxW + 0.5 && part.length > 1) {
        let k = 1, acc = 0;
        const chars = Array.from(part);
        while (k < chars.length) { const cw = textWidth(chars[k - 1], r.size, r.bold); if (acc + cw > maxW) break; acc += cw; k++; }
        k = Math.max(1, k - 1);
        cur.push(Object.assign({}, r, { text: chars.slice(0, k).join('') }));
        flush();
        part = chars.slice(k).join('');
        pw = textWidth(part, r.size, r.bold);
      }
      cur.push(Object.assign({}, r, { text: part })); curW += pw;
    }
  }
  if (cur.length || !lines.length) flush();
  return lines;
}
// Returns { lines:[{runs,w,size,rule?}], w, h, lineHeights[] } for a cell label.
export function layoutLabel(value, st, wrapWidth) {
  const size = num(st.fontSize, 12);
  const fs = num(st.fontStyle, 0);
  const base = { bold: !!(fs & 1), italic: !!(fs & 2), underline: !!(fs & 4), size, color: null };
  let paras;
  if (st.html === '1') paras = parseMarkup(value, base);
  else paras = String(value).split('\n').map((t) => ({ runs: [Object.assign({}, base, { text: t })] }));
  const wrap = st.whiteSpace === 'wrap' && wrapWidth > 0;
  const lines = [];
  for (const p of paras) {
    if (p.rule) { lines.push({ rule: true, runs: [], w: 0, size: 0, h: 9 }); continue; }
    const ls = wrap ? wrapRuns(p.runs, wrapWidth) : [mkLine(p.runs)];
    for (const l of ls) { l.h = Math.round((l.size || size) * 1.2 * 100) / 100; lines.push(l); }
  }
  let w = 0, h = 0;
  for (const l of lines) { w = Math.max(w, l.w); h += l.h; }
  return { lines, w, h };
}
export function measureLabel(value, st, wrapWidth) {
  const l = layoutLabel(value, st, wrapWidth);
  return { w: l.w, h: l.h, lines: l.lines.length };
}

/* --------------------------------------------------------------- colors -- */

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  let r, g, b;
  if (s === 0) r = g = b = l;
  else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
}
export const THEMES = {
  light: { name: 'light', canvas: '#ffffff', ink: '#000000' },
  dark: { name: 'dark', canvas: '#0b1526', ink: '#e6edf7' },
};
// Dark theme: mirror lightness so light tints become deep tints and dark ink becomes light.
export function themeColor(c, theme, role) {
  const hex = normColor(c);
  if (!hex) return hex;
  if (!theme || theme === 'light') return hex;
  const [h, s, l] = hexToHsl(hex);
  let nl;
  if (role === 'fill') nl = l > 0.5 ? 0.11 + (1 - l) * 0.62 : Math.min(0.9, 1 - l * 0.55);
  else if (role === 'font') nl = l < 0.6 ? 0.93 - l * 0.38 : 1 - l * 0.8;
  else nl = l < 0.5 ? 0.82 - l * 0.5 : 0.36 + (1 - l) * 0.5; // stroke
  if (role === 'fill' && s < 0.08) return hslToHex(0.6, 0.3, Math.max(0.09, Math.min(0.9, nl + 0.02)));
  const ns = role === 'fill' ? Math.min(s, 0.55) : Math.min(s, 0.85);
  return hslToHex(h, ns, Math.max(0.06, Math.min(0.96, nl)));
}
// Solid, saturated fills (chips, banners, headers) keep their colour and their light text in dark mode.
export function isSolidFill(c) {
  const hex = normColor(c);
  if (!hex) return false;
  const [, s, l] = hexToHsl(hex);
  return l < 0.3 || (l < 0.62 && s > 0.3);
}

/* ------------------------------------------------------------- geometry -- */

export function indexPage(page) {
  const byId = new Map();
  const kids = new Map();
  for (const c of page.cells) { byId.set(c.id, c); }
  for (const c of page.cells) {
    const p = c.parent;
    if (p === undefined || p === null) continue;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(c);
  }
  return { byId, kids };
}
// Absolute bounds of every vertex (children are relative to their parent vertex).
export function absBounds(page, idx) {
  idx = idx || indexPage(page);
  const out = new Map();
  const origin = (id, guard = 0) => {
    const c = idx.byId.get(id);
    if (!c || guard > 50 || !c.vertex || !c.geo) return { x: 0, y: 0 };
    const b = get(c, guard + 1);
    return b ? { x: b.x, y: b.y } : { x: 0, y: 0 };
  };
  function get(c, guard = 0) {
    if (out.has(c.id)) return out.get(c.id);
    if (!c.vertex || !c.geo) return null;
    const parent = idx.byId.get(c.parent);
    if (parent && parent.edge) return null; // edge label child — resolved later
    const o = parent && parent.vertex ? origin(parent.id, guard) : { x: 0, y: 0 };
    let b;
    if (c.geo.relative && parent && parent.vertex) {
      const pb = get(parent, guard + 1) || { x: 0, y: 0, w: 0, h: 0 };
      const off = c.geo.offset || { x: 0, y: 0 };
      b = { x: pb.x + c.geo.x * pb.w + off.x, y: pb.y + c.geo.y * pb.h + off.y, w: c.geo.w, h: c.geo.h };
    } else b = { x: o.x + c.geo.x, y: o.y + c.geo.y, w: c.geo.w, h: c.geo.h };
    out.set(c.id, b);
    return b;
  }
  for (const c of page.cells) if (c.vertex) get(c);
  return out;
}

function shapeOf(st) {
  if (st.shape) return st.shape;
  for (const k of ['swimlane', 'ellipse', 'rhombus', 'text', 'image', 'triangle', 'line', 'group', 'hexagon', 'cylinder', 'label', 'icon']) if (k in st && st[k] === '') return k;
  return 'rectangle';
}
function perimeterPoint(b, st, toward, ortho) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const shape = shapeOf(st);
  if (ortho) {
    // orthogonal projection when the other point is within the box span
    if (toward.x >= b.x && toward.x <= b.x + b.w) return { x: toward.x, y: toward.y < cy ? b.y : b.y + b.h };
    if (toward.y >= b.y && toward.y <= b.y + b.h) return { x: toward.x < cx ? b.x : b.x + b.w, y: toward.y };
  }
  const dx = toward.x - cx, dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  if (shape === 'ellipse' || shape === 'doubleEllipse') {
    const a = b.w / 2, bb = b.h / 2;
    const t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (bb * bb));
    return { x: cx + dx * t, y: cy + dy * t };
  }
  if (shape === 'rhombus') {
    const t = 1 / (Math.abs(dx) / (b.w / 2) + Math.abs(dy) / (b.h / 2));
    return { x: cx + dx * t, y: cy + dy * t };
  }
  const tx = dx ? (b.w / 2) / Math.abs(dx) : Infinity, ty = dy ? (b.h / 2) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}
function sideOf(b, p) {
  const e = 0.5;
  if (Math.abs(p.x - b.x) < e) return 'W';
  if (Math.abs(p.x - (b.x + b.w)) < e) return 'E';
  if (Math.abs(p.y - b.y) < e) return 'N';
  if (Math.abs(p.y - (b.y + b.h)) < e) return 'S';
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = (p.x - cx) / (b.w / 2 || 1), dy = (p.y - cy) / (b.h / 2 || 1);
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
}
const DIRV = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const a = out[out.length - 1];
    if (a && Math.abs(a.x - p.x) < 0.01 && Math.abs(a.y - p.y) < 0.01) continue;
    out.push({ x: p.x, y: p.y });
    while (out.length >= 3) {
      const [p1, p2, p3] = out.slice(-3);
      const col = (Math.abs(p1.x - p2.x) < 0.01 && Math.abs(p2.x - p3.x) < 0.01) || (Math.abs(p1.y - p2.y) < 0.01 && Math.abs(p2.y - p3.y) < 0.01);
      if (col) out.splice(out.length - 2, 1); else break;
    }
  }
  return out;
}
// Simple orthogonal connection between two ports leaving along d0 and arriving against d1 (both outward normals).
export function orthoRoute(p0, s0, p1, s1, stub = 20) {
  const d0 = DIRV[s0], d1 = DIRV[s1];
  const a = { x: p0.x + d0.x * stub, y: p0.y + d0.y * stub };
  const b = { x: p1.x + d1.x * stub, y: p1.y + d1.y * stub };
  const h0 = d0.x !== 0, h1 = d1.x !== 0;
  let mid;
  if (h0 && h1) {
    if (s0 !== s1 && (b.x - a.x) * d0.x >= 0) { const mx = (a.x + b.x) / 2; mid = [{ x: mx, y: a.y }, { x: mx, y: b.y }]; }
    else if (s0 === s1) { const ex = d0.x > 0 ? Math.max(a.x, b.x) : Math.min(a.x, b.x); mid = [{ x: ex, y: a.y }, { x: ex, y: b.y }]; }
    else { const my = (a.y + b.y) / 2; mid = [{ x: a.x, y: my }, { x: b.x, y: my }]; }
  } else if (!h0 && !h1) {
    if (s0 !== s1 && (b.y - a.y) * d0.y >= 0) { const my = (a.y + b.y) / 2; mid = [{ x: a.x, y: my }, { x: b.x, y: my }]; }
    else if (s0 === s1) { const ey = d0.y > 0 ? Math.max(a.y, b.y) : Math.min(a.y, b.y); mid = [{ x: a.x, y: ey }, { x: b.x, y: ey }]; }
    else { const mx = (a.x + b.x) / 2; mid = [{ x: mx, y: a.y }, { x: mx, y: b.y }]; }
  } else if (h0) mid = [{ x: b.x, y: a.y }];
  else mid = [{ x: a.x, y: b.y }];
  return simplify([p0, a, ...mid, b, p1]);
}
function fixedPoint(b, fx, fy, dx, dy) { return { x: b.x + b.w * fx + (dx || 0), y: b.y + b.h * fy + (dy || 0) }; }

// Resolve the drawn polyline of an edge. Returns { pts, curved } or null.
export function edgePath(c, idx, bounds) {
  const st = c.style, g = c.geo || {};
  const parent = idx.byId.get(c.parent);
  const po = parent && parent.vertex && bounds.get(parent.id) ? bounds.get(parent.id) : { x: 0, y: 0 };
  const way = (g.points || []).map((p) => ({ x: p.x + po.x, y: p.y + po.y }));
  const sb = c.source && bounds.get(c.source), tb = c.target && bounds.get(c.target);
  const sCell = c.source && idx.byId.get(c.source), tCell = c.target && idx.byId.get(c.target);
  const es = st.edgeStyle || '';
  const ortho = /orthogonal|elbow|entityRelation|segment/.test(es);
  let p0 = null, p1 = null, s0 = null, s1 = null;
  if (sb) { if (st.exitX !== undefined) { p0 = fixedPoint(sb, num(st.exitX, 0.5), num(st.exitY, 0.5), num(st.exitDx, 0), num(st.exitDy, 0)); s0 = sideOf(sb, { x: p0.x - num(st.exitDx, 0), y: p0.y - num(st.exitDy, 0) }); } }
  else if (g.sourcePoint) p0 = { x: g.sourcePoint.x + po.x, y: g.sourcePoint.y + po.y };
  if (tb) { if (st.entryX !== undefined) { p1 = fixedPoint(tb, num(st.entryX, 0.5), num(st.entryY, 0.5), num(st.entryDx, 0), num(st.entryDy, 0)); s1 = sideOf(tb, { x: p1.x - num(st.entryDx, 0), y: p1.y - num(st.entryDy, 0) }); } }
  else if (g.targetPoint) p1 = { x: g.targetPoint.x + po.x, y: g.targetPoint.y + po.y };
  if (!p0 && !sb) return null;
  if (!p1 && !tb) return null;
  const sc = sb ? { x: sb.x + sb.w / 2, y: sb.y + sb.h / 2 } : p0;
  const tc = tb ? { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 } : p1;
  if (sb && tb && c.source === c.target && !way.length) {
    // self loop on the right side
    const x = sb.x + sb.w, y = sb.y + sb.h / 2;
    return { pts: [{ x, y: y - 10 }, { x: x + 30, y: y - 10 }, { x: x + 30, y: y + 14 }, { x, y: y + 14 }], curved: false };
  }
  if (!way.length && ortho) {
    // automatic orthogonal route
    if (!p0 || !p1) {
      let a0 = s0, a1 = s1;
      if (!a0 || !a1) {
        const dx = tc.x - sc.x, dy = tc.y - sc.y;
        let horiz = Math.abs(dx) >= Math.abs(dy);
        if (sb && tb) {
          const gapX = Math.max(tb.x - (sb.x + sb.w), sb.x - (tb.x + tb.w));
          const gapY = Math.max(tb.y - (sb.y + sb.h), sb.y - (tb.y + tb.h));
          horiz = gapX >= gapY;
          if (es === 'entityRelationEdgeStyle') horiz = true;
        }
        if (!a0) a0 = horiz ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N');
        if (!a1) a1 = horiz ? (dx >= 0 ? 'W' : 'E') : (dy >= 0 ? 'N' : 'S');
      }
      const mid = (b, s) => ({ x: s === 'E' ? b.x + b.w : s === 'W' ? b.x : b.x + b.w / 2, y: s === 'S' ? b.y + b.h : s === 'N' ? b.y : b.y + b.h / 2 });
      if (!p0) p0 = sb ? mid(sb, a0) : sc;
      if (!p1) p1 = tb ? mid(tb, a1) : tc;
      s0 = a0; s1 = a1;
    }
    if (!s0) s0 = Math.abs(p1.x - p0.x) >= Math.abs(p1.y - p0.y) ? (p1.x >= p0.x ? 'E' : 'W') : (p1.y >= p0.y ? 'S' : 'N');
    if (!s1) s1 = Math.abs(p1.x - p0.x) >= Math.abs(p1.y - p0.y) ? (p1.x >= p0.x ? 'W' : 'E') : (p1.y >= p0.y ? 'N' : 'S');
    if (Math.abs(p0.x - p1.x) < 0.5 || Math.abs(p0.y - p1.y) < 0.5) {
      const straightOk = (Math.abs(p0.y - p1.y) < 0.5 && ((s0 === 'E' && p1.x > p0.x) || (s0 === 'W' && p1.x < p0.x))) || (Math.abs(p0.x - p1.x) < 0.5 && ((s0 === 'S' && p1.y > p0.y) || (s0 === 'N' && p1.y < p0.y)));
      if (straightOk) return { pts: [p0, p1], curved: false };
    }
    const span = Math.min(20, Math.max(8, Math.min(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)) / 2 || 20));
    return { pts: orthoRoute(p0, s0, p1, s1, span), curved: false };
  }
  // waypoints given (or straight edge): floating ends use the perimeter
  const first = way.length ? way[0] : (p1 || tc);
  const last = way.length ? way[way.length - 1] : (p0 || sc);
  if (!p0) p0 = perimeterPoint(sb, sCell.style, first, ortho || way.length > 0);
  if (!p1) p1 = perimeterPoint(tb, tCell.style, way.length ? last : p0, ortho || way.length > 0);
  let pts = [p0, ...way, p1];
  if (ortho) {
    // keep segments axis-aligned: insert elbows where consecutive points are diagonal
    const o = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = o[o.length - 1], b = pts[i];
      if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) {
        const prev = o[o.length - 2];
        const cameHoriz = prev ? Math.abs(prev.y - a.y) < 0.5 : (s0 ? s0 === 'E' || s0 === 'W' : Math.abs(b.x - a.x) > Math.abs(b.y - a.y));
        const lastSeg = i === pts.length - 1;
        if (lastSeg && s1) o.push(s1 === 'E' || s1 === 'W' ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
        else o.push(cameHoriz ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
      }
      o.push(b);
    }
    pts = simplify(o);
  }
  return { pts, curved: st.curved === '1' };
}
function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }
export function pointAlong(pts, t) {
  const L = pathLen(pts);
  let d = Math.max(0, Math.min(1, t)) * L;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg || i === pts.length - 1) {
      const f = seg ? Math.min(1, d / seg) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f, dx: seg ? (pts[i].x - pts[i - 1].x) / seg : 1, dy: seg ? (pts[i].y - pts[i - 1].y) / seg : 0 };
    }
    d -= seg;
  }
  return { x: pts[0].x, y: pts[0].y, dx: 1, dy: 0 };
}

/* ------------------------------------------------------------- renderer -- */

const f1 = (v) => (Math.round(v * 10) / 10).toString();
function rrPath(x, y, w, h, r, corners = [1, 1, 1, 1]) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const [tl, tr, br, bl] = corners.map((c) => (c ? r : 0));
  return `M${f1(x + tl)},${f1(y)}H${f1(x + w - tr)}${tr ? `A${f1(tr)},${f1(tr)} 0 0 1 ${f1(x + w)},${f1(y + tr)}` : ''}V${f1(y + h - br)}${br ? `A${f1(br)},${f1(br)} 0 0 1 ${f1(x + w - br)},${f1(y + h)}` : ''}H${f1(x + bl)}${bl ? `A${f1(bl)},${f1(bl)} 0 0 1 ${f1(x)},${f1(y + h - bl)}` : ''}V${f1(y + tl)}${tl ? `A${f1(tl)},${f1(tl)} 0 0 1 ${f1(x + tl)},${f1(y)}` : ''}Z`;
}
function arcRadius(st, w, h) {
  if (st.rounded !== '1') return 0;
  const a = num(st.arcSize, 15);
  return st.absoluteArcSize === '1' ? Math.min(w / 2, h / 2, a / 2) : Math.min(w, h) * Math.min(50, a) / 100;
}
function imageUri(v) {
  if (!v) return null;
  if (/^data:image\/[a-z+.-]+,/.test(v)) return v.replace(/^(data:image\/[a-z+.-]+),/, '$1;base64,'); // draw.io drops ";base64"
  return v;
}

export function renderSvg(page, opts = {}) {
  const theme = opts.theme === 'dark' ? 'dark' : 'light';
  const T = THEMES[theme];
  const pad = opts.padding === undefined ? 24 : opts.padding;
  const idx = indexPage(page);
  const bounds = absBounds(page, idx);
  const C = (c, role, dflt) => { const v = c === undefined ? dflt : c; if (v === 'none' || v === null || v === undefined) return 'none'; if (v === 'default') return role === 'font' ? T.ink : role === 'fill' ? T.canvas : T.ink; return themeColor(v, theme, role) || 'none'; };
  const defs = [];
  const imgIds = new Map();
  let uid = 0;
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x, y, w = 0, h = 0) => { if (!Number.isFinite(x + y + w + h)) return; bb.x0 = Math.min(bb.x0, x); bb.y0 = Math.min(bb.y0, y); bb.x1 = Math.max(bb.x1, x + w); bb.y1 = Math.max(bb.y1, y + h); };
  const fontFamily = (st) => (st.fontFamily ? st.fontFamily.replace(/"/g, '') + ', ' : '') + 'Helvetica, Arial, sans-serif';

  function strokeAttrs(st, dfltStroke) {
    const sc = C(st.strokeColor, 'stroke', dfltStroke);
    const sw = num(st.strokeWidth, 1);
    let a = ` stroke="${sc}"`;
    if (sc !== 'none') {
      a += ` stroke-width="${f1(sw)}"`;
      if (st.dashed === '1') a += ` stroke-dasharray="${(st.dashPattern || '3 3').split(/[ ,]+/).map((v) => f1(num(v, 3) * Math.max(1, sw))).join(' ')}"`;
      if (st.strokeOpacity !== undefined) a += ` stroke-opacity="${num(st.strokeOpacity, 100) / 100}"`;
    }
    return a;
  }
  function fillAttr(st, dflt, b) {
    let fc = theme === 'dark' && isSolidFill(st.fillColor) ? normColor(st.fillColor) : C(st.fillColor, 'fill', dflt);
    if (fc !== 'none' && st.gradientColor && st.gradientColor !== 'none') {
      const id = 'g' + (++uid);
      const dir = st.gradientDirection || 'south';
      const v = dir === 'east' ? 'x1="0" y1="0" x2="1" y2="0"' : dir === 'west' ? 'x1="1" y1="0" x2="0" y2="0"' : dir === 'north' ? 'x1="0" y1="1" x2="0" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"';
      defs.push(`<linearGradient id="${id}" ${v}><stop offset="0" stop-color="${fc}"/><stop offset="1" stop-color="${C(st.gradientColor, 'fill')}"/></linearGradient>`);
      fc = `url(#${id})`;
    }
    let a = ` fill="${fc}"`;
    if (st.fillOpacity !== undefined && fc !== 'none') a += ` fill-opacity="${num(st.fillOpacity, 100) / 100}"`;
    return a;
  }

  function drawShape(c, b) {
    const st = c.style;
    const shape = shapeOf(st);
    const { x, y, w, h } = b;
    const isText = shape === 'text';
    const dFill = isText || shape === 'image' || shape === 'label' && false ? 'none' : '#ffffff';
    const dStroke = isText || shape === 'image' ? 'none' : '#000000';
    const F = (d) => fillAttr(st, d === undefined ? dFill : d, b);
    const S = (d) => strokeAttrs(st, d === undefined ? dStroke : d);
    const r = arcRadius(st, w, h);
    let s = '';
    switch (shape) {
      case 'group': return '';
      case 'image': {
        if (st.fillColor && st.fillColor !== 'none' || (st.strokeColor && st.strokeColor !== 'none')) s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"${F('none')}${S('none')}/>`;
        const uri = imageUri(st.image);
        if (uri) {
          const stretch = st.imageAspect === '0' && false;
          let id = imgIds.get(uri);
          if (!id) { id = 'i' + (imgIds.size + 1); imgIds.set(uri, id); defs.push(`<image id="${id}" width="100" height="100" href="${escXml(uri)}"${stretch ? ' preserveAspectRatio="none"' : ''}/>`); }
          const k = Math.min(w, h) / 100;
          s += `<use href="#${id}" transform="translate(${f1(x + (w - 100 * k) / 2)},${f1(y + (h - 100 * k) / 2)}) scale(${k.toFixed(4)})"/>`;
        }
        return s;
      }
      case 'doubleEllipse': return `<ellipse cx="${f1(x + w / 2)}" cy="${f1(y + h / 2)}" rx="${f1(w / 2)}" ry="${f1(h / 2)}"${F()}${S()}/><ellipse cx="${f1(x + w / 2)}" cy="${f1(y + h / 2)}" rx="${f1(Math.max(0, w / 2 - 4))}" ry="${f1(Math.max(0, h / 2 - 4))}" fill="none"${S()}/>`;
      case 'ellipse': return `<ellipse cx="${f1(x + w / 2)}" cy="${f1(y + h / 2)}" rx="${f1(w / 2)}" ry="${f1(h / 2)}"${F()}${S()}/>` + (st.double === '1' ? `<ellipse cx="${f1(x + w / 2)}" cy="${f1(y + h / 2)}" rx="${f1(Math.max(0, w / 2 - 3))}" ry="${f1(Math.max(0, h / 2 - 3))}" fill="none"${S()}/>` : '');
      case 'rhombus': return `<path d="M${f1(x + w / 2)},${f1(y)}L${f1(x + w)},${f1(y + h / 2)}L${f1(x + w / 2)},${f1(y + h)}L${f1(x)},${f1(y + h / 2)}Z" stroke-linejoin="round"${F()}${S()}/>`;
      case 'triangle': return `<path d="M${f1(x)},${f1(y)}L${f1(x + w)},${f1(y + h / 2)}L${f1(x)},${f1(y + h)}Z"${F()}${S()}/>`;
      case 'hexagon': { const k = Math.min(w / 2, num(st.size, 0.25) <= 1 ? w * num(st.size, 0.25) : num(st.size, 20)); return `<path d="M${f1(x + k)},${f1(y)}H${f1(x + w - k)}L${f1(x + w)},${f1(y + h / 2)}L${f1(x + w - k)},${f1(y + h)}H${f1(x + k)}L${f1(x)},${f1(y + h / 2)}Z" stroke-linejoin="round"${F()}${S()}/>`; }
      case 'parallelogram': { const k = Math.min(w / 2, num(st.size, 0.2) <= 1 ? w * num(st.size, 0.2) : num(st.size, 20)); return `<path d="M${f1(x + k)},${f1(y)}H${f1(x + w)}L${f1(x + w - k)},${f1(y + h)}H${f1(x)}Z" stroke-linejoin="round"${F()}${S()}/>`; }
      case 'step': { const k = Math.min(w / 2, num(st.size, 0.2) <= 1 ? w * num(st.size, 0.2) : num(st.size, 20)); return `<path d="M${f1(x)},${f1(y)}H${f1(x + w - k)}L${f1(x + w)},${f1(y + h / 2)}L${f1(x + w - k)},${f1(y + h)}H${f1(x)}L${f1(x + k)},${f1(y + h / 2)}Z" stroke-linejoin="round"${F()}${S()}/>`; }
      case 'cylinder': case 'cylinder3': case 'datastore': {
        const e = Math.min(h / 2, num(st.size, 12));
        return `<path d="M${f1(x)},${f1(y + e)}A${f1(w / 2)},${f1(e)} 0 0 1 ${f1(x + w)},${f1(y + e)}V${f1(y + h - e)}A${f1(w / 2)},${f1(e)} 0 0 1 ${f1(x)},${f1(y + h - e)}Z"${F()}${S()}/><path d="M${f1(x)},${f1(y + e)}A${f1(w / 2)},${f1(e)} 0 0 0 ${f1(x + w)},${f1(y + e)}" fill="none"${S()}/>`;
      }
      case 'document': { const k = h * num(st.size, 0.3) / 2; return `<path d="M${f1(x)},${f1(y)}H${f1(x + w)}V${f1(y + h - k)}Q${f1(x + w * 0.75)},${f1(y + h - k * 3)} ${f1(x + w / 2)},${f1(y + h - k)}T${f1(x)},${f1(y + h - k)}Z"${F()}${S()}/>`; }
      case 'note': { const k = Math.min(w, h, num(st.size, 14)); return `<path d="M${f1(x)},${f1(y)}H${f1(x + w - k)}L${f1(x + w)},${f1(y + k)}V${f1(y + h)}H${f1(x)}Z" stroke-linejoin="round"${F()}${S()}/><path d="M${f1(x + w - k)},${f1(y)}V${f1(y + k)}H${f1(x + w)}" fill="none"${S()}/>`; }
      case 'process': { const k = w * num(st.size, 0.1); return `<path d="${rrPath(x, y, w, h, r)}"${F()}${S()}/><path d="M${f1(x + k)},${f1(y)}V${f1(y + h)}M${f1(x + w - k)},${f1(y)}V${f1(y + h)}" fill="none"${S()}/>`; }
      case 'line': return st.direction === 'south' || st.direction === 'north' ? `<path d="M${f1(x + w / 2)},${f1(y)}V${f1(y + h)}" fill="none"${S()}/>` : `<path d="M${f1(x)},${f1(y + h / 2)}H${f1(x + w)}" fill="none"${S()}/>`;
      case 'umlActor': {
        const cx = x + w / 2, hr = Math.min(w / 4, h / 8);
        return `<g fill="none"${S()}><circle cx="${f1(cx)}" cy="${f1(y + hr)}" r="${f1(hr)}"${F('#ffffff')}/><path d="M${f1(cx)},${f1(y + hr * 2)}V${f1(y + h * 0.66)}M${f1(x)},${f1(y + h * 0.36)}H${f1(x + w)}M${f1(cx)},${f1(y + h * 0.66)}L${f1(x)},${f1(y + h)}M${f1(cx)},${f1(y + h * 0.66)}L${f1(x + w)},${f1(y + h)}"/></g>`;
      }
      case 'umlLifeline': {
        const hs = num(st.size, 40);
        const sw = num(st.strokeWidth, 1);
        return `<path d="${rrPath(x, y, w, Math.min(h, hs), r)}"${F()}${S()}/><path d="M${f1(x + w / 2)},${f1(y + hs)}V${f1(y + h)}" fill="none" stroke="${C(st.strokeColor, 'stroke', '#000000')}" stroke-width="${f1(sw)}" stroke-dasharray="6 5"/>`;
      }
      case 'partialRectangle': {
        s = `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"${F()} stroke="none"/>`;
        let d = '';
        if (st.top !== '0') d += `M${f1(x)},${f1(y)}H${f1(x + w)}`;
        if (st.right !== '0') d += `M${f1(x + w)},${f1(y)}V${f1(y + h)}`;
        if (st.bottom !== '0') d += `M${f1(x)},${f1(y + h)}H${f1(x + w)}`;
        if (st.left !== '0') d += `M${f1(x)},${f1(y)}V${f1(y + h)}`;
        return d ? s + `<path d="${d}" fill="none"${S()}/>` : s;
      }
      case 'swimlane': {
        const ss = num(st.startSize, 23);
        const horiz = st.horizontal !== '0';
        const bodyFill = C(st.swimlaneFillColor, 'fill', 'none');
        s = `<path d="${rrPath(x, y, w, h, r)}" fill="${bodyFill}"${S()}/>`;
        if (ss > 0) {
          if (horiz) s += `<path d="${rrPath(x, y, w, Math.min(ss, h), r, ss >= h ? [1, 1, 1, 1] : [1, 1, 0, 0])}"${F()}${st.swimlaneLine === '0' ? ' stroke="none"' : S()}/>`;
          else s += `<path d="${rrPath(x, y, Math.min(ss, w), h, r, ss >= w ? [1, 1, 1, 1] : [1, 0, 0, 1])}"${F()}${st.swimlaneLine === '0' ? ' stroke="none"' : S()}/>`;
          if (st.swimlaneLine === '0') s += `<path d="${rrPath(x, y, w, h, r)}" fill="none"${S()}/>`;
        }
        return s;
      }
      default: {
        if (/^mxgraph\.bootstrap\.rrect/.test(shape)) return `<path d="${rrPath(x, y, w, h, num(st.rSize, 5))}"${F()}${S()}/>`;
        if (r > 0) return `<path d="${rrPath(x, y, w, h, r)}"${F()}${S()}/>`;
        return `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"${F()}${S()}/>`;
      }
    }
  }

  // Draws a laid-out label inside rect (bx,by,bw,bh) with alignment; returns svg.
  function drawText(value, st, box, extra = {}) {
    if (value === undefined || value === null || value === '' || st.noLabel === '1') return '';
    const sp = num(st.spacing, 2);
    const padL = sp + num(st.spacingLeft, 0), padR = sp + num(st.spacingRight, 0), padT = sp + num(st.spacingTop, 0), padB = sp + num(st.spacingBottom, 0);
    const rot = extra.rotate;
    let bw = rot ? box.h : box.w, bh = rot ? box.w : box.h;
    const align = extra.align || st.align || 'center';
    const valign = extra.valign || st.verticalAlign || 'middle';
    const lay = layoutLabel(value, st, Math.max(8, bw - padL - padR));
    if (!lay.lines.length) return '';
    const keep = theme === 'dark' && (isSolidFill(st.fillColor) || ctxKeep);
    const fc = keep ? (normColor(st.fontColor) || '#000000') : C(st.fontColor, 'font', '#000000');
    const fam = fontFamily(st);
    // local coordinates: origin at top-left of the (possibly rotated) box
    let ty = valign === 'top' ? padT : valign === 'bottom' ? bh - padB - lay.h : padT + (bh - padT - padB - lay.h) / 2;
    const ax = align === 'left' ? padL : align === 'right' ? bw - padR : padL + (bw - padL - padR) / 2;
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    let s = '';
    const bg = st.labelBackgroundColor && st.labelBackgroundColor !== 'none' ? C(st.labelBackgroundColor, 'fill') : null;
    const bd = st.labelBorderColor && st.labelBorderColor !== 'none' ? C(st.labelBorderColor, 'stroke') : null;
    if (bg || bd) {
      const x0 = align === 'left' ? ax : align === 'right' ? ax - lay.w : ax - lay.w / 2;
      s += `<rect x="${f1(x0 - 3)}" y="${f1(ty - 1)}" width="${f1(lay.w + 6)}" height="${f1(lay.h + 2)}" rx="2" fill="${bg || 'none'}" stroke="${bd || 'none'}"/>`;
    }
    const op = st.textOpacity !== undefined ? ` opacity="${num(st.textOpacity, 100) / 100}"` : '';
    for (const l of lay.lines) {
      if (l.rule) { s += `<path d="M${f1(padL)},${f1(ty + 4.5)}H${f1(bw - padR)}" stroke="${C(st.strokeColor, 'stroke', '#999999')}" stroke-width="1" fill="none" opacity="0.6"/>`; ty += l.h; continue; }
      if (l.runs.length) {
        const base = ty + l.h / 2 + (l.size || 12) * 0.355;
        let t = `<text x="${f1(ax)}" y="${f1(base)}" text-anchor="${anchor}" font-family="${fam}" font-size="${f1(l.size)}" fill="${fc}"${op} xml:space="preserve">`;
        const single = l.runs.length === 1 && !l.runs[0].bold && !l.runs[0].italic && !l.runs[0].underline && !l.runs[0].color && l.runs[0].size === l.size;
        if (single) t += escText(l.runs[0].text);
        else for (const r of l.runs) {
          let a = '';
          if (r.bold) a += ' font-weight="bold"';
          if (r.italic) a += ' font-style="italic"';
          if (r.underline) a += ' text-decoration="underline"';
          if (r.size !== l.size) a += ` font-size="${f1(r.size)}"`;
          if (r.color) a += ` fill="${keep ? r.color : C(r.color, 'font')}"`;
          t += `<tspan${a}>${escText(r.text)}</tspan>`;
        }
        s += t + '</text>';
      }
      ty += l.h;
    }
    extra.out = { w: lay.w, h: lay.h };
    if (rot) return `<g transform="translate(${f1(box.x)},${f1(box.y + box.h)}) rotate(-90)">${s}</g>`;
    return `<g transform="translate(${f1(box.x)},${f1(box.y)})">${s}</g>`;
  }

  function vertexLabel(c, b) {
    const st = c.style;
    if (!c.value) return '';
    const shape = shapeOf(st);
    if (shape === 'swimlane') {
      const ss = num(st.startSize, 23);
      if (st.horizontal === '0') return drawText(c.value, st, { x: b.x, y: b.y, w: Math.min(ss, b.w), h: b.h }, { rotate: true, valign: 'middle' });
      return drawText(c.value, st, { x: b.x, y: b.y, w: b.w, h: Math.min(ss, b.h) }, { valign: st.verticalAlign === 'top' && ss >= b.h ? 'top' : 'middle' });
    }
    if (shape === 'umlLifeline') return drawText(c.value, st, { x: b.x, y: b.y, w: b.w, h: Math.min(b.h, num(st.size, 40)) });
    let box = { x: b.x, y: b.y, w: b.w, h: b.h };
    let align = st.align, valign = st.verticalAlign;
    const lp = st.labelPosition || 'center', vlp = st.verticalLabelPosition || (shape === 'umlActor' ? 'bottom' : 'middle');
    const lay = (lp !== 'center' || vlp !== 'middle') ? layoutLabel(c.value, st, st.whiteSpace === 'wrap' ? Math.max(b.w, 120) : 0) : null;
    if (lp === 'left') { const W = lay.w + 12; box.x = b.x - W; box.w = W; align = align || 'right'; }
    else if (lp === 'right') { const W = lay.w + 12; box.x = b.x + b.w; box.w = W; align = align || 'left'; }
    else if (vlp !== 'middle') { const W = Math.max(b.w, lay.w + 12); box.x = b.x + b.w / 2 - W / 2; box.w = W; }
    if (vlp === 'top') { const H = lay.h + 8; box.y = b.y - H; box.h = H; valign = valign || 'bottom'; }
    else if (vlp === 'bottom') { const H = lay.h + 8; box.y = b.y + b.h; box.h = H; valign = valign || 'top'; }
    if (lay) grow(box.x, box.y, box.w, box.h);
    if (st.horizontal === '0') return drawText(c.value, st, box, { rotate: true, align, valign });
    if (shape === 'rhombus') { const iw = b.w * 0.66; box = { x: b.x + (b.w - iw) / 2, y: b.y, w: iw, h: b.h }; }
    return drawText(c.value, st, box, { align, valign });
  }

  function marker(type, tip, ux, uy, size, sw, filled, color, bgFill) {
    // tip = end point; (ux,uy) unit vector pointing from the line toward the tip. Returns {svg, shorten}
    if (!type || type === 'none') return { svg: '', shorten: 0 };
    const nx = -uy, ny = ux;
    const P = (along, perp) => `${f1(tip.x - ux * along + nx * perp)},${f1(tip.y - uy * along + ny * perp)}`;
    const stroke = ` stroke="${color}" stroke-width="${f1(sw)}" stroke-linejoin="round" stroke-linecap="round"`;
    const fill = filled ? color : bgFill;
    const L = size + sw;
    switch (type) {
      case 'classic': case 'classicThin': { const hw = L / (type === 'classicThin' ? 3 : 2); return { svg: `<path d="M${P(0, 0)}L${P(L, hw)}L${P(L * 0.75, 0)}L${P(L, -hw)}Z" fill="${fill}"${stroke}/>`, shorten: L * 0.75 }; }
      case 'block': case 'blockThin': case 'triangle': { const hw = L / (type === 'blockThin' ? 3 : 2); return { svg: `<path d="M${P(0, 0)}L${P(L, hw)}L${P(L, -hw)}Z" fill="${fill}"${stroke}/>`, shorten: L }; }
      case 'open': case 'openThin': { const hw = L / (type === 'openThin' ? 3 : 2); return { svg: `<path d="M${P(L, hw)}L${P(0, 0)}L${P(L, -hw)}" fill="none"${stroke}/>`, shorten: 0 }; }
      case 'async': case 'openAsync': return { svg: `<path d="M${P(0, 0)}L${P(L, L / 2)}${type === 'async' ? `L${P(L, 0)}Z` : ''}" fill="${type === 'async' ? fill : 'none'}"${stroke}/>`, shorten: 0 };
      case 'oval': case 'circle': { const rr = size / 2; return { svg: `<circle cx="${f1(tip.x)}" cy="${f1(tip.y)}" r="${f1(rr)}" fill="${fill}"${stroke}/>`, shorten: rr }; }
      case 'diamond': case 'diamondThin': { const hw = L / (type === 'diamondThin' ? 3.2 : 2); return { svg: `<path d="M${P(0, 0)}L${P(L, hw)}L${P(2 * L, 0)}L${P(L, -hw)}Z" fill="${fill}"${stroke}/>`, shorten: 2 * L }; }
      case 'dash': return { svg: `<path d="M${P(size, size / 2)}L${P(0, -size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      case 'cross': return { svg: `<path d="M${P(size, size / 2)}L${P(0, -size / 2)}M${P(size, -size / 2)}L${P(0, size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      case 'ERone': return { svg: `<path d="M${P(size / 2, size / 2)}L${P(size / 2, -size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      case 'ERmandOne': return { svg: `<path d="M${P(size / 2, size / 2)}L${P(size / 2, -size / 2)}M${P(size, size / 2)}L${P(size, -size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      case 'ERmany': return { svg: `<path d="M${P(0, size / 2)}L${P(size, 0)}L${P(0, -size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      case 'ERoneToMany': return { svg: `<path d="M${P(0, size / 2)}L${P(size, 0)}L${P(0, -size / 2)}M${P(size, size / 2)}L${P(size, -size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      case 'ERzeroToOne': return { svg: `<circle cx="${f1(tip.x - ux * size * 1.5)}" cy="${f1(tip.y - uy * size * 1.5)}" r="${f1(size / 2)}" fill="${bgFill}"${stroke}/><path d="M${P(size / 2, size / 2)}L${P(size / 2, -size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      case 'ERzeroToMany': return { svg: `<circle cx="${f1(tip.x - ux * size * 1.5)}" cy="${f1(tip.y - uy * size * 1.5)}" r="${f1(size / 2)}" fill="${bgFill}"${stroke}/><path d="M${P(0, size / 2)}L${P(size, 0)}L${P(0, -size / 2)}" fill="none"${stroke}/>`, shorten: 0 };
      default: { const hw = L / 2; return { svg: `<path d="M${P(0, 0)}L${P(L, hw)}L${P(L, -hw)}Z" fill="${fill}"${stroke}/>`, shorten: L }; }
    }
  }

  let ctxKeep = false;
  const edgeGeom = new Map();
  function drawEdge(c) {
    const st = c.style;
    const ep = edgePath(c, idx, bounds);
    if (!ep || ep.pts.length < 2) return '';
    let pts = ep.pts.map((p) => ({ x: p.x, y: p.y }));
    edgeGeom.set(c.id, ep.pts);
    for (const p of pts) grow(p.x - 6, p.y - 6, 12, 12);
    const color = C(st.strokeColor, 'stroke', '#000000');
    const sw = num(st.strokeWidth, 1);
    const n = pts.length;
    const unit = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; return [(b.x - a.x) / d, (b.y - a.y) / d]; };
    const endT = st.endArrow === undefined ? 'classic' : st.endArrow;
    const startT = st.startArrow || 'none';
    const [eux, euy] = unit(pts[n - 2], pts[n - 1]);
    const [sux, suy] = unit(pts[1], pts[0]);
    const em = marker(endT, pts[n - 1], eux, euy, num(st.endSize, 6), sw, st.endFill !== '0', color, T.canvas);
    const sm = marker(startT, pts[0], sux, suy, num(st.startSize, 6), sw, st.startFill !== '0', color, T.canvas);
    const segLenE = Math.hypot(pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y);
    const segLenS = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    if (em.shorten && segLenE > em.shorten) pts[n - 1] = { x: pts[n - 1].x - eux * em.shorten, y: pts[n - 1].y - euy * em.shorten };
    if (sm.shorten && segLenS > sm.shorten) pts[0] = { x: pts[0].x - sux * sm.shorten, y: pts[0].y - suy * sm.shorten };
    let d = `M${f1(pts[0].x)},${f1(pts[0].y)}`;
    if (ep.curved && n > 2) {
      for (let i = 1; i < n - 2; i++) d += `Q${f1(pts[i].x)},${f1(pts[i].y)} ${f1((pts[i].x + pts[i + 1].x) / 2)},${f1((pts[i].y + pts[i + 1].y) / 2)}`;
      d += `Q${f1(pts[n - 2].x)},${f1(pts[n - 2].y)} ${f1(pts[n - 1].x)},${f1(pts[n - 1].y)}`;
    } else if (st.rounded === '1' && n > 2) {
      const R = num(st.arcSize, 20) / 2;
      for (let i = 1; i < n - 1; i++) {
        const a = pts[i - 1], b = pts[i], cc = pts[i + 1];
        const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(cc.x - b.x, cc.y - b.y);
        const rr = Math.min(R, l1 / 2, l2 / 2);
        if (rr < 0.5) { d += `L${f1(b.x)},${f1(b.y)}`; continue; }
        d += `L${f1(b.x - ((b.x - a.x) / l1) * rr)},${f1(b.y - ((b.y - a.y) / l1) * rr)}Q${f1(b.x)},${f1(b.y)} ${f1(b.x + ((cc.x - b.x) / l2) * rr)},${f1(b.y + ((cc.y - b.y) / l2) * rr)}`;
      }
      d += `L${f1(pts[n - 1].x)},${f1(pts[n - 1].y)}`;
    } else for (let i = 1; i < n; i++) d += `L${f1(pts[i].x)},${f1(pts[i].y)}`;
    let a = ` stroke="${color}" stroke-width="${f1(sw)}" fill="none" stroke-linejoin="round"`;
    const dashed = st.dashed === '1';
    if (dashed) a += ` stroke-dasharray="${(st.dashPattern || '3 3').split(/[ ,]+/).map((v) => f1(num(v, 3) * Math.max(1, sw))).join(' ')}"`;
    if (st.opacity !== undefined) a += ` opacity="${num(st.opacity, 100) / 100}"`;
    let s = `<path class="sfd-hit" d="${d}" stroke="transparent" stroke-width="${f1(Math.max(12, sw + 10))}" fill="none"/>`;
    s += `<path class="sfd-edge${dashed ? ' sfd-dashed' : ''}${st.flowAnimation === '1' ? ' sfd-flow' : ''}" d="${d}"${a}/>` + sm.svg + em.svg;
    if (c.value) {
      const t = (num(c.geo && c.geo.relative ? c.geo.x : 0, 0) + 1) / 2;
      const p = pointAlong(ep.pts, t);
      const off = (c.geo && c.geo.offset) || { x: 0, y: 0 };
      const perp = c.geo && c.geo.relative ? num(c.geo.y, 0) : 0;
      const cx = p.x + off.x + -p.dy * perp, cy = p.y + off.y + p.dx * perp;
      const lst = Object.assign({ fontSize: '11' }, st, { whiteSpace: undefined, spacing: '0', spacingLeft: undefined, spacingRight: undefined, spacingTop: undefined, spacingBottom: undefined });
      const lay = layoutLabel(c.value, lst, 0);
      const box = { x: cx - lay.w / 2, y: cy - lay.h / 2, w: lay.w, h: lay.h };
      grow(box.x - 4, box.y - 2, box.w + 8, box.h + 4);
      s += `<g class="sfd-elabel">${drawText(c.value, lst, box, { align: 'center', valign: 'middle' })}</g>`;
    }
    return s;
  }

  function edgeChildLabel(c, parentEdge) {
    // vertex whose parent is an edge: relative position along the edge path
    const pts = edgeGeom.get(parentEdge.id);
    if (!pts || !c.geo) return null;
    const p = pointAlong(pts, (num(c.geo.x, 0) + 1) / 2);
    const off = c.geo.offset || { x: 0, y: 0 };
    const st = c.style;
    let w = c.geo.w, h = c.geo.h;
    if (!w || !h) { const lay = layoutLabel(c.value || '', st, 0); w = w || lay.w + 12; h = h || lay.h + 6; }
    return { x: p.x + off.x - w / 2, y: p.y + off.y - h / 2 + -p.dx * 0 + num(c.geo.y, 0) * 0, w, h };
  }

  const body = [];
  function emitCell(c) {
    let inner = '';
    let b = null;
    ctxKeep = false;
    if (c.vertex) {
      b = bounds.get(c.id);
      const parent = idx.byId.get(c.parent);
      ctxKeep = !!(parent && parent.vertex && isSolidFill(parent.style.fillColor) && (!c.style.fillColor || c.style.fillColor === 'none'));
      if (!b && parent && parent.edge) { b = edgeChildLabel(c, parent); if (b) bounds.set(c.id, b); }
      if (b) {
        grow(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
        const st = c.style;
        let sh = drawShape(c, b);
        if (st.shadow === '1' && sh) { sh = `<g filter="url(#sfd-shadow)">${sh}</g>`; needShadow = true; }
        let op = '';
        if (st.opacity !== undefined) op = ` opacity="${num(st.opacity, 100) / 100}"`;
        inner = `<g class="sfd-shape"${op}>${sh}</g>` + vertexLabel(c, b);
        const rot = num(st.rotation, 0);
        if (rot) inner = `<g transform="rotate(${rot} ${f1(b.x + b.w / 2)} ${f1(b.y + b.h / 2)})">${inner}</g>`;
      }
    } else if (c.edge) inner = drawEdge(c);
    const kids = idx.kids.get(c.id) || [];
    let attrs = ` data-id="${escXml(c.id)}" class="sfd-cell ${c.edge ? 'sfd-e' : 'sfd-v'}"`;
    if (c.link) attrs += ` data-link="${escXml(c.link)}"`;
    if (c.edge) attrs += ` data-src="${escXml(c.source || '')}" data-tgt="${escXml(c.target || '')}"`;
    const tip = c.tooltip ? `<title>${escText(c.tooltip)}</title>` : '';
    if (inner || kids.length) {
      body.push(`<g${attrs}>${tip}${inner}`);
      for (const k of kids) emitCell(k);
      body.push('</g>');
    }
  }
  let needShadow = false;
  // edges are resolved lazily inside emitCell; draw order = document tree order
  const roots = page.cells.filter((c) => !c.vertex && !c.edge);
  const seen = new Set();
  for (const layer of roots) { seen.add(layer.id); for (const k of (idx.kids.get(layer.id) || [])) if (k.vertex || k.edge) emitCell(k); }
  for (const c of page.cells) if ((c.vertex || c.edge) && (c.parent === undefined || c.parent === null || !idx.byId.has(c.parent))) emitCell(c);

  if (!Number.isFinite(bb.x0)) { bb.x0 = 0; bb.y0 = 0; bb.x1 = 200; bb.y1 = 100; }
  const vx = Math.floor(bb.x0 - pad), vy = Math.floor(bb.y0 - pad);
  const vw = Math.ceil(bb.x1 - bb.x0 + pad * 2), vh = Math.ceil(bb.y1 - bb.y0 + pad * 2);
  if (needShadow) defs.push('<filter id="sfd-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#032d60" flood-opacity="0.18"/></filter>');
  const bgc = opts.background === 'transparent' ? null : (opts.background || (theme === 'dark' ? T.canvas : themeColor(page.attrs && page.attrs.background, theme, 'fill') || T.canvas));
  const scale = opts.scale || 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(vw * scale)}" height="${Math.round(vh * scale)}" viewBox="${vx} ${vy} ${vw} ${vh}" data-theme="${theme}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    (bgc ? `<rect class="sfd-bg" x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bgc}"/>` : '') +
    `<g class="sfd-root">${body.join('')}</g></svg>`;
  return { svg, width: vw, height: vh, viewBox: [vx, vy, vw, vh], bounds, edges: edgeGeom };
}
