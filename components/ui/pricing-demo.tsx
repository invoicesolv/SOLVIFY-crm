"use client"

import { PricingSection } from "@/components/ui/pricing-section"

export const PAYMENT_FREQUENCIES = {
  sv: ["Månadsvis", "Årsvis"],
  en: ["Monthly", "Yearly"]
}

interface PricingTier {
  id: string
  name: string
  description: string
  price: {
    monthly: number | string
    yearly: number | string
  }
  features: string[]
  cta: {
    text: string
    href: string
  }
  trial?: string
  stripePriceId?: {
    monthly: string | null
    yearly: string | null
  }
  popular?: boolean
  highlighted?: boolean
}

export const TIERS: { sv: PricingTier[], en: PricingTier[] } = {
  sv: [
    {
      id: "free",
      name: "Privatpersoner",
      description: "För dina hobbyprojekt",
      price: {
        monthly: "Gratis",
        yearly: "Gratis"
      },
      features: [
        "14 dagars gratis test",
        "Gratis e-postaviseringar",
        "3-minuters kontroller",
        "Automatisk databerikelse",
        "10 övervakare",
        "Upp till 3 platser"
      ],
      cta: {
        text: "Kom igång",
        href: "/register?plan=free"
      },
      stripePriceId: {
        monthly: null,
        yearly: null
      }
    },
    {
      id: "team",
      name: "Team",
      description: "Perfekt för små företag",
      price: {
        monthly: 299,
        yearly: 2990
      },
      features: [
        "14 dagars gratis test",
        "Obegränsade telefonsamtal",
        "30 sekunders kontroller",
        "Enskilt användarkonto",
        "20 övervakare",
        "Upp till 6 platser"
      ],
      cta: {
        text: "Testa gratis",
        href: "/register?plan=team"
      },
      stripePriceId: {
        monthly: "price_1R3KiwKrzodQUsuF79bVaycE",
        yearly: "price_1R3Kj6KrzodQUsuFOsAVUeWl"
      },
      popular: true
    },
    {
      id: "business",
      name: "Organisationer",
      description: "Perfekt för stora företag",
      price: {
        monthly: 499,
        yearly: 4990
      },
      features: [
        "14 dagars gratis test",
        "Obegränsade telefonsamtal",
        "15 sekunders kontroller",
        "Enskilt användarkonto",
        "50 övervakare",
        "Upp till 10 platser"
      ],
      cta: {
        text: "Testa gratis",
        href: "/register?plan=business"
      },
      stripePriceId: {
        monthly: "price_1R3KjGKrzodQUsuFkBaoyjB2",
        yearly: "price_1R3KjTKrzodQUsuF2ULuAm7D"
      }
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "För flera team",
      price: {
        monthly: 999,
        yearly: 9990
      },
      features: [
        "Allt i Organisationer",
        "Upp till 5 teammedlemmar",
        "100 övervakare",
        "15 statussidor",
        "200+ integrationer"
      ],
      cta: {
        text: "Kontakta oss",
        href: "/contact"
      },
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || "price_1R3KjdKrzodQUsuFRvxjWweU",
        yearly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID || "price_1R3KjpKrzodQUsuF0ZO54S4S"
      }
    }
  ],
  en: [
    {
      id: "free",
      name: "Personal",
      description: "For individual entrepreneurs",
      price: {
        monthly: "Free",
        yearly: "Free"
      },
      features: [
        "Customer management",
        "Project management",
        "Basic bookkeeping",
        "Calendar integration",
        "Email notifications"
      ],
      cta: {
        text: "Try for free",
        href: "/register"
      },
      trial: "14 days for free",
      stripePriceId: {
        monthly: null,
        yearly: null
      }
    },
    {
      id: "team",
      name: "Team",
      description: "For small teams",
      price: {
        monthly: 29,
        yearly: 290
      },
      features: [
        "Everything in Personal",
        "Invoice management",
        "Fortnox integration",
        "AI assistants",
        "Marketing analytics"
      ],
      cta: {
        text: "Try for free",
        href: "#"
      },
      trial: "14 days for free",
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID || "price_1R3KiwKrzodQUsuF79bVaycE",
        yearly: process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID || "price_1R3Kj6KrzodQUsuFOsAVUeWl"
      },
      popular: true
    },
    {
      id: "business",
      name: "Organizations",
      description: "For larger companies",
      price: {
        monthly: 49,
        yearly: 490
      },
      features: [
        "Everything in Team",
        "Domain management",
        "Google Analytics",
        "Advanced bookkeeping",
        "Receipt handling"
      ],
      cta: {
        text: "Try for free",
        href: "#"
      },
      trial: "14 days for free",
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || "price_1R3KjGKrzodQUsuFkBaoyjB2",
        yearly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID || "price_1R3KjTKrzodQUsuF2ULuAm7D"
      }
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "For large companies",
      price: {
        monthly: 99,
        yearly: 990
      },
      features: [
        "Everything in Organizations",
        "Custom integrations",
        "Dedicated support",
        "Custom reports",
        "SLA guarantee"
      ],
      cta: {
        text: "Contact us",
        href: "/contact"
      },
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || "price_1R3KjdKrzodQUsuFRvxjWweU",
        yearly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID || "price_1R3KjpKrzodQUsuF0ZO54S4S"
      }
    }
  ]
}

interface PricingSectionDemoProps {
  title?: string;
  subtitle?: string;
  frequencies?: string[];
  tiers?: typeof TIERS.en | typeof TIERS.sv;
  lang?: "en" | "sv";
}

export function PricingSectionDemo({
  title = "Simple Pricing",
  subtitle = "Choose the plan that fits your needs",
  lang = "en",
  frequencies = PAYMENT_FREQUENCIES[lang],
  tiers = TIERS[lang],
}: PricingSectionDemoProps) {
  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <PricingSection
          title={title}
          subtitle={subtitle}
          tiers={tiers}
          frequencies={frequencies}
        />
      </div>
    </section>
  );
} 