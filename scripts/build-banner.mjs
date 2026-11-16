#!/usr/bin/env node
// Builds the README hero (.github/cover.png): soft pastel "paper" style, Archistry mark + wordmark,
// embossed tiles hinting at the diagram types and outputs, and the per-stage diagram counts.
//   node scripts/build-banner.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SKILL_ROOT } from './lib/dsl.mjs';
import { TYPES, STAGES } from './lib/types.mjs';
import { screenshotHtml } from './lib/raster.mjs';

const W = 1280, H = 560;
const brand = path.join(SKILL_ROOT, 'docs', 'brand');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const font = (file, family, weight) => `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff;base64,${b64(path.join(brand, 'fonts', file))}) format('woff')}`;
const mark = fs.readFileSync(path.join(brand, 'archistry-mark.svg'), 'utf8').replace('width="256" height="256"', 'width="104" height="104"');

// contour lines, top-left
let contours = '';
for (let i = 0; i < 16; i++) {
  const o = i * 11;
  contours += `<path d="M${-40 + o * 0.2} ${-20 + o} C ${160 + o} ${30 + o * 0.6}, ${230 + o * 0.8} ${-40 + o * 0.4}, ${460 + o} ${-60 + o * 0.3}" fill="none" stroke="#cfc8e6" stroke-width="1" opacity="${(0.75 - i * 0.04).toFixed(2)}"/>`;
}

// pastel palette (matches the mark: periwinkle + lilac + peach keystone)
const P = { ink: '#1e1b3a', sub: '#5f5a7d', lav: '#e9e4fb', lav2: '#d9d1f6', peri: '#c9d6ff', mint: '#d4f1e8', peach: '#ffe0cc', butter: '#fff1c9', stroke: '#b9b0e0' };
const stageTint = ['#e7dcff', '#d6e4ff', '#d3f0e6', '#e3defe', '#ffe3d1', '#fff0c7', '#dff3d8'];
const counts = STAGES.map((s) => TYPES.filter((t) => t.stage === s).length);

