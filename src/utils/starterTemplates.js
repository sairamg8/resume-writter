import { BASE_COVER_LETTER } from './defaultDataContent.js';
import { DATA_VERSION } from './dataVersion.js';
import { getStarterSettings } from './starterSettings.js';
import { ACADEMIC_STARTER } from './starterAcademic.js';

// The design settings a starter (or a JSON Resume import) starts with: ./starterSettings.js.
export { getStarterSettings };

export const STARTER_TEMPLATES = [
  {
    id: 'software-engineer',
    name: 'Software Engineer (Full Stack)',
    badge: 'Tech & Engineering',
    description: 'High-impact bullet points with metrics (%, RPS, latency) and modern tech stack.',
    template: 'classic',
    personal: {
      name: 'Alex Morgan',
      title: 'Senior Full Stack Engineer',
      email: 'alex.morgan@email.com',
      phone: '+1 (555) 234-5678',
      location: 'San Francisco, CA',
      website: 'alexmorgan.dev',
      linkedin: 'linkedin.com/in/alexmorgan',
      github: 'github.com/alexmorgan',
      summary: 'Results-driven Full Stack Engineer with 6+ years of experience designing and scaling distributed systems, cloud microservices, and reactive web applications. Proven track record of optimizing latency by 45% and supporting 2M+ active users.',
      hiddenFields: []
    },
    sections: [
      {
        id: 'sec-exp',
        type: 'experience',
        title: 'Work Experience',
        visible: true,
        items: [
          {
            id: 'exp-1',
            role: 'Senior Software Engineer',
            company: 'Stripe Technologies',
            location: 'San Francisco, CA',
            startDate: '2022-03',
            endDate: '',
            current: true,
            description: '<ul><li>Architected event-driven microservices processing 120K transactions/minute, cutting payment processing latency by 38%.</li><li>Spearheaded migration from monolith to Kubernetes cluster, improving system reliability to 99.99% uptime.</li><li>Mentored 8 mid-level engineers and standardized CI/CD pipelines, reducing deployment cycle times from 2 days to 25 minutes.</li></ul>'
          },
          {
            id: 'exp-2',
            role: 'Full Stack Developer',
            company: 'NextGen Solutions',
            location: 'Austin, TX',
            startDate: '2019-06',
            endDate: '2022-02',
            current: false,
            description: '<ul><li>Engineered customer-facing dashboard in React and Node.js used by 450K monthly active users.</li><li>Optimized database queries and introduced Redis caching layer, reducing server response times by 55%.</li><li>Collaborated with product and UX teams to deliver 14 high-priority features ahead of schedule.</li></ul>'
          }
        ]
      },
      {
        id: 'sec-skills',
        type: 'skills',
        title: 'Skills',
        visible: true,
        items: [
          { id: 'sk-1', category: '', skills: 'TypeScript / JavaScript, React & Next.js, Node.js & Go, PostgreSQL & Redis, Docker & Kubernetes, AWS & Cloud Architecture, GraphQL & REST APIs, CI/CD & DevOps' }
        ]
      },
      {
        id: 'sec-edu',
        type: 'education',
        title: 'Education',
        visible: true,
        items: [
          {
            id: 'edu-1',
            institution: 'University of California, Berkeley',
            degree: 'B.S. in Computer Science',
            fieldOfStudy: 'Computer Science',
            location: 'Berkeley, CA',
            startDate: '2015-08',
            endDate: '2019-05',
            gpa: '3.8',
            description: 'Dean’s Honor List. Coursework: Distributed Systems, Algorithms, Database Management.'
          }
        ]
      },
      {
        id: 'sec-proj',
        type: 'projects',
        title: 'Projects',
        visible: true,
        items: [
          {
            id: 'proj-1',
            name: 'CloudScale Monitor',
            url: 'https://github.com/alexmorgan/cloudscale',
            technologies: 'Go, React, Prometheus, Docker',
            startDate: '2023-01',
            endDate: '2023-08',
            description: 'Open-source distributed telemetry dashboard monitoring microservices health in real time. Garnered 1,200+ GitHub stars.'
          }
        ]
      }
    ]
  },
  {
    id: 'product-manager',
    name: 'Product Manager',
    badge: 'Product & Strategy',
    description: 'Outcome-oriented achievements focused on roadmap execution, ARR growth, and cross-functional leadership.',
    template: 'modern',
    personal: {
      name: 'Sarah Chen',
      title: 'Lead Product Manager',
      email: 'sarah.chen@email.com',
      phone: '+1 (555) 345-6789',
      location: 'New York, NY',
      website: 'sarahchen.pm',
      linkedin: 'linkedin.com/in/sarahchenpm',
      summary: 'Impact-focused Product Manager with 7+ years translating user research and business goals into scalable digital products. Drove $4.2M in annual recurring revenue (ARR) and elevated customer retention by 28%.',
      hiddenFields: []
    },
    sections: [
      {
        id: 'sec-exp',
        type: 'experience',
        title: 'Work Experience',
        visible: true,
        items: [
          {
            id: 'exp-1',
            role: 'Lead Product Manager',
            company: 'SaaSify Platforms',
            location: 'New York, NY',
            startDate: '2021-08',
            endDate: '',
            current: true,
            description: '<ul><li>Spearheaded product vision and roadmap for flagship enterprise analytics tool, driving $4.2M in new ARR.</li><li>Conducted 80+ customer interviews and analyzed behavioral telemetry to redesign user onboarding, boosting 30-day retention by 28%.</li><li>Managed cross-functional squad of 14 engineers, designers, and data scientists across 2-week agile sprints.</li></ul>'
          },
          {
            id: 'exp-2',
            role: 'Product Manager',
            company: 'FinTrack App',
            location: 'Boston, MA',
            startDate: '2018-05',
            endDate: '2021-07',
            current: false,
            description: '<ul><li>Launched automated bill negotiation feature from ideation to delivery, capturing 350K active users in first 6 months.</li><li>Partnered with compliance and risk teams to ensure seamless financial regulatory alignment across all 50 states.</li><li>Established A/B experimentation framework that increased checkout funnel conversion by 19%.</li></ul>'
          }
        ]
      },
      {
        id: 'sec-skills',
        type: 'skills',
        title: 'Skills & Competencies',
        visible: true,
        items: [
          { id: 'sk-1', category: '', skills: 'Product Strategy & Vision, Agile & Scrum Methodologies, User Research & Discovery, A/B Testing & Experimentation, Mixpanel & Amplitude Analytics, SQL & Data Analysis, Go-to-Market (GTM) Strategy, Stakeholder Management' }
        ]
      },
      {
        id: 'sec-edu',
        type: 'education',
        title: 'Education',
        visible: true,
        items: [
          {
            id: 'edu-1',
            institution: 'Columbia University',
            degree: 'B.A. in Economics & Information Systems',
            fieldOfStudy: 'Economics',
            location: 'New York, NY',
            startDate: '2014-09',
            endDate: '2018-05',
            gpa: '3.7',
            description: 'Graduated Magna Cum Laude. President of Undergraduate Product & Tech Association.'
          }
        ]
      }
    ]
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist & AI Engineer',
    badge: 'AI & Data',
    description: 'Features machine learning models, statistical analysis, Python data stacks, and business ROI.',
    template: 'executive',
    personal: {
      name: 'David Patel',
      title: 'Senior Data Scientist',
      email: 'david.patel@email.com',
      phone: '+1 (555) 456-7890',
      location: 'Seattle, WA',
      linkedin: 'linkedin.com/in/davidpatel-ai',
      github: 'github.com/davidpatel-ds',
      summary: 'Data Scientist with 5+ years of production experience in machine learning, predictive modeling, and large language model (LLM) fine-tuning. Proven ability to translate complex data into actionable business value.',
      hiddenFields: []
    },
    sections: [
      {
        id: 'sec-exp',
        type: 'experience',
        title: 'Work Experience',
        visible: true,
        items: [
          {
            id: 'exp-1',
            role: 'Senior Data Scientist',
            company: 'Veritas Analytics',
            location: 'Seattle, WA',
            startDate: '2022-01',
            endDate: '',
            current: true,
            description: '<ul><li>Engineered churn prediction gradient-boosted models, saving $1.8M in enterprise customer cancellations annually.</li><li>Fine-tuned open-source LLMs using LoRA/PEFT for domain-specific contract parsing, reducing manual review hours by 70%.</li><li>Built production inference pipelines on AWS SageMaker serving 5M+ daily API predictions at sub-80ms latency.</li></ul>'
          },
          {
            id: 'exp-2',
            role: 'Data Scientist',
            company: 'RetailPulse Insights',
            location: 'San Jose, CA',
            startDate: '2019-07',
            endDate: '2021-12',
            current: false,
            description: '<ul><li>Developed recommendation engine algorithms utilizing collaborative filtering, increasing average cart order value by 14%.</li><li>Orchestrated automated ETL pipelines in Apache Airflow and Snowflake processing 4TB of transactional data daily.</li><li>Presented predictive market forecasts to executive C-suite, influencing $12M in annual inventory allocation.</li></ul>'
          }
        ]
      },
      {
        id: 'sec-skills',
        type: 'skills',
        title: 'Skills & Technologies',
        visible: true,
        items: [
          { id: 'sk-1', category: '', skills: 'Python & R, PyTorch & TensorFlow, SQL & Snowflake, LLM Fine-Tuning & Prompt Engineering, AWS SageMaker & MLflow, Data Pipelines & Airflow, Statistical Modeling & A/B Testing, Docker & Kubernetes' }
        ]
      },
      {
        id: 'sec-edu',
        type: 'education',
        title: 'Education',
        visible: true,
        items: [
          {
            id: 'edu-1',
            institution: 'University of Washington',
            degree: 'M.S. in Data Science',
            fieldOfStudy: 'Data Science & Statistics',
            location: 'Seattle, WA',
            startDate: '2017-09',
            endDate: '2019-06',
            gpa: '3.9'
          }
        ]
      }
    ]
  },
  ACADEMIC_STARTER,
];

export function buildResumeFromStarter(starterId, newId) {
  const starter = STARTER_TEMPLATES.find(t => t.id === starterId) || STARTER_TEMPLATES[0];
  const template = starter.template || 'classic';
  return {
    id: newId,
    name: starter.name,
    updatedAt: Date.now(),
    // Current data, like a blank résumé: no migration runs on it. It was stamped 1, so the next load
    // ran every migration since — v9 moved the Modern starter's photo text from Center to Top.
    dataVersion: DATA_VERSION,
    template,
    settings: getStarterSettings(template),
    personal: JSON.parse(JSON.stringify(starter.personal)),
    sections: JSON.parse(JSON.stringify(starter.sections)),
    coverLetter: { ...BASE_COVER_LETTER }
  };
}
