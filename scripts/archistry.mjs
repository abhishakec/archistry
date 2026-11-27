#!/usr/bin/env node
// archistry — Salesforce diagrams from a JSON spec: draw.io + interactive HTML + PNG/JPG/SVG. Zero npm dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseMxfile, serializeMxfile, renderSvg, parseStyle } from './lib/mx.mjs';
import { makePalette, loadBrand, iconCatalog, resolveIcon, styleImage, SKILL_ROOT } from './lib/dsl.mjs';
import { TYPES, STAGES, resolveType, suggestTypes } from './lib/types.mjs';
import { validateFile } from './lib/validate.mjs';
import { unknownFieldNotes } from './lib/spec-fields.mjs';
import { buildHtml, extractModel } from './lib/html.mjs';
import { rasterize, findBrowser, findDrawioCli } from './lib/raster.mjs';
import { erdFromSfdx, mappingFromCsv, flowFromMetadata } from './lib/generators.mjs';
import { HARNESSES, detectHarnesses, setupProject } from './lib/setup.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, 'package.json'), 'utf8')).version;
const inflate = (b64) => decodeURIComponent(zlib.inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8'));
const SUPPORTED_SHAPES = new Set(['image', 'ellipse', 'doubleEllipse', 'rhombus', 'triangle', 'hexagon', 'parallelogram', 'step', 'cylinder', 'cylinder3', 'datastore', 'document', 'note', 'process', 'line', 'umlActor', 'umlLifeline', 'partialRectangle', 'swimlane', 'text', 'group', 'rectangle', 'label', 'table', 'tableRow', 'mxgraph.bootstrap.rrect']);

function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o') opt.out = argv[++i];
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const k = (eq > 0 ? a.slice(2, eq) : a.slice(2)).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      if (eq > 0) opt[k] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('-') && !['json', 'strict', 'allFields', 'transparent', 'stdout', 'quiet', 'noValidate', 'force', 'highlight', 'animate'].includes(k)) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}
const fail = (msg, code = 1) => { console.error('error: ' + msg); process.exit(code); };
const rel = (p) => { const r = path.relative(process.cwd(), p); return r && !r.startsWith('..') ? r : p; };

function readModel(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const xml = /\.html?$/i.test(file) || /^\s*<!doctype html/i.test(raw) ? extractModel(raw) : raw;
  return parseMxfile(xml, { inflate });
}
function unsupportedShapes(model) {
  const seen = new Set();
  for (const p of model.pages) for (const c of p.cells) { const s = c.style && c.style.shape; if (s && !SUPPORTED_SHAPES.has(s) && !/^mxgraph\.bootstrap\.rrect/.test(s)) seen.add(s); }
  return [...seen];
}

/** Viewer defaults: CLI flags win over the spec's "viewer" field. Both default to off. */
const flag = (v) => v === true || (typeof v === 'string' && !/^(false|off|no|0)$/i.test(v));
export function viewerOptions(spec, opt = {}) {
  const v = (spec && typeof spec.viewer === 'object' && spec.viewer) || {};
  return { highlight: opt.highlight !== undefined ? flag(opt.highlight) : flag(v.highlight), animate: opt.animate !== undefined ? flag(opt.animate) : flag(v.animate) };
}
/** Adds draw.io flow animation to every connector (only used when animate is on). */
function addFlowAnimation(pages) {
  for (const p of pages) for (const c of p.cells) if (c.edge) c.style = typeof c.style === 'string' ? c.style.replace(/;?$/, ';') + 'flowAnimation=1;' : Object.assign({}, c.style, { flowAnimation: '1' });
}

/** spec object -> { model, pages, type, warnings, brand } */
export function buildSpec(spec, { cwd = process.cwd(), animate } = {}) {
  if (!spec || typeof spec !== 'object') throw new Error('spec must be a JSON object');
  const t = resolveType(spec.type);
  if (!t) { const s = suggestTypes(spec.type); throw new Error(`unknown diagram type "${spec.type}".${s.length ? ' Did you mean: ' + s.join(', ') + '?' : ''} Run "archistry types" for the full list.`); }
  const merged = Object.assign({}, t.defaults, spec, { type: t.name === 'class-diagram' ? 'class-diagram' : spec.type });
  if (t.defaults.mode && !spec.mode) merged.mode = t.defaults.mode;
  // matrix presets are keyed by canonical name
  if (t.engine === 'matrix' || t.engine === 'tables') merged.type = t.name;
  const brand = loadBrand(spec, cwd);
  const palette = makePalette(brand);
  const pages = t.fn(merged, { palette });
  if (animate === undefined) animate = viewerOptions(spec).animate;
  if (animate) addFlowAnimation(pages);
  const warnings = [];
  for (const p of pages) for (const w of p.warnings || []) if (!warnings.includes(w)) warnings.push(w);
  for (const w of pages.warnings || []) if (!warnings.includes(w)) warnings.push(w);
  // typo hints only: appended after the pages are built, so they cannot change the generated diagram
  for (const w of unknownFieldNotes(spec)) warnings.push(w);
  const xml = serializeMxfile({ pages });
  return { xml, model: parseMxfile(xml), type: t, warnings, brand: palette.name, title: spec.title || t.name };
}

