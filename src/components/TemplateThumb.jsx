import { useMemo } from 'react';
import ResumeThumbnail from '@/components/ResumeThumbnail';
import { usePicture } from '@/hooks/usePicture';
import { buildResumeFromStarter, STARTER_TEMPLATES } from '@/utils/starterTemplates';
import { LETTER_KIND } from '@/utils/letters';
import { withLook } from '@/utils/templateSwitch';

// A picker card's picture (A1): page 1 of a sample résumé — the first role starter, a fictional person —
// in the card's look. Drawn at once as the template's mock page (ResumeThumbnail); where `picture` is
// asked (the gallery), the real page, painted by the app's own renderer once the card is on screen,
// replaces it. `letter`: the same look's cover-letter letterhead (F1). On /new (R3-012) the page is the
// user's own résumé on the card's look instead (`source`), as picking the card will make it.

let sample = null;
const sampleResume = () => (sample ??= buildResumeFromStarter(STARTER_TEMPLATES[0].id, 'look_sample'));

// Not what a sample page prints: the user's uploaded icons are images of their own, and the design
// bookkeeping prints nothing.
const NOT_DRAWN = ['customContactIcons', 'myDesigns', 'templatePreset'];

/** The sample résumé in `card`'s look (utils/templatePicker.js), or its letter. */
export function lookResume(card, { letter = false } = {}) {
  const settings = Object.fromEntries(Object.entries(card.look || {}).filter(([k]) => !NOT_DRAWN.includes(k)));
  return { ...sampleResume(), template: card.engine, settings, ...(letter ? { kind: LETTER_KIND } : {}) };
}

/** The look `card` puts a résumé on (templateSwitch.withLook): its template or design, and its Layout. */
export const cardLook = (card) => ({
  engine: card.engine, preset: card.preset, variant: card.variant, ...(card.own ? { design: card.design } : {}),
});

/** `source`, a résumé of the user's, on `card`'s look: the page a pick of the card on /new makes. */
export const sourceOnLook = (source, card) => withLook(source, cardLook(card));

/**
 * `size` 'sm' (the Design panel's row, 40 px wide) or 'lg' (the gallery's card, filling its box).
 * `picture`: paint the real page in place of the mock. `source`: draw that résumé on the card's look
 * rather than the sample (the page only; a letter's thumb stays the sample's).
 */
export function TemplateThumb({ card, size = 'sm', picture = false, letter = false, source = null }) {
  const own = source && !letter;
  const resume = useMemo(() => (own ? sourceOnLook(source, card) : lookResume(card, { letter })), [card, letter, own, source]);
  // The user's page is a new picture whenever what it prints changes (its id and last edit name it).
  const whose = own ? `:${source.id}@${source.updatedAt ?? ''}` : '';
  const drawn = JSON.stringify(resume.settings, (k, v) => (NOT_DRAWN.includes(k) ? undefined : v));
  const key = `${letter ? 'letter' : 'page'}:${resume.template}:${drawn}${whose}`;
  const [ref, url] = usePicture(
    key,
    () => import('@/utils/pageImage').then((m) => m.pageImage(resume, { width: 240, letter })),
    { enabled: picture },
  );
  const accent = resume.settings.accentColor || '#2563eb';
  const box = size === 'lg' ? 'w-full aspect-[210/297]' : 'w-10 h-14';
  return (
    <div ref={ref} data-look-thumb={letter ? 'letter' : 'page'} className={`${box} relative shrink-0 overflow-hidden rounded bg-white`}>
      {url ? (
        <img data-page-image="" src={url} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
      ) : (
        // The mock page is 80 × 112 px: halved in a row, centred in a gallery card.
        <div className={size === 'lg' ? 'absolute inset-0 flex items-center justify-center' : 'origin-top-left scale-50'}>
          <ResumeThumbnail resume={resume} accent={accent} />
        </div>
      )}
    </div>
  );
}
