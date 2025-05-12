import Script from 'next/script'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Vibe CRM | Modernt CRM för växande företag",
  description: "Vibe CRM samlar alla dina viktiga affärsverktyg i en kraftfull plattform, vilket sparar tid och pengar.",
  keywords: "CRM, kundhantering, projekthantering, fakturering, ekonomisystem",
  alternates: {
    canonical: 'https://vibe.solvify.com/landing/sv',
    languages: {
      'en-US': 'https://vibe.solvify.com/landing',
      'sv-SE': 'https://vibe.solvify.com/landing/sv',
    },
  },
  openGraph: {
    title: "Vibe CRM | Modernt CRM för växande företag",
    description: "Vibe CRM samlar alla dina viktiga affärsverktyg i en kraftfull plattform, vilket sparar tid och pengar.",
    type: "website",
    locale: 'sv_SE',
    url: 'https://vibe.solvify.com/landing/sv',
    images: [
      {
        url: 'https://vibe.solvify.com/og-image-sv.jpg',
        width: 1200,
        height: 630,
        alt: 'Vibe CRM Dashboard',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Vibe CRM | Modernt CRM för växande företag",
    description: "Vibe CRM samlar alla dina viktiga affärsverktyg i en kraftfull plattform, vilket sparar tid och pengar.",
    images: ['https://vibe.solvify.com/twitter-image-sv.jpg'],
  },
};

export default function SwedishLandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Product structured data in Swedish
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Vibe CRM",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "299",
      "priceCurrency": "SEK",
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "127"
    },
    "description": "Vibe CRM samlar alla dina viktiga affärsverktyg i en kraftfull plattform, vilket sparar tid och pengar."
  };

  // Organization structured data with Swedish content
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Solvify AB",
    "url": "https://vibe.solvify.com",
    "logo": "https://vibe.solvify.com/S-logo.png",
    "sameAs": [
      "https://www.linkedin.com/company/solvify",
      "https://twitter.com/solvify"
    ],
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Artillerigatan 6",
      "addressLocality": "Stockholm",
      "postalCode": "114 51",
      "addressCountry": "SE"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+46-70-736-80-87",
      "contactType": "kundtjänst",
      "availableLanguage": ["English", "Svenska"]
    }
  };

  return (
    <>
      {children}
      <Script id="product-json-ld" type="application/ld+json">
        {JSON.stringify(productJsonLd)}
      </Script>
      <Script id="organization-json-ld" type="application/ld+json">
        {JSON.stringify(organizationJsonLd)}
      </Script>
    </>
  )
} 