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

export default function SwedishLandingPage() {
  return (
    <main className="bg-neutral-950 min-h-screen">
      <NavBarDemo lang="sv" />
      <HeroCRM lang="sv" />
      <FeaturesSection 
        title="Ersätt 8 olika mjukvaruverktyg med en lösning"
        subtitle="Solvify CRM samlar alla dina viktiga affärsverktyg i en kraftfull plattform, vilket sparar tid och pengar."
      />
      <SocialProof lang="sv" />
      <PricingSectionDemo 
        lang="sv"
        title="Enkel prissättning"
        subtitle="Välj den plan som passar dina behov"
      />
      <FeatureComparisonTable lang="sv" />
      <TestimonialsSection lang="sv" />
      <AboutSection 
        title="Om Solvify CRM"
        subtitle="Vi har som uppdrag att hjälpa företag att växa genom bättre kundrelationer och effektiva arbetsflöden."
      />
      <ContactSection 
        language="sv"
        title="Kontakta oss"
        subtitle="Har du frågor om vårt CRM-system? Vårt team finns här för att hjälpa dig."
        formLabels={{
          name: "Namn",
          email: "E-post",
          message: "Meddelande",
          submit: "Skicka meddelande"
        }}
      />
      <Footer />
    </main>
  );
} 