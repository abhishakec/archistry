// journey.mjs — phase × row grids: customer-journey map (with emotion curve) and service-blueprint.
import { Diagram, finishPage, measure, h, small, up10, snap10, clamp, textWidth, resolveIcon } from '../dsl.mjs';

export function build(spec, ctx) {
  const d = new Diagram(spec, ctx);
  const phases = (spec.phases || []).map((p) => (typeof p === 'string' ? { label: p } : p));
  if (!phases.length) throw new Error('a journey needs "phases"');
  const rows = spec.rows || [];
  const LW = spec.labelWidth || 150, CW = spec.columnWidth || clamp(Math.round(1240 / phases.length / 10) * 10, 170, 260), n = phases.length;
  const W = LW + CW * n;
  let y = 0;
  // persona banner
  const p = spec.persona;
  if (p) {
    const iconR = resolveIcon(p.icon || 'utility/user');
    let v = `<b><font style="font-size:14px">${h(p.name || 'Persona')}</font></b>`;
    if (p.role) v += '  ' + small(h(p.role), d.ink.sub, 11);
    if (p.goal) v += `<br>${small('<b>Goal:</b> ' + h(p.goal), d.ink.text, 11)}`;
    if (p.scenario) v += `<br>${small('<b>Scenario:</b> ' + h(p.scenario), d.ink.text, 11)}`;
    const hh = up10(measure(v, { fontSize: 12 }, W - 80).h + 24);
    const c = d.node({ id: d.uid('persona'), x: 0, y, w: W, h: hh, value: v, connectable: '0', style: { rounded: '1', arcSize: 16, absoluteArcSize: '1', fillColor: '#f3f3f3', strokeColor: d.ink.border, fontColor: d.ink.text, fontSize: 12, align: 'left', spacingLeft: 62, container: '1', collapsible: '0' } });
    if (iconR) d.icon(iconR.key, 14, Math.round((hh - 34) / 2), 34, c.id);
    y += hh + 16;
  }
  // phase chevrons
  const palette = ['salesforce', 'integration', 'data', 'engagement', 'ai', 'success', 'analytics', 'purple'];
  phases.forEach((ph, i) => {
    const k = d.kind(ph.kind || palette[i % palette.length], false);
    d.node({ id: d.uid('phase_' + ph.label), x: LW + i * CW, y, w: CW - 4, h: 44, value: `<b>${h(ph.label)}</b>${ph.sub ? '<br>' + small(h(ph.sub), '#ffffff', 10) : ''}`, connectable: '0', style: { shape: 'step', size: 14, fixedSize: '1', perimeter: 'stepPerimeter', fillColor: k.stroke, strokeColor: k.stroke, fontColor: '#ffffff', fontSize: 13, spacingLeft: 14, spacingRight: 10 } });
  });
  d.text(0, y, LW - 10, 44, `<b>${h(spec.phaseLabel || 'Stage')}</b>`, { verticalAlign: 'middle', fontSize: 12, fontColor: d.ink.sub });
  y += 54;
  const emo = spec.emotion || null;
  const drawEmotion = (yy) => {
    const EH = 130;
    d.node({ id: d.uid('row_emotion'), x: 0, y: yy, w: LW - 6, h: EH, value: `<b>${h(spec.emotionLabel || 'Feeling')}</b>`, connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: '#f3f3f3', strokeColor: d.ink.border, fontColor: d.ink.text, fontSize: 12, align: 'left', spacingLeft: 10 } });
    d.node({ id: d.uid('emo_bg'), x: LW, y: yy, w: CW * n - 4, h: EH, value: '', connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: '#e5e5e5' } });
    d.edge({ id: d.uid('emo_mid'), style: { endArrow: 'none', strokeColor: '#c9c7c5', dashed: '1', dashPattern: '3 4', strokeWidth: 1, rounded: '0' }, sourcePoint: { x: LW + 8, y: yy + EH / 2 }, targetPoint: { x: LW + CW * n - 12, y: yy + EH / 2 } });
    const pts = [];
    emo.forEach((e, i) => {
      if (i >= n || e === null || e === undefined) return;
      const o = typeof e === 'number' ? { score: e } : e;
      const sc = clamp(o.score || 0, -2, 2);
      pts.push({ x: LW + i * CW + CW / 2 - 2, y: yy + EH / 2 - sc * 20 - (o.label ? 8 : 0), sc, label: o.label });
    });
    for (let i = 1; i < pts.length; i++) d.edge({ id: d.uid('emo_line'), style: { endArrow: 'none', strokeColor: '#032d60', strokeWidth: 2, rounded: '0' }, sourcePoint: { x: pts[i - 1].x, y: pts[i - 1].y }, targetPoint: { x: pts[i].x, y: pts[i].y } });
    for (const pt of pts) {
      const k = d.kind(pt.sc > 0 ? 'success' : pt.sc < 0 ? 'danger' : 'warning', false);
      d.node({ id: d.uid('emo_pt'), x: pt.x - 13, y: pt.y - 13, w: 26, h: 26, value: `<b>${pt.sc > 0 ? '+' + pt.sc : pt.sc}</b>`, connectable: '0', style: { ellipse: '', fillColor: k.fill, strokeColor: k.stroke, strokeWidth: 2, fontColor: d.ink.text, fontSize: 10, whiteSpace: undefined } });
      if (pt.label) d.text(pt.x - CW / 2 + 6, pt.y + 15, CW - 12, 30, small(h(pt.label), d.ink.sub, 10), { align: 'center', verticalAlign: 'top' });
    }
    return EH + 10;
  };
  let emotionDone = false;
  for (const r of rows) {
    if (r.divider !== undefined) {
      d.edge({ id: d.uid('divider'), style: { endArrow: 'none', strokeColor: d.ink.text, dashed: '1', dashPattern: '8 5', strokeWidth: 1.5, rounded: '0' }, sourcePoint: { x: 0, y: y + 12 }, targetPoint: { x: W - 4, y: y + 12 } });
      const tw = up10(textWidth(r.divider, 10, true) + 20);
      d.node({ id: d.uid('divider_tag'), x: W - tw - 20, y: y + 2, w: tw, h: 20, value: `<b>${h(r.divider)}</b>`, connectable: '0', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: d.ink.text, fontColor: d.ink.text, fontSize: 10, whiteSpace: undefined } });
      y += 30; continue;
    }
    if (r.emotion && emo) { y += drawEmotion(y); emotionDone = true; continue; }
    const k = d.kind(r.kind || 'neutral', false);
    const cells = r.cells || [];
    const chips = r.style === 'chips' || cells.some((c) => Array.isArray(c));
    let rh = 60;
    const prepared = cells.map((c) => {
      if (chips) {
        const list = [].concat(c || []).map(String);
        let cx = 8, cy = 8;
        const out = [];
        for (const t of list) { const w = clamp(up10(textWidth(t, 10, true) + 18), 40, CW - 20); if (cx + w > CW - 8 && cx > 8) { cx = 8; cy += 26; } out.push({ t, x: cx, y: cy, w }); cx += w + 6; }
        rh = Math.max(rh, cy + 30);
        return out;
      }
      const list = [].concat(c || []).map(String);
      const v = list.length > 1 ? list.map((t) => '• ' + h(t)).join('<br>') : h(list[0] || '');
      rh = Math.max(rh, measure(v, { fontSize: 11 }, CW - 24).h + 20);
      return v;
    });
    rh = up10(rh);
    d.node({ id: d.uid('row_' + r.label), x: 0, y, w: LW - 6, h: rh, value: `<b>${h(r.label || '')}</b>${r.sub ? '<br>' + small(h(r.sub), d.ink.sub, 10) : ''}`, connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: r.kind ? k.fill : '#f3f3f3', strokeColor: r.kind ? k.stroke : d.ink.border, fontColor: d.ink.text, fontSize: 12, align: 'left', spacingLeft: 10, spacingRight: 4 } });
    for (let i = 0; i < n; i++) {
      const cell = d.node({ id: d.uid('jc'), x: LW + i * CW, y, w: CW - 4, h: rh, value: chips ? '' : (prepared[i] || ''), connectable: '0', style: { rounded: '1', arcSize: 12, absoluteArcSize: '1', fillColor: r.kind ? k.fill : '#ffffff', strokeColor: r.kind ? k.stroke : '#e5e5e5', fontColor: d.ink.text, fontSize: 11, align: 'left', verticalAlign: 'top', spacingLeft: 10, spacingRight: 8, spacingTop: 8, container: chips ? '1' : undefined, collapsible: chips ? '0' : undefined, fillOpacity: r.kind ? 60 : undefined } });
      if (chips) for (const ch of prepared[i] || []) {
        const ck = d.kind(r.chipKind || r.kind || 'salesforce', false);
        d.node({ id: d.uid('chip'), x: ch.x, y: ch.y, w: ch.w, h: 20, value: `<b>${h(ch.t)}</b>`, parent: cell.id, connectable: '0', style: { rounded: '1', arcSize: 20, absoluteArcSize: '1', fillColor: '#ffffff', strokeColor: ck.stroke, fontColor: d.ink.text, fontSize: 10, whiteSpace: undefined, part: '1' } });
      }
    }
    y += rh + 8;
  }
  if (emo && !emotionDone) drawEmotion(y);
  void snap10;
  return [finishPage(d)];
}
