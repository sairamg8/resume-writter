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

/**
 * A weak-phrase entry: `phrases` matched as whole words — not inside a longer word ("Networked with",
 * "unhandled", R4-LO-11), accented letters counted as letters — with `after` a further condition on
 * what follows. `match` has one capture group (autoFixWeakPhrases reads its offset from that).
 */
const weak = (phrases, replacement, alternatives, after = '') => ({
  phrases,
  replacement,
  alternatives,
  match: new RegExp(`(?<![\\p{L}\\d])(${phrases.join('|')})(?![\\p{L}\\d])${after}`, 'giu'),
});

// ── The one weak-phrase list: the ATS score's "passive language" and the optimizer's ──
// Each kept its own, and they disagreed: "Tasked with…" was passive to the score while the optimizer
// said "No Weak Words" and Auto-Fix could not touch it; "Ensured…" was the reverse (R4-SW-WT-03). The
// ATS score reads this list too (atsChecker.js), so every phrase it counts has a replacement here.
export const WEAK_PHRASE_REPLACEMENTS = [
  weak(['was responsible for', 'responsible for', 'responsibilities included', 'duties included', 'tasked with'], 'Led', ['Directed', 'Oversaw', 'Spearheaded']),
  weak(['worked on', 'worked with'], 'Engineered', ['Co-developed', 'Collaborated on', 'Built']),
  weak(['helped with', 'assisted with', 'assisted in'], 'Facilitated', ['Supported delivery of', 'Co-engineered', 'Accelerated']),
  // "Helped to cut costs" has a verb after it, as "tried to" has: "Facilitated cut costs" was no sentence.
  weak(['helped to'], 'Facilitated efforts to', ['Supported efforts to', 'Drove efforts to', 'Accelerated efforts to']),
  weak(['handled'], 'Managed', ['Resolved', 'Administered', 'Executed']),
  // "did" as a main verb only: in "did not" it is a helper verb, and Auto-Fix wrote "delivered not" (R4-LO-10).
  weak(['did'], 'Delivered', ['Conducted', 'Accomplished', 'Produced'], '(?!\\s+(?:not|never)(?![\\p{L}\\d]))'),
  weak(['made sure', 'ensured that', 'ensured'], 'Guaranteed', ['Maintained compliance with', 'Enforced', 'Safeguarded']),
  weak(['changed'], 'Transformed', ['Modernized', 'Overhauled', 'Refactored']),
  weak(['participated in', 'was involved in'], 'Contributed to', ['Partnered in', 'Active member of', 'Drove']),
  weak(['in charge of'], 'Oversaw', ['Led', 'Directed', 'Headed']),
  // "Tried to cut costs" → "Led efforts to cut costs": a bare verb read "Drove cut costs".
  weak(['tried to', 'attempted to'], 'Led efforts to', ['Drove efforts to', 'Spearheaded efforts to', 'Championed efforts to']),
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

  // Common strong verbs the list lacked: a statement opening with one read "Verb Missing", and a
  // power-verb chip went in front of it — "Spearheaded Launched…", "Spearheaded Shipped…", from the
  // starters' own bullets and the modal's own rewrite tip (R5-HUNT9-OPTIMIZER-VERB-CHIP-DOUBLES-UNLISTED-VERB).
  'adopted', 'attained', 'awarded', 'completed', 'containerized', 'contributed', 'converted',
  'crafted', 'defined', 'demonstrated', 'drove', 'extended', 'fine-tuned', 'fixed', 'initiated',
  'instrumented', 'introduced', 'landed', 'launched', 'lectured', 'lowered', 'obtained', 'onboarded',
  'operated', 'owned', 'piloted', 'ran', 'rebuilt', 'released', 'rescued', 'retained', 'revitalized',
  'rewrote', 'rolled', 'shaped', 'shipped', 'sold', 'solved', 'taught', 'trimmed', 'tutored', 'won',

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
 * digit in a name such as "S3", "EC2" or "Web3", and not a year.
 */
export function hasMetric(text) {
  const clean = String(text || '').trim();
  // A calendar year ("in 2021", "2019–2022", "the 2020s") measures nothing: it is read as no number
  // at all, or "Joined Acme in 2021" scored as a quantified result (R4-CL-09). "$2019", "2019%",
  // "2000+" and "2010k" stay numbers.
  const noYears = clean
    // A year range or a month and year ("2019–22", "2019/20", "05/2021") is dates too, all of it.
    .replace(/(?<![\p{L}\d$])(?:19|20)\d{2}\s*[–—/-]\s*\d{2}(?![\d%+kKmMbBxX$])/gu, '')
    .replace(/(?<![\p{L}\d$])\d{1,2}\/(?:19|20)\d{2}(?![\d%+kKmMbBxX$])/gu, '')
    .replace(/(?<![\p{L}\d$]|\d[.,])(?:19|20)\d{2}(?![\d%+kKmMbBxX$]|[.,]\d)/gu, '')
    // A fiscal year ("FY2021", "FY21-22", "FY '21") is a date too (R4-LO-15).
    .replace(/(?<!\p{L})FY\s*['’-]?\s*\d{2}(?:\d{2})?(?:\s*[–—/-]\s*\d{2,4})?(?![\d%+kKmMbBxX$])/giu, '')
    // A multiplier or currency written before its number ("x10", "Rs.500", "EUR500k") leaves the number whole.
    .replace(/(?<!\p{L})(?:x|rs\.?|inr|usd|eur|gbp|aud|cad|chf|jpy|cny|sgd)(?=\s?\d)/giu, ' ');
  // Digits glued to letters are part of a name, all of them: the "021" of "FY2021" and the "0" of
  // "v2.0" counted as a number of their own, only the first digit was checked (R4-LO-15).
  return /(?<!\p{L}[\d.,]*)\d/u.test(noYears) && !/^\d{4}$/.test(clean);
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
    const found = clean.match(new RegExp(wp.match.source, 'iu'));
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
    // The words it found, and what they could be instead: it used to quote the first alternative as
    // the weak phrase — "Resolved" on a statement that said "handled" (R2-078).
    const { phrase, replacement, alternatives } = detectedWeakPhrases[0];
    suggestions.push(`Replace the weak phrase "${phrase}" with a power verb such as "${replacement}" or "${alternatives[0]}" to demonstrate leadership.`);
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
 * The statement with power verb `verb` clicked in (R4-CL-07): it replaces a leading action verb, or a
 * leading weak phrase ("Responsible for" → "Spearheaded"), and otherwise goes before the first word,
 * which is lowercased only when it is a word that is never a name ("In 2023, built" → "Spearheaded in
 * 2023, built"; "AWS" and "Kubernetes" stay, R4-LO-13). It always replaced the first word, whatever
 * it was ("Spearheaded for migrating…"), and joined the lines of the statement into one. Every other
 * character is kept. A statement opening with a helper verb or a negation ("Did not miss…", "Was
 * promoted…", "Never missed…") is returned as it is (opensWithAuxiliary): no verb can go before it —
 * "Spearheaded did not miss…" — and dropping the words would change what it says (R4-SW-WT-04).
 */
export function insertActionVerb(text, verb) {
  const s = String(text ?? '');
  if (!s.trim()) return `${verb} `;
  // Bullet marks, quotes and spaces before the first word stay where they are ("- Led …").
  const lead = s.match(LEAD_MARKS)[0];
  const rest = s.slice(lead.length);
  // A verb phrase Auto-Fix or the tips write ("Contributed to", "Collaborated on") goes whole, or the
  // chip left "Spearheaded to the hackathon".
  // "Led efforts to" keeps its "efforts to", which has a verb after it: "Led efforts to cut costs"
  // read "Spearheaded cut costs" (review of R4-SW-WT-03).
  const phrase = rest.match(LEADING_VERB_PHRASE);
  if (phrase) return lead + verb + (/ efforts to$/i.test(phrase[0]) ? ' efforts to' : '') + rest.slice(phrase[0].length);
  if (leadsWithActionVerb(rest)) return lead + rest.replace(/^\p{L}[\p{L}'’-]*/u, verb);
  for (const wp of WEAK_PHRASE_REPLACEMENTS) {
    const weak = new RegExp(`^${wp.match.source}`, 'iu');
    // "Tried to", "Attempted to" and "Helped to" have a verb after them: the chip keeps it one, as
    // Auto-Fix does ("Spearheaded efforts to cut costs", not "Spearheaded cut costs").
    if (weak.test(rest)) return lead + rest.replace(weak, (_, found) => (/\sto$/i.test(found) ? `${verb} efforts to` : verb));
  }
  if (AUXILIARY_LEAD.test(rest)) return s;
  const [word] = rest.match(/^\p{L}*/u);
  return `${lead}${verb} ${FUNCTION_WORDS.has(word.toLowerCase()) && /^\p{Lu}\p{Ll}*$/u.test(word) ? word[0].toLowerCase() + rest.slice(1) : rest}`;
}

/** Bullet marks, quotes and spaces before a statement's first word. */
const LEAD_MARKS = /^[\s•\-*–—◦▪▸‣⁃"'“‘(]*/u;

/**
 * A helper verb or a negation as a statement's first word: "Did not", "Didn't", "Was", "Has", "Never"…,
 * and the modal ones: "Could not", "Can't", "Cannot", "Won't", "Should", "Must", "Might"… — they took a
 * chip's verb in front ("Spearheaded Could not reproduce…", review of R4-SW-WT-04). "May" before a
 * number is the month ("May 2023: shipped…"), not the helper verb. A statement opening with another
 * negative — "No", "Nobody", "None", "Nothing", "Neither", "Nor", "Zero" — took it too: "Spearheaded no
 * customer data was lost…" (review of R4-SW-WT-03); "No-code …" and "Zero-downtime …" are
 * a noun's first word, and still take a verb.
 */
const AUXILIARY_LEAD = /^(?:(?:did|does|do|was|were|is|are|has|have|had|been|being|never|not|cannot|can|could|will|would|shall|should|must|might|may(?!\s*\d)|(?:wo|sha)(?=n['’]t))(?:n['’]t)?(?![\p{L}\d])|(?:no(?:body|ne|thing)?|neither|nor|zero)(?![\p{L}\d.-]))/iu;

/**
 * Whether a power-verb chip leaves `text` as it is because it opens with a helper verb or a negation
 * ("Did not miss a release deadline"): the optimizer then asks for a rewrite instead (R4-SW-WT-04).
 * "Did" as a main verb ("Did the audit") is a weak phrase the chip replaces, and is not one of these.
 */
export function opensWithAuxiliary(text) {
  const rest = String(text ?? '').replace(LEAD_MARKS, '');
  return AUXILIARY_LEAD.test(rest) && insertActionVerb(text, 'Led') === String(text ?? '');
}

/**
 * The words lowercased when a power verb goes before them ("In 2023" → "Spearheaded in 2023"): words
 * that are never a name. Any other capitalised word keeps its case, as it may be one — "Kubernetes
 * cluster…" read "Spearheaded kubernetes cluster…" (R4-LO-13).
 */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'our', 'your', 'his', 'her', 'its', 'their',
  'we', 'you', 'he', 'she', 'it', 'they', 'each', 'every', 'all', 'both', 'some', 'many', 'several',
  'multiple', 'various', 'other', 'another', 'any', 'no', 'more', 'most', 'over', 'under', 'in', 'on',
  'at', 'by', 'for', 'from', 'to', 'into', 'onto', 'with', 'within', 'without', 'across', 'after',
  'before', 'during', 'since', 'until', 'through', 'throughout', 'while', 'when', 'as', 'of', 'about',
  'above', 'below', 'between', 'among', 'along', 'around', 'behind', 'beyond', 'despite', 'via', 'per',
  'and', 'or', 'but', 'also', 'then', 'not', 'did', 'was', 'were', 'is', 'are', 'has', 'had', 'have',
  'been', 'being', 'be', 'successfully',
]);

/** The verb phrases of more than one word among Auto-Fix's replacements and their alternatives. */
const LEADING_VERB_PHRASE = new RegExp(`^(?:${WEAK_PHRASE_REPLACEMENTS
  .flatMap(({ replacement, alternatives }) => [replacement, ...alternatives])
  .filter((p) => p.includes(' '))
  .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')})\\b`, 'iu');

/**
 * The statement with a metric phrase ("by 35%") added at its end, before its closing punctuation:
 * "Reduced latency for checkout." becomes "Reduced latency for checkout by 35%.", not "… checkout. by
 * 35%", and an empty statement is the phrase alone (R4-CL-08).
 */
export function insertMetric(text, metric) {
  let [, body, stop] = String(text ?? '').trim().match(/^([\s\S]*?)([.!?;:]*)$/);
  // An abbreviation's dot ("etc.", "Inc.", "U.S.") is part of its word and stays on it; the sentence
  // still ends with one after the metric. "…APIs, etc." read "…APIs, etc by 35%." (R4-LO-14).
  if (stop.startsWith('.') && ABBREVIATION_END.test(body)) body += '.';
  return body.trim() ? `${body.trimEnd()} ${metric}${stop}` : metric;
}

/** Text ending in a word written with a dot: a known abbreviation, or letters split by dots ("e.g", "U.S"). */
const ABBREVIATION_END = /(?:(?<![\p{L}\d])(?:etc|inc|ltd|co|corp|llc|jr|sr|vs|approx|dept|misc|mr|mrs|dr)|\p{L}\.\p{L})$/iu;

/**
 * Whether the text before a phrase ends where a sentence starts: nothing, or a line break or a
 * sentence's end (". ", "! ", "? "), then only spaces, bullet marks or opening quotes.
 */
const SENTENCE_START = /(?:^|[.!?]\s|\n)[\s•\-*–—◦▪▸‣⁃"'“‘(]*$/;

/**
 * Replaces weak phrases in text with their strongest alternatives — capitalised where a sentence
 * starts, in lowercase inside one: "Engineered 4 APIs; handled QA" becomes "…; managed QA", not
 * "…; Managed QA" (R2-078).
 */
export function autoFixWeakPhrases(text = '') {
  let result = text;
  for (const wp of WEAK_PHRASE_REPLACEMENTS) {
    // Each pattern has one group, so the offset and the whole text are the last two arguments.
    result = result.replace(wp.match, (...args) => {
      const [offset, whole] = args.slice(-2);
      return SENTENCE_START.test(whole.slice(0, offset))
        ? wp.replacement
        : wp.replacement[0].toLowerCase() + wp.replacement.slice(1);
    });
  }
  return result;
}
