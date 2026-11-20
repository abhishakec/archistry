// raster.mjs — SVG -> PNG/JPG using a locally installed Chromium-based browser in headless mode.
// No npm dependencies: the browser draws the SVG on a canvas and the data URL is read back from --dump-dom.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function which(name) {
  try { return execFileSync('which', [name], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch { return null; }
}

export function findBrowser() {
  const env = process.env.ARCHISTRY_BROWSER || process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;
  const c = [];
  if (process.platform === 'win32') {
    const roots = [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA].filter(Boolean);
    for (const r of roots) c.push(path.join(r, 'Microsoft/Edge/Application/msedge.exe'), path.join(r, 'Google/Chrome/Application/chrome.exe'), path.join(r, 'BraveSoftware/Brave-Browser/Application/brave.exe'), path.join(r, 'Chromium/Application/chrome.exe'));
  } else if (process.platform === 'darwin') {
    for (const base of ['/Applications', path.join(os.homedir(), 'Applications')]) c.push(`${base}/Google Chrome.app/Contents/MacOS/Google Chrome`, `${base}/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`, `${base}/Chromium.app/Contents/MacOS/Chromium`, `${base}/Brave Browser.app/Contents/MacOS/Brave Browser`);
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser']) { const p = which(n); if (p) c.push(p); }
  }
  return c.find((p) => fs.existsSync(p)) || null;
}

export function findDrawioCli() {
  const env = process.env.ARCHISTRY_DRAWIO;
  if (env && fs.existsSync(env)) return env;
  const c = [];
  if (process.platform === 'win32') { for (const r of [process.env.PROGRAMFILES, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean)) c.push(path.join(r, 'draw.io/draw.io.exe')); }
  else if (process.platform === 'darwin') c.push('/Applications/draw.io.app/Contents/MacOS/draw.io');
  else { for (const n of ['drawio', 'draw.io']) { const p = which(n); if (p) c.push(p); } }
  return c.find((p) => fs.existsSync(p)) || null;
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script id="jobs" type="application/json">__JOBS__</script>
<script>
(async () => {
  const jobs = JSON.parse(document.getElementById('jobs').textContent);
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    const pre = document.createElement('pre'); pre.id = 'sfd-out-' + i;
    try {
      const url = URL.createObjectURL(new Blob([j.svg], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('svg failed to load')); img.src = url; });
      let s = j.scale;
      const MAXSIDE = 16000, MAXAREA = 180e6;
      s = Math.min(s, MAXSIDE / j.w, MAXSIDE / j.h, Math.sqrt(MAXAREA / (j.w * j.h)));
      const c = document.createElement('canvas'); c.width = Math.round(j.w * s); c.height = Math.round(j.h * s);
      const x = c.getContext('2d');
      if (j.bg) { x.fillStyle = j.bg; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(img, 0, 0, c.width, c.height);
      pre.textContent = c.toDataURL(j.mime, j.quality);
    } catch (e) { pre.textContent = 'ERROR:' + e.message; }
    document.body.appendChild(pre);
  }
  const d = document.createElement('pre'); d.id = 'sfd-done'; d.textContent = 'done'; document.body.appendChild(d);
})();
</script></body></html>`;

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Some launchers (Edge on Windows) return at once while the real headless process keeps running, so --dump-dom
// prints nothing and --screenshot writes its file a moment later. Wait until the file exists and its size is stable.
function waitForFile(file, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  let last = -1;
  while (Date.now() < end) {
    let size = -1;
    try { size = fs.statSync(file).size; } catch { /* not there yet */ }
    if (size > 0 && size === last) return true;
    last = size;
    sleepSync(size > 0 ? 300 : 150);
  }
  return false;
}

// Fallback for rasterize(): one SVG per page, one screenshot per image (PNG, or JPEG chosen by the file extension).
function rasterizeByScreenshot(browser, jobs, tmp) {
  return jobs.map((j, i) => {
    const jpg = j.format === 'jpg' || j.format === 'jpeg';
    let s = j.scale || 2;
    s = Math.min(s, 16000 / j.width, 16000 / j.height, Math.sqrt(180e6 / (j.width * j.height)));
    const W = Math.max(1, Math.round(j.width * s)), H = Math.max(1, Math.round(j.height * s));
    const svgFile = path.join(tmp, `s${i}.svg`), htmlFile = path.join(tmp, `s${i}.html`), out = path.join(tmp, `o${i}.${jpg ? 'jpg' : 'png'}`);
    fs.writeFileSync(svgFile, j.svg);
    const bg = jpg ? (j.background && j.background !== 'transparent' ? j.background : '#ffffff') : 'transparent';
    fs.writeFileSync(htmlFile, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:${bg}}img{display:block;width:${W}px;height:${H}px}</style></head><body><img src="s${i}.svg" width="${W}" height="${H}"></body></html>`);
    const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', `--user-data-dir=${path.join(tmp, 'profile' + i)}`, `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--virtual-time-budget=5000'];
    if (!jpg) args.push('--default-background-color=00000000');
    args.push(`--screenshot=${out}`, pathToFileURL(htmlFile).href);
    spawnSync(browser, args, { encoding: 'utf8', timeout: 120000 });
    if (!waitForFile(out)) throw new Error('headless browser did not finish rendering (' + browser + ')');
    return fs.readFileSync(out);
  });
}

