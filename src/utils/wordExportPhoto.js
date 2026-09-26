// The Word résumé's profile photo (R2-126): Personal Info → Photo as the PDF's header prints it — its
// box, shape, ring and "cover" crop — as a docx ImageRun.
import { ImageRun } from 'docx';
import { getPdfPhotoStyle } from '@/templates/pdf/shared/pdfPhoto';
import { drawableImage } from '@/utils/imageUpload';
import { svgPhotoCopy, withPrintablePhotos } from '@/utils/printableImage';
import { templateId } from '@/constants/templates';
import { photoOption } from '@/constants/photoOptions';
import { accent2Hex } from '@/utils/wordExportUtils';

const EMU_PER_PT = 12700;
const PX_PER_PT = 96 / 72; // docx sizes an image in px at 96 dpi

/**
 * The bytes of base64 `payload`, read as react-pdf reads a photo's (Buffer.from): a character that is
 * not base64 is skipped, base64url's "-" and "_" read as "+" and "/", and a lone last character is
 * dropped; null when nothing is left. A stored photo can hold anything: atob threw on a stray
 * character, and the whole Word export failed where the PDF printed the photo.
 */
function base64Bytes(payload) {
  const b64 = payload.replace(/[^\w+/-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(b64.length % 4 === 1 ? b64.slice(0, -1) : b64);
    return bin.length ? Uint8Array.from(bin, (c) => c.charCodeAt(0)) : null;
  } catch {
    return null;
  }
}

/** A PNG's or a JPEG's size in px, { w, h }, from its bytes; null when they hold neither. */
function imageSize(bytes) {
  const at = (i) => (bytes[i] << 8) | bytes[i + 1];
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { w: (at(16) << 16) | at(18), h: (at(20) << 16) | at(22) };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  // A JPEG's size is in its frame header (SOF0–SOF15, not DHT C4, JPG C8 or DAC CC); walk the segments to it.
  for (let i = 2; i + 9 < bytes.length;) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: at(i + 7), h: at(i + 5) };
    i += 2 + at(i + 2);
  }
  return null;
}

/**
 * The part of a `size` picture that fills a `w` × `h` box, as the PDF's objectFit "cover" draws it:
 * the middle, cut evenly off the sides that overflow — Word's srcRect, in thousandths of a percent.
 */
function coverCrop(size, w, h) {
  const box = w / h;
  const pic = size.w / size.h;
  const cut = (keep) => Math.round(((1 - keep) / 2) * 100000);
  return pic > box
    ? { l: cut(box / pic), t: 0, r: cut(box / pic), b: 0 }
    : { l: 0, t: cut(pic / box), r: 0, b: cut(pic / box) };
}

/**
 * An ImageRun in a shape Word's API does not offer: docx always writes a rectangle, uncropped. The
 * drawing it builds gets `geometry` ({ prst, adj }: an ellipse, or a rounded rectangle and its
 * corner) and `crop` (srcRect) set in place — and, `grey`, DrawingML's greyscale effect on its
 * picture (<a:grayscl/>), so Word shows Photo → Tone Grayscale whatever bytes it holds (R2-147).
 */
class ShapedImageRun extends ImageRun {
  constructor(options, geometry, crop, grey = false) {
    super(options);
    this.geometry = geometry;
    this.crop = crop;
    this.grey = grey;
  }

  prepForXml(context) {
    const xml = super.prepForXml(context);
    const { prst, adj } = this.geometry;
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return undefined;
      if (node['a:prstGeom']) node['a:prstGeom'] = [{ _attr: { prst } }, { 'a:avLst': adj == null ? {} : [{ 'a:gd': { _attr: { name: 'adj', fmla: `val ${adj}` } } }] }];
      if ('a:srcRect' in node) node['a:srcRect'] = { _attr: this.crop };
      if (this.grey && node['a:blip'] && !JSON.stringify(node['a:blip']).includes('a:grayscl')) {
        const blip = node['a:blip'];
        node['a:blip'] = [...(Array.isArray(blip) ? blip : [blip]), { 'a:grayscl': {} }];
      }
      return Object.values(node).forEach(walk);
    };
    walk(xml);
    return xml;
  }
}

