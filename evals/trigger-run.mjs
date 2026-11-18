// Trigger eval: for each query, start `claude -p` in a project that has the skill installed, stop at the
// first tool call, and record whether it was the Skill tool loading `archistry`.
// usage: node trigger-run.mjs <project-dir-with-the-skill-installed> <evals.json> <out.json> [concurrency]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [proj, evalsFile, outFile, conc = '4'] = process.argv.slice(2);
const evals = JSON.parse(fs.readFileSync(evalsFile, 'utf8'));
// CLAUDE_CLI = path to the Claude Code cli.js (needed on Windows); otherwise `claude` must be on PATH
const cli = process.env.CLAUDE_CLI || null;
function one(q) {
  return new Promise((resolve) => {
    const p = spawn(cli ? process.execPath : 'claude', [...(cli ? [cli] : []), '-p', q.query, '--output-format', 'stream-json', '--verbose', '--max-turns', '3'], { cwd: proj, stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '', first = null, done = false, seq = [];
    const finish = (why) => { if (done) return; done = true; try { spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' }); } catch {} resolve({ first, why }); };
    const timer = setTimeout(() => finish('timeout'), 150000);
    p.stdout.on('data', (d) => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let j; try { j = JSON.parse(line); } catch { continue; }
        const content = j.message && j.message.content;
        if (j.type === 'assistant' && Array.isArray(content)) for (const c of content) if (c.type === 'tool_use') { const nm = c.name + (c.name === 'Skill' ? ':' + ((c.input && c.input.skill) || '') : ''); seq.push(nm); if (!first) first = nm; if (/^Skill:/.test(nm) || seq.length >= 6) { clearTimeout(timer); first = seq.find((x) => /^Skill:/.test(x)) || seq.join(' > '); finish('tool'); return; } }
        if (j.type === 'result') { clearTimeout(timer); finish('result'); return; }
      }
    });
    p.on('close', () => { clearTimeout(timer); finish('closed'); });
  });
}
const results = []; let next = 0;
async function worker() { while (next < evals.length) { const k = next++; const r = await one(evals[k]); const triggered = !!(r.first && /^Skill:.*archistry/i.test(r.first)); results[k] = { ...evals[k], first: r.first, why: r.why, triggered, pass: triggered === evals[k].should_trigger }; console.log(`${results[k].pass ? 'PASS' : 'FAIL'} [${evals[k].should_trigger ? 'should' : 'should-not'}] first=${r.first || '(none, ' + r.why + ')'} :: ${evals[k].query.slice(0, 70)}`); } }
await Promise.all(Array.from({ length: +conc }, worker));
fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
const p = results.filter((r) => r.pass).length; console.log(`\n${p}/${results.length} pass; should-trigger ${results.filter((r) => r.should_trigger && r.pass).length}/${results.filter((r) => r.should_trigger).length}; should-not ${results.filter((r) => !r.should_trigger && r.pass).length}/${results.filter((r) => !r.should_trigger).length}`);