function renderPages(model, { theme, scale, transparent, pages }) {
  const list = pages === 'all' || pages === undefined ? model.pages.map((_, i) => i) : [].concat(pages);
  return list.map((i) => { const r = renderSvg(model.pages[i], { theme, background: transparent ? 'transparent' : undefined, padding: 24 }); return { index: i, svg: r.svg, width: r.width, height: r.height, scale: scale || 2 }; });
}
function writeImages(model, base, formats, o) {
  const out = [];
  const rendered = renderPages(model, o);
  const multi = rendered.length > 1;
  const name = (r, ext) => `${base}${multi ? '-' + (r.index + 1) : ''}.${ext}`;
  if (formats.includes('svg')) for (const r of rendered) { fs.writeFileSync(name(r, 'svg'), r.svg); out.push(name(r, 'svg')); }
  const ras = formats.filter((f) => f === 'png' || f === 'jpg' || f === 'jpeg');
  if (ras.length) {
    const jobs = [];
    for (const f of ras) for (const r of rendered) jobs.push({ svg: r.svg, width: r.width, height: r.height, scale: r.scale, format: f, background: o.theme === 'dark' ? '#0b1526' : '#ffffff', _name: name(r, f === 'jpeg' ? 'jpg' : f) });
    const bufs = rasterize(jobs);
    bufs.forEach((b, i) => { fs.writeFileSync(jobs[i]._name, b); out.push(jobs[i]._name); });
  }
  return out;
}
function printFindings(res, { json, quiet } = {}) {
  if (json) return;
  for (const f of res.findings) if (!(quiet && f.level !== 'ERROR')) console.log(`  ${f.level.padEnd(7)} ${f.code.padEnd(18)} ${f.page ? '[' + f.page + '] ' : ''}${f.message}`);
}

