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

  // Detect numbers / percentages / currency / metrics
  const metricRegex = /\b(\d+(?:\.\d+)?%|\$\d+(?:,\d{3})*(?:\.\d+)?[KkMmBb]?|\d+\+?|\b\d+\s*(?:hours|days|weeks|months|years|ms|seconds|users|clients|teams|projects))\b/i;
  const hasMetric = metricRegex.test(clean);

  // Check first word for strong action verb
  const firstWord = clean.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
  const allVerbs = Object.values(ACTION_VERBS_BY_CATEGORY).flat().map(v => v.toLowerCase());
  const hasActionVerb = allVerbs.includes(firstWord.toLowerCase());

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
  if (hasMetric) score += 30;
  if (detectedWeakPhrases.length > 0) score = Math.max(20, score - (detectedWeakPhrases.length * 15));
  if (clean.length > 200) score -= 10; // Too verbose
  if (clean.length < 35) score -= 15;  // Too brief

  const suggestions = [];
  if (!hasActionVerb) {
    suggestions.push(`Start with a strong action verb (e.g. "${ACTION_VERBS_BY_CATEGORY['Leadership & Execution'][0]}" or "${ACTION_VERBS_BY_CATEGORY['Technical & Engineering'][0]}") instead of passive voice.`);
  }
  if (!hasMetric) {
    suggestions.push('Add quantifiable metrics (e.g. %, $, time saved, team size, scale) to prove tangible business impact.');
  }
  if (detectedWeakPhrases.length > 0) {
    suggestions.push(`Replace weak phrases like "${detectedWeakPhrases[0].alternatives[0]}" to demonstrate leadership.`);
  }

  return {
    clean,
    hasActionVerb,
    hasMetric,
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