// jobs: [{svg, width, height, format:'png'|'jpg', scale, background, quality}] -> [Buffer]
export function rasterize(jobs, opts = {}) {
  const browser = opts.browser || findBrowser();
  if (!browser) throw new Error('No Chromium-based browser found for PNG/JPG export. Install Chrome, Edge, Chromium or Brave, or set ARCHISTRY_BROWSER to its executable. (SVG export needs no browser.)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfd-'));
  try {
    const payload = jobs.map((j) => {
      const jpg = j.format === 'jpg' || j.format === 'jpeg';
      return { svg: j.svg, w: j.width, h: j.height, scale: j.scale || 2, mime: jpg ? 'image/jpeg' : 'image/png', quality: j.quality || 0.92, bg: jpg ? (j.background && j.background !== 'transparent' ? j.background : '#ffffff') : null };
    });
    const html = path.join(tmp, 'r.html');
    fs.writeFileSync(html, PAGE.replace('__JOBS__', () => JSON.stringify(payload).replace(/</g, '\\u003c')));
    const run = (mode, budget) => spawnSync(browser, [`--headless${mode}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', `--user-data-dir=${path.join(tmp, 'profile')}`, `--virtual-time-budget=${budget}`, '--dump-dom', pathToFileURL(html).href], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, timeout: 240000 });
    let dom = '';
    for (const [mode, budget] of [['=new', 20000], ['=new', 120000], ['', 60000]]) {
      const r = run(mode, budget);
      dom = r.stdout || '';
      if (dom.includes('id="sfd-done"')) break;
    }
    if (!dom.includes('id="sfd-done"')) return rasterizeByScreenshot(browser, jobs, tmp);
    return jobs.map((_, i) => {
      const m = dom.match(new RegExp(`<pre id="sfd-out-${i}">([^<]*)</pre>`));
      if (!m) throw new Error('no output for image ' + i);
      if (m[1].startsWith('ERROR:')) throw new Error(m[1]);
      return Buffer.from(m[1].slice(m[1].indexOf(',') + 1), 'base64');
    });
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp cleanup is best effort */ }
  }
}

// Full-page screenshot of a local HTML file (used for the README banner and viewer previews).
export function screenshotHtml(htmlPath, outPng, { width = 1280, height = 640, scale = 2, browser } = {}) {
  browser = browser || findBrowser();
  if (!browser) throw new Error('No Chromium-based browser found.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfd-'));
  try {
    try { fs.rmSync(outPng, { force: true }); } catch { /* ignore */ }
    spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', `--user-data-dir=${path.join(tmp, 'profile')}`, `--window-size=${width},${height}`, `--force-device-scale-factor=${scale}`, '--virtual-time-budget=8000', `--screenshot=${outPng}`, pathToFileURL(htmlPath).href], { encoding: 'utf8', timeout: 120000 });
    if (!waitForFile(outPng)) throw new Error('screenshot failed');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* best effort */ }
  }
}
