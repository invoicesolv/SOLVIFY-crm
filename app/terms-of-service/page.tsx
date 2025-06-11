"use client";

import { SidebarDemo } from "@/components/ui/code.demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";

export default function TermsOfServicePage() {
  return (
    <SidebarDemo>
      <div className="p-8 space-y-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardContent className="p-8 space-y-8">
              
              {/* Introduction */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    By accessing and using the Solvify CRM platform ("Service"), you accept and agree to be bound 
                    by the terms and provision of this agreement. If you do not agree to abide by the above, 
                    please do not use this service.
                  </p>
                </div>
              </section>

              {/* Use License */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">2. Use License</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Permission is granted to temporarily use the Solvify CRM platform for personal, 
                    non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>modify or copy the materials</li>
                    <li>use the materials for any commercial purpose or for any public display</li>
                    <li>attempt to reverse engineer any software contained on the website</li>
                    <li>remove any copyright or other proprietary notations from the materials</li>
                  </ul>
                </div>
              </section>

              {/* Account Responsibilities */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">3. Account Responsibilities</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>You are responsible for:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Ensuring all information provided is accurate and up-to-date</li>
                    <li>Complying with all applicable laws and regulations</li>
                    <li>Respecting the terms of service of connected social media platforms</li>
                  </ul>
                </div>
              </section>

              {/* Prohibited Uses */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">4. Prohibited Uses</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>You may not use our Service:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>For any unlawful purpose or to solicit others to unlawful acts</li>
                    <li>To violate any international, federal, provincial, or state regulations or laws</li>
                    <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
                    <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
                    <li>To submit false or misleading information</li>
                    <li>To upload or transmit viruses or any other type of malicious code</li>
                    <li>To spam, phish, pharm, pretext, spider, crawl, or scrape</li>
                    <li>For any obscene or immoral purpose</li>
                  </ul>
                </div>
              </section>

              {/* Service Availability */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">5. Service Availability</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    We strive to provide reliable service, but we do not guarantee that our Service will be 
                    available at all times. We may experience hardware, software, or other problems or need 
                    to perform maintenance related to the Service, resulting in interruptions, delays, or errors.
                  </p>
                </div>
              </section>

              {/* Payment Terms */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">6. Payment and Subscription Terms</h2>
                <div className="space-y-4 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">6.1 Subscription Fees</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Subscription fees are billed in advance on a monthly or annual basis</li>
                    <li>All fees are non-refundable except as required by law</li>
                    <li>Prices may change with 30 days notice</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">6.2 Cancellation</h3>
                  <p>
                    You may cancel your subscription at any time. Your subscription will remain active 
                    until the end of your current billing period.
                  </p>
                </div>
              </section>

              {/* Intellectual Property */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">7. Intellectual Property Rights</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    The Service and its original content, features, and functionality are and will remain 
                    the exclusive property of Solvify AB and its licensors. The Service is protected by 
                    copyright, trademark, and other laws.
                  </p>
                </div>
              </section>

              {/* User Content */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">8. User Content</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    You retain ownership of content you create through our Service. By using our Service, 
                    you grant us a limited, non-exclusive license to use, store, and display your content 
                    solely for the purpose of providing our Service to you.
                  </p>
                </div>
              </section>

              {/* Disclaimer */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">9. Disclaimer</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    The information on this website is provided on an 'as is' basis. To the fullest extent 
                    permitted by law, this Company excludes all representations, warranties, conditions and 
                    terms express or implied, statutory or otherwise.
                  </p>
                </div>
              </section>

              {/* Limitation of Liability */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">10. Limitation of Liability</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    In no event shall Solvify AB, nor its directors, employees, partners, agents, suppliers, 
                    or affiliates, be liable for any indirect, incidental, special, consequential, or punitive 
                    damages, including without limitation, loss of profits, data, use, goodwill, or other 
                    intangible losses, resulting from your use of the Service.
                  </p>
                </div>
              </section>

              {/* Termination */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">11. Termination</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    We may terminate or suspend your account and bar access to the Service immediately, 
                    without prior notice or liability, under our sole discretion, for any reason whatsoever 
                    and without limitation, including but not limited to a breach of the Terms.
                  </p>
                </div>
              </section>

              {/* Governing Law */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">12. Governing Law</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    These Terms shall be interpreted and governed by the laws of Sweden. Any disputes 
                    relating to these terms shall be subject to the exclusive jurisdiction of the Swedish courts.
                  </p>
                </div>
              </section>

              {/* Changes to Terms */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">13. Changes to Terms</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 
                    If a revision is material, we will provide at least 30 days notice prior to any new terms 
                    taking effect.
                  </p>
                </div>
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">14. Contact Information</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>If you have any questions about these Terms of Service, please contact us:</p>
                  <div className="bg-muted/20 p-4 rounded-lg">
                    <p><strong>Email:</strong> support@solvify.se</p>
                    <p><strong>Address:</strong> Solvify AB, Sweden</p>
                  </div>
                </div>
              </section>

            </CardContent>
          </AnimatedBorderCard>
        </div>
      </div>
    </SidebarDemo>
  );
} 