export const SAIRAM_PERSONAL = {
  name: 'Sairam Gudiputi',
  title: 'UI Software Engineer',
  email: 'you@example.com',
  phone: '+1 555 0100',
  location: 'Bangalore, India',
  website: 'sairamg.dev',
  linkedin: 'linkedin.com/in/sairamg8',
  github: '',
  summary:
    'Product-focused UI Software Engineer with 7+ years of experience delivering high-performance web applications across fintech, healthcare, and e-commerce — working with clients including Natwest Group, Philips, Pfizer, and Ingram Micro. Proven at architecting scalable React and Next.js frontends that improve Core Web Vitals, reduce load times, and handle thousands of concurrent users. Deep expertise in TypeScript, performance engineering, accessibility, and leading cross-functional delivery under Agile frameworks.',
  photo: null,
  hiddenFields: ['github'],
};

export const SAIRAM_SECTIONS = [
  {
    id: 'skills',
    type: 'skills',
    title: 'Skills',
    settings: { spacing: 'normal', columns: 1, skillsStyle: 'inline', separator: 'colon', titleStyle: 'inline' },
    items: [
      { id: 'sk1', category: 'Core Tech', skills: 'React, Next.js (14/15), TypeScript, JavaScript (ES6+), Node.js, Express.js, MongoDB, PostgreSQL', description: '', bullets: [] },
      { id: 'sk2', category: 'UI/UX & Styling', skills: 'Material UI, TailwindCSS, Framer Motion, Vanilla Extract CSS, Bootstrap, Ant Design, Shadcn, SASS', description: '', bullets: [] },
      { id: 'sk3', category: 'Performance', skills: 'Code Splitting, SSR/ISR, Lazy Loading, Bundle Optimization, API Batching, TanStack Virtual, Memoization', description: '', bullets: [] },
      { id: 'sk4', category: 'Dev Tools & Infra', skills: 'Webpack, Vite, Babel, ESLint, Git, GitHub CI/CD, NPM/Yarn, Veeva Vault, Salesforce', description: '', bullets: [] },
      { id: 'sk5', category: 'Testing & Quality', skills: 'Jest, React Testing Library (RTL), Cypress, Unit Testing, Code Review', description: '', bullets: [] },
      { id: 'sk6', category: 'Methodologies', skills: 'Agile/Scrum, CI/CD, Modular Architecture, Redux Toolkit, Context API, React Hook Form, YUP', description: '', bullets: [] },
    ],
  },
  {
    id: 'experience',
    type: 'experience',
    title: 'Professional Experience',
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
    items: [
      {
        id: 'exp0',
        company: 'Natwest Group', role: 'WoW Software Engineer', location: 'Bangalore, India',
        startDate: '11/2025', endDate: '', current: true,
        description: '<ul><li>Refined the \'Make a Payment\' UX for Natwest\'s consumer banking platform by engineering fluid micro-transitions and real-time field validation, reducing payment form errors and delivering a high-trust, low-latency experience for millions of enterprise banking users</li><li>Collaborated with cross-functional squads following Natwest\'s Ways of Working (WoW) Agile framework — contributing to sprint planning, code reviews, and continuous delivery pipelines</li><li>Implemented accessible UI components adhering to WCAG 2.1 standards, ensuring full keyboard navigation and screen reader support across the critical payment journey</li></ul><p><em>Tech: React, TypeScript, TailwindCSS, Accessibility (A11y), CI/CD</em></p>',
        bullets: [],
      },
      {
        id: 'exp1',
        company: 'LTIMindtree', role: 'Software Engineer', location: 'Bangalore, India',
        startDate: '09/2024', endDate: '11/2025', current: false,
        description: '<p><em>RFP Internal AI Tool – Philips Healthcare</em></p><ul><li>Led architecture and end-to-end development of an AI-powered RFP management platform for Philips, modeled after enterprise tools like RFPIO and Loopio — enabling healthcare teams to respond to RFPs faster through intelligent content reuse and smart suggestions</li><li>Designed a recursive section/subsection system with seamless drag-and-drop reordering using Dnd Kit, allowing users to manage deeply nested RFP document structures like a file system</li><li>Optimized frontend performance via deep memoization, API batching, and intelligent caching, achieving a 70% improvement in perceived responsiveness and eliminating bottlenecks during peak usage</li><li>Built high-performance virtualized lists with TanStack Virtualization to smoothly render audit trail datasets exceeding 10,000 rows across all devices</li><li>Mentored two junior developers on React architecture, component design patterns, and pull request best practices</li><li>Implemented CI/CD pipelines that cut deployment time by 20% and improved release cadence</li></ul><p><em>Tech: React 18, Filament (Internal Library), Context API, React Hook Form, YUP, Redux Toolkit, GitHub CI/CD</em></p><p><em>Contentful Experience Website – Philips Healthcare CMS</em></p><ul><li>Led the frontend revamp of Philips\' customer-facing healthcare content platform, architecting a Next.js 14 and Contentful CMS solution with performance-first principles — achieving 40% faster load times and measurably improved Core Web Vitals scores</li><li>Resolved critical performance bottlenecks by implementing advanced Next.js optimizations including code splitting, lazy loading, and intelligent ISR caching strategies</li><li>Drove SSR adoption and lazy loading patterns across the platform, delivering a more stable and faster experience for healthcare content consumers</li></ul><p><em>Tech: Next.js 14, React 18, Vanilla Extract CSS, Context API, Contentful CMS</em></p>',
        bullets: [],
      },
      {
        id: 'exp2',
        company: 'Crossdev Technologies', role: 'Software Engineer', location: 'Bangalore, India',
        startDate: '06/2023', endDate: '08/2024', current: false,
        description: '<p><em>Paywize – B2B Payment Ecosystem</em></p><ul><li>Architected a secure B2B payment platform facilitating financial transactions between merchants and distributors across UPI QR, Virtual Accounts, and Wallet transfer channels</li><li>Built a robust security framework using JWT authentication and Role-Based Access Control (RBAC) to enforce multi-tier access policies and protect sensitive financial data</li><li>Optimized API response patterns and database schemas to sustain 1,000+ concurrent users with sub-500ms response times under production load</li></ul><p><em>Tech: React 18, Node.js, Express.js, PostgreSQL, Redux Toolkit, Material UI, YUP, React Hook Form</em></p><p><em>FinEase – Stock Market Trading Platform</em></p><ul><li>Designed and implemented a brokerage interface using Next.js SSR architecture, improving SEO visibility and accelerating feature delivery velocity across trading modules</li><li>Engineered real-time data visualizations with Chart.js, optimized with memoization and lazy loading to handle high-frequency stock data updates without UI degradation</li><li>Defined modular Redux Toolkit state management patterns adopted team-wide, reducing state-related bugs and improving long-term maintainability</li></ul><p><em>Tech: Next.js, React 18, Material UI, Chart.js, SASS, Redux Toolkit, CSS Modules</em></p>',
        bullets: [],
      },
      {
        id: 'exp3',
        company: 'TATA Consultancy Services', role: 'System Engineer', location: 'Bangalore, India',
        startDate: '02/2023', endDate: '06/2023', current: false,
        description: '<p><em>Ingram Micro – B2B E-commerce Platform</em></p><ul><li>Modernized the legacy frontend architecture of Ingram Micro\'s high-traffic B2B e-commerce platform serving enterprise buyers globally — rebuilding product browsing and ordering workflows with React, reducing initial load time by 25%</li><li>Optimized multi-step bulk order forms and state management using Zustand and Context API, significantly improving form maintainability and user workflow efficiency under high concurrency</li></ul><p><em>Tech: React 17, Zustand, Context API, Bootstrap, Ant Design, CSS-in-JS</em></p>',
        bullets: [],
      },
      {
        id: 'exp4',
        company: 'Indegene Pvt Ltd', role: 'Junior Software Engineer', location: 'Bangalore, India',
        startDate: '10/2020', endDate: '02/2023', current: false,
        description: '<p><em>Pfizer Projects – Healthcare Communication</em></p><ul><li>Developed responsive healthcare web applications and email templates for Pfizer\'s global communication campaigns using React, Bootstrap, and Veeva Vault — ensuring accessibility and multi-device compatibility for pharmaceutical reps and healthcare professionals</li><li>Built internal tools and campaign microsites used by Pfizer\'s marketing and medical affairs teams, improving operational efficiency and content delivery speed across initiatives</li><li>Recognized with the "Best Sprinter" award three consecutive times for consistent, high-quality delivery under tight sprint deadlines</li></ul><p><em>Tech: React.js, Bootstrap, Tailwind CSS, Veeva Vault, Salesforce</em></p><p><em>Software Pundits (Contract @ Indegene)</em></p><ul><li>Contributed to healthcare-based static site builds and responsive email template designs, ensuring cross-client email rendering consistency and multi-device compatibility</li></ul>',
        bullets: [],
      },
      {
        id: 'exp5',
        company: 'DigitalKnock India Pvt Ltd', role: 'Web Developer', location: 'Bangalore, India',
        startDate: '01/2019', endDate: '10/2020', current: false,
        description: '<p>Designed and developed 20+ client-facing websites from scratch for SME clients across retail, real estate, and services sectors. Converted static sites into CMS-backed web applications using PHP and MySQL with admin panels enabling non-technical clients to manage their own content. Ensured responsive design, cross-browser compatibility, and performance optimization across all devices.</p><p><em>Tech: HTML5, CSS3, JavaScript, Bootstrap, PHP, MySQL, Tailwind CSS</em></p>',
        bullets: [],
      },
    ],
  },
  {
    id: 'certifications',
    type: 'certifications',
    title: 'Certificates',
    settings: { spacing: 'normal', showDates: true, columns: 1 },
    items: [
      { id: 'cert1', name: 'JavaScript — The Complete Guide (ES6+)', issuer: 'Udemy', date: '', expiry: '', credentialId: '', url: '' },
      { id: 'cert2', name: 'Node.js — The Complete Bootcamp', issuer: 'Udemy', date: '', expiry: '', credentialId: '', url: '' },
    ],
  },
  {
    id: 'education',
    type: 'education',
    title: 'Education',
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: false, titleStyle: 'stacked' },
    items: [
      {
        id: 'edu1',
        institution: 'Jawaharlal Nehru Technological University',
        degree: 'B.Tech, Pharmaceutical Engineering',
        fieldOfStudy: '', location: 'Bangalore, India',
        startDate: '05/2014', endDate: '06/2018',
        gpa: '', description: '', bullets: [],
      },
    ],
  },
];

export const BASE_COVER_LETTER = {
  recipientName: '',
  recipientTitle: 'Hiring Manager',
  company: '',
  date: '',
  subject: '',
  body: '',
  closing: 'Sincerely',
};
