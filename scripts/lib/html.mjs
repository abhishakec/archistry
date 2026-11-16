// html.mjs — package a draw.io model as one standalone, offline HTML file (viewer + editor + exports).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

let CACHE = null;
function assets() {
  if (CACHE) return CACHE;
  const src = fs.readFileSync(path.join(HERE, 'mx.mjs'), 'utf8');
  const names = [];
  const body = src.replace(/^export\s+(function|const|let|class)\s+([A-Za-z0-9_$]+)/gm, (m, kw, name) => { names.push(name); return `${kw} ${name}`; });
  const core = `window.SFDMX = (function () {\n${body}\nreturn { ${names.join(', ')} };\n})();`;
  CACHE = { core, css: fs.readFileSync(path.join(ROOT, 'assets', 'viewer', 'viewer.css'), 'utf8'), js: fs.readFileSync(path.join(ROOT, 'assets', 'viewer', 'viewer.js'), 'utf8') };
  return CACHE;
}
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const noScriptEnd = (s) => s.replace(/<\/(script)/gi, '<\\/$1');

/** xml: uncompressed mxfile string. Returns the complete HTML document. */
export function buildHtml(xml, { title = 'Diagram', theme = 'light', description = '' } = {}) {
  const a = assets();
  if (/<\/script/i.test(xml)) throw new Error('diagram XML contains a literal </script> sequence and cannot be embedded safely');
  return `<!doctype html>
<html lang="en" data-theme="${theme === 'dark' ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="archistry">
${description ? `<meta name="description" content="${escHtml(description)}">\n` : ''}<title>${escHtml(title)}</title>
<style>
${a.css}
</style>
</head>
<body>
<div id="app"></div>
<noscript>This diagram needs JavaScript to render. The draw.io source is embedded in this file and can be extracted with: node scripts/archistry.mjs convert this-file.html -o diagram.drawio</noscript>
<script type="application/xml" id="sfd-model">
${xml.trim()}
</script>
<script>
${noScriptEnd(a.core)}
</script>
<script>
${noScriptEnd(a.js)}
</script>
</body>
</html>
`;
}

/** Pull the embedded draw.io XML back out of an HTML file produced by buildHtml (or saved from the browser). */
export function extractModel(html) {
  const m = html.match(/<script[^>]*id=["']sfd-model["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error('no embedded diagram found — this HTML file was not produced by archistry');
  return m[1].trim() + '\n';
}
