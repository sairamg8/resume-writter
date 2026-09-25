// Design → Language (R2-148): the words the app itself prints on a résumé — month names, a current
// entry's "Present", and the section titles it gave — in the résumé's language, and the direction
// its page reads in. Everything the user typed prints as typed. A résumé storing no language, as
// every one saved before this setting, prints in English, left to right, exactly as it always did.
// Plain data and relative imports only: node's test runner loads it without the app's @/ aliases.

/**
 * Each language's words. The month names are CLDR's Gregorian ones, as Intl.DateTimeFormat gives
 * them in a month and year ("janv. 2024", Persian and Urdu without the day's ezafe), written out
 * here so the PDF, the preview and every browser print the same words whatever ICU they carry.
 * `titles`: each section type's title in the language, printed where the section keeps a title
 * the app gave it (sectionTitle); `summary`, `contact` and `aboutMe` the headings the templates
 * print themselves, and `fields` the Sidebar's contact labels (English's are CONTACT_LABELS; LinkedIn
 * and GitHub are names, in every language). `dir: 'rtl'` mirrors the page (the PDF's and Word's).
 */
const LANGUAGES = {
  en: {
    name: 'English',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    present: 'Present',
    titles: {
      experience: 'Professional Experience', education: 'Education', skills: 'Skills', projects: 'Projects',
      languages: 'Languages', certifications: 'Certifications', awards: 'Awards & Honors',
      volunteering: 'Volunteering', references: 'References', interests: 'Interests',
    },
    summary: 'Professional Summary', contact: 'Contact', aboutMe: 'About Me',
  },
  es: {
    name: 'Español',
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    monthsShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
    present: 'Actualidad',
    titles: {
      experience: 'Experiencia profesional', education: 'Educación', skills: 'Habilidades', projects: 'Proyectos',
      languages: 'Idiomas', certifications: 'Certificaciones', awards: 'Premios y reconocimientos',
      volunteering: 'Voluntariado', references: 'Referencias', interests: 'Intereses',
    },
    summary: 'Perfil profesional', contact: 'Contacto', aboutMe: 'Sobre mí',
    fields: { email: 'Correo', phone: 'Teléfono', location: 'Ubicación', website: 'Sitio web' },
  },
  fr: {
    name: 'Français',
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    monthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    present: 'Aujourd’hui',
    titles: {
      experience: 'Expérience professionnelle', education: 'Formation', skills: 'Compétences', projects: 'Projets',
      languages: 'Langues', certifications: 'Certifications', awards: 'Prix et distinctions',
      volunteering: 'Bénévolat', references: 'Références', interests: 'Centres d’intérêt',
    },
    summary: 'Profil professionnel', contact: 'Contact', aboutMe: 'À propos de moi',
    fields: { email: 'E-mail', phone: 'Téléphone', location: 'Adresse', website: 'Site web' },
  },
  de: {
    name: 'Deutsch',
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    monthsShort: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
    present: 'heute',
    titles: {
      experience: 'Berufserfahrung', education: 'Ausbildung', skills: 'Kenntnisse', projects: 'Projekte',
      languages: 'Sprachen', certifications: 'Zertifikate', awards: 'Auszeichnungen',
      volunteering: 'Ehrenamt', references: 'Referenzen', interests: 'Interessen',
    },
    summary: 'Profil', contact: 'Kontakt', aboutMe: 'Über mich',
    fields: { email: 'E-Mail', phone: 'Telefon', location: 'Ort', website: 'Website' },
  },
  pt: {
    name: 'Português',
    months: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    monthsShort: ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'],
    present: 'Atual',
    titles: {
      experience: 'Experiência profissional', education: 'Formação acadêmica', skills: 'Competências', projects: 'Projetos',
      languages: 'Idiomas', certifications: 'Certificações', awards: 'Prêmios e distinções',
      volunteering: 'Voluntariado', references: 'Referências', interests: 'Interesses',
    },
    summary: 'Resumo profissional', contact: 'Contato', aboutMe: 'Sobre mim',
    fields: { email: 'E-mail', phone: 'Telefone', location: 'Localização', website: 'Site' },
  },
  it: {
    name: 'Italiano',
    months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    monthsShort: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    present: 'In corso',
    titles: {
      experience: 'Esperienza professionale', education: 'Istruzione', skills: 'Competenze', projects: 'Progetti',
      languages: 'Lingue', certifications: 'Certificazioni', awards: 'Premi e riconoscimenti',
      volunteering: 'Volontariato', references: 'Referenze', interests: 'Interessi',
    },
    summary: 'Profilo professionale', contact: 'Contatti', aboutMe: 'Chi sono',
    fields: { email: 'Email', phone: 'Telefono', location: 'Località', website: 'Sito web' },
  },
  nl: {
    name: 'Nederlands',
    months: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
    monthsShort: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
    present: 'heden',
    titles: {
      experience: 'Werkervaring', education: 'Opleiding', skills: 'Vaardigheden', projects: 'Projecten',
      languages: 'Talen', certifications: 'Certificeringen', awards: 'Prijzen en onderscheidingen',
      volunteering: 'Vrijwilligerswerk', references: 'Referenties', interests: 'Interesses',
    },
    summary: 'Profiel', contact: 'Contact', aboutMe: 'Over mij',
    fields: { email: 'E-mail', phone: 'Telefoon', location: 'Locatie', website: 'Website' },
  },
  ar: {
    name: 'العربية',
    dir: 'rtl',
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    present: 'حتى الآن',
    titles: {
      experience: 'الخبرة المهنية', education: 'التعليم', skills: 'المهارات', projects: 'المشاريع',
      languages: 'اللغات', certifications: 'الشهادات', awards: 'الجوائز والتكريمات',
      volunteering: 'العمل التطوعي', references: 'المراجع', interests: 'الاهتمامات',
    },
    summary: 'الملخص المهني', contact: 'التواصل', aboutMe: 'نبذة عني',
    fields: { email: 'البريد الإلكتروني', phone: 'الهاتف', location: 'الموقع', website: 'الموقع الإلكتروني' },
  },
  he: {
    name: 'עברית',
    dir: 'rtl',
    months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
    present: 'היום',
    titles: {
      experience: 'ניסיון תעסוקתי', education: 'השכלה', skills: 'כישורים', projects: 'פרויקטים',
      languages: 'שפות', certifications: 'הסמכות', awards: 'פרסים והוקרות',
      volunteering: 'התנדבות', references: 'ממליצים', interests: 'תחומי עניין',
    },
    summary: 'תקציר מקצועי', contact: 'פרטי קשר', aboutMe: 'קצת עליי',
    fields: { email: 'דוא״ל', phone: 'טלפון', location: 'מיקום', website: 'אתר' },
  },
  fa: {
    name: 'فارسی',
    dir: 'rtl',
    months: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    present: 'اکنون',
    titles: {
      experience: 'سوابق شغلی', education: 'تحصیلات', skills: 'مهارت‌ها', projects: 'پروژه‌ها',
      languages: 'زبان‌ها', certifications: 'گواهینامه‌ها', awards: 'جوایز و افتخارات',
      volunteering: 'فعالیت‌های داوطلبانه', references: 'معرف‌ها', interests: 'علایق',
    },
    summary: 'خلاصه حرفه‌ای', contact: 'اطلاعات تماس', aboutMe: 'درباره من',
    fields: { email: 'ایمیل', phone: 'تلفن', location: 'محل سکونت', website: 'وب‌سایت' },
  },
  ur: {
    name: 'اردو',
    dir: 'rtl',
    months: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    present: 'تاحال',
    titles: {
      experience: 'پیشہ ورانہ تجربہ', education: 'تعلیم', skills: 'مہارتیں', projects: 'منصوبے',
      languages: 'زبانیں', certifications: 'اسناد', awards: 'اعزازات',
      volunteering: 'رضاکارانہ کام', references: 'حوالہ جات', interests: 'دلچسپیاں',
    },
    summary: 'پیشہ ورانہ خلاصہ', contact: 'رابطہ', aboutMe: 'میرے بارے میں',
    fields: { email: 'ای میل', phone: 'فون', location: 'مقام', website: 'ویب سائٹ' },
  },
};

