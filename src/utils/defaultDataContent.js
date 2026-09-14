// Starting content for a new résumé: empty fields, the three core sections, no entries.
// Personal data never ships in the code — a user's résumés live in their own browser
// (localStorage) and, when signed in, their own cloud account.

export const BLANK_PERSONAL = {
  name: '',
  title: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  linkedin: '',
  github: '',
  summary: '',
  photo: null,
  hiddenFields: [],
};

export function blankSections() {
  return [
    {
      id: 'experience', type: 'experience', title: 'Professional Experience', visible: true,
      settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
      items: [],
    },
    {
      id: 'education', type: 'education', title: 'Education', visible: true,
      settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
      items: [],
    },
    {
      id: 'skills', type: 'skills', title: 'Skills', visible: true,
      settings: { spacing: 'normal', columns: 1, skillsStyle: 'inline', separator: 'colon', titleStyle: 'inline' },
      items: [],
    },
  ];
}

// Every line of the letter block starts empty: a filled field prints, an empty one does not.
export const BASE_COVER_LETTER = {
  recipientName: '',
  recipientTitle: '',
  company: '',
  date: '',
  subject: '',
  body: '',
  closing: 'Sincerely',
};
