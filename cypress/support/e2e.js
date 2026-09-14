import './commands.js';

// Surface app crashes as test failures, but keep Firebase's "no config" noise from
// failing unrelated specs when the build has no VITE_FIREBASE_* env (the open-source default).
Cypress.on('uncaught:exception', (err) => {
  if (/firebase|auth\/invalid-api-key|installations/i.test(err.message)) return false;
  return true;
});
