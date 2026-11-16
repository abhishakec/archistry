// aim.mjs — Agent Interaction Map: one page that shows who talks to an Agentforce agent, how the reasoning
// engine picks a topic (classification description on the line, scope in the box), which actions each topic
// can run and what grounds them. Topics that carry "steps" get their own Agent Instruction Diagram page,
// linked from the topic box (drill-down). Approach inspired by Elements.cloud's AIM / AID diagrams.
import { Diagram, finishPage, measure, measureCard, drawCard, h, small, up10, up20, snap10, textWidth, wrapPlain, resolveIcon } from '../dsl.mjs';
import { drawAid } from './flow.mjs';

const ACTION_KINDS = {
  flow: { icon: 'standard/flow', color: 'salesforce', tag: 'Flow' },
  apex: { icon: 'standard/apex', color: 'salesforce', tag: 'Apex' },
  prompt: { icon: 'standard/prompt_builder', color: 'data', tag: 'Prompt Template' },
  api: { icon: 'utility/integration', color: 'integration', tag: 'External API' },
  mulesoft: { icon: 'product/mulesoft', color: 'integration', tag: 'MuleSoft API' },
  retriever: { icon: 'standard/knowledge', color: 'data', tag: 'Retriever / RAG' },
  standard: { icon: 'standard/agent_astro', color: 'ai', tag: 'Standard action' },
  handoff: { icon: 'utility/user', color: 'warning', tag: 'Human handoff' },
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'topic';

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const agent = spec.agent || {};
  const topics = (spec.topics || []).map((t) => Object.assign({}, t));
  if (!topics.length) throw new Error('an agent interaction map needs "topics"');
  const esc = spec.escalation;
  if (esc) topics.push({ name: esc.label || 'Escalation', classification: esc.classification || 'The agent cannot resolve the request, or the user asks for a person.', scope: esc.scope || esc.target || 'Transfer the conversation with full context to a human.', actions: [{ label: esc.target || 'Route to service rep', kind: 'handoff' }], _esc: true });
  const firstPageId = 'aim';
  topics.forEach((t, i) => { t._n = i + 1; if (t.steps && t.steps.length) t._pageId = 'aid-' + slug(t.name) + '-' + (i + 1); });

  // ---- column A: users & channels
  const people = [...(agent.users || spec.users || []).map((u) => (typeof u === 'string' ? { label: u, icon: 'utility/user' } : Object.assign({ icon: 'utility/user' }, u))), ...(agent.channels || spec.channels || []).map((c) => (typeof c === 'string' ? { label: c, icon: /whats|sms|chat|messag/i.test(c) ? 'utility/chat' : /mail/i.test(c) ? 'utility/email' : /slack/i.test(c) ? 'standard/slack' : /voice|phone|call/i.test(c) ? 'utility/phone_portrait' : /mobile|app/i.test(c) ? 'platform/apps_mobile' : 'platform/web' } : c))];
  const cardO = { minW: 180, maxW: 200, minH: 60 };
  for (const p of people) Object.assign(p, { _s: measureCard(d, p, cardO) });
  const AW = people.length ? Math.max(...people.map((p) => p._s.w)) + 40 : 0;
  const AH = people.length ? 50 + people.reduce((s, p) => s + p._s.h + 16, 0) + 4 : 0;

  // ---- column B: the agent
  const BW = 320;
  const sections = [];
  const eng = agent.engine || 'Atlas Reasoning Engine';
  sections.push({ kind: 'ai', v: `<b>${h(eng)}</b><br>${small((agent.reasoning || ['Understand the request', 'Classify to a topic', 'Plan and run actions', 'Check and respond']).map((s, i) => `${i + 1}. ${h(s)}`).join('<br>'), d.ink.text, 11)}`, solid: true });
  if ((agent.instructions || []).length) sections.push({ kind: 'neutral', v: `${small('<b>GLOBAL INSTRUCTIONS</b>', d.ink.sub, 10)}<br>` + agent.instructions.map((s) => small('• ' + h(s), d.ink.text, 11)).join('<br>') });
  if ((agent.guardrails || []).length) sections.push({ kind: 'security', v: `${small('<b>GUARDRAILS</b>', d.ink.sub, 10)}<br>` + agent.guardrails.map((s) => small('• ' + h(s), d.ink.text, 11)).join('<br>') });
  if ((agent.variables || []).length) sections.push({ kind: 'data', v: `${small('<b>VARIABLES &amp; FILTERS</b>', d.ink.sub, 10)}<br>${small(agent.variables.map(h).join(' · '), d.ink.text, 11)}` });
  for (const s of sections) s.h = up10(measure(s.v, { fontSize: 12 }, BW - 52).h + 18);
  let headV = `${small(h((agent.type || 'Agentforce agent').toUpperCase()), d.ink.sub, 10)}<br><b><font style="font-size:16px">${h(agent.name || 'Agent')}</font></b>`;
  if (agent.description) headV += `<br>${small(h(agent.description), d.ink.text, 11)}`;
  const headH = Math.max(70, up10(measure(headV, { fontSize: 12 }, BW - 84).h + 36));
  const BH = up20(headH + sections.reduce((s, x) => s + x.h + 10, 0) + 14);

  // ---- columns C/D: topics and their actions
  const CW = 300, DW = 240;
  const GAP_BC = 270, GAP_CD = 70;
  for (const t of topics) {
    t._v = `${small((t._esc ? 'ESCALATION' : 'TOPIC ' + t._n) + ' · JOB TO BE DONE', d.ink.sub, 10)}<br><b><font style="font-size:14px">${h(t.name)}</font></b>` + (t.scope ? `<br>${small('<b>Scope</b> ' + h(t.scope), d.ink.text, 11)}` : '');
    t._h = Math.max(80, up20(measure(t._v, { fontSize: 12 }, CW - 30).h + 24 + (t._pageId ? 26 : 0)));
    t._lines = t.classification ? wrapPlain(t.classification, 200, 11) : [];
    t._acts = (t.actions || []).map((a) => (typeof a === 'string' ? { label: a } : Object.assign({}, a)));
    for (const a of t._acts) { const ak = ACTION_KINDS[String(a.kind || 'flow').toLowerCase()] || ACTION_KINDS.flow; a._ak = ak; a._card = { label: a.label, sub: a.target || ak.tag, icon: a.icon || ak.icon, kind: ak.color }; a._s = measureCard(d, a._card, { minW: DW, maxW: DW, minH: 60 }); }
    const actsH = t._acts.reduce((s, a) => s + a._s.h + 12, -12);
    t._rowH = up20(Math.max(t._h, actsH, t._lines.length * 13.2 + 30));
  }
  const rowsH = topics.reduce((s, t) => s + t._rowH + 30, -30);
  const totalH = Math.max(BH, rowsH, AH);

  const ax = 0, bx = AW ? AW + 150 : 0, cx = bx + BW + GAP_BC, dx = cx + CW + GAP_CD;
  // A
  let zoneA = null;
  if (people.length) {
    const ay = snap10((totalH - AH) / 2);
    const k = d.kind('user');
    zoneA = d.node({ id: d.uid('users_channels'), x: ax, y: ay, w: AW, h: AH, value: '<b>Users &amp; channels</b>', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13, align: 'left', verticalAlign: 'top', spacingLeft: 14, spacingTop: 9, container: '1', collapsible: '0', recursiveResize: '0' } });
    let y = 46;
    for (const p of people) { drawCard(d, Object.assign({ kind: 'neutral' }, p), { x: 20, y, w: AW - 40, h: p._s.h }, zoneA.id, cardO); y += p._s.h + 16; }
  }
  // B
  const by = snap10((totalH - BH) / 2);
  const ak = d.kind('ai');
  const agentCell = d.node({ id: d.uid('agent'), x: bx, y: by, w: BW, h: BH, value: headV, style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: ak.fill, strokeColor: ak.stroke, strokeWidth: 2, fontColor: d.ink.text, fontSize: 12, align: 'left', verticalAlign: 'top', spacingLeft: 66, spacingTop: 12, spacingRight: 12, container: '1', collapsible: '0', recursiveResize: '0', shadow: '1' } });
  d.icon(agent.icon || 'standard/agent_astro', 16, 16, 38, agentCell.id);
  let sy = headH;
  for (const s of sections) {
    const k = d.kind(s.kind, false);
    d.node({ id: d.uid('agent_sec'), x: 14, y: sy, w: BW - 28, h: s.h, value: s.v, parent: agentCell.id, connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: s.solid ? '#ffffff' : (s.kind === 'neutral' ? '#ffffff' : k.fill), strokeColor: k.stroke, strokeWidth: s.solid ? 1.5 : 1, fontColor: d.ink.text, fontSize: 12, align: 'left', verticalAlign: 'top', spacingLeft: 10, spacingTop: 6, spacingRight: 8, part: '1' } });
    sy += s.h + 10;
  }
  if (zoneA) d.edge({ id: d.uid('e_request'), source: zoneA.id, target: agentCell.id, value: 'Utterance /<br>request', style: { edgeStyle: 'orthogonalEdgeStyle', strokeWidth: 2 }, exit: { fx: 1, fy: 0.5 }, entry: { fx: 0, fy: (zoneA.geo.y + AH / 2 - by) / BH }, points: [] });

  // C / D
  let ty = snap10((totalH - rowsH) / 2);
  const trunk1 = bx + BW + 30, agentMidY = by + BH / 2;
  const actionCells = new Map();
  for (const t of topics) {
    const tk = d.kind(t._esc ? 'warning' : (t.kind || 'salesforce'));
    const tcy = ty + t._rowH / 2;
    const topicCell = d.node({ id: d.uid('topic_' + slug(t.name)), x: cx, y: snap10(tcy - t._h / 2), w: CW, h: t._h, value: t._v, link: t._pageId ? 'data:page/id,' + t._pageId : undefined, tooltip: t._pageId ? 'Open the Agent Instruction Diagram for this topic' : t.note, style: { rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: tk.fill, strokeColor: tk.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 12, align: 'left', verticalAlign: 'top', spacingLeft: 14, spacingTop: 10, spacingRight: 12, container: '1', collapsible: '0', recursiveResize: '0' } });
    if (t._pageId) d.node({ id: d.uid('drill'), x: CW - 150, y: t._h - 24, w: 140, h: 18, value: '<b>Instruction diagram ▸</b>', parent: topicCell.id, connectable: '0', link: 'data:page/id,' + t._pageId, style: { rounded: '1', arcSize: 18, absoluteArcSize: '1', fillColor: tk.stroke, strokeColor: 'none', fontColor: '#ffffff', fontSize: 9, whiteSpace: undefined, part: '1' } });
    const cyPort = topicCell.geo.y + t._h / 2;
    const L1 = trunk1 - (bx + BW), L2 = Math.abs(cyPort - agentMidY), L3 = cx - trunk1;
    d.edge({ id: d.uid('e_classify'), source: agentCell.id, target: topicCell.id, value: t._lines.map(h).join('<br>'), style: { edgeStyle: 'orthogonalEdgeStyle', strokeColor: tk.stroke, strokeWidth: 1.5, fontSize: 11, dashed: t._esc ? '1' : '0', dashPattern: '6 4' }, exit: { fx: 1, fy: 0.5 }, entry: { fx: 0, fy: 0.5 }, points: L2 < 1 ? [] : [{ x: trunk1, y: agentMidY }, { x: trunk1, y: cyPort }], labelT: (L1 + L2 + L3 * 0.52) / (L1 + L2 + L3) });
    const actsH = t._acts.reduce((s, a) => s + a._s.h + 12, -12);
    let ay2 = snap10(tcy - actsH / 2);
    const trunk2 = cx + CW + 30;
    for (const a of t._acts) {
      const cell = drawCard(d, a._card, { x: dx, y: ay2, w: DW, h: a._s.h }, '1', { minW: DW, maxW: DW });
      if (a.id) actionCells.set(a.id, cell);
      a._cell = cell;
      const acy = ay2 + a._s.h / 2;
      d.edge({ id: d.uid('e_action'), source: topicCell.id, target: cell.id, style: { edgeStyle: 'orthogonalEdgeStyle', strokeColor: d.ink.line, strokeWidth: 1.2, endSize: 5 }, exit: { fx: 1, fy: 0.5 }, entry: { fx: 0, fy: 0.5 }, points: Math.abs(acy - cyPort) < 1 ? [] : [{ x: trunk2, y: cyPort }, { x: trunk2, y: acy }] });
      ay2 += a._s.h + 12;
    }
    ty += t._rowH + 30;
  }
  // E: grounding & systems
  const data = (spec.data || spec.grounding || []).map((x) => (typeof x === 'string' ? { label: x } : Object.assign({}, x)));
  if (data.length) {
    const ex = dx + DW + 130;
    const o = { minW: 200, maxW: 220, minH: 60 };
    for (const x of data) { if (!x.icon) x.icon = /data cloud|data 360/i.test(x.label) ? 'standard/data_cloud' : /knowledge/i.test(x.label) ? 'standard/knowledge' : /erp|sap|api|carrier|oms/i.test(x.label) ? 'utility/integration' : 'utility/database'; x._s = measureCard(d, x, o); }
    const EW = Math.max(...data.map((x) => x._s.w)) + 40;
    const EH = 50 + data.reduce((s, x) => s + x._s.h + 16, 0) + 4;
    const k = d.kind('data');
    const zone = d.node({ id: d.uid('grounding'), x: ex, y: snap10((totalH - EH) / 2), w: EW, h: EH, value: '<b>Grounding &amp; systems</b>', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5, fontColor: d.ink.text, fontSize: 13, align: 'left', verticalAlign: 'top', spacingLeft: 14, spacingTop: 9, container: '1', collapsible: '0', recursiveResize: '0' } });
    let y = 46;
    const dataCells = new Map();
    for (const x of data) { const c = drawCard(d, Object.assign({ kind: x.kind || 'neutral' }, x), { x: 20, y, w: EW - 40, h: x._s.h }, zone.id, Object.assign({ style: { fillColor: '#ffffff' } }, o)); dataCells.set(x.id || x.label, c); y += x._s.h + 16; }
    const links = [];
    const obstacles = [...dataCells.values()];
    for (const t of topics) for (const a of t._acts) for (const u of [].concat(a.uses || [])) { const target = dataCells.get(u); if (!target) { d.warnings.push(`action "${a.label}" uses unknown data source "${u}"`); continue; } if (!obstacles.includes(a._cell)) obstacles.push(a._cell); links.push({ from: a._cell.id, to: target.id, style: { dashed: '1', dashPattern: '4 4', endArrow: 'open', strokeColor: k.stroke, strokeWidth: 1.2 }, fromSides: 'E', toSides: 'W' }); }
    if (links.length) d.routeEdges(links, obstacles);
  }
  // trust layer band
  if ((spec.trustLayer || []).length) {
    let x1 = 0;
    for (const c of d.cells) if (c.vertex && c.parent === '1') x1 = Math.max(x1, c.geo.x + c.geo.w);
    const k = d.kind('security');
    const band = d.node({ id: d.uid('trust'), x: 0, y: totalH + 40, w: x1, h: 50, value: '<b>Einstein Trust Layer</b>', connectable: '0', style: { rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: k.fill, strokeColor: k.stroke, fontColor: d.ink.text, fontSize: 12, align: 'left', spacingLeft: 44, container: '1', collapsible: '0' } });
    d.icon('utility/lock', 12, 13, 24, band.id);
    let px = 200;
    for (const t of spec.trustLayer) { const w = up10(textWidth(t, 10, true) + 20); d.node({ id: d.uid('trust_chip'), x: px, y: 15, w, h: 20, value: `<b>${h(t)}</b>`, parent: band.id, connectable: '0', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: k.stroke, fontColor: d.ink.text, fontSize: 10, whiteSpace: undefined, part: '1' } }); px += w + 8; }
  }
  d.usedKinds.clear();
  d.legendExtra.push({ swatch: { style: { fillColor: ak.fill, strokeColor: ak.stroke, strokeWidth: 1.5 } }, label: 'Agent + reasoning engine' });
  { const k = d.kind('salesforce', false); d.legendExtra.push({ swatch: { style: { fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5 } }, label: 'Topic (scope in the box, classification description on the line in)' }); }
  if (topics.some((t) => t._esc)) { const k = d.kind('warning', false); d.legendExtra.push({ swatch: { style: { fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 1.5 } }, label: 'Escalation to a human' }); }
  const pages = [finishPage(d, { id: firstPageId, name: 'Agent Interaction Map' })];

  // ---- drill-down pages: one Agent Instruction Diagram per topic that has steps
  for (const t of topics) {
    if (!t._pageId) continue;
    const sub = { type: 'agent-instruction-diagram', title: `${t.name} — Agent Instruction Diagram`, subtitle: `Topic ${t._n} of ${agent.name || 'the agent'} · drill-down from the Agent Interaction Map`, topic: { name: t.name, classification: t.classification, scope: t.scope }, guardrails: t.guardrails || [], inputs: t.inputs, data: t.data, steps: t.steps, flows: t.flows || [], wrap: t.wrap, brand: spec.brand };
    const d2 = new Diagram(sub, ctx);
    drawAid(d2, sub);
    let x0 = Infinity, y0 = Infinity;
    for (const c of d2.cells) if (c.vertex && c.parent === '1') { x0 = Math.min(x0, c.geo.x); y0 = Math.min(y0, c.geo.y); }
    d2.node({ id: d2.uid('back'), x: x0, y: y0 - 44, w: 230, h: 24, value: '<b>◂ Back to Agent Interaction Map</b>', link: 'data:page/id,' + firstPageId, connectable: '0', style: { rounded: '1', arcSize: 24, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: d2.ink.border, fontColor: d2.ink.text, fontSize: 10, whiteSpace: undefined } });
    pages.push(finishPage(d2, { id: t._pageId, name: t.name }));
    for (const w of d2.warnings) d.warnings.push(w);
  }
  pages.warnings = d.warnings;
  void resolveIcon;
  return pages;
}
