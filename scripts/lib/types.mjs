// types.mjs — the diagram catalogue: every type a Salesforce project needs, the engine that draws it,
// the question it answers and the delivery stage it belongs to.
import { build as blocks } from './builders/blocks.mjs';
import { build as flow, buildAid } from './builders/flow.mjs';
import { build as sequence } from './builders/sequence.mjs';
import { build as tables } from './builders/tables.mjs';
import { build as mapping } from './builders/mapping.mjs';
import { build as tree } from './builders/tree.mjs';
import { build as matrix } from './builders/matrix.mjs';
import { build as timeline } from './builders/timeline.mjs';
import { build as journey } from './builders/journey.mjs';
import { build as aim } from './builders/aim.mjs';
import { build as wireframe } from './builders/wireframe.mjs';

export const STAGES = ['Discover', 'Architect', 'Design', 'Agentforce', 'Build', 'Test', 'Release'];

const T = (name, stage, engine, fn, answers, defaults = {}, aliases = []) => ({ name, stage, engine, fn, answers, defaults, aliases });
export const TYPES = [
  // ---- Discover: requirements, people, scope
  T('stakeholder-map', 'Discover', 'matrix', matrix, 'Who has influence and interest, and how do we engage each group?', { mode: 'quadrant' }, ['power-interest-grid']),
  T('org-chart', 'Discover', 'tree', tree, 'Who reports to whom in the business or the delivery team?', {}, ['team-structure', 'governance-model']),
  T('raci', 'Discover', 'matrix', matrix, 'Who is Responsible, Accountable, Consulted and Informed for each activity?', { mode: 'table' }, ['responsibility-matrix']),
  T('capability-map', 'Discover', 'blocks', blocks, 'Which business capabilities exist and which are in scope, live or a gap?', { compact: true }, ['business-capability-map']),
  T('business-process', 'Discover', 'flow', flow, 'What are the steps, who performs them and where are the decisions? (as-is / to-be, BPMN-style swimlanes)', { direction: 'LR' }, ['process', 'swimlane', 'bpmn', 'process-flow', 'approval-process']),
  T('customer-journey', 'Discover', 'journey', journey, 'What does a persona do, think and feel at each stage, and where are the pain points?', {}, ['journey-map', 'user-journey']),
  T('service-blueprint', 'Discover', 'journey', journey, 'How do front-stage, back-stage and systems line up behind each customer step?', {}, []),
  T('user-story-map', 'Discover', 'matrix', matrix, 'Which stories sit under each activity and in which release slice?', { mode: 'board' }, ['story-map', 'moscow', 'board', 'swot', 'kanban']),
  T('system-context', 'Discover', 'blocks', blocks, 'Which people and systems surround the solution and what flows between them?', {}, ['context-diagram']),
  T('fit-gap-analysis', 'Discover', 'matrix', matrix, 'Which requirements are met out of the box, by configuration, by custom build, or not at all?', { mode: 'table' }, ['fit-gap']),
  T('prioritization-matrix', 'Discover', 'matrix', matrix, 'Which backlog items give the most value for the least effort?', { mode: 'quadrant' }, ['value-effort-matrix', 'quadrant']),
  // ---- Architect: landscape, integration, data, security
  T('system-landscape', 'Architect', 'blocks', blocks, 'Which systems exist across the enterprise and how are they grouped and connected?', {}, ['landscape', 'architecture', 'org-strategy']),
  T('solution-architecture', 'Architect', 'blocks', blocks, 'Which products and components make up this solution and how do they interact?', {}, ['solution', 'architecture-diagram']),
  T('integration-architecture', 'Architect', 'blocks', blocks, 'Which integrations exist, with what pattern, protocol, direction and frequency?', {}, ['integration-landscape', 'integration']),
  T('sequence', 'Architect', 'sequence', sequence, 'In what order do systems and people message each other?', {}, ['integration-sequence', 'sequence-diagram']),
  T('oauth-flow', 'Architect', 'sequence', sequence, 'How does this OAuth / SSO flow authenticate and authorise step by step?', {}, ['sso-flow', 'auth-flow']),
  T('data-model', 'Architect', 'tables', tables, 'Which objects and fields exist and how are they related? (Salesforce ERD notation)', {}, ['erd', 'object-model', 'datamodel']),
  T('data-flow', 'Architect', 'blocks', blocks, 'Where does data originate, how is it transformed and where does it land?', {}, ['data-lineage', 'data-migration-flow']),
  T('data-cloud-architecture', 'Architect', 'blocks', blocks, 'How does data move through Data Cloud: ingest, harmonise, unify, analyse and activate?', {}, ['data-360-architecture']),
  T('data-cloud-mapping', 'Architect', 'mapping', mapping, 'Which source fields map to which DLO and DMO fields, with what transformation?', {}, ['field-mapping', 'data-mapping', 'datamapping', 'data-migration-mapping']),
  T('sharing-model', 'Architect', 'blocks', blocks, 'How is record access opened up, layer by layer, from org-wide defaults to manual sharing?', { compact: true }, ['security-model', 'sharing-architecture']),
  T('role-hierarchy', 'Architect', 'tree', tree, 'How does the role hierarchy roll record visibility upward?', {}, ['territory-hierarchy']),
  T('permission-matrix', 'Architect', 'matrix', matrix, 'Which profile or permission set gets which access to which object?', { mode: 'table' }, ['crud-matrix', 'owd-matrix']),
  // ---- Design: behaviour and experience
  T('state-lifecycle', 'Design', 'flow', flow, 'Which statuses can a record move through, and what triggers each transition?', { direction: 'LR' }, ['state-diagram', 'record-lifecycle', 'lifecycle']),
  T('flowchart', 'Design', 'flow', flow, 'What is the logic, decision by decision?', { direction: 'TB' }, ['decision-tree', 'logic-flow']),
  T('lightning-page-wireframe', 'Design', 'wireframe', wireframe, 'What goes where on this Lightning page or screen?', {}, ['wireframe', 'page-layout', 'screen-wireframe']),
  T('class-diagram', 'Design', 'tables', tables, 'Which Apex classes and interfaces exist and how do they depend on each other?', { mode: 'class' }, ['uml-class', 'apex-class-diagram']),
  // ---- Agentforce
  T('agent-interaction-map', 'Agentforce', 'aim', aim, 'How is an AI agent orchestrated: channels, reasoning, topics (jobs to be done), actions and grounding?', {}, ['aim', 'agent-map', 'agentforce-architecture']),
  T('agent-instruction-diagram', 'Agentforce', 'flow', buildAid, 'Inside one topic: which instruction steps, actions, prompts and guardrails does the agent follow?', {}, ['aid', 'agent-instruction-design', 'agent-interaction-design', 'topic-design']),
  // ---- Build
  T('environment-strategy', 'Build', 'blocks', blocks, 'Which orgs and sandboxes exist and how do changes move between them?', {}, ['sandbox-strategy', 'org-strategy-environments']),
  T('devops-pipeline', 'Build', 'flow', flow, 'What happens from commit to production, with which gates and checks?', { direction: 'LR' }, ['ci-cd', 'release-pipeline']),
  T('branching-strategy', 'Build', 'flow', flow, 'Which branches exist and how do changes merge between them?', { direction: 'LR' }, ['git-flow']),
  T('flow-logic', 'Build', 'flow', flow, 'What does this Salesforce Flow or Apex trigger do, element by element?', { direction: 'TB' }, ['salesforce-flow', 'automation-logic']),
  // ---- Test
  T('test-strategy', 'Test', 'matrix', matrix, 'Which test levels run where, by whom, with what tools and exit criteria?', { mode: 'table' }, ['test-plan']),
  T('traceability-matrix', 'Test', 'matrix', matrix, 'Is every requirement covered by a test, and what is its status?', { mode: 'table' }, ['rtm', 'test-coverage']),
  T('defect-lifecycle', 'Test', 'flow', flow, 'How does a defect move from raised to closed?', { direction: 'LR' }, ['bug-lifecycle']),
  // ---- Release
  T('roadmap', 'Release', 'timeline', timeline, 'What is delivered when, across workstreams and releases?', {}, ['timeline', 'release-roadmap']),
  T('project-plan', 'Release', 'timeline', timeline, 'What are the tasks, durations, dependencies and milestones? (gantt)', {}, ['gantt', 'release-plan', 'sprint-plan']),
  T('cutover-plan', 'Release', 'timeline', timeline, 'What happens hour by hour during go-live, and who owns each step?', {}, ['go-live-plan', 'deployment-runbook']),
  T('risk-matrix', 'Release', 'matrix', matrix, 'Which risks are most likely and most damaging?', { mode: 'quadrant', grid: 5 }, ['risk-heatmap', 'raid']),
];

