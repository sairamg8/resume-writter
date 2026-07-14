import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
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
              All resume data — including your name, contact details, work history, and any uploaded photo
              — is stored exclusively in your browser's <strong>localStorage</strong>. It never leaves
              your device and we cannot access it.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2b. With a Google account (cloud sync)</h3>
            <p>When you sign in with Google, we collect and store the following:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Google profile data</strong>: your name, email address, and profile photo URL, provided by Google OAuth.</li>
              <li><strong>Resume data</strong>: all content you enter into CPWT-CV, synced to Firebase Firestore under your unique user ID.</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> collect payment information, browsing history, or device identifiers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To sync your resumes across devices when you are signed in.</li>
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
                <strong>Google Fonts</strong> — loaded on-demand for font selection. Google may log font requests.
                See{' '}
                <a href="https://developers.google.com/fonts/faq/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Google Fonts Privacy FAQ
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              Your cloud data is retained for as long as your account exists. You may delete your data
              at any time by signing in and deleting all your resumes, or by contacting us to request
              full account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Security</h2>
            <p>
              Firestore security rules ensure that only you (authenticated by your Google account) can
              read or write your resume data. All data in transit is encrypted via HTTPS/TLS.
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
              For privacy-related requests or questions, email us at{' '}
              <a href="mailto:sairamgudiputi8@gmail.com" className="text-blue-600 hover:underline">
                sairamgudiputi8@gmail.com
              </a>.
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
  return (
    <div className="border-t border-gray-200 bg-white mt-12">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-400">© 2026 CPWT-CV. All rights reserved.</p>
        <div className="flex gap-4 text-xs text-gray-400">
          <button onClick={() => navigate('/terms')} className="hover:text-gray-700 transition-colors">Terms</button>
          <button onClick={() => navigate('/privacy')} className="hover:text-gray-700 transition-colors">Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}
