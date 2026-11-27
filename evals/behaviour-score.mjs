// Scores each behaviour case against its expectations by inspecting the produced specs / drawio text (not the agent's own claims).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// usage: node behaviour-score.mjs <behaviour-run-out-dir> [results.json]   (default results/behaviour-latest.json next to this file)
// Grades the cases produced by behaviour-run.mjs and records the result where Command Centre looks for it.
const root = process.argv[2];
const outFile = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', 'behaviour-latest.json');
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const caseDir = (i) => { const d = fs.readdirSync(root).find((x) => x.startsWith('case-' + String(i).padStart(2, '0'))); return d ? path.join(root, d) : null; };
const text = (dir) => { let t = ''; const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); if (e.isDirectory()) { if (!/^(\.claude|force-app)$/.test(e.name)) walk(f); } else if (/\.(json|drawio)$/.test(e.name) && !/stream/.test(e.name)) t += '\n' + read(f); } }; walk(dir); return t; };
const has = (t, ...ws) => ws.every((w) => new RegExp(w, 'i').test(t));
const files = (dir, re) => { let n = 0; const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); if (e.isDirectory()) { if (e.name !== '.claude') walk(f); } else if (re.test(e.name)) n++; } }; walk(dir); return n; };
const checks = {
  1: (t, d) => [['type solution-architecture', has(t, '"type":\\s*"solution-architecture"')], ['names all six systems', has(t, 'Commerce Cloud', 'Sales Cloud', 'MuleSoft', 'SAP', 'Data Cloud', 'Agentforce')], ['drawio + html written', files(d, /\.drawio$/) > 0 && files(d, /\.html$/) > 0]],
  2: (t, d) => [['type data-model', has(t, '"type":\\s*"data-model"')], ['Promotion_Line__c → Promotion__c master-detail', has(t, 'master', 'Promotion_Line__c')], ['image for the BA team (png/svg)', files(d, /\.(png|svg)$/) > 0], ['fields marked illustrative', has(t, 'illustrative')]],
  3: (t, d) => [['type oauth-flow', has(t, '"type":\\s*"oauth-flow"')], ['PKCE present', has(t, 'PKCE|code_challenge|code_verifier')], ['a PNG', files(d, /\.png$/) > 0]],
  4: (t, d) => [['uses erd-from-sfdx (spec says "From SFDX")', has(t, 'SFDX')], ['title "Promotions data model"', has(t, '"title":\\s*"Promotions data model"')], ['only built objects + Account', has(t, 'Promotion__c', 'Promotion_Line__c', 'Account') && !/Product2/i.test(JSON.stringify((() => { try { return JSON.parse(read(path.join(d, 'diagrams', 'promotions-data-model.json'))).objects?.map((o) => o.name || o.api || o.id); } catch { return []; } })()))]],
  5: (t) => [['business-process spec', has(t, '"type":\\s*"business-process"')], ['state-lifecycle spec', has(t, '"type":\\s*"state-lifecycle"')], ['recycle + disqualify paths', has(t, 'recycl', 'disqualif')]],
  6: (t) => [['type agent-interaction-map', has(t, '"type":\\s*"agent-interaction-map"')], ['steps on Returns topic', has(t, 'Returns')], ['refund guardrail', has(t, 'refund', 'guardrail|limit|approv')], ['both channels', has(t, 'WhatsApp', 'chat')]],
  7: (t) => [['persona-map', has(t, '"type":\\s*"persona-map"')], ['process-hierarchy', has(t, '"type":\\s*"process-hierarchy"')], ['L0 and L1 shown', has(t, 'L0', 'L1')], ['scope marked', has(t, 'phase')], ['illustrative flagged', has(t, 'illustrative')]],
  8: (t, d) => [['current-future-state', has(t, '"type":\\s*"current-future-state"')], ['links labelled replaces/retired', has(t, 'replaces|retired')], ['drawio + html', files(d, /\.drawio$/) > 0 && files(d, /\.html$/) > 0]],
  9: (t) => [['territory-model', has(t, '"type":\\s*"territory-model"')], ['global→segment hierarchy', has(t, 'Global', 'EMEA', 'Enterprise', 'Mid-?Market')], ['phase 2 marked', has(t, 'phase\\s*2')], ['illustrative flagged', has(t, 'illustrative')]],
  10: (t, d) => [['omni-channel-routing', has(t, '"type":\\s*"omni-channel-routing"')], ['skills on edges/cards', has(t, 'skill')], ['overflow as exception', has(t, 'overflow')], ['drawio + html', files(d, /\.drawio$/) > 0 && files(d, /\.html$/) > 0]],
  11: (t, d) => [['experience-site-map spec', has(t, '"type":\\s*"experience-site-map"')], ['build produced drawio', files(d, /\.drawio$/) > 0]],
};
let pass = 0, total = 0; const lines = [], cases = [];
for (let i = 1; i <= 11; i++) {
  const d = caseDir(i); if (!d) { lines.push(`#${i}: (no run)`); cases.push({ id: i, name: 'case-' + i, pass: false, checks: [] }); continue; }
  const rows = checks[i](text(d), d); const ok = rows.every((r) => r[1]); total++; if (ok) pass++;
  cases.push({ id: i, name: path.basename(d).replace(/^case-\d+-/, ''), pass: ok, checks: rows.map((r) => ({ text: r[0], pass: r[1] })) });
  lines.push(`#${String(i).padStart(2)} ${ok ? 'PASS' : 'FAIL'}  ${path.basename(d).replace(/^case-\d+-/, '').padEnd(28)} ${rows.map((r) => (r[1] ? '✓' : '✗') + ' ' + r[0]).join(' · ')}`);
}
console.log(lines.join('\n') + `\n\n${pass}/${total} cases pass every automatic check`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ ranAt: new Date().toISOString(), cases }, null, 1));
console.log('recorded ' + outFile);