/* ---------------------------------------------------------------- commands */
const commands = {
  build(pos, opt) {
    const specPath = pos[0];
    if (!specPath) fail('usage: archistry build <spec.json> [-o <output base>] [--format drawio,html,png,jpg,svg] [--theme light|dark] [--scale 2] [--highlight] [--animate]');
    let spec;
    try { spec = JSON.parse(specPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(specPath, 'utf8')); } catch (e) { fail(`could not read spec ${specPath}: ${e.message}`); }
    let built;
    const vo = viewerOptions(spec, opt);
    try { built = buildSpec(spec, { cwd: specPath === '-' ? process.cwd() : path.dirname(path.resolve(specPath)), animate: vo.animate }); } catch (e) { fail(e.message, 2); }
    let base = opt.out ? opt.out.replace(/\.(drawio|html|png|jpe?g|svg|json)$/i, '') : (specPath === '-' ? 'diagram' : specPath.replace(/\.json$/i, '').replace(/\.spec$/i, ''));
    if (opt.out && fs.existsSync(opt.out) && fs.statSync(opt.out).isDirectory()) base = path.join(opt.out, path.basename(specPath === '-' ? 'diagram' : specPath).replace(/\.json$/i, ''));
    fs.mkdirSync(path.dirname(path.resolve(base)), { recursive: true });
    const formats = String(opt.format || 'drawio,html').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).flatMap((f) => (f === 'all' ? ['drawio', 'html', 'png', 'svg'] : f === 'both' ? ['drawio', 'html'] : [f]));
    const res = validateFile(built.model);
    const files = [];
    if (formats.includes('drawio')) { fs.writeFileSync(base + '.drawio', built.xml); files.push(base + '.drawio'); }
    if (formats.includes('html')) { fs.writeFileSync(base + '.html', buildHtml(built.xml, { title: built.title, theme: opt.theme, description: spec.subtitle, highlight: vo.highlight, animate: vo.animate })); files.push(base + '.html'); }
    const imgs = formats.filter((f) => ['png', 'jpg', 'jpeg', 'svg'].includes(f));
    let imgError = null;
    if (imgs.length) { try { files.push(...writeImages(built.model, base, imgs, { theme: opt.theme, scale: +opt.scale || 2, transparent: !!opt.transparent, pages: 'all' })); } catch (e) { imgError = e.message; } }
    const summary = { ok: res.ok && !imgError, type: built.type.name, engine: built.type.engine, pages: built.model.pages.length, files: files.map((f) => path.resolve(f)), stats: res.stats, errors: res.errors, warnings: res.warnings, findings: res.findings, notes: built.warnings, brand: built.brand || null, imageError: imgError };
    if (opt.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(`${res.ok ? 'OK' : 'FAILED'}  ${built.type.name}  ·  ${built.model.pages.length} page${built.model.pages.length > 1 ? 's' : ''}  ·  ${res.stats.map((s) => `${s.nodes} boxes, ${s.edges} connectors, ${s.crossings} crossings`).join(' | ')}${built.brand ? '  ·  brand: ' + built.brand : ''}`);
      for (const f of files) console.log('  wrote ' + rel(f));
      for (const w of built.warnings) console.log('  NOTE    ' + w);
      printFindings(res, opt);
      if (imgError) console.log('  ERROR   image export: ' + imgError);
      if (res.errors) console.log(`\n${res.errors} error(s): fix the spec and rebuild — do not hand this diagram over.`);
      else if (res.warnings) console.log(`\n${res.warnings} warning(s): review them; most are fixed by shorter labels, fewer links per box, or splitting the diagram.`);
    }
    process.exit(res.ok && !imgError ? (opt.strict && res.warnings ? 3 : 0) : 2);
  },

  validate(pos, opt) {
    if (!pos[0]) fail('usage: archistry validate <file.drawio|file.html|spec.json> [--json] [--strict]');
    let model, specNotes = []; // specNotes: unknown-field hints, only for spec.json input
    try {
      if (/\.json$/i.test(pos[0])) { const b = buildSpec(JSON.parse(fs.readFileSync(pos[0], 'utf8')), { cwd: path.dirname(path.resolve(pos[0])) }); model = b.model; specNotes = b.warnings.filter((w) => /^unknown field/.test(w)); }
      else model = readModel(pos[0]);
    } catch (e) { if (opt.json) { console.log(JSON.stringify({ ok: false, errors: 1, warnings: 0, findings: [{ level: 'ERROR', code: 'xml-parse', message: e.message }] }, null, 2)); process.exit(2); } fail(e.message, 2); }
    const res = validateFile(model);
    const odd = unsupportedShapes(model);
    if (opt.json) console.log(JSON.stringify(Object.assign({}, res, { approximatedShapes: odd }), null, 2));
    else {
      console.log(`${res.ok ? (res.warnings ? 'OK with warnings' : 'OK') : 'FAILED'}  ${rel(pos[0])}  ·  ${res.errors} error(s), ${res.warnings} warning(s)  ·  ${res.stats.map((s) => `${s.page}: ${s.nodes} boxes, ${s.edges} connectors, ${s.crossings} crossings`).join(' | ')}`);
      printFindings(res, opt);
      for (const w of specNotes) console.log('  NOTE    ' + w);
      if (odd.length) console.log(`  NOTE    draw.io stencils the HTML/image renderer approximates as rectangles: ${odd.join(', ')}`);
    }
    process.exit(!res.ok ? 2 : opt.strict && res.warnings ? 3 : 0);
  },

  convert(pos, opt) {
    const inp = pos[0], out = opt.out || pos[1];
    if (!inp || !out) fail('usage: archistry convert <in.drawio|in.html> -o <out.html|out.drawio> [--highlight] [--animate]');
    let model;
    try { model = readModel(inp); } catch (e) { fail(e.message, 2); }
    const vo = viewerOptions(null, opt);
    if (vo.animate) addFlowAnimation(model.pages);
    const xml = serializeMxfile(model);
    if (/\.html?$/i.test(out)) { const title = opt.title || path.basename(inp).replace(/\.(drawio|html?|xml)$/i, '').replace(/[-_]+/g, ' '); fs.writeFileSync(out, buildHtml(xml, { title, theme: opt.theme, highlight: vo.highlight, animate: vo.animate })); }
    else fs.writeFileSync(out, xml);
    const odd = unsupportedShapes(model);
    console.log(`wrote ${rel(out)}  ·  ${model.pages.length} page(s)`);
    if (odd.length && /\.html?$/i.test(out)) console.log(`NOTE: ${odd.length} draw.io stencil type(s) are drawn as plain rectangles in HTML: ${odd.join(', ')}. The .drawio file itself is unchanged.`);
  },

  export(pos, opt) {
    const inp = pos[0];
    if (!inp) fail('usage: archistry export <in.drawio|in.html|spec.json> [-o out.png] [--format png,jpg,svg] [--scale 2] [--theme dark] [--page 1|all] [--transparent] [--engine auto|builtin|drawio]');
    let model;
    try { model = /\.json$/i.test(inp) ? buildSpec(JSON.parse(fs.readFileSync(inp, 'utf8')), { cwd: path.dirname(path.resolve(inp)) }).model : readModel(inp); } catch (e) { fail(e.message, 2); }
    let formats = opt.format ? String(opt.format).toLowerCase().split(',') : null;
    let base = inp.replace(/\.(drawio|html?|json|xml)$/i, '');
    if (opt.out) { const m = opt.out.match(/\.(png|jpe?g|svg)$/i); if (m) { base = opt.out.slice(0, -m[0].length); if (!formats) formats = [m[1].toLowerCase()]; } else base = opt.out; }
    if (!formats) formats = ['png'];
    const pages = opt.page === undefined || opt.page === 'all' ? 'all' : [Math.max(0, Math.min(model.pages.length - 1, (+opt.page || 1) - 1))];
    const odd = unsupportedShapes(model);
    const cli = findDrawioCli();
    const engine = opt.engine || 'auto';
    if ((engine === 'drawio' || (engine === 'auto' && odd.length && cli)) && /\.drawio$/i.test(inp)) {
      if (!cli) fail('draw.io desktop was not found. Install it or use --engine builtin.');
      const made = [];
      for (const f of formats) { const outFile = `${base}.${f}`; execFileSync(cli, ['-x', '-f', f === 'jpeg' ? 'jpg' : f, '-s', String(+opt.scale || 2), ...(pages === 'all' ? [] : ['-p', String(pages[0])]), ...(opt.transparent ? ['-t'] : []), '-o', outFile, inp], { stdio: 'ignore' }); made.push(outFile); }
      console.log(made.map((f) => 'wrote ' + rel(f)).join('\n') + '\n(engine: draw.io desktop)');
      return;
    }
    let files;
    try { files = writeImages(model, base, formats, { theme: opt.theme, scale: +opt.scale || 2, transparent: !!opt.transparent, pages }); } catch (e) { fail(e.message, 2); }
    for (const f of files) console.log('wrote ' + rel(f));
    if (odd.length) console.log(`NOTE: ${odd.length} draw.io stencil type(s) were approximated as rectangles (${odd.join(', ')}). For pixel-exact output of hand-edited files install draw.io desktop (used automatically) or run "Draw.io: Convert To…" in VS Code.`);
  },

  types(pos, opt) {
    if (opt.json) { console.log(JSON.stringify(TYPES.map((t) => ({ type: t.name, stage: t.stage, engine: t.engine, answers: t.answers, aliases: t.aliases, example: `examples/${t.name}.json` })), null, 2)); return; }
    const stage = opt.stage ? String(opt.stage).toLowerCase() : null;
    for (const s of STAGES) {
      if (stage && s.toLowerCase() !== stage) continue;
      console.log(`\n${s.toUpperCase()}`);
      for (const t of TYPES.filter((x) => x.stage === s)) console.log(`  ${t.name.padEnd(28)} ${t.answers}`);
    }
    console.log(`\n${TYPES.length} diagram types. Starter spec: archistry init <type>   ·   spec reference: references/<engine>.md`);
  },

  init(pos, opt) {
    const t = resolveType(pos[0]);
    if (!t) fail(`unknown type "${pos[0] || ''}". Run "archistry types".`);
    const ex = path.join(SKILL_ROOT, 'examples', t.name + '.json');
    if (!fs.existsSync(ex)) fail(`no starter spec for ${t.name}`);
    let text = fs.readFileSync(ex, 'utf8');
    // Starters always use the default Salesforce header card, whatever header the example shows.
    try { const s = JSON.parse(text); if (s.header !== undefined && s.header !== 'card') { delete s.header; text = JSON.stringify(s, null, 2) + '\n'; } } catch { /* leave as is */ }
    if (opt.out) { if (fs.existsSync(opt.out) && !opt.force) fail(`${opt.out} already exists (use --force to overwrite)`); fs.writeFileSync(opt.out, text); console.log(`wrote ${rel(opt.out)}  ·  engine: ${t.engine}  ·  reference: references/${t.engine}.md`); }
    else process.stdout.write(text);
  },

  icons(pos, opt) {
    const cat = iconCatalog();
    const sub = pos[0] || 'list';
    if (sub === 'search') {
      const q = String(pos[1] || '').toLowerCase();
      const hits = Object.keys(cat).filter((k) => k.toLowerCase().includes(q) || String(cat[k].label).toLowerCase().includes(q));
      if (!hits.length) console.log(`no icon matches "${q}" — use a plain card rather than a wrong icon`);
      for (const k of hits) console.log(`${k.padEnd(42)} ${cat[k].label}`);
    } else if (sub === 'show' || sub === 'style') {
      const r = resolveIcon(pos[1]);
      if (!r) fail(`icon not found: ${pos[1]}`);
      console.log(`shape=image;html=1;aspect=fixed;imageAspect=1;image=${styleImage(r.entry.uri)};`);
    } else {
      const want = sub === 'list' ? pos[1] : sub;
      const groups = {};
      for (const k of Object.keys(cat)) { const [c, n] = k.split('/'); (groups[c] = groups[c] || []).push(n); }
      if (opt.json) { console.log(JSON.stringify(groups, null, 2)); return; }
      for (const c of Object.keys(groups)) { if (want && c !== want) continue; console.log(`\n${c}/  (${groups[c].length})\n  ${groups[c].join('  ')}`); }
      console.log(`\n${Object.keys(cat).length} icons. Use "<category>/<name>" as the icon value in a spec.`);
    }
  },

  'erd-from-sfdx'(pos, opt) {
    if (!pos[0]) fail('usage: archistry erd-from-sfdx <sfdx-project-dir> -o spec.json [--objects A,B__c] [--include-fields 8] [--all-fields]');
    let spec;
    try { spec = erdFromSfdx(pos[0], { objects: opt.objects ? String(opt.objects).split(',').map((s) => s.trim()) : null, includeFields: +opt.includeFields || 8, allFields: !!opt.allFields, title: opt.title }); } catch (e) { fail(e.message, 2); }
    emitSpec(spec, opt);
  },
  'mapping-from-csv'(pos, opt) {
    if (!pos[0]) fail('usage: archistry mapping-from-csv <mappings.csv> -o spec.json [--title "..."]');
    let spec;
    try { spec = mappingFromCsv(fs.readFileSync(pos[0], 'utf8'), { title: opt.title }); } catch (e) { fail(e.message, 2); }
    emitSpec(spec, opt);
  },
  'flow-from-metadata'(pos, opt) {
    if (!pos[0]) fail('usage: archistry flow-from-metadata <My_Flow.flow-meta.xml> -o spec.json [--title "..."]');
    let spec;
    try { spec = flowFromMetadata(fs.readFileSync(pos[0], 'utf8'), { title: opt.title }); } catch (e) { fail(e.message, 2); }
    emitSpec(spec, opt);
  },

  doctor() {
    const major = +process.versions.node.split('.')[0];
    const b = findBrowser(), dcli = findDrawioCli();
    console.log(`archistry ${VERSION}`);
    console.log(`  node            ${process.versions.node}  ${major >= 18 ? 'ok' : 'TOO OLD — Node 18+ required'}`);
    console.log(`  icon catalog    ${Object.keys(iconCatalog()).length} icons`);
    console.log(`  diagram types   ${TYPES.length}`);
    console.log(`  browser (PNG/JPG export)   ${b || 'not found — install Chrome/Edge/Chromium or set ARCHISTRY_BROWSER; draw.io, HTML and SVG output still work'}`);
    console.log(`  draw.io desktop (optional) ${dcli || 'not found — only needed for pixel-exact export of hand-edited files with exotic stencils'}`);
    let okAll = major >= 18;
    try { const r = buildSpec({ type: 'solution-architecture', title: 'Self-test', children: [{ zone: 'A', kind: 'salesforce', children: [{ id: 'a', label: 'One' }] }, { zone: 'B', kind: 'external', children: [{ id: 'b', label: 'Two' }] }], links: [{ from: 'a', to: 'b', label: 'API' }] }); const v = validateFile(r.model); console.log(`  self-test       ${v.ok ? 'ok' : 'FAILED'} (${v.stats[0].nodes} boxes, ${v.stats[0].edges} connector)`); okAll = okAll && v.ok; } catch (e) { console.log('  self-test       FAILED: ' + e.message); okAll = false; }
    process.exit(okAll ? 0 : 1);
  },

  setup(pos, opt) {
    const project = path.resolve(pos[0] || '.');
    if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) fail(`project folder not found: ${project}`);
    // the skill as the user reached it (keeps a junction/symlink path inside the project), else its real folder
    const invoked = process.argv[1] && /archistry\.mjs$/.test(process.argv[1]) ? path.resolve(path.dirname(process.argv[1]), '..') : SKILL_ROOT;
    const all = Object.keys(HARNESSES);
    let list;
    if (!opt.harness || opt.harness === 'auto') {
      list = detectHarnesses(project);
      if (!list.length) list = ['agents'];
    } else list = opt.harness === 'all' ? all : String(opt.harness).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    let res;
    try { res = setupProject(project, invoked, { harnesses: list, remove: !!opt.remove, dryRun: !!opt.dryRun }); } catch (e) { fail(e.message); }
    if (opt.json) { console.log(JSON.stringify(res, null, 2)); return; }
    for (const r of res) console.log(`${opt.dryRun ? 'would be ' : ''}${r.action.padEnd(18)} ${HARNESSES[r.harness].label.padEnd(48)} ${rel(r.file)}`);
    if (!opt.remove && !res.portable) console.log(`\nNOTE  the skill is outside this project and your home folder, so the block points at ${res.skill}: that path only works on this machine. Install the skill inside the project (or under your home folder) before committing these files.`);
    if (!opt.dryRun && !opt.remove) console.log(`\nDiagram requests in this project now go to Archistry. Re-run to refresh, --remove to undo. Harnesses: ${all.join(', ')} (--harness a,b | all | auto).`);
  },

  help() {
    console.log(`archistry ${VERSION} — Salesforce diagrams as draw.io + interactive HTML + images

  archistry types [--stage discover|architect|design|agentforce|build|test|release] [--json]
  archistry init <type> [-o spec.json]                 starter spec for a diagram type
  archistry build <spec.json> [-o base] [--format drawio,html,png,jpg,svg] [--theme dark] [--scale 2] [--highlight] [--animate] [--json] [--strict]
  archistry validate <file.drawio|file.html|spec.json> [--json] [--strict]
  archistry convert <in.drawio|in.html> -o <out.html|out.drawio> [--highlight] [--animate]
  archistry export <in.drawio|in.html|spec.json> -o out.png|out.jpg|out.svg [--scale 2] [--theme dark] [--page N] [--transparent]
  archistry icons search <text> | list [category] | show <key>
  archistry erd-from-sfdx <project-dir> -o spec.json [--objects A,B__c] [--include-fields 8]
  archistry mapping-from-csv <mappings.csv> -o spec.json
  archistry flow-from-metadata <X.flow-meta.xml> -o spec.json
  archistry doctor
  archistry setup [project-dir] [--harness auto|all|claude,copilot,agents,gemini,cursor,windsurf] [--dry-run] [--remove]
                                                       add an "always use Archistry for diagrams" block to the project's agent instructions

Exit codes: 0 ok · 2 failed (invalid spec or validation errors) · 3 warnings with --strict`);
  },
};
function emitSpec(spec, opt) {
  const text = JSON.stringify(spec, null, 2) + '\n';
  if (opt.out) { fs.writeFileSync(opt.out, text); console.log(`wrote ${rel(opt.out)}  ·  next: node ${rel(path.join(HERE, 'archistry.mjs'))} build ${rel(opt.out)}`); }
  else process.stdout.write(text);
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); // realpath: skill may be installed as a symlink/junction
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opt } = parseArgs(rest);
  if (!cmd || cmd === '-h' || cmd === '--help') commands.help();
  else if (cmd === '-v' || cmd === '--version') console.log(VERSION);
  else if (commands[cmd]) commands[cmd](pos, opt);
  else fail(`unknown command "${cmd}". Run "archistry help".`);
}
void parseStyle;
