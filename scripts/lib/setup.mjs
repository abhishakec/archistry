// setup.mjs — writes a short, managed "use Archistry for diagrams" block into a project's agent
// instruction files (CLAUDE.md, .github/copilot-instructions.md, AGENTS.md, GEMINI.md, Cursor and
// Windsurf rules), so the harness picks the skill for every diagram request in that project.
// The block sits between markers: re-running replaces it, --remove deletes it, nothing else is touched.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const START = '<!-- archistry:start -->';
const END = '<!-- archistry:end -->';

// Each harness: the file it reads, how to spot it in a project, and whether the file is wholly ours.
export const HARNESSES = {
  claude: { label: 'Claude Code', file: 'CLAUDE.md', detect: ['CLAUDE.md', '.claude'] },
  copilot: { label: 'GitHub Copilot', file: '.github/copilot-instructions.md', detect: ['.github/copilot-instructions.md', '.github/skills', '.vscode'] },
  agents: { label: 'AGENTS.md (Codex, Cursor, Copilot agent, others)', file: 'AGENTS.md', detect: ['AGENTS.md', '.codex', '.agents'] },
  gemini: { label: 'Gemini CLI', file: 'GEMINI.md', detect: ['GEMINI.md', '.gemini'] },
  cursor: { label: 'Cursor', file: '.cursor/rules/archistry.mdc', own: true, detect: ['.cursor'] },
  windsurf: { label: 'Windsurf', file: '.windsurf/rules/archistry.md', own: true, detect: ['.windsurf', '.windsurfrules'] },
};

/** Harnesses whose marker files or folders exist in the project. */
export function detectHarnesses(projectDir) {
  return Object.keys(HARNESSES).filter((k) => HARNESSES[k].detect.some((p) => fs.existsSync(path.join(projectDir, p))));
}

/** Path of the skill as the project should reference it: relative when the skill lives inside the project. */
// Instruction files get committed, so never write a user's home folder into them: a global install
// under the home folder becomes "~/...". Any other outside path is machine-specific (flagged).
export function skillRef(projectDir, skillDir) {
  const slash = (p) => p.split(path.sep).join('/');
  const rel = path.relative(projectDir, skillDir);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return { ref: slash(rel), portable: true };
  const home = os.homedir();
  const fromHome = path.relative(home, skillDir);
  if (home && fromHome && !fromHome.startsWith('..') && !path.isAbsolute(fromHome)) return { ref: '~/' + slash(fromHome), portable: true };
  return { ref: slash(skillDir), portable: false };
}

export function blockText(harness, skill) {
  const cli = `node ${skill}/scripts/archistry.mjs`;
  const lines = [
    START,
    '## Diagrams: always use the Archistry skill',
    '',
    'For any request to create, draw, diagram, map, chart or visualise something on',
    'this Salesforce project (architecture, data model / ERD, integration or OAuth',
    'sequence, process, journey, capability map, roadmap, gantt, cutover plan,',
    'fit-gap, RACI, Agentforce maps and the other Archistry types), use the',
    'Archistry skill. Do not write Mermaid, ASCII art or hand-made HTML / SVG.',
    '',
    harness === 'claude'
      ? '- Invoke the `archistry` skill first (or read `' + skill + '/SKILL.md`) and follow its workflow.'
      : `- Read \`${skill}/SKILL.md\` first and follow its workflow.`,
    `- Build every diagram from a JSON spec: \`${cli} build diagrams/<name>.json\``,
    '  (writes `.drawio` and `.html`; add `--format drawio,html,png` for images).',
    '- Every diagram carries the Salesforce header card: a `title` and a',
    '  `subtitle` that states purpose, scope and message.',
    '- Keep specs and outputs in `diagrams/`.',
    `- When you delegate diagram work, tell each subagent to read \`${skill}/SKILL.md\` first.`,
    END,
  ];
  return lines.join('\n');
}

function ownFile(harness, block) {
  if (harness === 'cursor') return `---\ndescription: Use the Archistry skill for every Salesforce diagram request\nalwaysApply: true\n---\n\n${block}\n`;
  if (harness === 'windsurf') return `---\ntrigger: always_on\n---\n\n${block}\n`;
  return block + '\n';
}

const blockRe = new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n?`);

/** Plans (and unless dryRun, applies) the change for each harness. Returns [{harness, file, action}]. */
export function setupProject(projectDir, skillDir, { harnesses, remove = false, dryRun = false } = {}) {
  const { ref: skill, portable } = skillRef(projectDir, skillDir);
  const out = [];
  out.portable = portable;
  out.skill = skill;
  for (const h of harnesses) {
    const def = HARNESSES[h];
    if (!def) throw new Error(`unknown harness "${h}": use ${Object.keys(HARNESSES).join(', ')}`);
    const file = path.join(projectDir, def.file);
    const exists = fs.existsSync(file);
    const current = exists ? fs.readFileSync(file, 'utf8') : '';
    const block = blockText(h, skill);
    let next, action;
    if (remove) {
      if (!exists || !blockRe.test(current)) { out.push({ harness: h, file, action: 'nothing to remove' }); continue; }
      next = def.own ? '' : current.replace(blockRe, '\n').replace(/\n{3,}$/, '\n');
      action = def.own || !next.trim() ? 'deleted' : 'block removed';
    } else if (def.own) {
      next = ownFile(h, block);
      action = !exists ? 'created' : current === next ? 'up to date' : 'updated';
    } else if (blockRe.test(current)) {
      next = current.replace(blockRe, (m) => (m.startsWith('\n') ? '\n\n' : '') + block + '\n');
      action = next === current ? 'up to date' : 'updated';
    } else {
      next = (current ? current.replace(/\s*$/, '') + '\n\n' : '') + block + '\n';
      action = exists ? 'block added' : 'created';
    }
    if (!dryRun && action !== 'up to date') {
      if (action === 'deleted') fs.unlinkSync(file);
      else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, next); }
    }
    out.push({ harness: h, file, action });
  }
  return out;
}
