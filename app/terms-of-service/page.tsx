"use client";

import { SidebarDemo } from "@/components/ui/code.demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-lg text-gray-600">CRM Publish - Effective Date: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing and using CRM Publish ("the Service"), you accept and agree to be bound by the terms 
              and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 mb-4">
              CRM Publish is a customer relationship management platform that helps businesses manage their 
              social media presence across multiple platforms including Facebook, Instagram, and other social networks.
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Social media account integration and management</li>
              <li>Content scheduling and publishing</li>
              <li>Analytics and insights reporting</li>
              <li>Customer engagement tracking</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts and Registration</h2>
            <p className="text-gray-700 mb-4">
              To use our Service, you must create an account and provide accurate, complete information. 
              You are responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
              <li>Ensuring your account information remains current and accurate</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Social Media Integration</h2>
            <p className="text-gray-700 mb-4">
              Our Service integrates with third-party social media platforms. By connecting your social media accounts:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>You grant us permission to access your account data as specified during authorization</li>
              <li>You remain responsible for compliance with each platform's terms of service</li>
              <li>You can revoke access at any time through your account settings</li>
              <li>We will only access data necessary to provide our services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Acceptable Use Policy</h2>
            <p className="text-gray-700 mb-4">You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with the proper functioning of the Service</li>
              <li>Use the Service for spam or unsolicited communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Payment and Billing</h2>
            <p className="text-gray-700 mb-4">
              Paid features of our Service are billed in advance on a subscription basis. By subscribing:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>You authorize us to charge your payment method for applicable fees</li>
              <li>Subscriptions automatically renew unless cancelled</li>
              <li>You can cancel your subscription at any time</li>
              <li>Refunds are provided according to our refund policy</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data and Privacy</h2>
            <p className="text-gray-700 mb-4">
              Your privacy is important to us. Our collection and use of your personal information is governed 
              by our Privacy Policy, which is incorporated into these Terms by reference.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              The Service and its original content, features, and functionality are owned by CRM Publish and are 
              protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Service Availability</h2>
            <p className="text-gray-700 mb-4">
              We strive to provide reliable service but cannot guarantee 100% uptime. We reserve the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Modify or discontinue the Service with reasonable notice</li>
              <li>Perform maintenance that may temporarily affect availability</li>
              <li>Suspend access for violations of these Terms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              To the maximum extent permitted by law, CRM Publish shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, or any loss of profits or revenues.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Termination</h2>
            <p className="text-gray-700 mb-4">
              We may terminate or suspend your account and access to the Service immediately, without prior notice, 
              for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes 
              via email or through the Service. Continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law</h2>
            <p className="text-gray-700 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of Spain, 
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contact Information</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700"><strong>Email:</strong> kevin@solvify.se</p>
              <p className="text-gray-700"><strong>Address:</strong> Plaza Cavalleria 1, B, 1b, Palma de Mallorca, Baleares 07012, Spain</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 