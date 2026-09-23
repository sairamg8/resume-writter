// JSON Resume (jsonresume.org): the Export menu's JSON Resume file, and the import of one. The
// import lives in jsonResumeImport.js, the export in jsonResumeExport.js, each section type's
// entries both ways in jsonResumeSections.js; the Export menu, the Dashboard and the editor's
// import read them from here.
export { jsonResumeToCpwtResume } from './jsonResumeImport.js';
export { cpwtResumeToJsonResume } from './jsonResumeExport.js';

/**
 * Checks if a parsed JSON object matches the JSON Resume standard (jsonresume.org).
 */
export function isJsonResume(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (obj.basics && typeof obj.basics === 'object') return true;
  if (Array.isArray(obj.work) && Array.isArray(obj.education) && !Array.isArray(obj.sections)) return true;
  return false;
}
