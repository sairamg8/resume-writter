import { useRef } from 'react';
import { Camera, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Chip } from '@/components/PersonalInfoEditorHeader';
import { readImageFile } from '@/utils/imageUpload';
import { UNLOADABLE_PHOTO, UNPRINTABLE_PHOTO, usePrintableImage } from '@/hooks/usePrintableImage';
import { photoTextPositionApplies, templateId } from '@/constants/templates';
import { PHOTO_OPTIONS, photoOption } from '@/constants/photoOptions';

/**
 * One photo control's chips, from the list the PDF clamps to (src/constants/photoOptions.js): the
 * panel offers exactly what the PDF draws, so neither can gain an option the other does not
 * (AUD-25). The active chip is the stored value as the PDF resolves it — an imported file's
 * unknown value shows the default that prints, not a chip nobody picked.
 */
function PhotoChips({ control, s, set }) {
  return (
    <div className="flex gap-2">
      {PHOTO_OPTIONS[control].map(({ val, label }) => (
        <Chip key={val} active={photoOption(control, s[control]) === val} onClick={() => set(control, val)}>{label}</Chip>
      ))}
    </div>
  );
}

export function PhotoSection({ resume: whole, personal, updatePersonal, toggleFieldVisibility, hidden, s, set, template, open, onToggle, coverLetter }) {
  const photoInputRef = useRef(null);
  // A photo saved as WebP or GIF, before uploads were converted, prints as a converted copy; one
  // this browser cannot read either prints nothing, and the panel says so instead of "Added" (R7-7).
  const printable = usePrintableImage(personal.photo);
  const unprintable = Boolean(personal.photo) && printable === null;

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // The whole résumé, sections and all: an upload may take only what its cloud document has left (R2-097).
    const resume = { ...whole, personal, settings: s, template, coverLetter };
    readImageFile(file, { kind: 'photo', resume, replacing: personal.photo }).then((dataUrl) => updatePersonal('photo', dataUrl), (err) => alert(err.message));
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Photo</p>
          {personal.photo && !hidden.has('photo') && (unprintable ? (
            <span className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">Not printed</span>
          ) : (
            <span className="text-[9px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">Added</span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {personal.photo && (
            <button
              onClick={e => { e.stopPropagation(); toggleFieldVisibility('photo'); }}
              className={`p-1 rounded transition-colors ${hidden.has('photo') ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
              // Hidden, it leaves the cover letter too; a photo uploaded for the letter still prints (R2-092).
              title={hidden.has('photo') ? 'Show photo on the résumé and cover letter' : 'Hide photo from the résumé and cover letter (a photo uploaded for the letter stays)'}
            >
              {hidden.has('photo') ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3">
          <div className="flex items-center gap-4">
            <div
              onClick={() => photoInputRef.current?.click()}
              className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors overflow-hidden shrink-0"
            >
              {personal.photo ? (
                <img src={personal.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-0.5 text-gray-400">
                  <Camera size={16} />
                  <span className="text-[9px]">Photo</span>
                </div>
              )}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700">Profile Photo</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Optional. Click to upload.</p>
              {unprintable && (
                <p className="text-[11px] text-amber-700 mt-1" data-testid="photo-unprintable">
                  {typeof personal.photo === 'string' && !personal.photo.startsWith('data:') ? UNLOADABLE_PHOTO : UNPRINTABLE_PHOTO}
                </p>
              )}
              {personal.photo && (
                <button onClick={() => updatePersonal('photo', null)} className="text-[11px] text-red-500 hover:text-red-600 mt-1">Remove photo</button>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Shape</p>
            <PhotoChips control="photoShape" s={s} set={set} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Size</p>
            <PhotoChips control="photoSize" s={s} set={set} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Border</p>
            <PhotoChips control="photoBorder" s={s} set={set} />
          </div>

          {/* A circle takes no Height, and an imported shape the PDF does not draw ('oval') is one (R2-094). */}
          {photoOption('photoShape', s.photoShape) !== 'circle' && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Height</p>
              <PhotoChips control="photoHeight" s={s} set={set} />
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Text Position</p>
            {photoTextPositionApplies(s, template) ? (
              <PhotoChips control="photoTextAlign" s={s} set={set} />
            ) : (
              <p className="text-[11px] text-gray-400" data-testid="photo-text-position-note">
                {templateId(template) === 'sidebar'
                  ? 'The Sidebar template prints the photo above your name.'
                  : 'A centered header prints the photo above your name. Align the header left to place the text beside it.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
