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

export default function LandingPage() {
  return (
    <main className="bg-neutral-950 min-h-screen">
      <NavBarDemo lang="en" />
      <HeroCRM lang="en" />
      <FeaturesSection />
      <SocialProof lang="en" />
      <PricingSectionDemo 
        lang="en"
        title="Simple Pricing"
        subtitle="Choose the plan that fits your needs"
      />
      <FeatureComparisonTable lang="en" />
      <TestimonialsSection lang="en" />
      <AboutSection 
        title="About Solvify CRM"
        subtitle="We're on a mission to help businesses grow through better customer relationships and streamlined workflows."
      />
      <ContactSection 
        language="en"
        title="Get in Touch"
        subtitle="Have questions about our CRM? Our team is here to help."
        formLabels={{
          name: "Name",
          email: "Email",
          message: "Message",
          submit: "Send Message"
        }}
      />
      <Footer />
    </main>
  );
} 