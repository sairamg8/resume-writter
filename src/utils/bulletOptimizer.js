/**
 * Bullet Point Optimizer & STAR / Google X-Y-Z Formula Engine
 * Evaluates resume bullet points, detects weak phrases, suggests action verbs,
 * and helps candidates write impactful, metric-driven achievements.
 */

export const ACTION_VERBS_BY_CATEGORY = {
  'Leadership & Execution': [
    'Spearheaded', 'Orchestrated', 'Championed', 'Directed', 'Mobilized',
    'Mentored', 'Steered', 'Executed', 'Founded', 'Galvanized'
  ],
  'Technical & Engineering': [
    'Architected', 'Engineered', 'Developed', 'Deployed', 'Automated',
    'Refactored', 'Implemented', 'Scaled', 'Configured', 'Constructed'
  ],
  'Performance & Growth': [
    'Accelerated', 'Optimized', 'Streamlined', 'Boosted', 'Maximized',
    'Outperformed', 'Expanded', 'Amplified', 'Elevated', 'Yielded'
  ],
  'Cost & Efficiency': [
    'Reduced', 'Consolidated', 'Decreased', 'Eliminated', 'Saved',
    'Cut', 'Mitigated', 'Curtailed', 'Salvaged', 'Reclaimed'
  ],
  'Innovation & Design': [
    'Pioneered', 'Innovated', 'Devised', 'Overhauled', 'Transformed',
    'Conceived', 'Modernized', 'Formulated', 'Redesigned', 'Conceptualized'
  ],
  'Collaboration & Strategy': [
    'Negotiated', 'Partnered', 'Liaised', 'Co-authored', 'Facilitated',
    'Aligned', 'Coordinated', 'Arbitrated', 'Brokered', 'Integrated'
  ]
};

export const WEAK_PHRASE_REPLACEMENTS = [
  { match: /\b(was responsible for|responsible for)\b/gi, replacement: 'Led', alternatives: ['Directed', 'Oversaw', 'Spearheaded'] },
  { match: /\b(worked on|worked with)\b/gi, replacement: 'Engineered', alternatives: ['Co-developed', 'Collaborated on', 'Built'] },
  { match: /\b(helped with|helped to|assisted with|assisted in)\b/gi, replacement: 'Facilitated', alternatives: ['Supported delivery of', 'Co-engineered', 'Accelerated'] },
  { match: /\b(handled)\b/gi, replacement: 'Managed', alternatives: ['Resolved', 'Administered', 'Executed'] },
  { match: /\b(did)\b/gi, replacement: 'Delivered', alternatives: ['Conducted', 'Accomplished', 'Produced'] },
  { match: /\b(made sure|ensured that|ensured)\b/gi, replacement: 'Guaranteed', alternatives: ['Maintained compliance with', 'Enforced', 'Safeguarded'] },
  { match: /\b(changed)\b/gi, replacement: 'Transformed', alternatives: ['Modernized', 'Overhauled', 'Refactored'] },
  { match: /\b(participated in)\b/gi, replacement: 'Contributed to', alternatives: ['Partnered in', 'Active member of', 'Drove'] },
  { match: /\b(in charge of)\b/gi, replacement: 'Oversaw', alternatives: ['Led', 'Directed', 'Headed'] },
];

