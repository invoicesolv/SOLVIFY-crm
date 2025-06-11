"use client";

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

export default function LandingPage() {
  return (
    <main className="bg-background min-h-screen">
      <NavBarDemo lang="en" />
      <HeroCRM lang="en" />
      
      {/* Cost Savings Calculator - High impact section */}
      <CostSavingsCalculator />
      
      {/* Tool Replacement Visual Section */}
      <ToolReplacementSection />
      
      {/* AI Features Showcase with screenshots */}
      <AIFeaturesShowcase />
      
      {/* Enhanced Features Section */}
      <FeaturesSection />
      
      {/* ROI and Benefits Section */}
      <ROISection />
      
      {/* Integrations Section */}
      <IntegrationsSection />
      
      {/* Social Proof */}
      <SocialProof lang="en" />
      
      {/* Pricing with emphasis on savings */}
      <PricingSectionDemo 
        lang="en"
        title="Replace Your Entire Tool Stack for Less"
        subtitle="Stop paying for 8+ different subscriptions. Get everything in one platform."
      />
      
      {/* Feature Comparison Table */}
      <FeatureComparisonTable lang="en" />
      
      {/* Testimonials */}
      <TestimonialsSection lang="en" />
      
      {/* About Section */}
      <AboutSection 
        title="Why We Built Solvify CRM"
        subtitle="We were tired of businesses wasting money on fragmented software stacks that don't work together."
      />
      
      {/* Contact Section */}
      <ContactSection 
        language="en"
        title="Ready to Consolidate Your Tools?"
        subtitle="See how much you can save by replacing your current software stack with Solvify CRM."
        formLabels={{
          name: "Name",
          email: "Email",
          message: "Tell us about your current tools",
          submit: "Get My Savings Report"
        }}
      />
      
      <Footer />
    </main>
  );
} 