/** English: what a résumé storing no language, or one a newer build stored, prints in. */
export const DEFAULT_LANGUAGE = 'en';

/** Design → Language's choices, English first: [id, the language's own name]. */
export const RESUME_LANGUAGES = Object.entries(LANGUAGES).map(([id, l]) => [id, l.name]);

/**
 * The résumé's language: its stored `settings.language` when this build knows it, else English —
 * also for a value a newer build stored, which stays stored as it is (normalizeResume keeps it).
 */
export function languageOf(settings) {
  const id = settings?.language;
  return typeof id === 'string' && Object.hasOwn(LANGUAGES, id) ? id : DEFAULT_LANGUAGE;
}

/** The words of the résumé with `settings`: its language's (LANGUAGES), a short month the long one where the language has none. */
export function languageWords(settings) {
  const l = LANGUAGES[languageOf(settings)];
  return { ...l, monthsShort: l.monthsShort || l.months };
}

/**
 * Every word the résumé with `settings` can print in its language, for the PDF's font choice: an
 * Arabic month on a résumé typed in Latin letters needs the Arabic face as much as typed Arabic
 * does. Nothing for English, whose words the Latin face draws.
 */
export function languageText(settings) {
  if (languageOf(settings) === DEFAULT_LANGUAGE) return '';
  const w = languageWords(settings);
  return [...w.months, ...w.monthsShort, w.present, ...Object.values(w.titles), w.summary, w.contact, w.aboutMe, ...Object.values(w.fields || {})].join(' ');
}

