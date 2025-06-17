"use client";

import { SidebarDemo } from "@/components/ui/code.demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-lg text-gray-600">CRM Publish - Effective Date: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Information We Collect</h2>
            <p className="text-gray-700 mb-4">
              CRM Publish collects information you provide directly to us, such as when you create an account, 
              connect your social media accounts, or contact us for support.
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Account information (name, email address)</li>
              <li>Social media account data (with your permission)</li>
              <li>Usage data and analytics</li>
              <li>Communication preferences</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Provide and maintain our CRM services</li>
              <li>Display your social media content and analytics</li>
              <li>Send you technical notices and support messages</li>
              <li>Improve our services and develop new features</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Social Media Integration</h2>
            <p className="text-gray-700 mb-4">
              Our service integrates with social media platforms including Facebook and Instagram. 
              When you connect these accounts:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>We access only the data you explicitly authorize</li>
              <li>We display your posts, insights, and engagement metrics</li>
              <li>We do not post on your behalf without explicit permission</li>
              <li>You can disconnect your accounts at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">
              We do not sell, trade, or otherwise transfer your personal information to third parties except:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and safety</li>
              <li>With service providers who assist in our operations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement appropriate security measures to protect your personal information against 
              unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Your Rights</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data</li>
              <li>Withdraw consent for data processing</li>
              <li>Data portability</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your information only as long as necessary to provide our services and comply with legal obligations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Contact Information</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700"><strong>Email:</strong> kevin@solvify.se</p>
              <p className="text-gray-700"><strong>Address:</strong> Plaza Cavalleria 1, B, 1b, Palma de Mallorca, Baleares 07012, Spain</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Changes to This Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the effective date.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
} 