/**
 * The résumé's photo as the PDF prints it on `template`, or null where the PDF prints none: no photo,
 * the eye hides it, or bytes the PDF cannot draw (drawableImage). `s` the résumé's resolved settings.
 * Its box is the PDF's (getPdfPhotoStyle): Modern's and the Banner's photo sized for their banner, the
 * Sidebar's scaled to its column; the picture cropped to fill it. A Circle prints as an ellipse, Rounded
 * and Square as a rectangle with the PDF's corners. Border Thin and Accent ring it in the colour they
 * take on the white page — Word draws no banner or panel for the white ring they take there.
 * An SVG photo reaches here as the PNG copy withWordPhoto makes of it (RES-R2-126); one no copy could
 * be made of prints none, as Word takes no SVG without a PNG beside it. A photo react-pdf reads from
 * elsewhere reaches here as bytes (withWordPhoto). Photo → Tone Grayscale
 * prints it grey (ShapedImageRun's <a:grayscl/>; R2-147).
 * Returns { run, width }: `width` the box's, pt.
 */
export function wordPhoto(personal = {}, s = {}, template = 'classic') {
  if ((personal.hiddenFields || []).includes('photo')) return null;
  const src = drawableImage(personal.photo);
  const match = /^data:image\/(png|jpeg|jpg);base64,(.*)$/is.exec(src || '');
  if (!match) return null;
  const bytes = base64Bytes(match[2]);
  const size = bytes && imageSize(bytes);
  if (!size?.w || !size?.h) return null;
  const tid = templateId(template);
  const accent = s.accentColor || '#2563eb';
  const box = getPdfPhotoStyle(s, accent, ['modern', 'banner'].includes(tid) ? 'modern' : 'classic');
  // The Sidebar's column photo: Classic's scaled by one factor (SidebarTemplatePDF's sidePhoto).
  const scale = tid === 'sidebar' ? Math.min(0.55, 90 / box.width) : 1;
  const w = box.width * scale;
  const h = box.height * scale;
  const radius = Math.min(box.borderRadius, w / 2);
  const round = s.photoShape === 'circle' || radius >= Math.min(w, h) / 2 ? { prst: 'ellipse' } : { prst: 'roundRect', adj: Math.round((radius / Math.min(w, h)) * 100000) };
  const ring = getPdfPhotoStyle(s, accent, 'classic');
  const run = new ShapedImageRun({
    type: match[1].toLowerCase() === 'png' ? 'png' : 'jpg',
    data: bytes,
    transformation: { width: w * PX_PER_PT, height: h * PX_PER_PT },
    altText: { name: 'Photo', description: personal.name || 'Photo', title: 'Photo' },
    ...(box.borderWidth ? { outline: { type: 'solidFill', solidFillType: 'rgb', value: accent2Hex(ring.borderColor), width: Math.round(box.borderWidth * EMU_PER_PT) } } : {}),
  }, round, coverCrop(size, w, h), photoOption('photoTone', s.photoTone) === 'grayscale');
  return { run, width: w };
}

/** `bytes` as a base64 string, a chunk at a time (a photo's bytes overflow one call's arguments). */
function base64Of(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The picture at `url` as a data URL labelled by its bytes (drawableImage), or null when it cannot be read. */
async function fetchedImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout?.(15000) });
    if (!res.ok) return null;
    return drawableImage(`data:image/png;base64,${base64Of(new Uint8Array(await res.arrayBuffer()))}`);
  } catch {
    return null;
  }
}

/**
 * `resume` with its photo as the PDF export draws it, for wordPhoto to print (R2-126): the copy
 * the PDF prints of a WebP or GIF saved before uploads were converted (withPrintablePhotos, as
 * pdfExportReactPDF takes it), and the picture at a plain URL (a JSON Resume's `image`) fetched, as
 * react-pdf fetches it. Word printed neither. An SVG, saved or fetched, is drawn as a PNG copy
 * (svgPhotoCopy): react-pdf draws it as vectors, but a Word picture must be a PNG or a JPEG, and the
 * .docx printed no photo where the PDF printed it (RES-R2-126). A photo that cannot be read stays as
 * it is, and prints none; a hidden one is not fetched. The résumé itself is never changed.
 */
export async function withWordPhoto(resume) {
  const personal = resume?.personal;
  if (!personal?.photo || (personal.hiddenFields || []).includes('photo')) return resume;
  let out = resume;
  try {
    out = await withPrintablePhotos(resume);
  } catch {
    // no copy: the photo stays as saved
  }
  let photo = out.personal.photo;
  if (typeof photo === 'string' && /^https?:\/\//i.test(photo)) photo = (await fetchedImage(photo)) || photo;
  photo = (await svgPhotoCopy(photo)) || photo;
  return photo === out.personal.photo ? out : { ...out, personal: { ...out.personal, photo } };
}
