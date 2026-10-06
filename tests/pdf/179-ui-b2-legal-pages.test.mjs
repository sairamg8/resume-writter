// UI rebuild B2 (cluster legal-and-states): the Terms and Privacy pages in the canvas look. Wrapper only:
// the text is the live text word for word (EXPECTED below is the pre-redesign pages' text, tags stripped),
// the page sits under the shared AppBar with nothing active in the nav (and AuthBar, so a signed-out
// visitor can sign in) and above the phone tab bar, in one 680 px column; the two new-tab links in Privacy
// section 4 and the contact line are kept. Footer links: tests/unit/legal-footer.unit.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const EXPECTED = {
  "Terms": "Terms and Conditions Last updated: June 27, 2026 1. Acceptance of Terms By accessing or using CPWT-CV (\"the Service\", \"we\", \"our\"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Service. 2. Description of Service CPWT-CV is a browser-based resume and cover letter builder. It allows users to create, edit, export, and (with a Google account) sync resume data to the cloud. The Service is provided for personal, non-commercial use. 3. User Accounts You may use CPWT-CV without an account; all data is stored in your browser's local storage. If you choose to sign in with Google, your resume data will be synced to our cloud database (Firebase Firestore) under your Google account. You are responsible for maintaining the security of your Google account. 4. Your Content You retain full ownership of all resume content you create using CPWT-CV. We do not claim any intellectual property rights over your data. By using the cloud sync feature, you grant us a limited licence to store and transmit your content solely for the purpose of providing the Service. 5. Acceptable Use You agree not to: Use the Service for any unlawful purpose Attempt to gain unauthorised access to other users' data Upload malicious code or content to the Service Reverse-engineer or copy the Service for commercial purposes 6. Service Availability We aim to keep CPWT-CV available at all times but do not guarantee uninterrupted access. We may modify, suspend, or discontinue the Service at any time without notice. Because resume data is also stored locally in your browser, you will not lose your data if the cloud service is temporarily unavailable. 7. Disclaimer of Warranties The Service is provided \"as is\" without warranties of any kind, either express or implied. We do not warrant that the Service will be error-free, secure, or that exported documents will meet any specific employer or applicant-tracking-system requirements. 8. Limitation of Liability To the maximum extent permitted by law, CPWT-CV shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to loss of data or employment opportunities. 9. Changes to Terms We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes acceptance of the new Terms. 10. Contact Contact the people who run this site.",
  "Privacy": "Privacy Policy Last updated: June 27, 2026 1. Overview CPWT-CV (\"we\", \"our\", \"the Service\") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and what choices you have. 2. Data We Collect 2a. Without an account (local-only mode) Everything you enter — your résumés (including your name, contact details, work history, and any uploaded photo), the Job Tracker's jobs, and your boards — is stored exclusively in your browser's localStorage . It never leaves your device and we cannot access it. 2b. With a Google account (cloud sync) When you sign in with Google, we collect and store the following: Google profile data : your name, email address, and profile photo URL, provided by Google OAuth. Resume data : your résumés, synced to Firebase Firestore under your unique user ID. Job Tracker data : your jobs — company, role, status, dates, notes, to-dos and the rest of each job — synced the same way. Boards : your projects with their columns, labels, sprints and issues, synced the same way. Public links : only when you choose Share a public link on a résumé, a read-only copy of that résumé — what its PDF prints: the name, job title, contacts, photo, summary and sections you show — is stored in Firestore under a random link, and anyone with the link can read it. Fields and sections you hid, the cover letter and the résumé's name in your list are not in it. It stays public until you unpublish it. When you sign out, your résumés, jobs and boards are removed from this browser; they stay in your account and come back when you sign in again. Anything you add while signed out stays in this browser only, and joins your account the next time you sign in. We do not collect payment information, browsing history, or device identifiers. 3. How We Use Your Data To sync your résumés, jobs and boards across devices when you are signed in. To restore your data if you clear your browser's local storage. We do not sell, rent, or share your personal data with third parties for marketing purposes. 4. Third-Party Services We use the following third-party services: Google Firebase (Auth & Firestore) — for authentication and cloud storage. Firebase's data is stored on Google's infrastructure. See Firebase Privacy . jsDelivr (Fontsource font files) — the default font, Noto Sans, ships with the app. When you pick another font, add a custom Google Font, or your text contains symbols that font lacks, its files are downloaded from the jsDelivr CDN. No résumé content is sent — only the font file request, which jsDelivr may log. See jsDelivr Privacy Policy . 5. Data Retention Your cloud data is retained for as long as your account exists. You may delete your data at any time by signing in and deleting all your résumés, jobs and boards, or by contacting us to request full account deletion. 6. Security Firestore security rules ensure that only you (authenticated by your Google account) can read or write your résumés, jobs and boards. The one exception is a résumé you publish with a public link: anyone with that link can read its copy, and only you can change or unpublish it. All data in transit is encrypted via HTTPS/TLS. 7. Your Rights You have the right to: Access the personal data we hold about you Request correction or deletion of your data Export your data at any time using the JSON export feature Withdraw consent by signing out and clearing your browser storage 8. Children's Privacy CPWT-CV is not directed at children under 13. We do not knowingly collect data from children. If you believe a child has provided personal data, contact us and we will delete it promptly. 9. Changes to This Policy We may update this Privacy Policy occasionally. We will note the updated date at the top of this page. Continued use of the Service constitutes acceptance of the updated policy. 10. Contact Contact the people who run this site."
};

const flat = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const auth = { user: null, authLoading: false, cloudAvailable: true, signInWithGoogle() {}, signOut() {} };
const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
async function render(file, props = { auth, sync }) {
  const { default: Page } = await loadModule(file);
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Page, props)));
}

for (const [name, file] of [['Terms', '/src/pages/TermsPage.jsx'], ['Privacy', '/src/pages/PrivacyPage.jsx']]) {
  describe(`${name} page`, () => {
    it('keeps the live text word for word (title, date, every section, the contact line)', async () => {
      const html = await render(file);
      const body = html.slice(html.indexOf('<h1'), html.indexOf('<div class="border-t border-cv-hairline'));
      assert.ok(body.length > 1000, 'the page body was found');
      assert.equal(flat(body), EXPECTED[name]);
    });

    it('sits under the app bar with no area active, above the phone tab bar, in one 680 px column', async () => {
      const html = await render(file);
      assert.match(html, /data-testid="app-bar"/);
      assert.match(html, /data-testid="bottom-tab-bar"/);
      assert.equal(html.includes('aria-current="page"'), false, 'no nav area is current on a legal page');
      assert.match(html, /max-w-\[680px\]/);
      assert.match(html, /aria-label="Back"/);
      assert.match(html, /© 2026 CPWT-CV/);
    });

    it('offers Sign in to a signed-out visitor', async () => {
      assert.match(await render(file), /aria-label="Sign in with Google"/);
    });

    it('opens without an account bar props (a test or a build without them) and prints no mailto without an address', async () => {
      const html = await render(file, {});
      assert.match(html, /data-testid="app-bar"/);
      assert.equal(html.includes('mailto:'), false);
    });
  });
}

describe('Privacy section 4 links', () => {
  it('open in a new tab without opener', async () => {
    const html = await render('/src/pages/PrivacyPage.jsx');
    const links = [...html.matchAll(/<a href="(https:[^"]*)"([^>]*)>/g)];
    assert.deepEqual(links.map((m) => m[1]), ['https://firebase.google.com/support/privacy', 'https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net']);
    for (const m of links) assert.ok(m[2].includes('target="_blank"') && m[2].includes('rel="noopener noreferrer"'), m[0]);
  });
});
