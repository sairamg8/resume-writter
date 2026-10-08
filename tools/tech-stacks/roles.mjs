// Classifies a job title into a role type. First match wins, so order matters.
export const ROLES = ['fullstack', 'backend', 'frontend', 'mobile', 'data-ml', 'devops-sre', 'security', 'management', 'software-general', 'other']

const RULES = [
  ['management', /\b(manager|director|vp|vice president|head of|chief|cto|lead of)\b/i],
  ['fullstack', /full[\s-]?stack/i],
  ['frontend', /front[\s-]?end|\bui (engineer|developer)|web (engineer|developer)|\bux engineer|design engineer/i],
  ['backend', /back[\s-]?end|server[\s-]?side|\bapi\b|distributed systems?|microservices?|\bservices? engineer/i],
  ['mobile', /\b(ios|android|mobile|react native|flutter)\b/i],
  ['data-ml', /\b(data|machine learning|ml|ai|research|applied scientist|nlp|computer vision|analytics)\b/i],
  ['devops-sre', /\b(sre|site reliability|devops|infrastructure|platform|cloud|systems? engineer|reliability|release|build)\b/i],
  ['security', /\b(security|appsec|infosec|cyber)\b/i],
  ['software-general', /\b(software|engineer|developer|programmer|member of technical staff|mts|swe)\b/i],
]

export function classifyRole(title) {
  for (const [role, re] of RULES) if (re.test(title)) return role
  return 'other'
}
