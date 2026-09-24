// The Academic CV starter (T8): the scholarly CV the Academic template is built for, in the order such
// a CV reads — education, then publications, research and teaching appointments, grants and awards,
// talks, skills, references. Picking the Academic template never reorders a résumé; this starter is
// where its education- and publication-first order comes from. A fictional researcher; contact
// details use reserved example domains and a 555-01xx number.

/** A custom section of the starter's: a scholarly CV's own lists (publications, teaching, talks). */
const list = (id, title, items) => ({ id, type: 'custom', title, visible: true, items });

export const ACADEMIC_STARTER = {
  id: 'academic-cv',
  name: 'Academic CV (Researcher)',
  badge: 'Research & Academia',
  description: 'A scholarly CV: education and publications first, research and teaching appointments, grants.',
  template: 'academic',
  personal: {
    name: 'Dr. Maya Okafor',
    title: 'Postdoctoral Research Fellow, Computational Biology',
    email: 'maya.okafor@example.edu',
    phone: '+1 555 0171',
    location: 'Boston, MA',
    website: 'mayaokafor.example.org',
    linkedin: 'linkedin.com/in/maya-okafor-sample',
    github: 'github.com/maya-okafor-sample',
    summary: 'Computational biologist studying how gene-regulatory networks rewire during cell differentiation. Builds open single-cell analysis tools used by 40+ labs.',
    hiddenFields: [],
  },
  sections: [
    {
      id: 'sec-edu', type: 'education', title: 'Education', visible: true,
      items: [
        {
          id: 'edu-1', institution: 'Northeastern Institute of Technology', degree: 'Ph.D. in Computational Biology', fieldOfStudy: '',
          location: 'Boston, MA', startDate: '2017-09', endDate: '2022-05', gpa: '',
          description: 'Dissertation: Inferring regulatory rewiring from single-cell time courses. Advisor: Prof. L. Hart.',
        },
        {
          id: 'edu-2', institution: 'University of Lagos', degree: 'B.Sc. in Biochemistry', fieldOfStudy: '',
          location: 'Lagos, Nigeria', startDate: '2012-09', endDate: '2016-07', gpa: '', description: 'First Class Honours.',
        },
      ],
    },
    list('sec-pubs', 'Publications', [
      {
        id: 'pub-1', title: 'Regulatory rewiring precedes fate commitment in haematopoiesis', subtitle: 'Nature Methods, 21(4)',
        date: '2024-04', location: '', description: 'Okafor M., Hart L. Introduced a network-inference method for single-cell time courses.',
      },
      {
        id: 'pub-2', title: 'scTrace: lineage-aware clustering for single-cell RNA-seq', subtitle: 'Bioinformatics, 39(2)',
        date: '2023-02', location: '', description: 'Okafor M., Chen R., Hart L. Open-source package with 40+ citing labs.',
      },
      {
        id: 'pub-3', title: 'Noise-robust pseudotime from sparse sampling', subtitle: 'Proceedings of RECOMB 2021',
        date: '2021-05', location: '', description: 'Okafor M., Hart L. Conference paper; oral presentation.',
      },
    ]),
    {
      id: 'sec-research', type: 'experience', title: 'Research Experience', visible: true,
      items: [
        {
          id: 'res-1', role: 'Postdoctoral Research Fellow', company: 'Broadview Institute for Genomics', location: 'Boston, MA',
          startDate: '2022-07', endDate: '', current: true,
          description: '<ul><li>Lead the lab’s single-cell regulatory-network project, funded by a three-year fellowship.</li><li>Mentor two doctoral students and four undergraduate researchers.</li></ul>',
        },
        {
          id: 'res-2', role: 'Graduate Research Assistant', company: 'Hart Lab, Northeastern Institute of Technology', location: 'Boston, MA',
          startDate: '2017-09', endDate: '2022-05', current: false,
          description: '<ul><li>Built scTrace, a lineage-aware clustering package now used by 40+ labs.</li><li>Ran 12 single-cell sequencing experiments end to end, from sample preparation to analysis.</li></ul>',
        },
      ],
    },
    list('sec-teach', 'Teaching', [
      { id: 'tch-1', title: 'Teaching Fellow, Introduction to Bioinformatics', subtitle: 'Northeastern Institute of Technology', date: '2020-01', location: 'Boston, MA', description: 'Led weekly sections for 60 undergraduates; designed four programming labs.' },
    ]),
    {
      id: 'sec-awards', type: 'awards', title: 'Grants & Awards', visible: true,
      items: [
        { id: 'aw-1', title: 'Postdoctoral Fellowship in Computational Biology', issuer: 'Genomics Research Foundation', date: '2022-07', description: 'Three-year award, $180,000.' },
        { id: 'aw-2', title: 'Best Student Paper', issuer: 'RECOMB 2021', date: '2021-05', description: '' },
      ],
    },
    list('sec-talks', 'Invited Talks', [
      { id: 'talk-1', title: 'Watching networks rewire, one cell at a time', subtitle: 'Single-Cell Genomics Symposium', date: '2024-10', location: 'Heidelberg, Germany', description: '' },
    ]),
    {
      id: 'sec-skills', type: 'skills', title: 'Skills', visible: true,
      items: [
        { id: 'sk-1', category: 'Computational', skills: 'Python, R, Julia, Snakemake, high-performance computing' },
        { id: 'sk-2', category: 'Laboratory', skills: 'single-cell RNA-seq, ATAC-seq, flow cytometry' },
      ],
    },
    {
      id: 'sec-refs', type: 'references', title: 'References', visible: true,
      items: [
        { id: 'ref-1', name: 'Prof. Lena Hart', jobTitle: 'Professor of Computational Biology', company: 'Northeastern Institute of Technology', relationship: 'Doctoral advisor', email: 'l.hart@example.edu', phone: '' },
        { id: 'ref-2', name: 'Dr. Ravi Chen', jobTitle: 'Principal Investigator', company: 'Broadview Institute for Genomics', relationship: 'Postdoctoral supervisor', email: 'r.chen@example.edu', phone: '' },
      ],
    },
  ],
};
