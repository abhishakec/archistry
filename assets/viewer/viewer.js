/* archistry — standalone HTML viewer + editor.
   The diagram model is the draw.io XML embedded in <script id="sfd-model">; everything here reads and writes that
   model through the shared SFDMX core, so "Download .drawio" always round-trips to draw.io. */
(function () {
  'use strict';
  var MX = window.SFDMX;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var modelEl = $('#sfd-model');
  var app = $('#app');
  var file;
  try { file = MX.parseMxfile(modelEl.textContent); } catch (e) { app.textContent = 'Could not read the embedded diagram: ' + e.message; return; }
  var S = { page: 0, sel: new Set(), editing: false, tool: 'select', view: { x: 0, y: 0, k: 1 }, theme: document.documentElement.getAttribute('data-theme') || 'light', live: false, dirty: false, undo: [], redo: [], last: null, focus: null, hover: null, query: '', matches: [], matchAt: 0, connectFrom: null };
  var KINDS = [['#eaf5fe', '#0176d3', 'Salesforce'], ['#f6f2fb', '#5a1ba9', 'Data Cloud'], ['#eef1ff', '#3a49da', 'AI / Agentforce'], ['#def9f3', '#0b827c', 'Integration'], ['#ffece3', '#dd5a1b', 'Engagement'], ['#ebf7e6', '#2e844a', 'Success'], ['#fbf3e0', '#ca8501', 'Warning'], ['#fef1ee', '#ba0517', 'Danger'], ['#f3f3f3', '#747474', 'External'], ['#ffffff', '#969492', 'Neutral'], ['#ffffff', '#032d60', 'People'], ['#fdf0f7', '#b60554', 'Security'], ['#e7f8fb', '#0b6d8a', 'Analytics'], ['#fff8dc', '#ca8501', 'Note']];

  /* ------------------------------------------------------------ shell -- */
  app.innerHTML =
    '<div id="bar">' +
    '<span class="title" id="title"></span><span id="tabs"></span><span class="grow"></span>' +
    '<input id="search" type="search" placeholder="Find a box…  ( / )" aria-label="Find">' +
    '<span class="group"><button class="btn icon" id="zout" title="Zoom out (−)">−</button><button class="btn" id="zlabel" title="Actual size (1)">100%</button><button class="btn icon" id="zin" title="Zoom in (+)">+</button><button class="btn" id="fit" title="Fit to window (0)">Fit</button></span>' +
    '<button class="btn" id="live" title="Animate the direction of every connector (L)">Live</button>' +
    '<button class="btn" id="theme" title="Light / dark (T)">Dark</button>' +
    '<button class="btn" id="present" title="Full-screen presentation (P)">Present</button>' +
    '<span class="sep"></span>' +
    '<button class="btn" id="edit" title="Switch between exploring and editing (E)">Edit</button>' +
    '<span class="group edit-only"><button class="btn" id="undo" title="Undo (Ctrl+Z)">Undo</button><button class="btn" id="redo" title="Redo (Ctrl+Y)">Redo</button></span>' +
    '<div class="menu left edit-only" id="addmenu"><button class="btn" data-menu>Add ▾</button><div class="pop">' +
    '<button data-add="card">Card (rounded box)</button><button data-add="box">Rectangle</button><button data-add="ellipse">Ellipse</button><button data-add="diamond">Decision diamond</button><button data-add="pill">Pill / state</button><button data-add="data">Data store</button><button data-add="note">Note</button><button data-add="text">Text</button><button data-add="zone">Zone (container)</button><hr><div id="iconlist"></div></div></div>' +
    '<button class="btn edit-only" id="connect" title="Click a source box, then a target box (C)">Connect</button>' +
    '<div class="menu" id="exportmenu"><button class="btn primary" data-menu>Export ▾</button><div class="pop">' +
    '<button data-x="png">PNG image<span class="hint">2× sharp</span></button><button data-x="jpg">JPG image<span class="hint">white background</span></button><button data-x="svg">SVG vector<span class="hint">scales forever</span></button><button data-x="copy">Copy PNG to clipboard</button><hr>' +
    '<button data-x="drawio">Download .drawio<span class="hint">edit in draw.io</span></button><button data-x="html">Save HTML<span class="hint">keeps your edits</span></button><hr><button data-x="print">Print / save as PDF</button></div></div>' +
    '<button class="btn icon" id="helpbtn" title="Shortcuts (?)">?</button>' +
    '</div><div id="stage"></div><aside id="inspector"></aside>' +
    '<div id="status"><span id="st-mode"></span><span id="st-count"></span><span id="st-zoom"></span><span class="grow" style="flex:1"></span><span id="st-dirty"></span><span>archistry</span></div>' +
    '<div id="help"><div class="card"><h2>Explore, edit, export</h2><table>' +
    '<tr><td><b>Explore</b></td><td>Drag to pan · <kbd>Ctrl</kbd>+wheel or <kbd>+</kbd>/<kbd>−</kbd> to zoom · <kbd>0</kbd> fit · click a box to trace its connections · <kbd>/</kbd> find · <kbd>L</kbd> live flow · <kbd>T</kbd> theme · <kbd>P</kbd> present</td></tr>' +
    '<tr><td><b>Edit</b></td><td><kbd>E</kbd> toggles edit mode · drag boxes to move, corner handles to resize · double-click to edit text · <kbd>Shift</kbd>+click or <kbd>Shift</kbd>+drag to multi-select · arrows nudge · <kbd>Del</kbd> delete · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate · <kbd>C</kbd> connect two boxes · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo</td></tr>' +
    '<tr><td><b>Keep</b></td><td><b>Save HTML</b> stores your edits in a new copy of this file (<kbd>Ctrl</kbd>+<kbd>S</kbd>). <b>Download .drawio</b> gives the same diagram for draw.io, diagrams.net or the VS Code draw.io extension. PNG, JPG and SVG go straight into documents and slides.</td></tr>' +
    '<tr><td><b>Pages</b></td><td>Tabs at the top switch pages. Boxes with a link (for example a topic on an Agent Interaction Map) open their drill-down page; in edit mode use <kbd>Ctrl</kbd>+click.</td></tr>' +
    '</table><p style="text-align:right;margin:14px 0 0"><button class="btn primary" id="helpclose">Got it</button></p></div></div><div id="toast"></div>';
  var stage = $('#stage'), inspector = $('#inspector'), svg = null;

  /* ------------------------------------------------------------ model -- */
  function page() { return file.pages[S.page]; }
  function cellById(id) { var cs = page().cells; for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; }
  function resolveUnit(id) {
    var c = cellById(id), guard = 0;
    while (c && c.vertex && c.style.part === '1' && guard++ < 10) { var p = cellById(c.parent); if (!p || !p.vertex) break; c = p; }
    return c;
  }
  function descendants(id, out) { out = out || []; page().cells.forEach(function (c) { if (c.parent === id) { out.push(c); descendants(c.id, out); } }); return out; }
  function plain(v) { var d = document.createElement('div'); d.innerHTML = String(v || '').replace(/<br\s*\/?>/gi, ' '); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function isUnit(c, kids) {
    if (!c.vertex || c.style.part === '1') return false;
    var ks = kids.get(c.id) || [];
    for (var i = 0; i < ks.length; i++) if (ks[i].vertex && ks[i].style.part !== '1' && ks[i].connectable !== '0') return false;
    return true;
  }
  var uidN = 0;
  function newId(prefix) { var id; do { id = (prefix || 'u') + '_' + Date.now().toString(36) + (uidN++).toString(36); } while (cellById(id)); return id; }
  function pushUndo() { S.undo.push(MX.serializeMxfile(file)); if (S.undo.length > 80) S.undo.shift(); S.redo = []; S.dirty = true; }
  function restore(xml) { file = MX.parseMxfile(xml); if (S.page >= file.pages.length) S.page = 0; S.sel.clear(); render(); }
  function undo() { if (!S.undo.length) return; S.redo.push(MX.serializeMxfile(file)); restore(S.undo.pop()); S.dirty = true; }
  function redo() { if (!S.redo.length) return; S.undo.push(MX.serializeMxfile(file)); restore(S.redo.pop()); S.dirty = true; }

  /* ----------------------------------------------------------- render -- */
  function render() {
    var r = MX.renderSvg(page(), { theme: S.theme, background: 'transparent', padding: 0 });
    S.last = r;
    stage.innerHTML = r.svg;
    svg = stage.firstElementChild;
    svg.removeAttribute('width'); svg.removeAttribute('height');
    var idx = MX.indexPage(page());
    page().cells.forEach(function (c) { if (isUnit(c, idx.kids)) { var g = svg.querySelector('[data-id="' + cssEsc(c.id) + '"]'); if (g) g.classList.add('sfd-leaf'); } });
    if (S.live) svg.classList.add('live');
    var ov = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ov.setAttribute('id', 'ov'); svg.appendChild(ov);
    applyView(); drawOverlay(); applyHighlight(); updateChrome();
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  function applyView() {
    if (!svg) return;
    var w = stage.clientWidth || 800, h = stage.clientHeight || 600;
    svg.setAttribute('viewBox', S.view.x + ' ' + S.view.y + ' ' + w / S.view.k + ' ' + h / S.view.k);
    $('#zlabel').textContent = Math.round(S.view.k * 100) + '%';
    $('#st-zoom').textContent = 'Zoom ' + Math.round(S.view.k * 100) + '%';
  }
  function fit() {
    var vb = S.last.viewBox, w = stage.clientWidth || 800, h = stage.clientHeight || 600;
    var k = Math.min((w - 60) / vb[2], (h - 60) / vb[3], 1.6);
    if (!(k > 0)) k = 1;
    S.view.k = k; S.view.x = vb[0] - (w / k - vb[2]) / 2; S.view.y = vb[1] - (h / k - vb[3]) / 2;
    applyView(); drawOverlay();
  }
  function zoomAt(f, cx, cy) {
    var rect = stage.getBoundingClientRect();
    if (cx === undefined) { cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2; }
    var px = S.view.x + (cx - rect.left) / S.view.k, py = S.view.y + (cy - rect.top) / S.view.k;
    var k = Math.max(0.08, Math.min(6, S.view.k * f));
    S.view.x = px - (cx - rect.left) / k; S.view.y = py - (cy - rect.top) / k; S.view.k = k;
    applyView(); drawOverlay();
  }
  function centerOn(id) {
    var b = S.last.bounds.get(id); if (!b) return;
    var w = stage.clientWidth, h = stage.clientHeight;
    S.view.x = b.x + b.w / 2 - w / S.view.k / 2; S.view.y = b.y + b.h / 2 - h / S.view.k / 2; applyView(); drawOverlay();
  }
  function toDiagram(e) { var rect = stage.getBoundingClientRect(); return { x: S.view.x + (e.clientX - rect.left) / S.view.k, y: S.view.y + (e.clientY - rect.top) / S.view.k }; }
  function drawOverlay() {
    var ov = svg && svg.querySelector('#ov'); if (!ov) return;
    var s = '';
    if (S.editing) {
      S.sel.forEach(function (id) {
        var c = cellById(id); if (!c) return;
        if (c.vertex) { var b = S.last.bounds.get(id); if (b) s += '<rect class="sel-box" x="' + (b.x - 3) + '" y="' + (b.y - 3) + '" width="' + (b.w + 6) + '" height="' + (b.h + 6) + '" rx="3"/>'; }
        else { var pts = S.last.edges.get(id); if (pts) s += '<polyline class="sel-edge" points="' + pts.map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>'; }
      });
      if (S.sel.size === 1) {
        var only = cellById(Array.from(S.sel)[0]);
        if (only && only.vertex) { var bb = S.last.bounds.get(only.id), hs = 9 / S.view.k; if (bb) [['nw', bb.x, bb.y], ['ne', bb.x + bb.w, bb.y], ['se', bb.x + bb.w, bb.y + bb.h], ['sw', bb.x, bb.y + bb.h]].forEach(function (hd) { s += '<rect class="handle" data-handle="' + hd[0] + '" x="' + (hd[1] - hs / 2) + '" y="' + (hd[2] - hs / 2) + '" width="' + hs + '" height="' + hs + '" style="cursor:' + hd[0] + '-resize"/>'; }); }
      }
      if (S.connectFrom) { var cb = S.last.bounds.get(S.connectFrom); if (cb) s += '<rect class="sel-box" style="stroke-dasharray:none;stroke-width:3" x="' + (cb.x - 5) + '" y="' + (cb.y - 5) + '" width="' + (cb.w + 10) + '" height="' + (cb.h + 10) + '" rx="5"/>'; }
    }
    if (drag && drag.type === 'marquee' && drag.rect) s += '<rect class="marquee" x="' + drag.rect.x + '" y="' + drag.rect.y + '" width="' + drag.rect.w + '" height="' + drag.rect.h + '"/>';
    ov.innerHTML = s;
  }
  function neighbours(id) {
    var ids = new Set([id]);
    var family = new Set([id]); descendants(id).forEach(function (c) { family.add(c.id); });
    page().cells.forEach(function (c) { if (c.edge && (family.has(c.source) || family.has(c.target))) { ids.add(c.id); if (c.source) ids.add(c.source); if (c.target) ids.add(c.target); } });
    return ids;
  }
  function applyHighlight() {
    if (!svg) return;
    svg.querySelectorAll('.hl').forEach(function (g) { g.classList.remove('hl'); });
    var ids = null;
    if (S.query && S.matches.length) ids = new Set(S.matches);
    else if (!S.editing && (S.focus || S.hover)) ids = neighbours(S.focus || S.hover);
    svg.classList.toggle('dim', !!ids);
    if (ids) ids.forEach(function (id) { var g = svg.querySelector('[data-id="' + cssEsc(id) + '"]'); if (g) g.classList.add('hl'); });
  }
  function updateChrome() {
    var p = page();
    $('#title').textContent = document.title;
    var tabs = $('#tabs');
    if (file.pages.length > 1) tabs.innerHTML = file.pages.map(function (pg, i) { return '<button class="btn' + (i === S.page ? ' on' : '') + '" data-page="' + i + '">' + esc(pg.name) + '</button>'; }).join(''); else tabs.innerHTML = '';
    var idx = MX.indexPage(p), nodes = 0, edges = 0;
    p.cells.forEach(function (c) { if (c.edge && (c.source || c.target)) edges++; else if (c.connectable !== '0' && isUnit(c, idx.kids) && !('text' in c.style)) nodes++; });
    $('#st-count').textContent = nodes + ' boxes · ' + edges + ' connectors' + (file.pages.length > 1 ? ' · page ' + (S.page + 1) + ' of ' + file.pages.length : '');
    $('#st-mode').textContent = S.editing ? (S.tool === 'connect' ? 'Connect: click the source box, then the target' : 'Editing — drag to move, double-click to edit text') : 'Exploring — click a box to trace its connections';
    $('#st-dirty').textContent = S.dirty ? 'Unsaved edits — Export ▸ Save HTML or Download .drawio' : '';
    $('#st-dirty').className = S.dirty ? 'dirty' : '';
    $('#edit').classList.toggle('on', S.editing); $('#edit').textContent = S.editing ? 'Done editing' : 'Edit';
    $('#live').classList.toggle('on', S.live); $('#theme').textContent = S.theme === 'dark' ? 'Light' : 'Dark';
    $('#connect').classList.toggle('on', S.tool === 'connect');
    $('#undo').disabled = !S.undo.length; $('#redo').disabled = !S.redo.length;
    document.body.classList.toggle('editing', S.editing);
    renderInspector();
  }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

  /* -------------------------------------------------------- inspector -- */
  function hex(v, d) { var c = MX.normColor(v); return c || d; }
  function renderInspector() {
    var h = '';
    if (S.editing && S.sel.size) {
      var cells = Array.from(S.sel).map(cellById).filter(Boolean);
      var c = cells[0]; if (!c) { inspector.classList.remove('open'); return; }
      var st = c.style, isEdge = !!c.edge;
      h += '<h3>' + (cells.length > 1 ? cells.length + ' items selected' : (isEdge ? 'Connector' : 'Shape')) + '</h3>';
      h += '<label>Text (use &lt;br&gt; for a new line, &lt;b&gt;bold&lt;/b&gt;)</label><textarea id="i-label">' + esc(c.value) + '</textarea>';
      if (!isEdge) { h += '<label>Salesforce palette</label><div class="swatches">' + KINDS.map(function (k, i) { return '<div class="sw" data-kind="' + i + '" title="' + k[2] + '" style="background:' + k[0] + ';border-color:' + k[1] + '"></div>'; }).join('') + '</div>'; }
      h += '<div class="row">' + (isEdge ? '' : '<div><label>Fill</label><input type="color" id="i-fill" value="' + hex(st.fillColor, '#ffffff') + '"></div>') + '<div><label>Line</label><input type="color" id="i-stroke" value="' + hex(st.strokeColor, '#000000') + '"></div><div><label>Text</label><input type="color" id="i-font" value="' + hex(st.fontColor, '#000000') + '"></div></div>';
      h += '<div class="row"><div><label>Font size</label><input type="number" id="i-fs" min="6" max="72" value="' + (parseFloat(st.fontSize) || 12) + '"></div><div><label>Line width</label><input type="number" id="i-sw" min="0" max="12" step="0.5" value="' + (parseFloat(st.strokeWidth) || 1) + '"></div></div>';
      h += '<label>Line style</label><select id="i-dash"><option value="">Solid</option><option value="6 4"' + (st.dashed === '1' && st.dashPattern !== '1 3' ? ' selected' : '') + '>Dashed</option><option value="1 3"' + (st.dashed === '1' && st.dashPattern === '1 3' ? ' selected' : '') + '>Dotted</option></select>';
      if (isEdge) {
        var arrows = ['none', 'block', 'open', 'classic', 'diamond', 'oval', 'ERzeroToMany', 'ERzeroToOne', 'ERmandOne', 'ERmany', 'ERone'];
        var opt = function (v) { return arrows.map(function (a) { return '<option' + (a === v ? ' selected' : '') + '>' + a + '</option>'; }).join(''); };
        h += '<div class="row"><div><label>Start</label><select id="i-sa">' + opt(st.startArrow || 'none') + '</select></div><div><label>End</label><select id="i-ea">' + opt(st.endArrow === undefined ? 'classic' : st.endArrow) + '</select></div></div>';
        h += '<label>Route</label><div class="row"><button class="btn" id="i-reroute">Straighten / re-route</button><button class="btn" id="i-flip">Reverse</button></div>';
      } else if (c.geo) {
        h += '<div class="row"><div><label>Width</label><input type="number" id="i-w" step="10" value="' + Math.round(c.geo.w) + '"></div><div><label>Height</label><input type="number" id="i-h" step="10" value="' + Math.round(c.geo.h) + '"></div></div>';
        h += '<label>Link (URL or data:page/id,…)</label><input type="text" id="i-link" value="' + esc(c.link || '') + '">';
      }
      h += '<label>Arrange</label><div class="row"><button class="btn" id="i-front">To front</button><button class="btn" id="i-back">To back</button></div><div class="row" style="margin-top:8px"><button class="btn" id="i-dup">Duplicate</button><button class="btn" id="i-del" style="color:var(--danger)">Delete</button></div>';
      inspector.innerHTML = h; inspector.classList.add('open');
      bindInspector(cells);
      return;
    }
    if (!S.editing && S.focus) {
      var f = cellById(S.focus);
      if (f) {
        var ins = [], outs = [];
        var family = new Set([f.id]); descendants(f.id).forEach(function (x) { family.add(x.id); });
        page().cells.forEach(function (e) {
          if (!e.edge) return;
          if (family.has(e.source) && e.target) outs.push([e.target, plain(e.value)]);
          else if (family.has(e.target) && e.source) ins.push([e.source, plain(e.value)]);
        });
        var item = function (x) { var o = cellById(x[0]); return '<li data-go="' + esc(x[0]) + '">' + esc(plain(o && o.value) || x[0]) + (x[1] ? ' <span class="info">— ' + esc(x[1]) + '</span>' : '') + '</li>'; };
        h += '<h3>' + esc(plain(f.value) || f.id) + '</h3>';
        if (f.tooltip) h += '<p class="info">' + esc(f.tooltip) + '</p>';
        if (f.link) h += '<p><button class="btn primary" id="i-open">' + (/^data:page/.test(f.link) ? 'Open drill-down page' : 'Open link') + '</button></p>';
        h += '<p class="info"><b>' + ins.length + '</b> incoming · <b>' + outs.length + '</b> outgoing</p>';
        if (ins.length) h += '<label>Comes from</label><ul>' + ins.map(item).join('') + '</ul>';
        if (outs.length) h += '<label>Goes to</label><ul>' + outs.map(item).join('') + '</ul>';
        h += '<p class="info" style="margin-top:14px">Click the canvas to clear · press <b>E</b> to edit this diagram.</p>';
        inspector.innerHTML = h; inspector.classList.add('open');
        inspector.querySelectorAll('[data-go]').forEach(function (li) { li.onclick = function () { var u = resolveUnit(li.getAttribute('data-go')); if (u) { S.focus = u.id; centerOn(u.id); applyHighlight(); renderInspector(); } }; });
        var ob = $('#i-open'); if (ob) ob.onclick = function () { openLink(f.link); };
        return;
      }
    }
    inspector.classList.remove('open'); inspector.innerHTML = '';
  }
  function bindInspector(cells) {
    var once = false;
    var change = function (fn) { return function (ev) { if (!once) { pushUndo(); once = true; } cells.forEach(function (c) { fn(c, ev.target.value, ev); }); softRender(); }; };
    var on = function (id, evn, fn) { var el = $('#' + id); if (el) el.addEventListener(evn, fn); };
    on('i-label', 'input', change(function (c, v) { c.value = c.style.html === '1' ? v.replace(/\n/g, '<br>') : v; }));
    on('i-fill', 'input', change(function (c, v) { if (c.vertex) c.style.fillColor = v; }));
    on('i-stroke', 'input', change(function (c, v) { c.style.strokeColor = v; }));
    on('i-font', 'input', change(function (c, v) { c.style.fontColor = v; }));
    on('i-fs', 'input', change(function (c, v) { if (+v > 0) c.style.fontSize = String(+v); }));
    on('i-sw', 'input', change(function (c, v) { c.style.strokeWidth = String(+v); }));
    on('i-dash', 'change', change(function (c, v) { if (v) { c.style.dashed = '1'; c.style.dashPattern = v; } else { delete c.style.dashed; delete c.style.dashPattern; } }));
    on('i-sa', 'change', change(function (c, v) { if (c.edge) { c.style.startArrow = v; c.style.startFill = /^ER/.test(v) ? '0' : '1'; if (/^ER/.test(v)) c.style.startSize = '10'; } }));
    on('i-ea', 'change', change(function (c, v) { if (c.edge) { c.style.endArrow = v; c.style.endFill = /^ER/.test(v) ? '0' : '1'; if (/^ER/.test(v)) c.style.endSize = '10'; } }));
    on('i-w', 'change', change(function (c, v) { if (c.vertex && +v >= 10) c.geo.w = +v; }));
    on('i-h', 'change', change(function (c, v) { if (c.vertex && +v >= 10) c.geo.h = +v; }));
    on('i-link', 'change', change(function (c, v) { if (v) c.link = v; else delete c.link; }));
    inspector.querySelectorAll('.sw').forEach(function (sw) { sw.onclick = function () { var k = KINDS[+sw.getAttribute('data-kind')]; pushUndo(); cells.forEach(function (c) { if (c.vertex) { c.style.fillColor = k[0]; c.style.strokeColor = k[1]; } }); render(); }; });
    on('i-reroute', 'click', function () { pushUndo(); cells.forEach(function (c) { if (c.edge) { c.geo.points = []; ['exitX', 'exitY', 'exitDx', 'exitDy', 'entryX', 'entryY', 'entryDx', 'entryDy'].forEach(function (k) { delete c.style[k]; }); if (!c.style.edgeStyle || c.style.edgeStyle === 'none') c.style.edgeStyle = 'orthogonalEdgeStyle'; } }); render(); });
    on('i-flip', 'click', function () { pushUndo(); cells.forEach(function (c) { if (c.edge) { var t = c.source; c.source = c.target; c.target = t; c.geo.points = (c.geo.points || []).slice().reverse(); var s = c.style, ex = [s.exitX, s.exitY], en = [s.entryX, s.entryY]; if (en[0] !== undefined) { s.exitX = en[0]; s.exitY = en[1]; } else { delete s.exitX; delete s.exitY; } if (ex[0] !== undefined) { s.entryX = ex[0]; s.entryY = ex[1]; } else { delete s.entryX; delete s.entryY; } } }); render(); });
    on('i-front', 'click', function () { arrange(true); });
    on('i-back', 'click', function () { arrange(false); });
    on('i-dup', 'click', duplicate);
    on('i-del', 'click', removeSelected);
  }
  var softT = null;
  function softRender() { clearTimeout(softT); softT = setTimeout(function () { var a = document.activeElement, id = a && a.id, pos = a && a.selectionStart; var r = MX.renderSvg(page(), { theme: S.theme, background: 'transparent', padding: 0 }); S.last = r; var old = svg; stage.innerHTML = r.svg; svg = stage.firstElementChild; svg.removeAttribute('width'); svg.removeAttribute('height'); var ov = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ov.setAttribute('id', 'ov'); svg.appendChild(ov); applyView(); drawOverlay(); $('#st-dirty').textContent = 'Unsaved edits — Export ▸ Save HTML or Download .drawio'; $('#st-dirty').className = 'dirty'; $('#undo').disabled = false; void old; void id; void pos; }, 60); }

  /* ---------------------------------------------------------- editing -- */
  function topSelected() {
    var ids = Array.from(S.sel);
    return ids.filter(function (id) { var c = cellById(id), guard = 0; while (c && c.parent && guard++ < 30) { if (S.sel.has(c.parent)) return false; c = cellById(c.parent); } return true; }).map(cellById).filter(Boolean);
  }
  function removeSelected() {
    if (!S.sel.size) return;
    pushUndo();
    var gone = new Set();
    S.sel.forEach(function (id) { gone.add(id); descendants(id).forEach(function (c) { gone.add(c.id); }); });
    var p = page();
    p.cells.forEach(function (c) { if (c.edge && ((c.source && gone.has(c.source)) || (c.target && gone.has(c.target)))) { gone.add(c.id); descendants(c.id).forEach(function (k) { gone.add(k.id); }); } });
    p.cells = p.cells.filter(function (c) { return !gone.has(c.id); });
    S.sel.clear(); render();
  }
  function duplicate() {
    var tops = topSelected().filter(function (c) { return c.vertex || (c.edge && !c.source && !c.target); });
    if (!tops.length) return;
    pushUndo();
    var p = page(), fresh = [];
    tops.forEach(function (c) {
      var map = new Map(), group = [c].concat(descendants(c.id));
      group.forEach(function (g) { map.set(g.id, newId('dup')); });
      group.forEach(function (g) {
        var n = JSON.parse(JSON.stringify(g)); n.id = map.get(g.id);
        if (map.has(n.parent)) n.parent = map.get(n.parent);
        if (g === c && n.geo) { n.geo.x += 20; n.geo.y += 20; if (n.geo.points) n.geo.points.forEach(function (q) { q.x += 20; q.y += 20; }); if (n.geo.sourcePoint) { n.geo.sourcePoint.x += 20; n.geo.sourcePoint.y += 20; } if (n.geo.targetPoint) { n.geo.targetPoint.x += 20; n.geo.targetPoint.y += 20; } }
        p.cells.push(n);
      });
      fresh.push(map.get(c.id));
    });
    S.sel = new Set(fresh); render();
  }
  function arrange(front) {
    var tops = topSelected(); if (!tops.length) return;
    pushUndo();
    var p = page();
    tops.forEach(function (c) {
      var group = [c].concat(descendants(c.id)), ids = new Set(group.map(function (g) { return g.id; }));
      var rest = p.cells.filter(function (x) { return !ids.has(x.id); });
      if (front) p.cells = rest.concat(group);
      else { var at = 0; for (var i = 0; i < rest.length; i++) { if (rest[i].id === c.parent || (!rest[i].vertex && !rest[i].edge)) at = i + 1; } p.cells = rest.slice(0, at).concat(group, rest.slice(at)); }
    });
    render();
  }
  function addShape(kind, iconUri) {
    pushUndo();
    var w = stage.clientWidth, h = stage.clientHeight;
    var cx = Math.round((S.view.x + w / S.view.k / 2) / 10) * 10, cy = Math.round((S.view.y + h / S.view.k / 2) / 10) * 10;
    var base = { html: '1', whiteSpace: 'wrap', fontColor: '#032d60', fontSize: '13', strokeWidth: '1.5' };
    var defs = {
      card: [180, 60, '<b>New card</b>', { rounded: '1', arcSize: '16', absoluteArcSize: '1', fillColor: '#eaf5fe', strokeColor: '#0176d3' }],
      box: [160, 60, 'Text', { fillColor: '#ffffff', strokeColor: '#969492' }],
      ellipse: [120, 80, 'Text', { ellipse: '', fillColor: '#ffffff', strokeColor: '#032d60' }],
      diamond: [140, 80, 'Decision?', { rhombus: '', fillColor: '#fbf3e0', strokeColor: '#ca8501', fontSize: '12' }],
      pill: [140, 40, '<b>State</b>', { rounded: '1', arcSize: '100', absoluteArcSize: '1', fillColor: '#eaf5fe', strokeColor: '#0176d3' }],
      data: [120, 80, 'Data', { shape: 'cylinder3', size: '12', boundedLbl: '1', fillColor: '#f6f2fb', strokeColor: '#5a1ba9', spacingTop: '14' }],
      note: [180, 80, 'Note', { shape: 'note', size: '14', fillColor: '#fff8dc', strokeColor: '#ca8501', fontSize: '11', align: 'left', spacingLeft: '8' }],
      text: [160, 30, 'Text', { text: '', fillColor: 'none', strokeColor: 'none', align: 'left' }],
      zone: [320, 220, '<b>Zone</b>', { rounded: '1', arcSize: '20', absoluteArcSize: '1', fillColor: '#eaf5fe', strokeColor: '#0176d3', align: 'left', verticalAlign: 'top', spacingLeft: '14', spacingTop: '9', container: '1', collapsible: '0' }],
      icon: [48, 48, '', { shape: 'image', html: '1', aspect: 'fixed', imageAspect: '1', image: iconUri }],
    };
    var d = defs[kind] || defs.box;
    var st = kind === 'icon' ? d[3] : Object.assign({}, base, d[3]);
    var c = { id: newId(kind), value: d[2], style: st, vertex: true, parent: '1', geo: { x: cx - d[0] / 2, y: cy - d[1] / 2, w: d[0], h: d[1] } };
    var p = page();
    if (kind === 'zone') { var at = 0; for (var i = 0; i < p.cells.length; i++) if (!p.cells[i].vertex && !p.cells[i].edge) at = i + 1; p.cells.splice(at, 0, c); } else p.cells.push(c);
    S.sel = new Set([c.id]); render();
  }
  function connect(a, b) {
    if (a === b) return;
    pushUndo();
    var c = { id: newId('edge'), value: '', style: { html: '1', edgeStyle: 'orthogonalEdgeStyle', rounded: '1', strokeColor: '#514f4d', strokeWidth: '1.5', endArrow: 'block', endFill: '1', endSize: '6', fontSize: '11', fontColor: '#032d60', labelBackgroundColor: '#ffffff' }, edge: true, parent: '1', source: a, target: b, geo: { x: 0, y: 0, w: 0, h: 0, relative: true } };
    page().cells.push(c);
    S.sel = new Set([c.id]); render();
  }
  function iconChoices() {
    var seen = new Map();
    file.pages.forEach(function (p) { p.cells.forEach(function (c) { if (c.vertex && c.style.image && !seen.has(c.style.image)) seen.set(c.style.image, c.style.image); }); });
    var list = $('#iconlist');
    if (!seen.size) { list.innerHTML = ''; return; }
    var i = 0, h = '<div style="padding:6px 10px 2px;font-size:11px;color:var(--sub)">ICONS USED IN THIS DIAGRAM</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:4px 8px 8px">';
    seen.forEach(function (uri) { if (i++ > 35) return; var src = uri.replace(/^(data:image\/[a-z+.-]+),/, '$1;base64,'); h += '<img data-icon="' + (i - 1) + '" src="' + src + '" style="width:28px;height:28px;object-fit:contain;cursor:pointer;border-radius:4px" title="Add icon">'; });
    list.innerHTML = h + '</div>';
    var uris = Array.from(seen.keys());
    list.querySelectorAll('img').forEach(function (img) { img.onclick = function () { addShape('icon', uris[+img.getAttribute('data-icon')]); closeMenus(); }; });
  }
  function openLink(link) {
    var m = /^data:page\/id,(.+)$/.exec(link || '');
    if (m) { var i = file.pages.findIndex(function (p) { return p.id === m[1]; }); if (i >= 0) { gotoPage(i); return; } toast('Linked page not found'); return; }
    if (/^https?:/i.test(link)) window.open(link, '_blank', 'noopener');
  }
  function gotoPage(i) { S.page = i; S.sel.clear(); S.focus = null; S.query = ''; $('#search').value = ''; S.matches = []; render(); fit(); }

  /* ---------------------------------------------------------- pointer -- */
  var drag = null;
  function hitCell(e) {
    var g = e.target.closest ? e.target.closest('.sfd-cell') : null;
    if (!g) return null;
    return resolveUnit(g.getAttribute('data-id'));
  }
  stage.addEventListener('pointerdown', function (e) {
    if (e.button === 2) return;
    closeMenus();
    var pt = toDiagram(e);
    var handle = e.target.getAttribute && e.target.getAttribute('data-handle');
    var c = hitCell(e);
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already captured */ }
    if (S.editing && handle && S.sel.size === 1) { var hc = cellById(Array.from(S.sel)[0]); drag = { type: 'resize', handle: handle, cell: hc, g0: Object.assign({}, hc.geo), start: pt, moved: false }; return; }
    if (S.editing && e.button === 0 && c && S.tool === 'connect') { drag = { type: 'click', cell: c, sx: e.clientX, sy: e.clientY }; return; }
    if (S.editing && e.button === 0 && c) {
      if (e.shiftKey) { if (S.sel.has(c.id)) S.sel.delete(c.id); else S.sel.add(c.id); }
      else if (!S.sel.has(c.id)) S.sel = new Set([c.id]);
      drawOverlay(); renderInspector();
      drag = { type: 'move', start: pt, sx: e.clientX, sy: e.clientY, moved: false, cell: c, ctrl: e.ctrlKey || e.metaKey };
      return;
    }
    if (S.editing && e.button === 0 && e.shiftKey) { drag = { type: 'marquee', start: pt, rect: null }; return; }
    drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y, moved: false, cell: c };
    stage.classList.add('panning');
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag) {
      if (!S.editing && !S.focus && !S.query) { var hc = hitCell(e); var id = hc ? hc.id : null; if (id !== S.hover) { S.hover = id; applyHighlight(); } }
      return;
    }
    var pt = toDiagram(e);
    if (drag.type === 'pan') {
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      S.view.x = drag.vx - dx / S.view.k; S.view.y = drag.vy - dy / S.view.k; applyView();
    } else if (drag.type === 'move') {
      if (!drag.moved) { if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return; drag.moved = true; beginMove(); }
      var snap = e.altKey ? 1 : 10;
      var ddx = Math.round((pt.x - drag.start.x) / snap) * snap, ddy = Math.round((pt.y - drag.start.y) / snap) * snap;
      drag.items.forEach(function (it) { it.c.geo.x = it.x + ddx; it.c.geo.y = it.y + ddy; });
      drag.edges.forEach(function (it) { var g = it.c.geo; if (it.pts) g.points = it.pts.map(function (q) { return { x: q.x + ddx, y: q.y + ddy }; }); if (it.sp) g.sourcePoint = { x: it.sp.x + ddx, y: it.sp.y + ddy }; if (it.tp) g.targetPoint = { x: it.tp.x + ddx, y: it.tp.y + ddy }; });
      frame();
    } else if (drag.type === 'resize') {
      if (!drag.moved) { drag.moved = true; pushUndo(); }
      var g0 = drag.g0, g = drag.cell.geo, sn = e.altKey ? 1 : 10;
      var mx = Math.round((pt.x - drag.start.x) / sn) * sn, my = Math.round((pt.y - drag.start.y) / sn) * sn;
      var hnd = drag.handle;
      if (hnd.indexOf('e') >= 0) g.w = Math.max(20, g0.w + mx);
      if (hnd.indexOf('s') >= 0) g.h = Math.max(20, g0.h + my);
      if (hnd.indexOf('w') >= 0) { var nw = Math.max(20, g0.w - mx); g.x = g0.x + (g0.w - nw); g.w = nw; }
      if (hnd.indexOf('n') >= 0) { var nh = Math.max(20, g0.h - my); g.y = g0.y + (g0.h - nh); g.h = nh; }
      frame();
    } else if (drag.type === 'marquee') {
      drag.rect = { x: Math.min(pt.x, drag.start.x), y: Math.min(pt.y, drag.start.y), w: Math.abs(pt.x - drag.start.x), h: Math.abs(pt.y - drag.start.y) };
      drawOverlay();
    }
  });
  function endDrag(e) {
    if (!drag) return;
    var d = drag; drag = null;
    stage.classList.remove('panning');
    try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    if (d.type === 'pan' && !d.moved) {
      if (S.editing) { if (S.tool === 'connect') { S.connectFrom = null; } S.sel.clear(); drawOverlay(); updateChrome(); return; }
      var c = d.cell;
      if (c && c.link) { openLink(c.link); return; }
      S.focus = c && isFocusable(c) ? c.id : null; applyHighlight(); renderInspector();
    } else if (d.type === 'click') {
      if (!S.connectFrom) { S.connectFrom = d.cell.id; drawOverlay(); toast('Now click the target box'); }
      else { var from = S.connectFrom; S.connectFrom = null; S.tool = 'select'; connect(from, d.cell.id); }
    } else if (d.type === 'move') {
      if (!d.moved) { if (d.ctrl && d.cell.link) openLink(d.cell.link); return; }
      render();
    } else if (d.type === 'resize') { render(); }
    else if (d.type === 'marquee') {
      if (d.rect) { var r = d.rect, idx = MX.indexPage(page()); page().cells.forEach(function (c) { if (!c.vertex || !isUnit(c, idx.kids)) return; var b = S.last.bounds.get(c.id); if (b && b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h) S.sel.add(c.id); }); }
      drawOverlay(); renderInspector();
    }
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  function isFocusable(c) { return c.vertex; }
  var raf = 0;
  function frame() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; var r = MX.renderSvg(page(), { theme: S.theme, background: 'transparent', padding: 0 }); S.last = r; stage.innerHTML = r.svg; svg = stage.firstElementChild; svg.removeAttribute('width'); svg.removeAttribute('height'); var ov = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ov.setAttribute('id', 'ov'); svg.appendChild(ov); if (S.live) svg.classList.add('live'); applyView(); drawOverlay(); }); }
  function beginMove() {
    pushUndo();
    var tops = topSelected();
    var moved = new Set();
    tops.forEach(function (c) { if (c.vertex) { moved.add(c.id); descendants(c.id).forEach(function (k) { moved.add(k.id); }); } });
    drag.items = tops.filter(function (c) { return c.vertex && c.geo && !c.geo.relative; }).map(function (c) { return { c: c, x: c.geo.x, y: c.geo.y }; });
    drag.edges = [];
    var topLevelMove = tops.some(function (c) { return c.vertex; });
    page().cells.forEach(function (e) {
      if (!e.edge || !e.geo) return;
      var sIn = e.source ? moved.has(e.source) : false, tIn = e.target ? moved.has(e.target) : false;
      var selfSel = S.sel.has(e.id);
      var both = (sIn || !e.source) && (tIn || !e.target) && (sIn || tIn || selfSel);
      if (both) drag.edges.push({ c: e, pts: (e.geo.points || []).map(function (q) { return { x: q.x, y: q.y }; }), sp: !e.source && e.geo.sourcePoint ? Object.assign({}, e.geo.sourcePoint) : null, tp: !e.target && e.geo.targetPoint ? Object.assign({}, e.geo.targetPoint) : null });
      else if ((sIn || tIn) && topLevelMove) {
        // one end moves: let the line re-route itself
        var ortho = /orthogonal|elbow|entityRelation/.test(e.style.edgeStyle || '');
        if (ortho) { e.geo.points = []; ['exitX', 'exitY', 'exitDx', 'exitDy', 'entryX', 'entryY', 'entryDx', 'entryDy'].forEach(function (k) { delete e.style[k]; }); delete e.geo.x; e.geo.x = 0; }
        else if (e.style.curved === '1') e.geo.points = [];
      }
    });
  }
  stage.addEventListener('dblclick', function (e) {
    var c = hitCell(e);
    if (!c) return;
    if (!S.editing) { setEditing(true); }
    S.sel = new Set([c.id]); drawOverlay(); renderInspector();
    var ta = $('#i-label'); if (ta) { ta.focus(); ta.select(); }
  });
  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
    else { S.view.x += e.deltaX / S.view.k; S.view.y += e.deltaY / S.view.k; applyView(); }
  }, { passive: false });

  /* --------------------------------------------------------- commands -- */
  function setEditing(on) { S.editing = on; S.focus = null; S.hover = null; S.tool = 'select'; S.connectFrom = null; if (!on) S.sel.clear(); render(); if (on) iconChoices(); }
  function setTheme(t) { S.theme = t; document.documentElement.setAttribute('data-theme', t); render(); }
  function closeMenus() { document.querySelectorAll('.menu.open').forEach(function (m) { m.classList.remove('open'); }); }
  function runSearch(q) {
    S.query = q.trim().toLowerCase(); S.matches = []; S.matchAt = 0;
    if (S.query) { var idx = MX.indexPage(page()); page().cells.forEach(function (c) { if (c.vertex && isUnit(c, idx.kids) && plain(c.value).toLowerCase().indexOf(S.query) >= 0) S.matches.push(c.id); }); }
    applyHighlight();
    $('#st-mode').textContent = S.query ? S.matches.length + ' match' + (S.matches.length === 1 ? '' : 'es') + ' — Enter jumps to the next one' : (S.editing ? 'Editing' : 'Exploring — click a box to trace its connections');
  }
  function baseName() { return (document.title || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'diagram'; }
  function download(name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function exportSvg() { return MX.renderSvg(page(), { theme: S.theme, padding: 24 }); }
  function raster(mime, cb) {
    var r = exportSvg(), img = new Image(), scale = Math.min(3, Math.max(1, Math.min(2, 12000 / Math.max(r.width, r.height))));
    img.onload = function () { var c = document.createElement('canvas'); c.width = Math.round(r.width * scale); c.height = Math.round(r.height * scale); var x = c.getContext('2d'); if (mime === 'image/jpeg') { x.fillStyle = S.theme === 'dark' ? '#0b1526' : '#ffffff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { cb(b); }, mime, 0.93); };
    img.onerror = function () { toast('Export failed in this browser'); };
    img.src = URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml;charset=utf-8' }));
  }
  function currentXml() { return MX.serializeMxfile(file); }
  function selfHtml() {
    var doc = document.documentElement.cloneNode(true);
    doc.querySelector('#sfd-model').textContent = currentXml();
    doc.querySelector('#app').innerHTML = '';
    doc.querySelector('body').removeAttribute('class');
    doc.setAttribute('data-theme', S.theme);
    return '<!doctype html>\n' + doc.outerHTML;
  }
  function doExport(kind) {
    var pg = file.pages.length > 1 ? '-' + (S.page + 1) : '';
    if (kind === 'png') raster('image/png', function (b) { download(baseName() + pg + '.png', b); });
    else if (kind === 'jpg') raster('image/jpeg', function (b) { download(baseName() + pg + '.jpg', b); });
    else if (kind === 'svg') download(baseName() + pg + '.svg', exportSvg().svg, 'image/svg+xml');
    else if (kind === 'copy') raster('image/png', function (b) { try { navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(function () { toast('PNG copied — paste it into your document'); }, function () { toast('Clipboard blocked — use PNG download instead'); }); } catch (err) { toast('Clipboard not available — use PNG download instead'); } });
    else if (kind === 'drawio') { download(baseName() + '.drawio', currentXml(), 'application/xml'); S.dirty = false; updateChrome(); }
    else if (kind === 'html') { download(baseName() + '.html', selfHtml(), 'text/html'); S.dirty = false; updateChrome(); toast('Saved a copy with your edits'); }
    else if (kind === 'print') window.print();
  }

  /* ----------------------------------------------------------- wiring -- */
  $('#bar').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-menu')) { var m = t.parentNode, was = m.classList.contains('open'); closeMenus(); if (!was) m.classList.add('open'); return; }
    if (t.hasAttribute('data-page')) { gotoPage(+t.getAttribute('data-page')); return; }
    if (t.hasAttribute('data-add')) { addShape(t.getAttribute('data-add')); closeMenus(); return; }
    if (t.hasAttribute('data-x')) { doExport(t.getAttribute('data-x')); closeMenus(); return; }
    switch (t.id) {
      case 'zin': zoomAt(1.25); break;
      case 'zout': zoomAt(0.8); break;
      case 'zlabel': zoomAt(1 / S.view.k); break;
      case 'fit': fit(); break;
      case 'live': S.live = !S.live; render(); break;
      case 'theme': setTheme(S.theme === 'dark' ? 'light' : 'dark'); break;
      case 'present': present(); break;
      case 'edit': setEditing(!S.editing); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'connect': S.tool = S.tool === 'connect' ? 'select' : 'connect'; S.connectFrom = null; updateChrome(); drawOverlay(); break;
      case 'helpbtn': $('#help').classList.add('open'); break;
    }
  });
  $('#help').addEventListener('click', function (e) { if (e.target.id === 'help' || e.target.id === 'helpclose') $('#help').classList.remove('open'); });
  $('#search').addEventListener('input', function (e) { runSearch(e.target.value); });
  $('#search').addEventListener('keydown', function (e) { if (e.key === 'Enter' && S.matches.length) { centerOn(S.matches[S.matchAt % S.matches.length]); S.matchAt++; } if (e.key === 'Escape') { e.target.value = ''; runSearch(''); e.target.blur(); } });
  function present() { var on = !document.body.classList.contains('present'); document.body.classList.toggle('present', on); try { if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); else if (!on && document.fullscreenElement) document.exitFullscreen(); } catch (err) { /* fullscreen optional */ } setTimeout(fit, 250); if (on) toast('Press Esc or P to leave presentation'); }
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && document.body.classList.contains('present')) { document.body.classList.remove('present'); setTimeout(fit, 100); } });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    var mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); doExport('html'); return; }
    if (typing) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (S.editing) duplicate(); return; }
    if (mod && e.key.toLowerCase() === 'a') { if (S.editing) { e.preventDefault(); var idx = MX.indexPage(page()); S.sel = new Set(page().cells.filter(function (c) { return (c.vertex && isUnit(c, idx.kids)) || c.edge; }).map(function (c) { return c.id; })); drawOverlay(); renderInspector(); } return; }
    if (mod) return;
    switch (e.key) {
      case 'Escape': $('#help').classList.remove('open'); closeMenus(); if (document.body.classList.contains('present')) present(); S.sel.clear(); S.focus = null; S.connectFrom = null; S.tool = 'select'; applyHighlight(); drawOverlay(); updateChrome(); break;
      case 'Delete': case 'Backspace': if (S.editing) { e.preventDefault(); removeSelected(); } break;
      case '+': case '=': zoomAt(1.25); break;
      case '-': case '_': zoomAt(0.8); break;
      case '0': fit(); break;
      case '1': zoomAt(1 / S.view.k); break;
      case '/': e.preventDefault(); $('#search').focus(); break;
      case '?': $('#help').classList.toggle('open'); break;
      case 'e': case 'E': setEditing(!S.editing); break;
      case 'l': case 'L': S.live = !S.live; render(); break;
      case 't': case 'T': setTheme(S.theme === 'dark' ? 'light' : 'dark'); break;
      case 'p': case 'P': present(); break;
      case 'c': case 'C': if (S.editing) { S.tool = S.tool === 'connect' ? 'select' : 'connect'; S.connectFrom = null; updateChrome(); drawOverlay(); } break;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
        if (S.editing && S.sel.size) {
          e.preventDefault(); pushUndo();
          var st = e.shiftKey ? 1 : 10, dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
          drag = { items: [], edges: [] }; beginMoveNoUndo(); drag.items.forEach(function (it) { it.c.geo.x = it.x + dx; it.c.geo.y = it.y + dy; }); drag.edges.forEach(function (it) { var g = it.c.geo; if (it.pts) g.points = it.pts.map(function (q) { return { x: q.x + dx, y: q.y + dy }; }); if (it.sp) g.sourcePoint = { x: it.sp.x + dx, y: it.sp.y + dy }; if (it.tp) g.targetPoint = { x: it.tp.x + dx, y: it.tp.y + dy }; }); drag = null; render();
        } else { var s2 = 60 / S.view.k; S.view.x += e.key === 'ArrowLeft' ? -s2 : e.key === 'ArrowRight' ? s2 : 0; S.view.y += e.key === 'ArrowUp' ? -s2 : e.key === 'ArrowDown' ? s2 : 0; applyView(); }
        break;
    }
  });
  function beginMoveNoUndo() { var u = S.undo.length; beginMove(); S.undo.length = u; }
  window.addEventListener('resize', function () { applyView(); drawOverlay(); });
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('click', function (e) { if (!e.target.closest('.menu')) closeMenus(); });

  render();
  fit();
  if (/[?&#]edit\b/.test(location.search + location.hash)) setEditing(true);
  // small scripting surface for automation and tests
  window.SFD = { state: S, xml: currentXml, html: selfHtml, svg: function (o) { return MX.renderSvg(page(), Object.assign({ theme: S.theme, padding: 24 }, o || {})).svg; }, setEditing: setEditing, select: function (ids) { S.sel = new Set([].concat(ids)); drawOverlay(); renderInspector(); }, addShape: addShape, connect: connect, remove: removeSelected, undo: undo, redo: redo, gotoPage: gotoPage, fit: fit, setTheme: setTheme, move: function (dx, dy) { drag = { items: [], edges: [] }; beginMove(); drag.items.forEach(function (it) { it.c.geo.x = it.x + dx; it.c.geo.y = it.y + dy; }); drag.edges.forEach(function (it) { var g = it.c.geo; if (it.pts) g.points = it.pts.map(function (q) { return { x: q.x + dx, y: q.y + dy }; }); }); drag = null; render(); } };
})();
