import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: June 27, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CPWT-CV ("the Service", "we", "our"), you agree to be bound by these Terms
              and Conditions. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              CPWT-CV is a browser-based resume and cover letter builder. It allows users to create,
              edit, export, and (with a Google account) sync resume data to the cloud. The Service is
              provided for personal, non-commercial use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. User Accounts</h2>
            <p>
              You may use CPWT-CV without an account; all data is stored in your browser's local storage.
              If you choose to sign in with Google, your resume data will be synced to our cloud database
              (Firebase Firestore) under your Google account. You are responsible for maintaining the
              security of your Google account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Your Content</h2>
            <p>
              You retain full ownership of all resume content you create using CPWT-CV. We do not claim
              any intellectual property rights over your data. By using the cloud sync feature, you grant
              us a limited licence to store and transmit your content solely for the purpose of providing
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorised access to other users' data</li>
              <li>Upload malicious code or content to the Service</li>
              <li>Reverse-engineer or copy the Service for commercial purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Service Availability</h2>
            <p>
              We aim to keep CPWT-CV available at all times but do not guarantee uninterrupted access.
              We may modify, suspend, or discontinue the Service at any time without notice. Because resume
              data is also stored locally in your browser, you will not lose your data if the cloud service
              is temporarily unavailable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" without warranties of any kind, either express or implied.
              We do not warrant that the Service will be error-free, secure, or that exported documents
              will meet any specific employer or applicant-tracking-system requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, CPWT-CV shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the Service, including but
              not limited to loss of data or employment opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes
              are posted constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p>
              For questions about these Terms, contact us at{' '}
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
