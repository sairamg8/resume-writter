// Per-posting analysis helpers: required-vs-preferred text zones, role inference for generic
// titles, and a coarse region guess from the location string.
import { TECH } from './taxonomy.mjs'

const PREF_HEAD = /^[\s\-*•]*(nice[\s-]to[\s-]haves?|bonus(?:\s+points)?|preferred(?:\s+(?:qualifications|skills|experience))?|desired(?:\s+skills)?|extra\s+credit|pluses|good\s+to\s+have|what\s+(?:would|will)\s+make\s+you\s+(?:stand\s+out|a\s+great\s+fit)|even\s+better|bonus\s+skills)\b/i
const REQ_HEAD = /^[\s\-*•]*(requirements?|qualifications?|minimum\s+qualifications|basic\s+qualifications|what\s+you(?:'|’)?ll\s+(?:do|need|bring)|what\s+you\s+will\s+(?:do|need|bring)|responsibilities|about\s+you|who\s+you\s+are|you\s+have|you\s+will|about\s+the\s+(?:role|job|team)|the\s+role|what\s+we\s+offer|benefits|why\s+join|compensation|how\s+we\s+work)\b/i
const PREF_INLINE = /\b(?:a\s+plus|is\s+a\s+plus|are\s+a\s+plus|nice\s+to\s+have|bonus\s+points?|preferred|ideally|desirable|an\s+advantage|a\s+bonus|is\s+beneficial|nice-to-have)\b/i

// Splits a description into the text that states requirements/responsibilities and the text that
// is explicitly optional ("nice to have", "bonus", "preferred", ...). Heuristic, line-based.
export function splitZones(text) {
  const required = []
  const preferred = []
  let inPref = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const short = line.length < 90
    if (short && PREF_HEAD.test(line)) inPref = true
    else if (short && REQ_HEAD.test(line)) inPref = false
    ;(inPref || PREF_INLINE.test(line) ? preferred : required).push(line)
  }
  return { required: required.join('\n'), preferred: preferred.join('\n') }
}

export function matchTech(text) {
  const out = []
  for (const t of TECH) if (t.re.test(text)) out.push(t.name)
  return out
}

const FRONT_SIGNALS = new Set(['React', 'Angular', 'Vue', 'Svelte', 'Next.js', 'Nuxt', 'HTML/CSS', 'Tailwind', 'Redux', 'Webpack/Vite', 'Sass/styled-components', 'MobX/Zustand/Recoil', 'Storybook', 'jQuery'])
const BACK_SIGNALS = new Set(['Java', 'Go', 'Ruby', 'Rails', 'C#/.NET', 'Kotlin', 'Scala', 'PHP', 'Elixir', 'Node.js', 'Express', 'NestJS', 'Spring Boot', 'Spring Framework', 'Django', 'Flask', 'FastAPI', 'gRPC', 'Kafka', 'PostgreSQL', 'MySQL', 'Redis', 'Cassandra', 'DynamoDB', 'Laravel', 'Symfony', 'Phoenix', 'ASP.NET Core', 'Micronaut', 'Quarkus', 'Ktor'])

// A generic "Software Engineer" title says nothing about the stack, so infer the role from the
// technologies the posting asks for: frontend-only signals -> frontend, backend-only -> backend,
// both -> fullstack. Falls back to software-general when there is no signal.
export function inferRole(titleRole, techs) {
  if (titleRole !== 'software-general') return { role: titleRole, source: 'title' }
  const f = techs.filter((t) => FRONT_SIGNALS.has(t)).length
  const b = techs.filter((t) => BACK_SIGNALS.has(t)).length
  if (f >= 1 && b >= 1) return { role: 'fullstack', source: 'inferred' }
  if (f >= 2) return { role: 'frontend', source: 'inferred' }
  if (b >= 2) return { role: 'backend', source: 'inferred' }
  return { role: 'software-general', source: 'title' }
}

const REGIONS = [
  ['india', /\b(india|bangalore|bengaluru|hyderabad|pune|mumbai|chennai|gurgaon|gurugram|noida|delhi|kolkata)\b/i],
  ['canada', /\b(canada|toronto|vancouver|montreal|montréal|ottawa|calgary|waterloo)\b/i],
  ['europe', /\b(europe|emea|london|uk|united kingdom|england|germany|berlin|munich|france|paris|spain|madrid|barcelona|netherlands|amsterdam|poland|warsaw|krakow|kraków|sweden|stockholm|ireland|dublin|portugal|lisbon|switzerland|zurich|zürich|italy|milan|denmark|copenhagen|finland|helsinki|norway|oslo|austria|vienna|czech|prague|romania|bucharest|estonia|tallinn|lithuania|vilnius|latvia|riga|ukraine|greece|athens|belgium|brussels|hungary|budapest|bulgaria|sofia|serbia|croatia)\b/i],
  ['apac', /\b(apac|singapore|australia|sydney|melbourne|japan|tokyo|china|shanghai|beijing|shenzhen|hong kong|korea|seoul|indonesia|jakarta|philippines|manila|vietnam|thailand|bangkok|malaysia|new zealand|taiwan|taipei)\b/i],
  ['latam', /\b(latam|brazil|brasil|são paulo|sao paulo|mexico|méxico|argentina|buenos aires|colombia|bogot|chile|santiago|peru|lima|uruguay|costa rica)\b/i],
  ['middle-east-africa', /\b(israel|tel aviv|dubai|uae|saudi|riyadh|egypt|cairo|nigeria|lagos|kenya|nairobi|south africa|cape town|turkey|istanbul|ghana|accra|morocco)\b/i],
]
export function regionOf(location) {
  for (const [name, re] of REGIONS) if (re.test(location || '')) return name
  return 'us-or-unspecified'
}
