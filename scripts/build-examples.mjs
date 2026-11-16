#!/usr/bin/env node
// Rebuild every example: examples/<type>.json -> .drawio + .html, PNG previews in docs/previews/,
// and the gallery block in README.md. Doubles as the regression suite: exits non-zero on any failure.
//   node scripts/build-examples.mjs [type ...] [--no-png]
import fs from 'node:fs';
import path from 'node:path';
import { renderSvg } from './lib/mx.mjs';
import { SKILL_ROOT } from './lib/dsl.mjs';
import { TYPES, STAGES, ASKS } from './lib/types.mjs';
import { validateFile } from './lib/validate.mjs';
import { buildHtml } from './lib/html.mjs';
import { rasterize, findBrowser } from './lib/raster.mjs';
import { buildSpec } from './archistry.mjs';

const exDir = path.join(SKILL_ROOT, 'examples');
const prevDir = path.join(SKILL_ROOT, 'docs', 'previews');
fs.mkdirSync(prevDir, { recursive: true });
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const noPng = process.argv.includes('--no-png');
const jobs = [];
let failed = 0, warned = 0;
for (const t of TYPES) {
  if (only.length && !only.includes(t.name)) continue;
  const specPath = path.join(exDir, t.name + '.json');
  if (!fs.existsSync(specPath)) { console.log(`MISSING  ${t.name}`); failed++; continue; }
  try {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const built = buildSpec(spec, { cwd: exDir });
    const res = validateFile(built.model);
    fs.writeFileSync(path.join(exDir, t.name + '.drawio'), built.xml);
    fs.writeFileSync(path.join(exDir, t.name + '.html'), buildHtml(built.xml, { title: built.title, description: spec.subtitle }));
    const r = renderSvg(built.model.pages[0], { padding: 24 });
    jobs.push({ svg: r.svg, width: r.width, height: r.height, scale: Math.min(1.2, 1600 / r.width), format: 'png', _out: path.join(prevDir, t.name + '.png') });
    const tag = !res.ok ? 'FAILED ' : res.warnings || built.warnings.length ? 'WARN   ' : 'OK     ';
    if (!res.ok) failed++; else if (res.warnings || built.warnings.length) warned++;
    console.log(`${tag}  ${t.name.padEnd(28)} ${res.stats.map((s) => `${s.nodes}b/${s.edges}c/${s.crossings}x`).join(' | ')}`);
    for (const w of built.warnings) console.log(`           note: ${w}`);
    for (const f of res.findings) console.log(`           ${f.level} ${f.code}: ${f.message}`);
  } catch (e) { failed++; console.log(`ERROR    ${t.name}: ${e.message}`); }
}
if (!noPng && jobs.length) {
  if (!findBrowser()) console.log('previews skipped: no Chromium-based browser found');
  else { const bufs = rasterize(jobs); bufs.forEach((b, i) => fs.writeFileSync(jobs[i]._out, b)); console.log(`wrote ${bufs.length} previews to docs/previews/`); }
}

// README gallery (between the markers)
const readme = path.join(SKILL_ROOT, 'README.md');
if (!only.length && fs.existsSync(readme)) {
  const STAGE_INTRO = {
    Discover: 'Requirements, people and scope: the diagrams a BA or consultant draws in workshops.',
    Architect: 'Landscape, integration, data and security: the architect\'s core set.',
    Design: 'Behaviour and experience: how records move, how logic branches, what users see.',
    Agentforce: 'AI agent design: orchestration on one page, each topic\'s logic on the next.',
    Build: 'Environments, pipelines and automation as built.',
    Test: 'What is tested, by whom, and whether every requirement is covered.',
    Release: 'Plans, cutover and risk.',
  };
  let g = '';
  for (const s of STAGES) {
    const list = TYPES.filter((t) => t.stage === s);
    g += `\n### ${s}\n\n${STAGE_INTRO[s]}\n\n<table>\n`;
    for (let i = 0; i < list.length; i += 2) {
      g += '<tr>\n';
      for (const t of list.slice(i, i + 2)) {
        g += `<td width="50%" valign="top">\n<a href="examples/${t.name}.html"><img src="docs/previews/${t.name}.png" alt="${t.name} example" width="100%"></a>\n<br><b><code>${t.name}</code></b><br>\n${t.answers}<br>\n<sub><b>Ask:</b> "${ASKS[t.name]}"</sub><br>\n<sub><a href="examples/${t.name}.json">spec</a> · <a href="examples/${t.name}.drawio">draw.io</a> · <a href="examples/${t.name}.html">HTML</a></sub>\n</td>\n`;
      }
      if (list.slice(i, i + 2).length === 1) g += '<td width="50%"></td>\n';
      g += '</tr>\n';
    }
    g += '</table>\n';
  }
  const src = fs.readFileSync(readme, 'utf8');
  const a = '<!-- gallery:start -->', b = '<!-- gallery:end -->';
  if (src.includes(a) && src.includes(b)) { fs.writeFileSync(readme, src.slice(0, src.indexOf(a) + a.length) + '\n' + g + '\n' + src.slice(src.indexOf(b))); console.log('updated README gallery'); }
}
console.log(`\n${jobs.length} built · ${warned} with warnings · ${failed} failed`);
process.exit(failed ? 1 : 0);
