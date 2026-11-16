// generators.mjs — deterministic spec generators from real project inputs:
//   SFDX source -> data-model spec, CSV -> data-cloud-mapping spec, Flow metadata -> flow-logic spec.
import fs from 'node:fs';
import path from 'node:path';
import { parseXml } from './mx.mjs';

const child = (n, tag) => n.children.find((c) => c.tag === tag);
const kids = (n, tag) => n.children.filter((c) => c.tag === tag);
const txt = (n, tag) => { const c = n && child(n, tag); return c ? (c.text || '').trim() : ''; };

function walk(dir, hit, depth = 0) {
  if (depth > 12) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.sfdx' || e.name === '.sf') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, hit, depth + 1); else hit(p, e.name);
  }
}

/* ------------------------------------------------------------ SFDX -> ERD */
export function erdFromSfdx(projectDir, { objects = null, includeFields = 8, allFields = false, title = null } = {}) {
  const objs = new Map(); // api -> {label, fields:[]}
  const get = (api) => { if (!objs.has(api)) objs.set(api, { api, label: null, fields: [], defined: false }); return objs.get(api); };
  const readField = (f) => ({ name: txt(f, 'fullName'), label: txt(f, 'label'), type: txt(f, 'type'), refTo: txt(f, 'referenceTo'), required: txt(f, 'required') === 'true', externalId: txt(f, 'externalId') === 'true', relName: txt(f, 'relationshipName') });
  walk(projectDir, (p, name) => {
    const norm = p.replace(/\\/g, '/');
    let m = norm.match(/\/objects\/([^/]+)\/\1\.object-meta\.xml$/);
    if (m) { const o = get(m[1]); o.defined = true; const r = parseXml(fs.readFileSync(p, 'utf8')); const root = r.children.find((c) => c.tag === 'CustomObject'); if (root) o.label = txt(root, 'label') || o.label; return; }
    m = norm.match(/\/objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/);
    if (m) { const o = get(m[1]); o.defined = true; const r = parseXml(fs.readFileSync(p, 'utf8')); const root = r.children.find((c) => c.tag === 'CustomField'); if (root) { const f = readField(root); if (!f.name) f.name = m[2]; o.fields.push(f); } return; }
    if (/\.object$/.test(name) && /\/objects\//.test(norm)) { const api = name.replace(/\.object$/, ''); const o = get(api); o.defined = true; const r = parseXml(fs.readFileSync(p, 'utf8')); const root = r.children.find((c) => c.tag === 'CustomObject'); if (root) { o.label = txt(root, 'label') || o.label; for (const f of kids(root, 'fields')) o.fields.push(readField(f)); } }
  });
  if (!objs.size) throw new Error(`no object metadata found under ${projectDir} (expected **/objects/<Object>/...)`);
  let keep = new Set([...objs.values()].filter((o) => o.defined).map((o) => o.api));
  if (objects && objects.length) {
    const want = new Set(objects);
    keep = new Set([...keep].filter((a) => want.has(a)));
    for (const a of [...keep]) for (const f of objs.get(a).fields) if (f.refTo) keep.add(f.refTo);
    for (const o of objs.values()) if (o.defined && o.fields.some((f) => want.has(f.refTo))) keep.add(o.api);
  } else for (const o of [...objs.values()]) for (const f of o.fields) if (f.refTo && (f.type === 'Lookup' || f.type === 'MasterDetail')) keep.add(f.refTo);
  const entities = [], relationships = [];
  const pretty = (api) => api.replace(/__(c|x|e|mdt|b|dlm|dll)$/, '').replace(/^[A-Za-z0-9]+__/, '').replace(/_/g, ' ');
  for (const api of keep) {
    const o = objs.get(api) || { api, fields: [], label: null };
    const rel = o.fields.filter((f) => f.type === 'Lookup' || f.type === 'MasterDetail');
    const rest = o.fields.filter((f) => !rel.includes(f));
    const ordered = [...o.fields.filter((f) => f.externalId), ...rel, ...rest.filter((f) => !f.externalId && f.required), ...rest.filter((f) => !f.externalId && !f.required)];
    const shown = allFields ? ordered : ordered.slice(0, includeFields);
    entities.push({ id: api, label: o.label || pretty(api), api, fields: shown.map((f) => ({ name: f.name, type: f.type === 'Lookup' || f.type === 'MasterDetail' ? `${f.type}(${f.refTo})` : f.type, key: f.externalId || undefined, required: f.required || undefined })), more: ordered.length - shown.length || undefined });
    for (const f of rel) if (f.refTo && keep.has(f.refTo)) relationships.push({ from: api, to: f.refTo, type: f.type === 'MasterDetail' ? 'master-detail' : f.required ? 'required-lookup' : 'lookup', label: f.name });
  }
  return { type: 'data-model', title: title || `${path.basename(path.resolve(projectDir))} — Data Model`, subtitle: `Generated from SFDX source · ${entities.length} objects · ${relationships.length} relationships`, entities, relationships };
}

/* ---------------------------------------------------------- CSV -> mapping */
export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' && false) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}
export function mappingFromCsv(csvText, { title = null } = {}) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one mapping row');
  const head = rows[0].map((c) => c.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const col = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const ci = { sys: col('source_system', 'system'), sobj: col('source_object', 'source', 'dlo', 'source_dlo'), sfld: col('source_field', 'dlo_field'), tobj: col('target_dmo', 'target_object', 'dmo', 'target'), tfld: col('target_field', 'dmo_field'), cat: col('category'), type: col('mapping_type', 'transformation', 'transform', 'rule'), mid: col('dlo_object', 'staging_object'), midf: col('dlo_field_name', 'staging_field') };
  for (const k of ['sobj', 'sfld', 'tobj', 'tfld']) if (ci[k] < 0) throw new Error(`CSV is missing a required column. Required: source_object, source_field, target_dmo, target_field (optional: source_system, category, mapping_type). Found: ${head.join(', ')}`);
  const src = new Map(), tgt = new Map(), maps = [];
  const table = (m, key, label, extra) => { if (!m.has(key)) m.set(key, Object.assign({ id: key, label, fields: [] }, extra)); return m.get(key); };
  const slug = (p, s) => p + '_' + s.replace(/[^A-Za-z0-9]+/g, '_');
  for (const r of rows.slice(1)) {
    const g = (i) => (i >= 0 && r[i] !== undefined ? r[i].trim() : '');
    const so = g(ci.sobj), sf = g(ci.sfld), to = g(ci.tobj), tf = g(ci.tfld);
    if (!so || !sf || !to || !tf) continue;
    const s = table(src, slug('src', so), so, g(ci.sys) ? { api: g(ci.sys) } : {});
    const t = table(tgt, slug('dmo', to), to, g(ci.cat) ? { api: g(ci.cat) } : {});
    if (!s.fields.includes(sf)) s.fields.push(sf);
    if (!t.fields.includes(tf)) t.fields.push(tf);
    const mt = g(ci.type);
    const direct = !mt || /^direct$/i.test(mt);
    maps.push(Object.assign({ from: `${s.id}.${sf}`, to: `${t.id}.${tf}` }, direct ? {} : { label: mt.replace(/^formula:\s*/i, ''), kind: /key|identity/i.test(mt) ? 'key' : /lookup/i.test(mt) ? 'lookup' : 'transform' }));
  }
  if (!maps.length) throw new Error('no usable mapping rows found in the CSV');
  return { type: 'data-cloud-mapping', title: title || 'Data Cloud Field Mapping', subtitle: `${maps.length} field mappings · ${src.size} source objects · ${tgt.size} data model objects`, stages: [{ label: 'Source / Data Lake Objects', kind: 'salesforce', tables: [...src.values()] }, { label: 'Data Model Objects', kind: 'data', tables: [...tgt.values()] }], maps };
}

/* ------------------------------------------------ Flow metadata -> flowchart */
const FLOW_ELEMENTS = {
  decisions: { kind: 'gateway' }, screens: { kind: 'user', sub: 'Screen', icon: 'utility/desktop' }, assignments: { kind: 'task', sub: 'Assignment' },
  recordLookups: { kind: 'system', sub: 'Get Records', icon: 'utility/database' }, recordCreates: { kind: 'system', sub: 'Create Records', icon: 'utility/database' },
  recordUpdates: { kind: 'system', sub: 'Update Records', icon: 'utility/database' }, recordDeletes: { kind: 'system', sub: 'Delete Records', icon: 'utility/database' },
  actionCalls: { kind: 'system', sub: 'Action', icon: 'standard/apex' }, subflows: { kind: 'subprocess', sub: 'Subflow' }, loops: { kind: 'gateway' },
  waits: { kind: 'event' }, collectionProcessors: { kind: 'task', sub: 'Collection' }, customErrors: { kind: 'task', sub: 'Custom Error', color: 'danger' },
  transforms: { kind: 'task', sub: 'Transform' }, orchestratedStages: { kind: 'subprocess', sub: 'Stage' }, apexPluginCalls: { kind: 'system', sub: 'Apex Plugin', icon: 'standard/apex' }, recordRollbacks: { kind: 'system', sub: 'Roll Back' },
};
export function flowFromMetadata(xmlText, { title = null } = {}) {
  const doc = parseXml(xmlText);
  const flow = doc.children.find((c) => c.tag === 'Flow');
  if (!flow) throw new Error('not a Flow metadata file: no <Flow> root element');
  const nodes = [], edges = [];
  const target = (n, tag) => { const c = n && child(n, tag); return c ? txt(c, 'targetReference') : ''; };
  for (const [tag, def] of Object.entries(FLOW_ELEMENTS)) {
    for (const el of kids(flow, tag)) {
      const name = txt(el, 'name');
      if (!name) continue;
      const label = txt(el, 'label') || name;
      const node = { id: name, kind: def.kind, label: tag === 'loops' ? `Loop: ${label}` : label };
      if (def.sub && def.kind !== 'gateway') node.sub = tag === 'actionCalls' ? `Action: ${txt(el, 'actionName') || txt(el, 'actionType')}` : tag === 'subflows' ? `Subflow: ${txt(el, 'flowName')}` : /^record/.test(tag) && txt(el, 'object') ? `${def.sub}: ${txt(el, 'object')}` : def.sub;
      if (def.icon) node.icon = def.icon;
      if (def.color) node.color = def.color;
      nodes.push(node);
      if (tag === 'decisions') {
        for (const rule of kids(el, 'rules')) { const t = target(rule, 'connector'); if (t) edges.push({ from: name, to: t, label: txt(rule, 'label') || txt(rule, 'name') }); }
        const dt = target(el, 'defaultConnector'); if (dt) edges.push({ from: name, to: dt, label: txt(el, 'defaultConnectorLabel') || 'Default' });
      } else if (tag === 'loops') {
        const nx = target(el, 'nextValueConnector'); if (nx) edges.push({ from: name, to: nx, label: 'For each' });
        const dn = target(el, 'noMoreValuesConnector'); if (dn) edges.push({ from: name, to: dn, label: 'After last' });
      } else if (tag === 'waits') {
        for (const ev of kids(el, 'waitEvents')) { const t = target(ev, 'connector'); if (t) edges.push({ from: name, to: t, label: txt(ev, 'label') }); }
        const dt = target(el, 'defaultConnector'); if (dt) edges.push({ from: name, to: dt, label: 'Default' });
      } else { const t = target(el, 'connector'); if (t) edges.push({ from: name, to: t }); }
      const ft = target(el, 'faultConnector'); if (ft) edges.push({ from: name, to: ft, label: 'Fault', kind: 'exception' });
    }
  }
  const start = child(flow, 'start');
  let trigger = txt(flow, 'processType') || 'Flow';
  if (start) {
    const obj = txt(start, 'object'), tt = txt(start, 'triggerType'), rt = txt(start, 'recordTriggerType');
    if (obj) trigger = `${obj} · ${[rt, tt].filter(Boolean).join(' · ') || 'record-triggered'}`;
    else if (txt(start, 'schedule') || child(start, 'schedule')) trigger = 'Scheduled';
    nodes.unshift({ id: '__start', kind: 'start', label: trigger.length > 28 ? 'Start' : trigger });
    const t = target(start, 'connector'); if (t) edges.push({ from: '__start', to: t });
    for (const sp of kids(start, 'scheduledPaths')) { const st = target(sp, 'connector'); if (st) edges.push({ from: '__start', to: st, label: txt(sp, 'label') || 'Scheduled path' }); }
  } else {
    const se = txt(flow, 'startElementReference');
    nodes.unshift({ id: '__start', kind: 'start', label: 'Start' });
    if (se) edges.push({ from: '__start', to: se });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const clean = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const hasOut = new Set(clean.map((e) => e.from));
  let ends = 0;
  for (const n of [...nodes]) if (!hasOut.has(n.id) && n.kind !== 'start') { if (ends++ === 0) nodes.push({ id: '__end', kind: 'end', label: 'End' }); clean.push({ from: n.id, to: '__end' }); }
  const label = txt(flow, 'label') || 'Flow';
  return { type: 'flow-logic', title: title || `${label} — Flow Logic`, subtitle: `${trigger} · ${nodes.length - 1 - (ends ? 1 : 0)} elements · generated from Flow metadata`, direction: 'TB', nodes, edges: clean };
}
