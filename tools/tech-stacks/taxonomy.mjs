// Technology taxonomy used to tag job postings. Each entry: [name, category, regex source, flags?].
// Ambiguous words (Go, R, C, Swift, Rust, Spring, Rails) need context so they do not match prose.

export const CATEGORIES = ['frontend', 'backend', 'mobile', 'data', 'cloud', 'devops', 'database']

const defs = [
  // frontend
  ['React', 'frontend', String.raw`\breact(?:\.js|js)?\b(?!\s+(?:to|quickly|fast|swiftly|appropriately))`, 'i'],
  ['Next.js', 'frontend', String.raw`\bnext\.?js\b`, 'i'],
  ['Angular', 'frontend', String.raw`\bangular(?:js)?\b`, 'i'],
  ['Vue', 'frontend', String.raw`\bvue(?:\.js|js)?\b`, 'i'],
  ['Svelte', 'frontend', String.raw`\bsvelte(?:kit)?\b`, 'i'],
  ['TypeScript', 'frontend', String.raw`\btypescript\b`, 'i'],
  ['JavaScript', 'frontend', String.raw`\bjavascript\b`, 'i'],
  ['HTML/CSS', 'frontend', String.raw`\b(?:html5?|css3?)\b`, 'i'],
  ['Tailwind', 'frontend', String.raw`\btailwind(?:css)?\b`, 'i'],
  ['Redux', 'frontend', String.raw`\bredux\b`, 'i'],
  ['GraphQL', 'frontend', String.raw`\bgraphql\b`, 'i'],
  ['Webpack/Vite', 'frontend', String.raw`\b(?:webpack|vite)\b`, 'i'],
  // backend
  ['Java', 'backend', String.raw`\bjava\b(?!\s*script)`, 'i'],
  ['Kotlin', 'backend', String.raw`\bkotlin\b`, 'i'],
  ['Scala', 'backend', String.raw`\bscala\b`, 'i'],
  ['Python', 'backend', String.raw`\bpython\b`, 'i'],
  ['Go', 'backend', String.raw`\bgolang\b|\bGo\s*(?:,|/|\)|;)|\b(?:in|with|using|and|or)\s+Go\b(?!\s+(?:to|the|a|an|live|beyond|above))|\bGo\s+(?:services?|backend|programming|developer|engineer|microservices?)\b`],
  ['Ruby', 'backend', String.raw`\bruby\b`, 'i'],
  ['Rails', 'backend', String.raw`\b(?:ruby on rails|rails)\b`, 'i'],
  ['Node.js', 'backend', String.raw`\bnode(?:\.js|js)\b|\bnode\s+(?:backend|services?)\b`, 'i'],
  ['C#/.NET', 'backend', String.raw`(?:\bC#|\.net\b|\bdotnet\b|\basp\.net\b)`, 'i'],
  ['C++', 'backend', String.raw`\bC\+\+`],
  ['Rust', 'backend', String.raw`\brust\b(?!\s+(?:belt|bucket))`, 'i'],
  ['PHP', 'backend', String.raw`\bphp\b`, 'i'],
  ['Elixir', 'backend', String.raw`\belixir\b`, 'i'],
  ['Spring', 'backend', String.raw`\bspring(?:\s+(?:boot|framework|cloud|mvc))\b|\bspring\b(?=.{0,20}\bjava\b)`, 'i'],
  ['Django/Flask/FastAPI', 'backend', String.raw`\b(?:django|flask|fastapi)\b`, 'i'],
  ['gRPC', 'backend', String.raw`\bgrpc\b`, 'i'],
  ['Kafka', 'backend', String.raw`\bkafka\b`, 'i'],
  // mobile
  ['Swift/iOS', 'mobile', String.raw`\b(?:swift(?:ui)?|objective-c|ios)\b`, 'i'],
  ['Android', 'mobile', String.raw`\bandroid\b`, 'i'],
  ['React Native', 'mobile', String.raw`\breact[ -]native\b`, 'i'],
  ['Flutter', 'mobile', String.raw`\bflutter\b`, 'i'],
  // data / ml
  ['Spark', 'data', String.raw`\b(?:apache )?spark\b(?=.{0,40}(?:data|scala|python|pyspark|cluster|job|hadoop|sql))|\bpyspark\b`, 'i'],
  ['Airflow', 'data', String.raw`\bairflow\b`, 'i'],
  ['dbt', 'data', String.raw`\bdbt\b`, 'i'],
  ['Snowflake', 'data', String.raw`\bsnowflake\b`, 'i'],
  ['Databricks', 'data', String.raw`\bdatabricks\b`, 'i'],
  ['BigQuery', 'data', String.raw`\bbigquery\b`, 'i'],
  ['Hadoop', 'data', String.raw`\bhadoop\b`, 'i'],
  ['Flink', 'data', String.raw`\bflink\b`, 'i'],
  ['PyTorch', 'data', String.raw`\bpytorch\b`, 'i'],
  ['TensorFlow', 'data', String.raw`\btensorflow\b`, 'i'],
  ['Pandas/NumPy', 'data', String.raw`\b(?:pandas|numpy)\b`, 'i'],
  // cloud
  ['AWS', 'cloud', String.raw`\b(?:aws|amazon web services)\b`, 'i'],
  ['GCP', 'cloud', String.raw`\b(?:gcp|google cloud)\b`, 'i'],
  ['Azure', 'cloud', String.raw`\bazure\b`, 'i'],
  // devops
  ['Kubernetes', 'devops', String.raw`\b(?:kubernetes|k8s)\b`, 'i'],
  ['Docker', 'devops', String.raw`\bdocker\b`, 'i'],
  ['Terraform', 'devops', String.raw`\bterraform\b`, 'i'],
  ['Ansible', 'devops', String.raw`\bansible\b`, 'i'],
  ['Jenkins', 'devops', String.raw`\bjenkins\b`, 'i'],
  ['GitHub Actions', 'devops', String.raw`\bgithub actions\b`, 'i'],
  ['Prometheus/Grafana', 'devops', String.raw`\b(?:prometheus|grafana)\b`, 'i'],
  ['Datadog', 'devops', String.raw`\bdatadog\b`, 'i'],
  ['Linux', 'devops', String.raw`\blinux\b`, 'i'],
  // databases
  ['PostgreSQL', 'database', String.raw`\b(?:postgres(?:ql)?)\b`, 'i'],
  ['MySQL', 'database', String.raw`\bmysql\b`, 'i'],
  ['MongoDB', 'database', String.raw`\bmongo(?:db)?\b`, 'i'],
  ['Redis', 'database', String.raw`\bredis\b`, 'i'],
  ['Cassandra', 'database', String.raw`\bcassandra\b`, 'i'],
  ['DynamoDB', 'database', String.raw`\bdynamodb\b`, 'i'],
  ['Elasticsearch', 'database', String.raw`\b(?:elasticsearch|opensearch)\b`, 'i'],
  ['SQL', 'database', String.raw`\bsql\b`, 'i'],
]

export const TECH = defs.map(([name, category, src, flags = '']) => ({ name, category, re: new RegExp(src, flags) }))
