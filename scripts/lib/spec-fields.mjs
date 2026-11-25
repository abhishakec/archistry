// spec-fields.mjs — top-level spec fields archistry reads, used only to print a NOTE for typos.
// Why a global union and not a per-engine list: several types share an engine but read different fields
// through defaults/aliases, and a missed field would wrongly flag a valid spec. A near-miss of ANY known
// field is still a typo in practice, so the union is the safer allow-list. Never affects the output.
// Source: references/spec-common.md + references/<engine>.md + every `spec.<field>` read in
// scripts/lib/builders/*.mjs, dsl.mjs and archistry.mjs (viewer). Add new fields here when a builder reads one.
const FIELDS = `
type title subtitle header meta legend legendLabels brand viewer mode direction grid layout
children links nodes edges lanes steps flows wrap gap gapX gapY spacing bandGap compact compactLeaves stackAt
card cardWidth cardsPerRow columns rows rowHeader rowHeaderWidth roles items quadrants xAxis yAxis heat heatLabels
valueKinds valueLabels solidChips maxColWidth cellWidth cellHeight columnWidth labelWidth laneWidth nodeWidth
root roots arrows entities relationships relations classes maxFields maxPerRow groupRows
participants messages autonumber persona phases phaseLabel emotion emotionLabel stages maps
start end today todayLabel sprints unit axis axisGroups milestones dependencies pixelsPerDay
agent topic topics users channels data inputs grounding guardrails escalation trustLayer
app tabs activeTab page device chrome width
`.split(/\s+/).filter(Boolean);
const KNOWN = new Set(FIELDS);

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Notes for top-level keys no engine reads, e.g. `unknown field "direcion" (did you mean "direction"?)`. */
export function unknownFieldNotes(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [];
  const notes = [];
  for (const k of Object.keys(spec)) {
    if (KNOWN.has(k) || /^[$_]|^\/\//.test(k)) continue; // $schema, _comment, // comment: conventional non-content keys
    const lower = k.toLowerCase();
    const max = k.length > 7 ? 3 : 2;
    let best = null, bestD = max + 1;
    for (const f of FIELDS) {
      const d = f.toLowerCase() === lower ? 0 : distance(lower, f.toLowerCase());
      if (d < bestD && d < Math.min(k.length, f.length)) { best = f; bestD = d; }
    }
    notes.push(`unknown field "${k}"` + (best ? ` (did you mean "${best}"?)` : ''));
  }
  return notes;
}