// tiny abstract diagram drawn inside the main card (pastel nodes + orthogonal connectors)
const mini = `<svg width="300" height="190" viewBox="0 0 300 190">
  <g fill="none" stroke="#a79ddb" stroke-width="2" stroke-linecap="round">
    <path d="M84 46 H120 V96 H150"/><path d="M84 146 H120 V96"/><path d="M206 96 H236"/><path d="M262 116 V150 H206"/>
  </g>
  <g fill="#a79ddb"><path d="M150 96 l-7 -4 v8z"/><path d="M236 96 l-7 -4 v8z"/><path d="M206 150 l7 -4 v8z"/></g>
  <rect x="14" y="28" width="70" height="36" rx="10" fill="${P.peri}" stroke="#9fb3f5"/><rect x="24" y="40" width="34" height="5" rx="2.5" fill="#7f95e6"/><rect x="24" y="50" width="22" height="4" rx="2" fill="#aebdf0"/>
  <rect x="14" y="128" width="70" height="36" rx="10" fill="${P.mint}" stroke="#9fd8c4"/><rect x="24" y="140" width="34" height="5" rx="2.5" fill="#6cbca1"/><rect x="24" y="150" width="22" height="4" rx="2" fill="#a6d9c7"/>
  <rect x="150" y="76" width="56" height="40" rx="10" fill="${P.lav2}" stroke="#b5a8ec"/><rect x="160" y="90" width="30" height="5" rx="2.5" fill="#8f7fdc"/><rect x="160" y="100" width="20" height="4" rx="2" fill="#bdb2ee"/>
  <path d="M262 76 l20 20 -20 20 -20 -20z" fill="${P.butter}" stroke="#ecd38f"/>
  <rect x="150" y="134" width="56" height="32" rx="16" fill="${P.peach}" stroke="#f3bf9c"/>
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${font('sora-latin-700-normal.woff', 'Sora', 700)}${font('sora-latin-600-normal.woff', 'Sora', 600)}
${font('inter-latin-400-normal.woff', 'Inter', 400)}${font('inter-latin-500-normal.woff', 'Inter', 500)}${font('inter-latin-600-normal.woff', 'Inter', 600)}
${font('jetbrains-mono-latin-500-normal.woff', 'JBM', 500)}
*{box-sizing:border-box}html,body{margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;font-family:Inter,sans-serif;color:${P.ink};
 background:radial-gradient(700px 460px at 86% 30%,#efe9ff 0%,rgba(239,233,255,0) 70%),radial-gradient(520px 380px at 100% 100%,#ffeadb 0%,rgba(255,234,219,0) 70%),linear-gradient(180deg,#f8f6fc 0%,#f3f0f9 100%)}
.grain{position:absolute;inset:0;opacity:.35;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/><feColorMatrix values='0 0 0 0 .55  0 0 0 0 .52  0 0 0 0 .62  0 0 0 .09 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")}
.left{position:absolute;left:84px;top:150px;z-index:5}
.lock{display:flex;align-items:center;gap:26px}
.lock svg{filter:drop-shadow(0 14px 26px rgba(90,80,170,.22))}
.word{font-family:Sora;font-weight:700;font-size:82px;letter-spacing:-.03em;line-height:1}
.tag{margin:22px 0 0 2px;font-size:22px;font-weight:500;color:${P.sub};letter-spacing:-.005em}
.tag b{font-weight:600;color:${P.ink}}
.formats{margin:18px 0 0 2px;display:flex;gap:8px}
.fmt{font-family:JBM;font-size:12.5px;padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.75);border:1px solid #e3ddf3;color:#4c4673;box-shadow:0 1px 0 #fff inset,0 4px 10px rgba(80,70,150,.06)}
.stages{position:absolute;left:84px;bottom:42px;display:flex;gap:8px;z-index:5}
.st{display:flex;align-items:baseline;gap:7px;padding:8px 12px;border-radius:12px;font-size:12.5px;font-weight:600;color:#3d3860;border:1px solid rgba(255,255,255,.9);box-shadow:0 1px 0 #fff inset,0 6px 14px rgba(80,70,150,.08)}
.st b{font-family:JBM;font-weight:500;font-size:13px;color:${P.ink}}
.waves{position:absolute;inset:0;z-index:1}
.card{position:absolute;border-radius:26px;background:linear-gradient(160deg,#ffffff 0%,#f7f4fd 100%);border:1px solid rgba(255,255,255,.95);box-shadow:0 1px 0 #fff inset,0 -1px 0 rgba(150,140,200,.12) inset,0 24px 50px rgba(90,80,170,.14),0 3px 8px rgba(90,80,170,.07);z-index:3}
.c1{left:812px;top:92px;width:330px;height:286px;transform:rotate(-8deg)}
.c1 .dots{position:absolute;left:20px;top:18px;display:flex;gap:7px}.c1 .dots i{width:9px;height:9px;border-radius:50%;background:#ddd6f1;display:block}
.c1 .mini{position:absolute;left:14px;top:52px}
.c1 .bar{position:absolute;left:28px;bottom:22px;width:150px;height:8px;border-radius:4px;background:#ebe6f8}
.c1 .bar:after{content:"";position:absolute;left:0;top:0;width:96px;height:8px;border-radius:4px;background:linear-gradient(90deg,#c9bdf6,#a99cf0)}
.tile{position:absolute;width:86px;height:86px;border-radius:22px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;font-family:JBM;font-size:12px;color:#5b5585;z-index:4;background:linear-gradient(160deg,#ffffff,#f4f1fb);border:1px solid rgba(255,255,255,.95);box-shadow:0 1px 0 #fff inset,0 18px 30px rgba(90,80,170,.15),0 2px 6px rgba(90,80,170,.07)}
.t1{left:1150px;top:96px;transform:rotate(6deg)}
.t2{left:1132px;top:250px;transform:rotate(-4deg)}
.t3{left:742px;top:330px;transform:rotate(-10deg);border:1.5px dashed #cbc2ea;background:rgba(255,255,255,.55);box-shadow:none;font-size:28px;color:#b3a9dd;font-family:Inter}
.t4{left:990px;top:404px;width:150px;height:56px;white-space:nowrap;border-radius:18px;transform:rotate(-6deg);flex-direction:row;gap:8px}
.t4 i{width:12px;height:12px;border-radius:4px;display:block}
</style></head><body>
<svg class="waves" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="w1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece6fb"/></linearGradient>
    <linearGradient id="w2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f2fe"/><stop offset="1" stop-color="#e1d9f8"/></linearGradient>
    <linearGradient id="w3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7f1"/><stop offset="1" stop-color="#ffe2cf"/></linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="-6" stdDeviation="10" flood-color="#6a5fb8" flood-opacity=".12"/></filter>
  </defs>
  ${contours}
  <path d="M640 ${H} C 760 470, 820 330, 940 300 S 1160 250, 1290 120 V ${H} Z" fill="url(#w2)" filter="url(#sh)"/>
  <path d="M760 40 C 700 120, 700 300, 820 420 S 1000 ${H}, 1080 ${H} L 1290 ${H} V 0 L 840 0 C 800 0, 780 15, 760 40 Z" fill="url(#w1)" opacity=".75" filter="url(#sh)"/>
  <path d="M560 ${H} C 700 520, 820 470, 960 470 S 1170 430, 1290 360 V ${H} Z" fill="url(#w1)" filter="url(#sh)"/>
  <path d="M900 ${H} C 1000 520, 1120 520, 1290 470 V ${H} Z" fill="url(#w3)" filter="url(#sh)"/>
  <path d="M902 300 C 980 300, 1010 250, 1080 250 S 1170 330, 1176 300" fill="none" stroke="#b9b0e0" stroke-width="1.6"/>
  <circle cx="902" cy="300" r="5" fill="#fff" stroke="#b9b0e0" stroke-width="1.6"/><circle cx="1080" cy="250" r="5" fill="#fff" stroke="#b9b0e0" stroke-width="1.6"/>
</svg>
<div class="grain"></div>
<div class="card c1"><div class="dots"><i></i><i></i><i></i></div><div class="mini">${mini}</div><div class="bar"></div></div>
<div class="tile t1"><svg width="34" height="34" viewBox="0 0 34 34"><path d="M7 28V19a10 10 0 0 1 20 0v9" fill="none" stroke="#8f7fdc" stroke-width="3" stroke-linecap="round"/><rect x="3" y="24" width="8" height="8" rx="2.5" fill="#c9bdf6"/><rect x="23" y="24" width="8" height="8" rx="2.5" fill="#c9bdf6"/><rect x="12" y="2" width="10" height="10" rx="2" transform="rotate(45 17 7)" fill="#ffc9a3"/></svg></div>
<div class="tile t2"><b style="font-weight:500;color:#3d3860">.drawio</b><span style="opacity:.6">⇄</span><b style="font-weight:500;color:#3d3860">.html</b></div>
<div class="tile t3">+</div>
<div class="tile t4"><i style="background:#c9d6ff"></i><i style="background:#d4f1e8"></i><i style="background:#ffe0cc"></i><span>png · svg</span></div>
<div class="left">
  <div class="lock">${mark}<span class="word">Archistry</span></div>
  <div class="tag"><b>Architect-grade Salesforce diagrams</b> for AI agents</div>
  <div class="formats"><span class="fmt">${TYPES.length} diagram types</span><span class="fmt">draw.io ⇄ HTML</span><span class="fmt">PNG · JPG · SVG</span></div>
</div>
<div class="stages">${STAGES.map((s, i) => `<span class="st" style="background:${stageTint[i]}"><b>${String(counts[i]).padStart(2, '0')}</b>${s}</span>`).join('')}</div>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archistry-banner-'));
const file = path.join(tmp, 'banner.html');
fs.writeFileSync(file, html);
const out = path.join(SKILL_ROOT, '.github', 'cover.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
screenshotHtml(file, out, { width: W, height: H, scale: 2 });
fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
console.log('wrote ' + out);
