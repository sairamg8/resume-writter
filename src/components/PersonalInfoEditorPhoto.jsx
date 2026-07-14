import { useRef } from 'react';
import { Camera, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Chip } from '@/components/PersonalInfoEditorHeader';

export function PhotoSection({ personal, updatePersonal, toggleFieldVisibility, hidden, s, set, open, onToggle }) {
  const photoInputRef = useRef(null);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updatePersonal('photo', ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Photo</p>
          {personal.photo && !hidden.has('photo') && (
            <span className="text-[9px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">Added</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {personal.photo && (
            <button
              onClick={e => { e.stopPropagation(); toggleFieldVisibility('photo'); }}
              className={`p-1 rounded transition-colors ${hidden.has('photo') ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
              title={hidden.has('photo') ? 'Show photo on resume' : 'Hide photo from resume'}
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
              {personal.photo && (
                <button onClick={() => updatePersonal('photo', null)} className="text-[11px] text-red-500 hover:text-red-600 mt-1">Remove photo</button>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Shape</p>
            <div className="flex gap-2">
              {[{ val: 'circle', label: 'Circle' }, { val: 'rounded', label: 'Rounded' }, { val: 'square', label: 'Square' }].map(({ val, label }) => (
                <Chip key={val} active={(s.photoShape || 'circle') === val} onClick={() => set('photoShape', val)}>{label}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Size</p>
            <div className="flex gap-2">
              {[{ val: 'sm', label: 'Small' }, { val: 'md', label: 'Medium' }, { val: 'lg', label: 'Large' }].map(({ val, label }) => (
                <Chip key={val} active={(s.photoSize || 'md') === val} onClick={() => set('photoSize', val)}>{label}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Border</p>
            <div className="flex gap-2">
              {[{ val: 'none', label: 'None' }, { val: 'thin', label: 'Thin' }, { val: 'accent', label: 'Accent' }].map(({ val, label }) => (
                <Chip key={val} active={(s.photoBorder || 'accent') === val} onClick={() => set('photoBorder', val)}>{label}</Chip>
              ))}
            </div>
          </div>

          {(s.photoShape || 'circle') !== 'circle' && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Height</p>
              <div className="flex gap-2">
                {[{ val: 'match', label: 'Square' }, { val: 'tall', label: 'Tall' }, { val: 'taller', label: 'Portrait' }].map(({ val, label }) => (
                  <Chip key={val} active={(s.photoHeight || 'match') === val} onClick={() => set('photoHeight', val)}>{label}</Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Text Position</p>
            <div className="flex gap-2">
              {[{ val: 'top', label: '↑ Top' }, { val: 'center', label: '↕ Center' }, { val: 'bottom', label: '↓ Bottom' }].map(({ val, label }) => (
                <Chip key={val} active={(s.photoTextAlign || 'center') === val} onClick={() => set('photoTextAlign', val)}>{label}</Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
