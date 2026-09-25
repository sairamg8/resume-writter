import { letterheadCentered, templateId } from '@/constants/templates';
import { isLetter } from '@/utils/letters';
import { letterResumePhoto } from '@/utils/coverLetter';
import { pageSizeOf } from '@/constants/pageSize';

// A dashboard card's mock page: the résumé's template drawn in bars, so two résumés on different
// templates look different at a glance (R2-133). Every way of making a résumé stores the same accent,
// so a mock that took the accent alone drew every card the same.

/** A bar: `w` is its width as a share of the line, `h` its height in px. */
const Bar = ({ w, h = 2, color, center = false, style }) => (
  <div className="rounded-sm shrink-0" style={{ width: `${w * 100}%`, height: h, backgroundColor: color, ...(center ? { marginInline: 'auto' } : {}), ...style }} />
);

/** The name and title, and the contacts line: `ink` for the name, `sub` for the rest. */
function Header({ ink, sub, center, photo, photoRing }) {
  return (
    <div className={`flex items-center gap-1 ${center ? 'flex-col' : ''}`}>
      {photo && <div data-thumb-photo className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sub, boxShadow: `0 0 0 1px ${photoRing}` }} />}
      <div className="flex-1 w-full space-y-0.5">
        <Bar w={0.7} h={3} color={ink} center={center} />
        <Bar w={0.45} color={sub} center={center} />
        <Bar w={0.85} h={1} color={sub} center={center} />
      </div>
    </div>
  );
}

/** A section: its heading in the template's style, then its lines. */
function Section({ heading, line, lines = 2, center = false }) {
  return (
    <div className="space-y-0.5">
      {heading}
      {Array.from({ length: lines }, (_, i) => <Bar key={i} w={[0.9, 0.7, 0.8][i % 3]} h={1.5} color={line} center={center} />)}
    </div>
  );
}

