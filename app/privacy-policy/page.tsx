"use client";

import { SidebarDemo } from "@/components/ui/code.demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";

export default function PrivacyPolicyPage() {
  return (
    <SidebarDemo>
      <div className="p-8 space-y-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardContent className="p-8 space-y-8">
              
              {/* Introduction */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Solvify ("we," "our," or "us") operates the Solvify CRM platform (the "Service"). This page 
                    informs you of our policies regarding the collection, use, and disclosure of personal data 
                    when you use our Service and the choices you have associated with that data.
                  </p>
                  <p>
                    We use your data to provide and improve the Service. By using the Service, you agree to 
                    the collection and use of information in accordance with this policy.
                  </p>
                </div>
              </section>

              {/* Data We Collect */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
                <div className="space-y-4 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">2.1 Personal Information</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Name and email address when you create an account</li>
                    <li>Profile information you choose to provide</li>
                    <li>Billing and payment information for subscription services</li>
                    <li>Communication preferences and settings</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">2.2 Social Media Data</h3>
                  <p>
                    When you connect your social media accounts (Facebook, Instagram, Threads, LinkedIn, 
                    X/Twitter, TikTok, YouTube), we collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Profile information (username, display name, profile picture)</li>
                    <li>Account metrics (follower count, engagement rates)</li>
                    <li>Content you authorize us to access or post</li>
                    <li>Post performance data and analytics</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">2.3 Usage Data</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Log data (IP address, browser type, pages visited)</li>
                    <li>Device information and identifiers</li>
                    <li>Cookies and similar tracking technologies</li>
                    <li>Usage patterns and feature interactions</li>
                  </ul>
                </div>
              </section>

              {/* How We Use Data */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>We use the collected data for various purposes:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>To provide and maintain our Service</li>
                    <li>To manage your social media accounts and content</li>
                    <li>To process payments and manage subscriptions</li>
                    <li>To provide customer support and respond to inquiries</li>
                    <li>To send important updates about our Service</li>
                    <li>To improve our Service and develop new features</li>
                    <li>To comply with legal obligations</li>
                    <li>To detect and prevent fraud or abuse</li>
                  </ul>
                </div>
              </section>

              {/* Data Sharing */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Sharing and Disclosure</h2>
                <div className="space-y-4 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">4.1 Third-Party Services</h3>
                  <p>We share data with third-party services only as necessary to provide our Service:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Social Media Platforms:</strong> Facebook, Instagram, Threads, LinkedIn, X/Twitter, TikTok, YouTube</li>
                    <li><strong>Payment Processors:</strong> Stripe, PayPal (for billing)</li>
                    <li><strong>Analytics:</strong> Google Analytics (anonymized data only)</li>
                    <li><strong>Infrastructure:</strong> Supabase (database), Vercel (hosting)</li>
                    <li><strong>Email:</strong> Resend, Gmail API (for notifications)</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">4.2 Legal Requirements</h3>
                  <p>
                    We may disclose your information if required by law, court order, or government request, 
                    or to protect our rights, property, or safety.
                  </p>
                </div>
              </section>

              {/* Data Storage and Security */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">5. Data Security and Storage</h2>
                <div className="space-y-4 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">5.1 Security Measures</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>End-to-end encryption for sensitive data</li>
                    <li>Secure HTTPS connections for all data transmission</li>
                    <li>Regular security audits and vulnerability assessments</li>
                    <li>Access controls and authentication requirements</li>
                    <li>Data backup and disaster recovery procedures</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">5.2 Data Location</h3>
                  <p>
                    Your data is stored securely in EU data centers to comply with GDPR requirements. 
                    Data may be transferred internationally only with appropriate safeguards.
                  </p>
                </div>
              </section>

              {/* Your Rights (GDPR) */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">6. Your Rights (GDPR Compliance)</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>Under GDPR, you have the following rights:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Right to Access:</strong> Request copies of your personal data</li>
                    <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                    <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
                    <li><strong>Right to Restrict Processing:</strong> Limit how we process your data</li>
                    <li><strong>Right to Data Portability:</strong> Transfer your data to another service</li>
                    <li><strong>Right to Object:</strong> Object to certain types of processing</li>
                    <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
                  </ul>
                  <p>
                    To exercise these rights, contact us at <strong>privacy@solvify.se</strong>. 
                    We will respond within 30 days.
                  </p>
                </div>
              </section>

              {/* Cookies */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">7. Cookies and Tracking</h2>
                <div className="space-y-4 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">7.1 Types of Cookies</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Essential Cookies:</strong> Required for the Service to function</li>
                    <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                    <li><strong>Analytics Cookies:</strong> Help us understand how you use our Service</li>
                    <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">7.2 Managing Cookies</h3>
                  <p>
                    You can control cookies through your browser settings. Disabling certain cookies 
                    may affect the functionality of our Service.
                  </p>
                </div>
              </section>

              {/* Data Retention */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">8. Data Retention</h2>
                <div className="space-y-4 text-muted-foreground">
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Account Data:</strong> Retained while your account is active</li>
                    <li><strong>Usage Data:</strong> Retained for up to 2 years for analytics</li>
                    <li><strong>Marketing Data:</strong> Retained until you unsubscribe</li>
                    <li><strong>Legal Compliance:</strong> May be retained longer if required by law</li>
                  </ul>
                  <p>
                    When you delete your account, we will delete or anonymize your personal data 
                    within 30 days, except where retention is required by law.
                  </p>
                </div>
              </section>

              {/* Social Media API Compliance */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">9. Social Media Platform Compliance</h2>
                <div className="space-y-4 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">9.1 Meta Platforms (Facebook, Instagram, Threads)</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>We comply with Meta's Platform Terms and Developer Policies</li>
                    <li>Data is used only for the specific purposes you authorize</li>
                    <li>You can revoke access at any time through your platform settings</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">9.2 Google Services (YouTube)</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>We comply with Google API Services User Data Policy</li>
                    <li>Limited use of Google user data as defined by Google's policies</li>
                    <li>No unauthorized access or use beyond stated purposes</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">9.3 Other Platforms</h3>
                  <p>
                    We comply with the terms of service and privacy policies of LinkedIn, X/Twitter, 
                    and TikTok. Data access is limited to what you explicitly authorize.
                  </p>
                </div>
              </section>

              {/* Children's Privacy */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">10. Children's Privacy</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Our Service is not intended for children under 16 years of age. We do not 
                    knowingly collect personal information from children under 16. If you are a 
                    parent or guardian and believe your child has provided us with personal information, 
                    please contact us immediately.
                  </p>
                </div>
              </section>

              {/* Changes to Policy */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">11. Changes to This Privacy Policy</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    We may update our Privacy Policy from time to time. We will notify you of any 
                    changes by posting the new Privacy Policy on this page and updating the "last 
                    updated" date. Significant changes will be communicated via email or prominent 
                    notice in our Service.
                  </p>
                </div>
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">12. Contact Us</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>If you have any questions about this Privacy Policy, please contact us:</p>
                  <div className="bg-muted/20 p-4 rounded-lg">
                    <p><strong>Email:</strong> privacy@solvify.se</p>
                    <p><strong>Address:</strong> Solvify AB, Sweden</p>
                    <p><strong>Data Protection Officer:</strong> dpo@solvify.se</p>
                  </div>
                  
                  <p>
                    For GDPR-related inquiries, you also have the right to lodge a complaint with 
                    a supervisory authority in your country of residence.
                  </p>
                </div>
              </section>

            </CardContent>
          </AnimatedBorderCard>
        </div>
      </div>
    </SidebarDemo>
  );
} 