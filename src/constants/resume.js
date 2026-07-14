import ClassicTemplate from '@/templates/ClassicTemplate';
import ModernTemplate from '@/templates/ModernTemplate';
import MinimalTemplate from '@/templates/MinimalTemplate';
import SidebarTemplate from '@/templates/SidebarTemplate';
import ExecutiveTemplate from '@/templates/ExecutiveTemplate';

export const TEMPLATE_MAP = {
  classic:   ClassicTemplate,
  modern:    ModernTemplate,
  minimal:   MinimalTemplate,
  sidebar:   SidebarTemplate,
  executive: ExecutiveTemplate,
};

export const SECTION_GROUPS = [
  {
    label: 'Core',
    types: [
      { type: 'experience',  label: 'Work Experience' },
      { type: 'education',   label: 'Education' },
      { type: 'skills',      label: 'Skills' },
      { type: 'projects',    label: 'Projects' },
    ],
  },
  {
    label: 'More',
    types: [
      { type: 'languages',      label: 'Languages' },
      { type: 'certifications', label: 'Certifications' },
      { type: 'awards',         label: 'Awards & Honors' },
      { type: 'volunteering',   label: 'Volunteering' },
      { type: 'references',     label: 'References' },
      { type: 'interests',      label: 'Interests' },
      { type: 'custom',         label: 'Custom Section' },
    ],
  },
];

export const MARGIN_MAP    = { narrow: '8mm 12mm', normal: '14mm 18mm', wide: '20mm 24mm' };
export const FONT_SIZE_MAP = { small: '10px', normal: '11px', large: '12.5px' };
export const LINE_HEIGHT_MAP = { tight: '1.4', normal: '1.6', relaxed: '1.8' };
