import { useLocation, useNavigate } from 'react-router-dom';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { SITE_OWNER } from '@/utils/siteOwner';
import { ArrowLeft } from 'lucide-react';
import AppBar from '@/components/AppBar';
import AuthBar from '@/components/AuthBar';
import BottomTabBar from '@/components/BottomTabBar';

// The deployment's contact address (VITE_CONTACT_EMAIL); a fork without it names nobody's.
const { contactEmail } = SITE_OWNER;

export default function TermsPage({ auth, sync }) {
  const goBack = useBackOrHome();
  return (
    <div className="min-h-screen bg-cv-ground text-cv-body">
      <AppBar active={null} account={<AuthBar {...auth} {...sync} compact hideName />} />
      <div className="max-w-[680px] mx-auto px-4 py-10">
        <button onClick={goBack} aria-label="Back" title="Back" className="mb-6 p-1.5 rounded-cv-control hover:bg-cv-sunken text-cv-muted transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-3xl font-bold text-cv-ink mb-2">Terms and Conditions</h1>
        <p className="text-sm text-cv-faint mb-10">Last updated: June 27, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-cv-body leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CPWT-CV ("the Service", "we", "our"), you agree to be bound by these Terms
              and Conditions. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">2. Description of Service</h2>
            <p>
              CPWT-CV is a browser-based resume and cover letter builder. It allows users to create,
              edit, export, and (with a Google account) sync resume data to the cloud. The Service is
              provided for personal, non-commercial use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">3. User Accounts</h2>
            <p>
              You may use CPWT-CV without an account; all data is stored in your browser's local storage.
              If you choose to sign in with Google, your resume data will be synced to our cloud database
              (Firebase Firestore) under your Google account. You are responsible for maintaining the
              security of your Google account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">4. Your Content</h2>
            <p>
              You retain full ownership of all resume content you create using CPWT-CV. We do not claim
              any intellectual property rights over your data. By using the cloud sync feature, you grant
              us a limited licence to store and transmit your content solely for the purpose of providing
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorised access to other users' data</li>
              <li>Upload malicious code or content to the Service</li>
              <li>Reverse-engineer or copy the Service for commercial purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">6. Service Availability</h2>
            <p>
              We aim to keep CPWT-CV available at all times but do not guarantee uninterrupted access.
              We may modify, suspend, or discontinue the Service at any time without notice. Because resume
              data is also stored locally in your browser, you will not lose your data if the cloud service
              is temporarily unavailable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" without warranties of any kind, either express or implied.
              We do not warrant that the Service will be error-free, secure, or that exported documents
              will meet any specific employer or applicant-tracking-system requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, CPWT-CV shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the Service, including but
              not limited to loss of data or employment opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">9. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes
              are posted constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cv-ink mb-3">10. Contact</h2>
            <p>
              {contactEmail ? (<>
                For questions about these Terms, contact us at{' '}
                <a href={`mailto:${contactEmail}`} className="text-cv-brand-text hover:underline">
                  {contactEmail}
                </a>.
              </>) : 'Contact the people who run this site.'}
            </p>
          </section>
        </div>
      </div>

      <Footer />
      <BottomTabBar />
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
    <div className="border-t border-cv-hairline bg-cv-surface mt-12 pb-[72px] md:pb-0">
      <div className="max-w-[680px] mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-cv-faint">© 2026 CPWT-CV. All rights reserved.</p>
        <div className="flex gap-4 text-xs text-cv-faint">
          <button onClick={() => open('/terms')} className="hover:text-cv-ink transition-colors">Terms</button>
          <button onClick={() => open('/privacy')} className="hover:text-cv-ink transition-colors">Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}
