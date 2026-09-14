import { Image } from '@react-pdf/renderer';
import {
  MailIcon, PhoneIcon, MapPinIcon, GlobeIcon, LinkedinPdfIcon, GithubPdfIcon,
  FilledMailPdf, FilledPhonePdf, FilledPinPdf, FilledGlobePdf, FilledLinkedinPdf, FilledGithubPdf,
} from './PdfIcons';
import { getCustomContactIcon, getIconSetId } from '@/utils/contactIcons';

const OUTLINE = {
  email: MailIcon,
  phone: PhoneIcon,
  location: MapPinIcon,
  website: GlobeIcon,
  linkedin: LinkedinPdfIcon,
  github: GithubPdfIcon,
};

const FILLED = {
  email: FilledMailPdf,
  phone: FilledPhonePdf,
  location: FilledPinPdf,
  website: FilledGlobePdf,
  linkedin: FilledLinkedinPdf,
  github: FilledGithubPdf,
};

/** PDF contact icon — custom image wins, else pack by iconSet */
export function PdfContactIcon({ field, settings, size = 9, color = '#555555' }) {
  const custom = getCustomContactIcon(field, settings);
  if (custom) {
    return (
      <Image
        src={custom}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  const pack = getIconSetId(settings) === 'filled' ? FILLED : OUTLINE;
  const Icon = pack[field] || OUTLINE[field];
  if (!Icon) return null;
  return <Icon size={size} color={color} />;
}
