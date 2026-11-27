// Behaviour evals for the archistry skill: each case runs as a fresh `claude -p` session (Sonnet) in its own throwaway
// project with only the skill installed (junction), then records the tool trail, the final reply, cost and every file produced.
// usage: node behaviour-run.mjs <skill-dir> <cases.json> <out-dir> [concurrency] [--only 1,4]   (PATH must contain claude.exe)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const only = (() => { const i = argv.indexOf('--only'); if (i < 0) return null; const v = argv[i + 1].split(',').map(Number); argv.splice(i, 2); return new Set(v); })();
const COPY = (() => { const i = argv.indexOf('--copy'); if (i < 0) return false; argv.splice(i, 1); return true; })(); // --copy: install the skill as a real copy instead of a junction
const [skillDir, casesFile, outDir, conc = '2'] = argv;
const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const w = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };

// small SFDX project for the "ERD of the custom objects in this repo" case: only these two objects are "built"
function sfdxFixture(dir) {
  w(path.join(dir, 'sfdx-project.json'), JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], namespace: '', sourceApiVersion: '62.0' }, null, 2));
  const obj = (n, label) => w(path.join(dir, 'force-app/main/default/objects', n, n + '.object-meta.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><label>${label}</label><pluralLabel>${label}s</pluralLabel><nameField><label>${label} Name</label><type>Text</type></nameField><deploymentStatus>Deployed</deploymentStatus><sharingModel>${n === 'Promotion_Line__c' ? 'ControlledByParent' : 'ReadWrite'}</sharingModel></CustomObject>\n`);
  const fld = (o, n, label, type, extra = '') => w(path.join(dir, 'force-app/main/default/objects', o, 'fields', n + '.field-meta.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<CustomField xmlns="http://soap.sforce.com/2006/04/metadata"><fullName>${n}</fullName><label>${label}</label><type>${type}</type>${extra}</CustomField>\n`);
  obj('Promotion__c', 'Promotion'); obj('Promotion_Line__c', 'Promotion Line');
  fld('Promotion__c', 'Account__c', 'Account', 'Lookup', '<referenceTo>Account</referenceTo><relationshipName>Promotions</relationshipName><required>false</required><deleteConstraint>SetNull</deleteConstraint>');
  fld('Promotion__c', 'Discount_Pct__c', 'Discount %', 'Percent', '<precision>5</precision><scale>2</scale>');
  fld('Promotion__c', 'Start_Date__c', 'Start Date', 'Date');
  fld('Promotion__c', 'Status__c', 'Status', 'Picklist', '<valueSet><valueSetDefinition><sorted>false</sorted><value><fullName>Draft</fullName><default>true</default></value><value><fullName>Active</fullName><default>false</default></value></valueSetDefinition></valueSet>');
  fld('Promotion_Line__c', 'Promotion__c', 'Promotion', 'MasterDetail', '<referenceTo>Promotion__c</referenceTo><relationshipName>Lines</relationshipName><relationshipOrder>0</relationshipOrder><reparentableMasterDetail>false</reparentableMasterDetail>');
  fld('Promotion_Line__c', 'Product__c', 'Product', 'Lookup', '<referenceTo>Product2</referenceTo><relationshipName>Promotion_Lines</relationshipName><required>false</required><deleteConstraint>SetNull</deleteConstraint>');
  fld('Promotion_Line__c', 'Quantity__c', 'Quantity', 'Number', '<precision>6</precision><scale>0</scale>');
  fld('Promotion_Line__c', 'Discount_Amount__c', 'Discount Amount', 'Currency', '<precision>10</precision><scale>2</scale>');
}

function walkFiles(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), rel = path.relative(base, p).split(path.sep).join('/');
    if (/^(\.claude|node_modules|force-app|sfdx-project\.json|stream\.jsonl|stderr\.txt)/.test(rel)) continue;
    e.isDirectory() ? walkFiles(p, base, out) : out.push({ path: rel, bytes: fs.statSync(p).size });
  }
  return out;
}

function runOne(i, c) {
  const dir = path.resolve(outDir, `case-${String(i + 1).padStart(2, '0')}-${slug(c.name)}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(path.join(dir, '.claude', 'skills'), { recursive: true });
  if (COPY) fs.cpSync(path.resolve(skillDir), path.join(dir, '.claude', 'skills', 'archistry'), { recursive: true, filter: (f) => !/[\/]\.git([\/]|$)/.test(f) });
  else fs.symlinkSync(path.resolve(skillDir), path.join(dir, '.claude', 'skills', 'archistry'), 'junction');
  if (c.name === 'erd-from-sfdx') sfdxFixture(dir);
  const t0 = Date.now();
  return new Promise((resolve) => {
    const args = ['-p', c.prompt, '--model', 'sonnet', '--setting-sources', 'project', '--output-format', 'stream-json', '--verbose', '--max-turns', '30', '--max-budget-usd', '3', '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'PowerShell(node:*)', 'PowerShell(Get-ChildItem:*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'];
    // CLAUDE_CLI = path to the Claude Code cli.js (npm installs on Windows have no claude.exe); otherwise `claude` must be on PATH
    const cli = process.env.CLAUDE_CLI;
    const p = spawn(cli ? process.execPath : 'claude', cli ? [cli, ...args] : args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const raw = fs.createWriteStream(path.join(dir, 'stream.jsonl'));
    let buf = '', result = null, finalText = '', done = false; const trail = [];
    const finish = (why) => {
      if (done) return; done = true; clearTimeout(timer); raw.end();
      resolve({ i: i + 1, name: c.name, dir: path.basename(dir), why, ms: Date.now() - t0, cost: result?.total_cost_usd ?? null, turns: result?.num_turns ?? null, isError: result ? !!result.is_error : null, subtype: result?.subtype ?? null,
        finalText: finalText || String(result?.result || ''), trail, files: walkFiles(dir) });
    };
    const timer = setTimeout(() => { try { spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' }); } catch { /* gone */ } finish('timeout'); }, 20 * 60_000);
    p.stdout.on('data', (d) => {
      raw.write(d); buf += d; let k;
      while ((k = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, k); buf = buf.slice(k + 1); let j; try { j = JSON.parse(line); } catch { continue; }
        if (j.type === 'assistant') for (const b of j.message?.content || []) {
          if (b.type === 'tool_use') trail.push(b.name + (b.name === 'Skill' ? ':' + (b.input?.skill || '') : '') + (b.input?.command ? ' $ ' + String(b.input.command).slice(0, 220) : b.input?.file_path ? ' ' + b.input.file_path : ''));
          else if (b.type === 'text' && b.text.trim()) finalText = b.text;
        }
        if (j.type === 'result') result = j;
      }
    });
    p.stderr.on('data', (d) => fs.appendFileSync(path.join(dir, 'stderr.txt'), d));
    p.on('close', () => finish('closed'));
  });
}

const todo = cases.map((c, i) => [i, c]).filter(([i]) => !only || only.has(i + 1));
const results = []; let next = 0;
async function worker() {
  while (next < todo.length) {
    const [i, c] = todo[next++];
    const r = await runOne(i, c); results.push(r);
    console.log(`done #${r.i} ${r.name}: ${r.why} · ${r.turns ?? '?'} turns · $${(r.cost ?? 0).toFixed(2)} · ${Math.round(r.ms / 1000)}s · ${r.files.length} files${r.isError ? ' · ERROR ' + r.subtype : ''}`);
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results.sort((a, b) => a.i - b.i), null, 2));
  }
}
await Promise.all(Array.from({ length: Math.min(+conc, todo.length) }, worker));
const total = results.reduce((t, r) => t + (r.cost || 0), 0);
console.log(`ALL DONE · ${results.length} cases · total $${total.toFixed(2)}`);
