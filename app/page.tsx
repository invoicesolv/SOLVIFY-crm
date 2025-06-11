"use client"

import { HeroCRM } from "@/components/ui/hero-crm";
import { NavBarDemo } from "@/components/ui/navbar-demo";
import { PricingSectionDemo } from "@/components/ui/pricing-demo";
import { 
  FeaturesSection, 
  AboutSection, 
  ContactSection, 
  Footer 
} from "@/components/ui/landing-sections";
import { FeatureComparisonTable } from "@/components/ui/feature-comparison-table";
import { SocialProof } from "@/components/ui/social-proof";
import { TestimonialsSection } from "@/components/ui/testimonials-section";
import { CostSavingsCalculator } from "@/components/ui/cost-savings-calculator";
import { ToolReplacementSection } from "@/components/ui/tool-replacement-section";
import { AIFeaturesShowcase } from "@/components/ui/ai-features-showcase";
import { IntegrationsSection } from "@/components/ui/integrations-section";
import { ROISection } from "@/components/ui/roi-section";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <NavBarDemo lang="en" />
      
      {/* Hero Section with Strong Value Proposition */}
      <HeroCRM 
        lang="en"
        title="Replace 8+ Tools with One Powerful CRM"
        subtitle="Stop paying for fragmented software. Solvify CRM consolidates customer management, project tracking, invoicing, analytics, and more into one unified platform."
        ctaText="Start Free Trial"
        ctaHref="/register"
      />
      
      {/* Immediate Value - Cost Savings Calculator */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            See How Much You'll Save
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Calculate your potential savings by replacing your current tool stack with Solvify CRM
          </p>
        </div>
        <CostSavingsCalculator />
      </section>
      
      {/* Visual Tool Replacement */}
      <ToolReplacementSection />
      
      {/* AI-Powered Features with Screenshots */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            AI-Powered Business Intelligence
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get intelligent insights, automated workflows, and predictive analytics that help you make better business decisions
          </p>
        </div>
        <AIFeaturesShowcase />
      </section>
      
      {/* Core Features */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything Your Business Needs
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From customer management to financial tracking, we've got you covered
          </p>
        </div>
        <FeaturesSection />
      </section>
      
      {/* ROI and Benefits */}
      <ROISection />
      
      {/* Integrations */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Seamless Integrations
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect with the tools you already use and love
          </p>
        </div>
        <IntegrationsSection />
      </section>
      
      {/* Social Proof */}
      <section className="py-16 bg-background">
        <SocialProof lang="en" />
      </section>
      
      {/* Pricing - Emphasize Value */}
      <section className="py-16 bg-muted/30">
        <PricingSectionDemo 
          lang="en"
          title="Simple, Transparent Pricing"
          subtitle="Replace your entire software stack for less than what you're paying for just one tool"
        />
      </section>
      
      {/* Feature Comparison */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            See How We Compare
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Why choose multiple tools when one does it all?
          </p>
        </div>
        <FeatureComparisonTable lang="en" />
      </section>
      
      {/* Customer Testimonials */}
      <section className="py-16 bg-muted/30">
        <TestimonialsSection lang="en" />
      </section>
      
      {/* About Section - Trust Building */}
      <section className="py-16 bg-background">
        <AboutSection 
          title="Built by Business Owners, for Business Owners"
          subtitle="We understand the frustration of managing multiple subscriptions and fragmented data. That's why we built Solvify CRM - to give you everything you need in one place."
        />
      </section>
      
      {/* Final CTA */}
      <section className="py-16 bg-primary/10">
        <ContactSection 
          language="en"
          title="Ready to Simplify Your Business?"
                      subtitle="Join thousands of businesses that have already made the switch to Solvify CRM"
          formLabels={{
            name: "Full Name",
            email: "Business Email",
            message: "Tell us about your current challenges",
            submit: "Start My Free Trial"
          }}
        />
      </section>
      
      <Footer />
    </main>
  );
} 