// ── The one verb list: high-impact action verbs (150+), the ATS score's and the optimizer's ──
// It was the ATS checker's alone, and the optimizer checked its own 60: a statement Auto-Fix had just
// opened with "Led" read "Verb Missing" here and strong in the score (R2-025). It holds every verb the
// optimizer offers (ACTION_VERBS_BY_CATEGORY) and every verb Auto-Fix writes (WEAK_PHRASE_REPLACEMENTS),
// and no verb the optimizer calls weak ("ensured" is Auto-Fix's to replace).
export const ACTION_VERBS = new Set([
  // Leadership & Management
  'accelerated', 'achieved', 'administered', 'advocated', 'aligned', 'allocated', 'appointed',
  'approved', 'assigned', 'authorized', 'chaired', 'championed', 'coached', 'consolidated',
  'contracted', 'coordinated', 'delegated', 'directed', 'empowered', 'enabled', 'enforced',
  'established', 'executed', 'facilitated', 'fostered', 'founded', 'governed',
  'guided', 'headed', 'hired', 'hosted', 'inspired', 'instituted', 'instructed', 'led',
  'leveraged', 'managed', 'mentored', 'mobilized', 'motivated', 'navigated', 'orchestrated',
  'organized', 'overhauled', 'oversaw', 'partnered', 'pioneered', 'planned', 'prioritized',
  'produced', 'recruited', 'reorganized', 'restructured', 'revamped', 'spearheaded', 'steered',
  'supervised', 'trained', 'transformed', 'unified',

  // Technical, Development & Engineering
  'architected', 'automated', 'built', 'coded', 'compiled', 'computed', 'configured',
  'constructed', 'debugged', 'deployed', 'designed', 'developed', 'devised', 'discovered',
  'engineered', 'enhanced', 'implemented', 'installed', 'integrated', 'invented', 'maintained',
  'migrated', 'modeled', 'modernized', 'optimized', 'programmed', 'prototyped', 'refactored',
  're-engineered', 'resolved', 'scaled', 'secured', 'simulated', 'standardized', 'streamlined',
  'tested', 'troubleshot', 'upgraded', 'validated',

  // Research, Analysis & Problem Solving
  'analyzed', 'assessed', 'audited', 'benchmarked', 'calculated', 'clarified', 'collected',
  'compared', 'conducted', 'critiqued', 'deduced', 'diagnosed', 'evaluated', 'examined',
  'explored', 'forecasted', 'formulated', 'identified', 'inspected', 'interpreted', 'interviewed',
  'investigated', 'measured', 'monitored', 'quantified', 'researched', 'reviewed',
  'surveyed', 'synthesized', 'tracked',

  // Execution, Growth & Financial Impact
  'acquired', 'boosted', 'budgeted', 'captured', 'closed', 'curtailed', 'cut', 'decreased',
  'delivered', 'doubled', 'earned', 'exceeded', 'expanded', 'expedited', 'generated', 'grew',
  'halved', 'improved', 'increased', 'maximized', 'minimized', 'negotiated', 'outperformed',
  'procured', 'profitably', 'raised', 'reduced', 'saved', 'slashed', 'surpassed', 'tripled',
  'yielded',

  // Communication, Creative & Writing
  'addressed', 'authored', 'briefed', 'collaborated', 'composed', 'conveyed', 'corresponded',
  'created', 'customized', 'documented', 'drafted', 'edited', 'illustrated', 'influenced',
  'moderated', 'persuaded', 'presented', 'promoted', 'publicized', 'published',
  'represented', 'spoke', 'translated', 'wrote',

  // The optimizer's chips and Auto-Fix's replacements, each by its first word
  ...Object.values(ACTION_VERBS_BY_CATEGORY).flat().map((v) => v.toLowerCase()),
  ...WEAK_PHRASE_REPLACEMENTS.map(({ replacement }) => replacement.split(' ')[0].toLowerCase()),
]);

/**
 * A verb as it is looked up: lowercase letters only, on both sides, so 'Co-authored' is found
 * however it is punctuated (AUD-32).
 */
const verbKey = (w) => w.toLowerCase().replace(/[^a-z]/g, '');
const VERB_KEYS = new Set([...ACTION_VERBS].map(verbKey));

/**
 * Whether plain `text` opens with a strong action verb — the one check the optimizer's badge and
 * the ATS score both make (R2-025). Only punctuation at the edges of the first word is trimmed
 * ('Led,', '•Engineered', '"Co-authored,"').
 */
export function leadsWithActionVerb(text) {
  const firstWord = String(text || '').trim().split(/\s+/)[0].replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
  return firstWord !== '' && VERB_KEYS.has(verbKey(firstWord));
}

/**
 * Whether plain `text` quantifies its result — the one metric rule of the optimizer and the ATS
 * score (R2-025): a number that stands as one ("12", "45%", "$1.2M", "10k", "3x", "200ms"), not the
 * digit in a name such as "S3", "EC2" or "Web3", and not a statement that is only a year.
 */
export function hasMetric(text) {
  const clean = String(text || '').trim();
  return /(?<!\p{L})\d/u.test(clean) && !/^\d{4}$/.test(clean);
}

