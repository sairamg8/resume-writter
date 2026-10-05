// JSON Resume (jsonresume.org): the Export menu's JSON Resume file, and the import of one. The
// import lives in jsonResumeImport.js (with isJsonResume), the export in jsonResumeExport.js, each
// section type's entries both ways in jsonResumeSections.js; the Export menu and the editor's import
// read them from here. The Dashboard, on the start-up path, imports from jsonResumeImport.js itself, so
// the export, which only the editor uses, loads with the editor (tests/pdf/122-startup-json-resume-export-lazy).
export { isJsonResume, jsonResumeToCpwtResume } from './jsonResumeImport.js';
export { cpwtResumeToJsonResume } from './jsonResumeExport.js';
