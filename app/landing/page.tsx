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

export default function LandingPage() {
  return (
    <main className="bg-neutral-950 min-h-screen">
      <NavBarDemo />
      <HeroCRM 
        title="Transform Your Business with Solvify CRM"
        subtitle="Gain valuable insights, manage customer relationships, and boost productivity with our powerful CRM solution."
        ctaText="Get Started"
        ctaHref="/register"
      />
      <FeaturesSection />
      <PricingSectionDemo />
      <AboutSection />
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