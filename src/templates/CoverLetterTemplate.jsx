import { getFontById } from '@/utils/fonts';
import { photoStyle, ContactRow } from '@/templates/CoverLetterTemplateHelpers';

export default function CoverLetterTemplate({ data }) {
  const { personal, settings, coverLetter } = data;
  const fontFamily = settings?.customFont || getFontById(settings?.font)?.family || "'Inter', sans-serif";
  const accent = settings?.accentColor || '#2563eb';
  const cl = coverLetter || {};

  const clContactStyle  = cl.headerStyle   || settings?.contactStyle  || 'bar';
  const clContactLayout = cl.headerLayout  || settings?.contactLayout || 'justify';
  const clFieldsPos     = cl.fieldsPosition || 'right';
  const clPhotoAlign    = cl.photoTextAlign || 'center';

  const clHidden = new Set(cl.hiddenFields ?? []);

  const baseSize = settings?.fontSizeBase || 11;
  const nameSize = baseSize + (settings?.fontSizeNameDelta ?? 8);

  const photoSrc = cl.showPhoto !== false ? (cl.clPhoto || personal?.photo) : null;
  const vAlign = clPhotoAlign === 'top' ? 'flex-start' : clPhotoAlign === 'bottom' ? 'flex-end' : 'center';

  const photoEl = photoSrc ? (
    <img src={photoSrc} alt="" style={photoStyle(settings, accent)} />
  ) : null;

  const nameTitleEl = (
    <div className="min-w-0">
      <h1 className="font-bold leading-tight" style={{ color: '#0f172a', fontSize: nameSize + 'pt' }}>
        {personal?.name || 'Your Name'}
      </h1>
      {personal?.title && (
        <p className="mt-0.5" style={{ color: accent }}>{personal.title}</p>
      )}
    </div>
  );

  const photoNameEl = (
    <div style={{ display: 'flex', alignItems: vAlign, gap: '12px' }}>
      {photoEl}
      {nameTitleEl}
    </div>
  );

  const contactEl = (
    <ContactRow
      personal={personal}
      hidden={clHidden}
      style={clContactStyle}
      layout={clContactLayout}
      iconSize={settings?.iconSize ?? 11}
    />
  );

  function renderHeader() {
    if (clFieldsPos === 'below-name') {
      return (
        <div style={{ display: 'flex', alignItems: vAlign, gap: '12px' }}>
          {photoEl}
          <div style={{ flex: 1, minWidth: 0 }}>
            {nameTitleEl}
            {contactEl && <div style={{ marginTop: '6px' }}>{contactEl}</div>}
          </div>
        </div>
      );
    }

    if (clFieldsPos === 'below-all') {
      return (
        <div>
          {photoNameEl}
          {contactEl && <div style={{ marginTop: '8px' }}>{contactEl}</div>}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ flexShrink: 0 }}>{photoNameEl}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
          {contactEl}
        </div>
      </div>
    );
  }

  const textColor = settings?.textColor || '#1e293b';

  return (
    <div style={{ fontFamily, color: textColor, fontSize: baseSize + 'pt' }}>
      <div style={{ borderBottom: `3px solid ${accent}`, paddingBottom: '14px', marginBottom: '20px' }}>
        {renderHeader()}
      </div>

      {cl.body ? (
        <div
          className="mb-6 rich-text-output"
          style={{ color: textColor, minHeight: '160px' }}
          dangerouslySetInnerHTML={{ __html: cl.body }}
        />
      ) : (
        <div className="mb-6 whitespace-pre-wrap" style={{ color: '#9ca3af', minHeight: '160px' }}>
          {'Dear Hiring Manager,\n\nStart writing your cover letter in the "Cover Letter" tab on the left...\n\nBest regards,\n' + (personal?.name || 'Your Name')}
        </div>
      )}

      {(() => {
        const signatureGap = cl.signatureSpace === 'wide' ? '32px' : '8px';
        const sigName = cl.signatureName != null ? cl.signatureName : (personal?.name || 'Your Name');
        const sigDesignation = cl.signatureDesignation != null ? cl.signatureDesignation : (personal?.title || '');
        return (
          <div>
            <p>{cl.closing || 'Sincerely'},</p>
            <div style={{ marginTop: signatureGap }}>
              <p className="font-semibold" style={{ color: '#0f172a' }}>{sigName}</p>
              {sigDesignation && <p style={{ color: '#64748b' }}>{sigDesignation}</p>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
