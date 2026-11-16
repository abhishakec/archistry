// router.mjs — orthogonal edge router on a 10px lattice (A* with bend, crossing and overlap costs).
// Produces explicit ports and waypoints so draw.io, the HTML viewer and image export all draw the same line.

const G = 10;
const DIRS = [{ x: 1, y: 0, s: 'E' }, { x: 0, y: 1, s: 'S' }, { x: -1, y: 0, s: 'W' }, { x: 0, y: -1, s: 'N' }];
const SIDE_DIR = { E: 0, S: 1, W: 2, N: 3 };
const snap = (v) => Math.round(v / G) * G;

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) { let c = i * 2 + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

function sidePoint(n, side, frac) {
  if (side === 'E') return { x: n.x + n.w, y: snap(n.y + n.h * frac) };
  if (side === 'W') return { x: n.x, y: snap(n.y + n.h * frac) };
  if (side === 'S') return { x: snap(n.x + n.w * frac), y: n.y + n.h };
  return { x: snap(n.x + n.w * frac), y: n.y };
}

/**
 * route({ nodes, edges, soft, pad })
 *   nodes: [{id,x,y,w,h}]   absolute rectangles that lines must not cross
 *   edges: [{id, from, to, fromSides?, toSides?, labelW?, labelH?}]  sides: 'EWNS' subset or {E:cost,...}
 *   soft:  [{x,y,w,h,cost}] regions lines should avoid (zone titles, legends)
 * returns Map(id -> { exit:{side,fx,fy}, entry:{side,fx,fy}, points:[{x,y}], path:[{x,y}], label:{t,x,y}|null })
 */
export function route({ nodes, edges, soft = [], pad = 60, bendCost = 14, bounds = null }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h); }
  if (bounds) { x0 = Math.min(x0, bounds.x0); y0 = Math.min(y0, bounds.y0); x1 = Math.max(x1, bounds.x1); y1 = Math.max(y1, bounds.y1); }
  if (!Number.isFinite(x0)) return new Map();
  const ox = snap(x0) - pad, oy = snap(y0) - pad;
  const W = Math.round((snap(x1) + pad - ox) / G) + 1, H = Math.round((snap(y1) + pad - oy) / G) + 1;
  const N = W * H;
  const blocked = new Uint8Array(N);
  const softCost = new Float32Array(N);
  const owner = new Int32Array(N).fill(-1);
  const IX = (x) => Math.round((x - ox) / G), IY = (y) => Math.round((y - oy) / G);
  nodes.forEach((n, ni) => {
    const ax = Math.max(0, Math.ceil((n.x - ox) / G - 1e-6)), bx = Math.min(W - 1, Math.floor((n.x + n.w - ox) / G + 1e-6));
    const ay = Math.max(0, Math.ceil((n.y - oy) / G - 1e-6)), by = Math.min(H - 1, Math.floor((n.y + n.h - oy) / G + 1e-6));
    for (let j = ay; j <= by; j++) for (let i = ax; i <= bx; i++) { blocked[j * W + i] = 1; owner[j * W + i] = ni; }
    for (let j = Math.max(0, ay - 1); j <= Math.min(H - 1, by + 1); j++) for (let i = Math.max(0, ax - 1); i <= Math.min(W - 1, bx + 1); i++) if (!blocked[j * W + i]) softCost[j * W + i] = Math.max(softCost[j * W + i], 5);
  });
  for (const s of soft) {
    const ax = Math.max(0, IX(s.x)), bx = Math.min(W - 1, IX(s.x + s.w)), ay = Math.max(0, IY(s.y)), by = Math.min(H - 1, IY(s.y + s.h));
    for (let j = ay; j <= by; j++) for (let i = ax; i <= bx; i++) softCost[j * W + i] = Math.max(softCost[j * W + i], s.cost || 8);
  }
  let usedH = new Uint8Array(N), usedV = new Uint8Array(N);
  const gCost = new Float64Array(N * 4), stamp = new Int32Array(N * 4), prev = new Int32Array(N * 4);
  let gen = 0;

  const sideList = (v) => {
    if (!v) return [['E', 0], ['W', 0], ['S', 0], ['N', 0]];
    if (typeof v === 'string') return v.split('').map((s) => [s, 0]);
    return Object.keys(v).map((s) => [s, v[s]]);
  };

  // A* from a set of start ports to a set of goal ports. Port = {x,y,side,cost}
  function search(starts, goals, srcIdx, dstIdx) {
    gen++;
    const heap = new Heap();
    const goalAt = new Map(); // launch point idx -> [{dirIn, cost, port}]
    let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity;
    const launch = (p, steps) => { const d = DIRS[SIDE_DIR[p.side]]; return { i: IX(p.x) + d.x * steps, j: IY(p.y) + d.y * steps }; };
    const freeStub = (p, steps, selfIdx) => {
      const d = DIRS[SIDE_DIR[p.side]];
      for (let s = 1; s <= steps; s++) { const i = IX(p.x) + d.x * s, j = IY(p.y) + d.y * s; if (i < 0 || j < 0 || i >= W || j >= H) return false; const k = j * W + i; if (blocked[k] && owner[k] !== selfIdx) return false; if (blocked[k] && owner[k] === selfIdx) return false; }
      return true;
    };
    for (const steps of [2, 1]) {
      for (const p of goals) {
        if (p._ok) continue;
        if (!freeStub(p, steps, dstIdx)) continue;
        p._ok = steps;
        const l = launch(p, steps);
        const k = l.j * W + l.i;
        if (!goalAt.has(k)) goalAt.set(k, []);
        goalAt.get(k).push(p);
        gx0 = Math.min(gx0, l.i); gx1 = Math.max(gx1, l.i); gy0 = Math.min(gy0, l.j); gy1 = Math.max(gy1, l.j);
      }
    }
    if (!goalAt.size) return null;
    const hfun = (i, j) => (i < gx0 ? gx0 - i : i > gx1 ? i - gx1 : 0) + (j < gy0 ? gy0 - j : j > gy1 ? j - gy1 : 0);
    for (const steps of [2, 1]) {
      for (const p of starts) {
        if (p._ok) continue;
        if (!freeStub(p, steps, srcIdx)) continue;
        p._ok = steps;
        const l = launch(p, steps);
        const d = SIDE_DIR[p.side];
        const st = (l.j * W + l.i) * 4 + d;
        const c = steps + (p.cost || 0);
        if (stamp[st] === gen && gCost[st] <= c) continue;
        stamp[st] = gen; gCost[st] = c; prev[st] = -1 - starts.indexOf(p);
        heap.push(c + hfun(l.i, l.j), st);
      }
    }
    let best = null;
    while (heap.size) {
      const st = heap.pop();
      const d = st & 3, k = st >> 2, i = k % W, j = (k / W) | 0;
      const g = gCost[st];
      if (best && g >= best.cost) break;
      const gl = goalAt.get(k);
      if (gl) {
        for (const p of gl) {
          const need = (SIDE_DIR[p.side] + 2) & 3; // must travel against the outward normal
          const c = g + (d === need ? 0 : bendCost) + p._ok + (p.cost || 0);
          if (!best || c < best.cost) best = { cost: c, state: st, port: p };
        }
      }
      for (let nd = 0; nd < 4; nd++) {
        if (((nd + 2) & 3) === d) continue; // no U-turn
        const ni = i + DIRS[nd].x, nj = j + DIRS[nd].y;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nk = nj * W + ni;
        if (blocked[nk]) continue;
        let c = g + 1 + softCost[nk] + (nd === d ? 0 : bendCost);
        if (nd & 1) { // vertical move
          if (usedV[nk]) c += 45; if (usedH[nk]) c += 5;
          if ((ni > 0 && usedV[nk - 1]) || (ni < W - 1 && usedV[nk + 1])) c += 4;
        } else {
          if (usedH[nk]) c += 45; if (usedV[nk]) c += 5;
          if ((nj > 0 && usedH[nk - W]) || (nj < H - 1 && usedH[nk + W])) c += 4;
        }
        const ns = nk * 4 + nd;
        if (stamp[ns] === gen && gCost[ns] <= c) continue;
        stamp[ns] = gen; gCost[ns] = c; prev[ns] = st;
        heap.push(c + hfun(ni, nj), ns);
      }
    }
    for (const p of starts) delete p._ok;
    if (!best) { for (const p of goals) delete p._ok; return null; }
    const pts = [];
    let st = best.state;
    for (;;) { const k = st >> 2; pts.push({ x: ox + (k % W) * G, y: oy + ((k / W) | 0) * G }); const p = prev[st]; if (p < 0) { st = p; break; } st = p; }
    pts.reverse();
    const startPort = starts[-1 - st];
    const goalPort = best.port;
    for (const p of goals) delete p._ok;
    return { pts: [{ x: startPort.x, y: startPort.y }, ...pts, { x: goalPort.x, y: goalPort.y }], startPort, goalPort, cost: best.cost };
  }

  function mark(pts) {
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], b = pts[s];
      const horiz = a.y === b.y;
      const i0 = IX(Math.min(a.x, b.x)), i1 = IX(Math.max(a.x, b.x)), j0 = IY(Math.min(a.y, b.y)), j1 = IY(Math.max(a.y, b.y));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (i < 0 || j < 0 || i >= W || j >= H) continue; if (horiz) usedH[j * W + i] = 1; else usedV[j * W + i] = 1; }
    }
  }
  function compress(pts) {
    const out = [];
    for (const p of pts) {
      const n = out.length;
      if (n && out[n - 1].x === p.x && out[n - 1].y === p.y) continue;
      if (n >= 2 && ((out[n - 2].x === out[n - 1].x && out[n - 1].x === p.x) || (out[n - 2].y === out[n - 1].y && out[n - 1].y === p.y))) out[n - 1] = p; else out.push(p);
    }
    return out;
  }
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
  const order = edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => {
    const a = center(byId.get(e.from)), b = center(byId.get(e.to));
    return { e, d: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) };
  }).sort((p, q) => p.d - q.d).map((p) => p.e);

  const portsFor = (n, sides, fixed) => sideList(sides).map(([s, cost]) => { const f = fixed && fixed.side === s ? fixed.frac : 0.5; const p = sidePoint(n, s, f); return { x: p.x, y: p.y, side: s, cost }; });

  // pass 1 — choose sides with centred ports
  const pass1 = new Map();
  for (const e of order) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (e.from === e.to) continue;
    const r = search(portsFor(a, e.fromSides), portsFor(b, e.toSides), nodeIndex.get(e.from), nodeIndex.get(e.to));
    if (r) { pass1.set(e.id, r); mark(r.pts); }
  }
  // spread ports along each node side
  const sideUse = new Map(); // nodeId|side -> [{edge, end, other}]
  for (const e of order) {
    const r = pass1.get(e.id);
    if (!r) continue;
    const add = (nid, side, end, other) => { const k = nid + '|' + side; if (!sideUse.has(k)) sideUse.set(k, []); sideUse.get(k).push({ e, end, other }); };
    add(e.from, r.startPort.side, 'from', r.pts[Math.min(2, r.pts.length - 1)]);
    add(e.to, r.goalPort.side, 'to', r.pts[Math.max(0, r.pts.length - 3)]);
  }
  const fixedPort = new Map(); // edgeId|end -> {side, frac}
  for (const [k, list] of sideUse) {
    const [nid, side] = k.split('|');
    const n = byId.get(nid);
    const horizSide = side === 'N' || side === 'S';
    const len = horizSide ? n.w : n.h;
    const farOf = (it) => { const r = pass1.get(it.e.id); const far = it.end === 'from' ? r.pts[r.pts.length - 1] : r.pts[0]; return horizSide ? far.x : far.y; };
    list.sort((p, q) => (horizSide ? p.other.x - q.other.x : p.other.y - q.other.y) || (farOf(p) - farOf(q)));
    const slots = Math.max(1, Math.floor(len / (2 * G)) - 1);
    const cnt = Math.min(list.length, slots);
    list.forEach((it, i) => {
      let frac = 0.5;
      if (cnt > 1) {
        const slot = Math.min(cnt - 1, Math.floor((i * cnt) / list.length));
        const span = Math.min(len - 2 * G, (cnt - 1) * 2 * G);
        const start = (len - span) / 2;
        frac = (start + (span * slot) / (cnt - 1)) / len;
      }
      fixedPort.set(it.e.id + '|' + it.end, { side, frac });
    });
  }
  // pass 2 — final routes with fixed ports
  usedH = new Uint8Array(N); usedV = new Uint8Array(N);
  const out = new Map();
  const segsAll = [];
  for (const e of order) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (e.from === e.to) {
      // self-loop on the east side
      const y = snap(a.y + a.h / 2);
      const p = [{ x: a.x + a.w, y: y - G }, { x: a.x + a.w + 3 * G, y: y - G }, { x: a.x + a.w + 3 * G, y: y + G }, { x: a.x + a.w, y: y + G }];
      out.set(e.id, { exit: { side: 'E', fx: 1, fy: (p[0].y - a.y) / a.h }, entry: { side: 'E', fx: 1, fy: (p[3].y - a.y) / a.h }, points: p.slice(1, 3), path: p });
      continue;
    }
    const fp = fixedPort.get(e.id + '|from'), tp = fixedPort.get(e.id + '|to');
    let r = null;
    if (fp && tp) r = search(portsFor(a, fp.side, fp), portsFor(b, tp.side, tp), nodeIndex.get(e.from), nodeIndex.get(e.to));
    if (!r) r = search(portsFor(a, e.fromSides), portsFor(b, e.toSides), nodeIndex.get(e.from), nodeIndex.get(e.to));
    if (!r) r = search(portsFor(a, null), portsFor(b, null), nodeIndex.get(e.from), nodeIndex.get(e.to));
    if (!r) { out.set(e.id, null); continue; }
    mark(r.pts);
    const path = compress(r.pts);
    const fr = (n, p) => ({ fx: n.w ? (p.x - n.x) / n.w : 0.5, fy: n.h ? (p.y - n.y) / n.h : 0.5 });
    out.set(e.id, { exit: Object.assign({ side: r.startPort.side }, fr(a, path[0])), entry: Object.assign({ side: r.goalPort.side }, fr(b, path[path.length - 1])), points: path.slice(1, -1), path });
    for (let s = 1; s < path.length; s++) segsAll.push({ a: path[s - 1], b: path[s], id: e.id });
  }
  // label placement: midpoint of the best segment
  const placed = [];
  const hits = (r1, r2) => r1.x < r2.x + r2.w && r2.x < r1.x + r1.w && r1.y < r2.y + r2.h && r2.y < r1.y + r1.h;
  for (const e of order) {
    const r = out.get(e.id);
    if (!r || !e.labelW) continue;
    const path = r.path;
    let total = 0;
    const lens = [];
    for (let s = 1; s < path.length; s++) { const l = Math.abs(path[s].x - path[s - 1].x) + Math.abs(path[s].y - path[s - 1].y); lens.push(l); total += l; }
    let bestC = null, acc = 0;
    for (let s = 1; s < path.length; s++) {
      const a = path[s - 1], b = path[s], l = lens[s - 1];
      const horiz = a.y === b.y;
      const fracs = l > e.labelW + 60 ? [0.5, 0.3, 0.7] : [0.5];
      for (const f of fracs) {
        const cx = a.x + (b.x - a.x) * f, cy = a.y + (b.y - a.y) * f;
        const box = { x: cx - e.labelW / 2 - 2, y: cy - e.labelH / 2 - 1, w: e.labelW + 4, h: e.labelH + 2 };
        let score = 0;
        for (const n of nodes) if (hits(box, n)) score += 100;
        for (const p of placed) if (hits(box, p)) score += 80;
        for (const sg of segsAll) { if (sg.id === e.id) continue; const sb = { x: Math.min(sg.a.x, sg.b.x) - 1, y: Math.min(sg.a.y, sg.b.y) - 1, w: Math.abs(sg.a.x - sg.b.x) + 2, h: Math.abs(sg.a.y - sg.b.y) + 2 }; if (hits(box, sb)) score += 25; }
        for (const s2 of soft) if (hits(box, s2)) score += 10;
        if (horiz) { if (l < e.labelW + 16) score += 30; } else if (l < e.labelH + 16) score += 30;
        if (!horiz) score += 3;
        score += Math.abs(f - 0.5) * 4 + (s === 1 || s === path.length - 1 ? 2 : 0) - Math.min(l, 300) / 100;
        const t = total ? (acc + l * f) / total : 0.5;
        if (!bestC || score < bestC.score) bestC = { score, t, x: cx, y: cy, box };
      }
      acc += l;
    }
    if (bestC) { r.label = { t: bestC.t, x: bestC.x, y: bestC.y }; placed.push(bestC.box); }
  }
  return out;
}