export const GOOGLE_XYZ_TEMPLATES = [
  {
    role: 'Engineering & Tech',
    label: 'Feature / Performance',
    template: 'Engineered [feature/system], reducing [latency/downtime] by [X]% and supporting [Y]+ daily active users.',
  },
  {
    role: 'Engineering & Tech',
    label: 'Cost & Efficiency',
    template: 'Automated [manual process] using [technologies], cutting deployment cycle time by [X] hours and saving $[Y]K annually.',
  },
  {
    role: 'Product & Project Management',
    label: 'Product Launch',
    template: 'Spearheaded launch of [product/initiative] across [X] cross-functional teams, driving $[Y]M in ARR within [Z] months.',
  },
  {
    role: 'Product & Project Management',
    label: 'User Retention',
    template: 'Redesigned user onboarding flow based on analytics, elevating 30-day retention from [X]% to [Y]%.',
  },
  {
    role: 'Data & Analytics',
    label: 'Pipeline / Model',
    template: 'Architected end-to-end data pipeline processing [X] TB of data daily, boosting predictive model accuracy to [Y]%.',
  },
  {
    role: 'Marketing & Sales',
    label: 'Revenue & Leads',
    template: 'Orchestrated multi-channel campaign generating [X]+ qualified inbound leads and achieving [Y]% over quarterly target.',
  },
  {
    role: 'Operations & Leadership',
    label: 'Scale & Mentorship',
    template: 'Mentored team of [X] junior and mid-level members, standardizing agile workflows and increasing sprint velocity by [Y]%.',
  },
];

/**
 * Analyzes a given bullet point text for action verbs, metrics, and weak phrases.
 */
export function analyzeBullet(text = '') {
  const clean = text.replace(/<[^>]+>/g, '').trim();
  if (!clean) {
    return {
      clean,
      hasActionVerb: false,
      hasMetric: false,
      weakPhrases: [],
      score: 0,
      suggestions: ['Write an achievement starting with a strong action verb and including a measurable result.']
    };
  }

  // Metric and verb: the ATS score's own rules, so the badges here say what the score will (R2-025).
  const metric = hasMetric(clean);
  const firstWord = clean.split(/\s+/)[0].replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
  const hasActionVerb = leadsWithActionVerb(clean);

  // Check weak phrases. String#match with a copy of the pattern: `wp.match` is global, and
  // RegExp#test on a global pattern starts where its last match ended (lastIndex), so the same text
  // was found weak on one call and not on the next — the modal re-runs this on every render, and
  // its badge, score and Auto-Fix flickered (bug audit 2026-09-22). `phrase`: the words it found.
  const detectedWeakPhrases = [];
  for (const wp of WEAK_PHRASE_REPLACEMENTS) {
    const found = clean.match(new RegExp(wp.match.source, 'i'));
    if (found) detectedWeakPhrases.push({ ...wp, phrase: found[0] });
  }

  // Calculate bullet quality score (0 to 100)
  let score = 40;
  if (hasActionVerb) score += 30;
  if (metric) score += 30;
  if (detectedWeakPhrases.length > 0) score = Math.max(20, score - (detectedWeakPhrases.length * 15));
  if (clean.length > 200) score -= 10; // Too verbose
  if (clean.length < 35) score -= 15;  // Too brief

  const suggestions = [];
  if (!hasActionVerb) {
    suggestions.push(`Start with a strong action verb (e.g. "${ACTION_VERBS_BY_CATEGORY['Leadership & Execution'][0]}" or "${ACTION_VERBS_BY_CATEGORY['Technical & Engineering'][0]}") instead of passive voice.`);
  }
  if (!metric) {
    suggestions.push('Add quantifiable metrics (e.g. %, $, time saved, team size, scale) to prove tangible business impact.');
  }
  if (detectedWeakPhrases.length > 0) {
    suggestions.push(`Replace weak phrases like "${detectedWeakPhrases[0].alternatives[0]}" to demonstrate leadership.`);
  }

  return {
    clean,
    hasActionVerb,
    hasMetric: metric,
    firstWord,
    weakPhrases: detectedWeakPhrases,
    score: Math.min(100, Math.max(0, score)),
    suggestions
  };
}

/**
 * Replaces weak phrases in text with their strongest alternatives.
 */
export function autoFixWeakPhrases(text = '') {
  let result = text;
  for (const wp of WEAK_PHRASE_REPLACEMENTS) {
    result = result.replace(wp.match, wp.replacement);
  }
  return result;
}