export default function ResumeThumbnail({ resume, accent }) {
  const t = templateId(resume.template);
  const s = resume.settings || {};
  const personal = resume.personal || {};
  const hidden = Array.isArray(personal.hiddenFields) ? personal.hiddenFields : [];
  const photo = Boolean(personal.photo) && !hidden.includes('photo');
  const center = t === 'academic' || letterheadCentered(s, t);
  const ink = '#1f2937';
  const grey = '#d1d5db';
  const soft = `${accent}25`;

  const ruled = (w = 1) => <Bar w={1} h={0.75} color={accent} style={{ marginTop: 1 * w }} />;
  const heading = {
    classic: <><Bar w={0.35} h={1.5} color={accent} />{ruled()}</>,
    minimal: <Bar w={0.3} h={1} color={grey} />,
    executive: <Bar w={0.4} h={1.5} color={accent} center={center} />,
    timeline: <Bar w={0.35} h={1.5} color={accent} />,
    banner: <div className="rounded-sm px-0.5 py-px w-1/2" style={{ backgroundColor: accent }}><Bar w={0.8} h={1} color="#ffffffb3" /></div>,
    academic: <Bar w={0.35} h={1.5} color={ink} center />,
    compact: <Bar w={0.3} h={1} color={accent} />,
    modern: <Bar w={0.35} h={1.5} color={accent} />,
    // The designed layouts' heading marks (R2-138 B2; sectionHeadingLook's `variant`).
    gridline: <div className="space-y-px"><Bar w={1} h={0.5} color={soft} /><Bar w={0.35} h={1.5} color={accent} /><Bar w={1} h={0.5} color={soft} /></div>,
    registry: <div className="space-y-px"><Bar w={0.35} h={1.5} color={accent} /><div style={{ borderBottom: `1px dotted ${accent}` }} /></div>,
    bookend: <div className="flex items-center gap-0.5"><Bar w={0.3} h={1.5} color={accent} /><div className="flex-1" style={{ height: 0.75, backgroundColor: accent }} /></div>,
    lectern: <div className="flex items-center gap-0.5"><div className="flex-1" style={{ height: 0.75, backgroundColor: accent }} /><Bar w={0.3} h={1.5} color={accent} /><div className="flex-1" style={{ height: 0.75, backgroundColor: accent }} /></div>,
    chronicle: <div className="space-y-px"><Bar w={0.35} h={1.5} color={accent} /><Bar w={1} h={0.5} color={accent} /><Bar w={1} h={0.5} color={accent} /></div>,
    keystone: <div className="px-0.5 py-px" style={{ backgroundColor: soft, borderLeft: `2px solid ${accent}` }}><Bar w={0.4} h={1} color={accent} /></div>,
    banded: <div className="-mx-1.5 px-1.5 py-px" style={{ backgroundColor: soft }}><Bar w={0.35} h={1} color={accent} /></div>,
    keel: <div className="flex items-center gap-0.5"><Bar w={0.03} h={3} color={accent} /><Bar w={0.35} h={1.5} color={accent} /></div>,
    linen: <div className="w-1/3 pb-px" style={{ borderBottom: `1px solid ${accent}` }}><Bar w={1} h={1.5} color={accent} /></div>,
    broadsheet: <div className="space-y-px"><Bar w={1} h={1} color={accent} /><Bar w={0.35} h={1.5} color={accent} /></div>,
  }[t] || <Bar w={0.35} h={1.5} color={accent} />;
  const body = (sections, lines) => Array.from({ length: sections }, (_, i) => (
    <Section key={i} heading={heading} line={t === 'minimal' ? '#e5e7eb' : soft} lines={lines} center={t === 'academic'} />
  ));

  let page;
  if (isLetter(resume)) {
    // A letter's card draws a letter (R2-135): its letterhead in the template's look, the recipient
    // lines, three paragraphs and the signature — not a résumé's sections.
    const cl = resume.coverLetter || {};
    const letterPhoto = cl.showPhoto !== false && Boolean(cl.clPhoto || letterResumePhoto(personal));
    page = (
      <div className="p-1.5 space-y-1.5">
        <Header ink={ink} sub={grey} center={center} photo={letterPhoto} photoRing={accent} />
        <Bar w={1} h={0.75} color={accent} />
        <div className="space-y-0.5"><Bar w={0.3} h={1} color={grey} /><Bar w={0.45} h={1} color={grey} /></div>
        {[3, 3, 2].map((lines, i) => (
          <div key={i} className="space-y-0.5">
            {Array.from({ length: lines }, (_, j) => <Bar key={j} w={j === lines - 1 ? 0.6 : 0.95} h={1} color={soft} />)}
          </div>
        ))}
        <Bar w={0.35} h={1.5} color={ink} />
      </div>
    );
  } else if (t === 'sidebar') {
    const bg = s.sidebarBg || '#1e293b';
    page = (
      <div className="flex h-full">
        <div className="w-[34%] h-full p-1 space-y-1" style={{ backgroundColor: bg }}>
          {photo && <div data-thumb-photo className="w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: '#ffffff80', boxShadow: `0 0 0 1px ${accent}` }} />}
          <Bar w={0.9} h={2} color="#ffffffcc" />
          {[0.8, 0.6, 0.7, 0.5].map((w, i) => <Bar key={i} w={w} h={1} color="#ffffff66" />)}
        </div>
        <div className="flex-1 p-1 space-y-1">{body(4, 2)}</div>
      </div>
    );
  } else if (t === 'modern' || t === 'banner') {
    // Modern's band sits inside the margins, rounded; Banner's runs to the paper's edges, taller.
    const band = (
      <div className={t === 'banner' ? 'px-1.5 py-2' : 'm-1 mb-0 rounded-sm px-1 py-1'} style={{ backgroundColor: accent }}>
        <Header ink="#ffffffcc" sub="#ffffff66" center={false} photo={photo} photoRing="#ffffff" />
      </div>
    );
    page = <>{band}<div className="p-1.5 space-y-1">{body(3, 2)}</div></>;
  } else {
    const rule = { classic: null, executive: [accent, accent], academic: [ink], minimal: [grey], gridline: [soft], chronicle: [accent, accent], broadsheet: [ink] }[t];
    // The designed layouts' header marks (R2-138 B2): a mark over the name, beside it or around the header.
    const over = { gridline: <Bar w={1} h={0.5} color={soft} />, registry: <Bar w={1} h={2} color={accent} />, bookend: <Bar w={1} h={1.5} color={accent} />, linen: <Bar w={0.2} h={1} color={accent} center={center} /> }[t];
    const under = { bookend: <Bar w={1} h={1.5} color={accent} />, lectern: <Bar w={0.25} h={1} color={accent} center={center} /> }[t];
    const header = <Header ink={t === 'linen' ? accent : ink} sub={grey} center={center} photo={photo} photoRing={accent} />;
    page = (
      <div className={`p-1.5 ${t === 'minimal' ? 'space-y-1.5' : t === 'compact' ? 'space-y-0.5' : 'space-y-1'}`}>
        {over}
        {t === 'keystone' ? (
          <div className="flex gap-1"><div className="w-1.5 h-3 shrink-0" style={{ backgroundColor: accent, clipPath: 'polygon(0 0, 100% 0, 78% 100%, 22% 100%)' }} />{header}</div>
        ) : t === 'keel' ? (
          <div className="pl-1" style={{ borderLeft: `2px solid ${accent}` }}>{header}</div>
        ) : t === 'banded' ? (
          <div className="-mx-1.5 -mt-1.5 px-1.5 pt-1.5 pb-1" style={{ backgroundColor: soft }}>{header}</div>
        ) : header}
        {under}
        {rule && <div className="space-y-px">{rule.map((c, i) => <Bar key={i} w={1} h={t === 'broadsheet' || (t === 'chronicle' && i === 0) ? 1.5 : 0.75} color={c} />)}</div>}
        {t === 'timeline' ? (
          <div className="flex gap-1">
            <div className="w-px self-stretch" style={{ backgroundColor: accent }} />
            <div className="flex-1 space-y-1">{body(3, 2)}</div>
          </div>
        ) : t === 'compact' ? (
          <>
            {body(3, 3)}
            <div className="grid grid-cols-2 gap-0.5">{[0, 1, 2, 3].map((i) => <Bar key={i} w={0.8} h={1} color={soft} />)}</div>
          </>
        ) : body(t === 'minimal' ? 2 : 3, 2)}
      </div>
    );
  }

  // The page in the paper's shape (R2-136): A4's 80 × 112 px, US Letter's shorter 80 × 104 (11 / 8.5).
  const paper = pageSizeOf(s) === 'LETTER' ? 'h-[104px]' : 'h-28';
  return (
    <div data-thumb={isLetter(resume) ? 'letter' : t} className={`w-20 ${paper} rounded shadow-md flex flex-col overflow-hidden bg-white`} style={{ border: `2px solid ${accent}30` }}>
      {page}
    </div>
  );
}
