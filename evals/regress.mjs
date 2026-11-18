// Functional regression snapshot for the archistry skill: runs the CLI over every diagram type and
// the main commands, and records exit codes, output hashes and key lines. Run it on two copies of
// the skill and compare the JSON: any difference is a functional change.
// usage: node regress.mjs <skill-dir> <out.json>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const skill = path.resolve(process.argv[2]);
const outFile = process.argv[3];
const cli = path.join(skill, 'scripts', 'archistry.mjs');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-regress-'));
const run = (args, opts = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: opts.cwd || work, timeout: 180000 });
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
// strip the volatile parts (dates, versions) so equal output hashes equal
const norm = (s) => s.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, 'T').replace(/archistry \d+\.\d+\.\d+/g, 'archistry X');
const nsha = (f) => crypto.createHash('sha256').update(norm(fs.readFileSync(f, 'utf8'))).digest('hex').slice(0, 16);
const res = { types: {}, commands: {}, examples: {} };

const t = JSON.parse(run(['types', '--json']).stdout);
const list = Array.isArray(t) ? t : (t.types || Object.values(t));
const names = list.map((x) => x.name || x.id || x.type);
res.commands.typesCount = names.length;
res.commands.typesJsonHash = crypto.createHash('sha256').update(JSON.stringify(list)).digest('hex').slice(0, 16);

for (const n of names) {
  const spec = path.join(work, n + '.json');
  const init = run(['init', n, '-o', spec]);
  const r = { init: init.status, specHash: fs.existsSync(spec) ? nsha(spec) : null };
  if (fs.existsSync(spec)) {
    const b = run(['build', spec, '--format', 'drawio,html,svg', '--json']);
    r.build = b.status;
    try { const j = JSON.parse(b.stdout); r.ok = j.ok ?? j.status; r.errors = (j.errors || []).length; r.warnings = (j.warnings || []).length; } catch { r.buildOut = norm(b.stdout).slice(0, 300); }
    for (const ext of ['drawio', 'html', 'svg']) { const f = path.join(work, n + '.' + ext); r[ext] = fs.existsSync(f) ? nsha(f) : null; }
    const v = run(['validate', path.join(work, n + '.drawio'), '--json']);
    r.validate = v.status;
    // round trip: drawio -> html -> drawio keeps the model
    const c1 = path.join(work, n + '.rt.html'), c2 = path.join(work, n + '.rt.drawio');
    run(['convert', path.join(work, n + '.drawio'), '-o', c1]); run(['convert', c1, '-o', c2]);
    r.roundTrip = fs.existsSync(c2) ? nsha(c2) : null;
  }
  res.types[n] = r;
}
for (const q of [['icons', 'search', 'sales'], ['icons', 'list'], ['icons', 'show', 'product/sales_cloud'], ['types', '--stage', 'design'], ['--version']]) {
  const o = run(q); res.commands[q.join(' ')] = { code: o.status, out: crypto.createHash('sha256').update(norm(o.stdout + o.stderr)).digest('hex').slice(0, 16) };
}
const bad = run(['build', 'does-not-exist.json']); res.commands.missingSpec = bad.status;
// the shipped examples rebuild to the same files
const exDir = path.join(skill, 'examples');
if (fs.existsSync(exDir)) for (const f of fs.readdirSync(exDir).filter((x) => x.endsWith('.json'))) {
  const dst = path.join(work, 'ex-' + f); fs.copyFileSync(path.join(exDir, f), dst);
  const b = run(['build', dst, '--format', 'drawio,html', '--json']);
  res.examples[f] = { code: b.status, drawio: fs.existsSync(dst.replace(/json$/, 'drawio')) ? nsha(dst.replace(/json$/, 'drawio')) : null };
}
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
fs.rmSync(work, { recursive: true, force: true });
const bt = Object.values(res.types);
console.log(`types ${bt.length}; build ok ${bt.filter((x) => x.build === 0).length}; validate ok ${bt.filter((x) => x.validate === 0).length}; examples ${Object.keys(res.examples).length}`);
