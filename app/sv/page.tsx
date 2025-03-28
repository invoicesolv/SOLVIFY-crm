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

export default function SwedishPage() {
  return (
    <main className="bg-neutral-950 min-h-screen">
      <NavBarDemo />
      <HeroCRM 
        title="Transformera ditt företag med Solvify CRM"
        subtitle="Få värdefulla insikter, hantera kundrelationer och öka produktiviteten med vår kraftfulla CRM-lösning."
        ctaText="Kom igång"
        ctaHref="/register"
      />
      <FeaturesSection 
        title="Kraftfulla funktioner för ditt företag"
        subtitle="Vår CRM är fullpackad med funktioner som hjälper dig att hantera kunder, spåra försäljning och utveckla ditt företag."
        features={[
          {
            title: "Kundhantering",
            description: "Organisera och spåra alla dina kundinteraktioner på ett ställe.",
            icon: "👥",
          },
          {
            title: "Säljprocess",
            description: "Visualisera och optimera din säljprocess från lead till avslut.",
            icon: "📊",
          },
          {
            title: "Analyspanel",
            description: "Få realtidsinsikter i ditt företags prestanda.",
            icon: "📈",
          },
          {
            title: "Uppgiftshantering",
            description: "Tilldela och spåra uppgifter för att säkerställa att inget faller mellan stolarna.",
            icon: "✅",
          },
          {
            title: "E-postintegration",
            description: "Anslut din e-post för att spåra all kundkommunikation.",
            icon: "📧",
          },
          {
            title: "Mobilåtkomst",
            description: "Kom åt din CRM var som helst med vår mobilanpassade design.",
            icon: "📱",
          },
        ]}
      />
      <PricingSectionDemo 
        title="Enkel prissättning"
        subtitle="Välj den plan som passar dina behov"
        frequencies={["Månadsvis", "Årsvis"]}
        tiers={[
          {
            id: "individuals",
            name: "Privatpersoner",
            price: {
              monthly: "Gratis",
              yearly: "Gratis",
            },
            description: "För dina hobbyprojekt",
            features: [
              "Gratis e-postaviseringar",
              "3-minuters kontroller",
              "Automatisk databerikelse",
              "10 övervakare",
              "Upp till 3 platser",
            ],
            cta: {
              text: "Kom igång",
              href: "/register"
            },
            trial: "14 dagars gratis test",
            stripePriceId: {
              monthly: null,
              yearly: null
            }
          },
          {
            id: "teams",
            name: "Team",
            price: {
              monthly: "90 kr",
              yearly: "75 kr",
            },
            description: "Perfekt för små företag",
            features: [
              "Obegränsade telefonsamtal",
              "30 sekunders kontroller",
              "Enskilt användarkonto",
              "20 övervakare",
              "Upp till 6 platser",
            ],
            cta: {
              text: "Testa gratis",
              href: "#"
            },
            trial: "14 dagars gratis test",
            stripePriceId: {
              monthly: "price_1OuXPwKrzodQUsuFQZbGzxK2",
              yearly: "price_1OuXPwKrzodQUsuFvFgHmN8p"
            },
            popular: true
          },
          {
            id: "organizations",
            name: "Organisationer",
            price: {
              monthly: "120 kr",
              yearly: "100 kr",
            },
            description: "Perfekt för stora företag",
            features: [
              "Obegränsade telefonsamtal",
              "15 sekunders kontroller",
              "Enskilt användarkonto",
              "50 övervakare",
              "Upp till 10 platser",
            ],
            cta: {
              text: "Testa gratis",
              href: "#"
            },
            trial: "14 dagars gratis test",
            stripePriceId: {
              monthly: "price_1OuXQiKrzodQUsuFQmKpL8Yt",
              yearly: "price_1OuXQiKrzodQUsuFrGh2pN3q"
            }
          },
          {
            id: "enterprise",
            name: "Enterprise",
            price: {
              monthly: "Kontakta oss",
              yearly: "Kontakta oss",
            },
            description: "För flera team",
            features: [
              "Allt i Organisationer",
              "Upp till 5 teammedlemmar",
              "100 övervakare",
              "15 statussidor",
              "200+ integrationer",
            ],
            cta: {
              text: "Kontakta oss",
              href: "/contact"
            },
            stripePriceId: {
              monthly: null,
              yearly: null
            }
          },
        ]}
      />
      <AboutSection 
        title="Om Solvify"
        subtitle="Vi har som uppdrag att hjälpa företag växa genom bättre kundrelationer."
        content={[
          "Solvify grundades 2020 med ett enkelt mål: att skapa en CRM som människor faktiskt vill använda. Vi tror att kundrelationshanteringsprogram ska vara intuitiva, kraftfulla och trevliga att använda.",
          "Vårt team av erfarna utvecklare och designers har arbetat outtröttligt för att skapa en plattform som effektiviserar ditt arbetsflöde, ger värdefulla insikter och hjälper dig bygga starkare relationer med dina kunder.",
          "Vi är stolta över att betjäna företag i alla storlekar, från startups till stora organisationer, inom ett brett spektrum av branscher. Vårt engagemang för kontinuerlig förbättring innebär att vi alltid lägger till nya funktioner och förfinar befintliga baserat på kundfeedback."
        ]}
      />
      <ContactSection 
        language="sv"
        title="Kontakta Oss"
        subtitle="Har du frågor om vår CRM? Vårt team finns här för att hjälpa dig."
        formLabels={{
          name: "Namn",
          email: "E-post",
          message: "Meddelande",
          submit: "Skicka Meddelande"
        }}
      />
      <Footer 
        description="Kraftfulla CRM-lösningar för företag i alla storlekar. Effektivisera ditt arbetsflöde och bygg bättre kundrelationer."
        links={{
          product: {
            title: "Produkt",
            items: [
              { label: "Funktioner", href: "#features" },
              { label: "Priser", href: "#pricing" },
              { label: "Integrationer", href: "#" },
              { label: "Uppdateringar", href: "#" }
            ]
          },
          company: {
            title: "Företag",
            items: [
              { label: "Om oss", href: "#about" },
              { label: "Karriär", href: "#" },
              { label: "Blogg", href: "#" },
              { label: "Kontakt", href: "#contact" }
            ]
          },
          legal: {
            title: "Juridiskt",
            items: [
              { label: "Integritetspolicy", href: "#" },
              { label: "Användarvillkor", href: "#" },
              { label: "Cookie-policy", href: "#" },
              { label: "GDPR", href: "#" }
            ]
          }
        }}
      />
    </main>
  );
} 