const INDEX = new Map();
for (const t of TYPES) { INDEX.set(t.name, t); for (const a of t.aliases) if (!INDEX.has(a)) INDEX.set(a, t); }
export function resolveType(name) {
  if (!name) return null;
  const k = String(name).toLowerCase().trim().replace(/[\s_]+/g, '-');
  return INDEX.get(k) || null;
}
export function suggestTypes(name) {
  const k = String(name || '').toLowerCase();
  const words = k.split(/[^a-z0-9]+/).filter(Boolean);
  return TYPES.filter((t) => words.some((w) => w.length > 2 && (t.name.includes(w) || t.aliases.some((a) => a.includes(w))))).map((t) => t.name).slice(0, 6);
}

// One natural-language request per type: used in the README gallery and as trigger examples.
export const ASKS = {
  'stakeholder-map': 'Map our stakeholders on a power / interest grid for the Service Cloud programme.',
  'org-chart': 'Draw the delivery team org chart: sponsor, product owner, architect, squads.',
  'raci': 'Create a RACI for discovery, design, build, test and release across the project roles.',
  'capability-map': 'Build a capability map for customer service and colour it by live, in scope and gap.',
  'business-process': 'Diagram the to-be quote-to-order process as swimlanes with the discount approval path.',
  'customer-journey': 'Create an as-is customer journey map for a broadband fault, with pain points and opportunities.',
  'service-blueprint': 'Draw a service blueprint for appliance repair with front stage, back stage and systems.',
  'user-story-map': 'Lay out a user story map for field technicians, sliced into MVP and Release 2.',
  'system-context': 'Draw a system context diagram for the partner portal: users on the left, dependencies on the right.',
  'fit-gap-analysis': 'Turn these requirements into a fit-gap analysis: standard, config, custom or gap.',
  'prioritization-matrix': 'Plot the backlog on a value vs effort matrix.',
  'system-landscape': 'Draw our enterprise system landscape with Salesforce clouds, MuleSoft and systems of record.',
  'solution-architecture': 'Draw the solution architecture for order management: Commerce, Sales Cloud, MuleSoft to SAP, Data Cloud and an Agentforce agent.',
  'integration-architecture': 'Show the order-to-cash integration architecture with pattern, protocol and timing on each interface.',
  'sequence': 'Create a sequence diagram for order submission with a synchronous credit check and an async ERP hand-off.',
  'oauth-flow': 'Diagram the OAuth 2.0 web server flow with PKCE for our external client app.',
  'data-model': 'Generate an ERD from ./force-app for Promotion__c, Merchant__c and everything they relate to.',
  'data-flow': 'Show the data migration flow from the legacy CRM through staging and transformation into Salesforce.',
  'data-cloud-architecture': 'Draw the Data Cloud architecture from ingestion to activation.',
  'data-cloud-mapping': 'Here is mappings.csv: build the Data Cloud field mapping diagram, DLO to DMO.',
  'sharing-model': 'Explain our record access design as a layered sharing model, from OWD to manual sharing.',
  'role-hierarchy': 'Draw the role hierarchy for sales and service.',
  'permission-matrix': 'Create an object permission matrix by persona for the permission set groups.',
  'state-lifecycle': 'Diagram the Case status lifecycle with what triggers each transition.',
  'flowchart': 'Make a decision flow for choosing between Screen Flow, record-triggered Flow and Apex.',
  'lightning-page-wireframe': 'Wireframe the Case record page for the Service Console with annotations.',
  'class-diagram': 'Draw a class diagram of our Apex trigger framework and service layer.',
  'agent-interaction-map': 'Design an Agent Interaction Map for our service agent: channels, topics, actions and grounding.',
  'agent-instruction-diagram': 'Draw the Agent Instruction Diagram for the Order Status topic with guardrails.',
  'environment-strategy': 'Diagram our sandbox and environment strategy with the promotion path to production.',
  'devops-pipeline': 'Show the CI/CD pipeline from pull request to production with quality gates.',
  'branching-strategy': 'Illustrate our git branching strategy: feature, develop, release, main, hotfix.',
  'flow-logic': 'Turn Case_Escalation.flow-meta.xml into a flow logic diagram.',
  'test-strategy': 'Summarise the test strategy: levels, owners, environments, tools and exit criteria.',
  'traceability-matrix': 'Build a requirements traceability matrix with SIT and UAT status.',
  'defect-lifecycle': 'Draw the defect lifecycle used in SIT and UAT.',
  'roadmap': 'Create a three-release roadmap across Sales, Service, Data Cloud and Agentforce.',
  'project-plan': 'Make a sprint-level gantt for Release 1 with dependencies and milestones.',
  'cutover-plan': 'Draw the go-live weekend cutover plan with owners and the rollback decision point.',
  'risk-matrix': 'Plot the programme risks on a 5 by 5 likelihood / impact matrix.',
};
