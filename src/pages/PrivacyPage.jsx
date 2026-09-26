import { useLocation, useNavigate } from 'react-router-dom';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { SITE_OWNER } from '@/utils/siteOwner';
import { FileText, ArrowLeft } from 'lucide-react';

// The deployment's contact address (VITE_CONTACT_EMAIL); a fork without it names nobody's.
const { contactEmail } = SITE_OWNER;

export default function PrivacyPage() {
  const goBack = useBackOrHome();
  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={goBack} aria-label="Back" title="Back" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">CPWT-CV</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: June 27, 2026</p>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Overview</h2>
            <p>
              CPWT-CV ("we", "our", "the Service") is committed to protecting your privacy. This policy
              explains what data we collect, how we use it, and what choices you have.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Data We Collect</h2>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2a. Without an account (local-only mode)</h3>
            <p>
              Everything you enter — your résumés (including your name, contact details, work history, and
              any uploaded photo), the Job Tracker's jobs, and your boards — is stored exclusively in your
              browser's <strong>localStorage</strong>. It never leaves your device and we cannot access it.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2b. With a Google account (cloud sync)</h3>
            <p>When you sign in with Google, we collect and store the following:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Google profile data</strong>: your name, email address, and profile photo URL, provided by Google OAuth.</li>
              <li><strong>Resume data</strong>: your résumés, synced to Firebase Firestore under your unique user ID.</li>
              <li><strong>Job Tracker data</strong>: your jobs — company, role, status, dates, notes, to-dos and the rest of each job — synced the same way.</li>
              <li><strong>Boards</strong>: your projects with their columns, labels, sprints and issues, synced the same way.</li>
              <li><strong>Public links</strong>: only when you choose Share a public link on a résumé, a read-only copy of that résumé — what its PDF prints: the name, job title, contacts, photo, summary and sections you show — is stored in Firestore under a random link, and anyone with the link can read it. Fields and sections you hid, the cover letter and the résumé's name in your list are not in it. It stays public until you unpublish it.</li>
            </ul>
            <p className="mt-2">
              When you sign out, your résumés, jobs and boards are removed from this browser; they stay in your
              account and come back when you sign in again. Anything you add while signed out stays in this
              browser only, and joins your account the next time you sign in.
            </p>
            <p className="mt-2">
              We do <strong>not</strong> collect payment information, browsing history, or device identifiers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To sync your résumés, jobs and boards across devices when you are signed in.</li>
              <li>To restore your data if you clear your browser's local storage.</li>
              <li>We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong>Google Firebase (Auth &amp; Firestore)</strong> — for authentication and cloud storage.
                Firebase's data is stored on Google's infrastructure. See{' '}
                <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Firebase Privacy
                </a>.
              </li>
              <li>
                <strong>jsDelivr (Fontsource font files)</strong> — the default font, Noto Sans, ships with
                the app. When you pick another font, add a custom Google Font, or your text contains symbols
                that font lacks, its files are downloaded from the jsDelivr CDN. No résumé content is sent —
                only the font file request, which jsDelivr may log. See{' '}
                <a href="https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  jsDelivr Privacy Policy
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              Your cloud data is retained for as long as your account exists. You may delete your data
              at any time by signing in and deleting all your résumés, jobs and boards, or by contacting us to request
              full account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Security</h2>
            <p>
              Firestore security rules ensure that only you (authenticated by your Google account) can
              read or write your résumés, jobs and boards. The one exception is a résumé you publish with a
              public link: anyone with that link can read its copy, and only you can change or unpublish it.
              All data in transit is encrypted via HTTPS/TLS.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Export your data at any time using the JSON export feature</li>
              <li>Withdraw consent by signing out and clearing your browser storage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Children's Privacy</h2>
            <p>
              CPWT-CV is not directed at children under 13. We do not knowingly collect data from
              children. If you believe a child has provided personal data, contact us and we will
              delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy occasionally. We will note the updated date at the top
              of this page. Continued use of the Service constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p>
              {contactEmail ? (<>
                For privacy-related requests or questions, email us at{' '}
                <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">
                  {contactEmail}
                </a>.
              </>) : 'Contact the people who run this site.'}
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The link to the page already shown goes back to its top: navigating there added a second entry
  // of the same page (Back needed one more press to leave) and kept the scroll (R4-APP-08).
  const open = (to) => (to === pathname ? window.scrollTo(0, 0) : navigate(to));
  return (
    <div className="border-t border-gray-200 bg-white mt-12">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-400">© 2026 CPWT-CV. All rights reserved.</p>
        <div className="flex gap-4 text-xs text-gray-400">
          <button onClick={() => open('/terms')} className="hover:text-gray-700 transition-colors">Terms</button>
          <button onClick={() => open('/privacy')} className="hover:text-gray-700 transition-colors">Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}