/** 'rtl' for a résumé in Arabic, Hebrew, Persian or Urdu, else 'ltr'. */
export const directionOf = (settings) => (LANGUAGES[languageOf(settings)].dir === 'rtl' ? 'rtl' : 'ltr');

/** True when the résumé with `settings` reads right to left. */
export const isRtl = (settings) => directionOf(settings) === 'rtl';

/**
 * The English titles the app gives each section type: the one a new section gets (English's
 * `titles`), and the ones the role starters use. A section still holding one of them was not
 * renamed, so it prints in the résumé's language.
 */
const APP_TITLES = {
  experience: ['Experience', 'Work Experience'],
  awards: ['Awards'],
};

const isAppTitle = (type, title) => {
  const t = String(title ?? '').trim().toLowerCase();
  const titles = [LANGUAGES.en.titles[type], ...(APP_TITLES[type] || [])].filter(Boolean);
  return titles.some((x) => x.toLowerCase() === t);
};

/**
 * A section's title as the résumé with `settings` prints it: the title the app gave its type, in the
 * résumé's language; any title the user wrote (or an import brought) exactly as stored. English
 * prints every title as stored.
 */
export function sectionTitle(section, settings) {
  const title = section?.title;
  if (languageOf(settings) === DEFAULT_LANGUAGE || !isAppTitle(section?.type, title)) return title;
  return LANGUAGES[languageOf(settings)].titles[section.type] ?? title;
}

/** `sections` each with its title as the résumé with `settings` prints it (sectionTitle); English returns them as they are. */
export function withPrintedTitles(sections, settings) {
  if (languageOf(settings) === DEFAULT_LANGUAGE || !Array.isArray(sections)) return sections;
  return sections.map((s) => {
    const title = sectionTitle(s, settings);
    return title === s?.title ? s : { ...s, title };
  });
}
