import Script from 'next/script'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Vibe CRM | Modern CRM for Growing Businesses",
  description: "Vibe CRM consolidates all your essential business tools into one powerful platform, saving you time and money.",
  keywords: "CRM, customer management, project management, invoicing, accounting",
  alternates: {
    canonical: 'https://vibe.solvify.com/landing',
    languages: {
      'en-US': 'https://vibe.solvify.com/landing',
      'sv-SE': 'https://vibe.solvify.com/landing/sv',
    },
  },
  openGraph: {
    title: "Vibe CRM | Modern CRM for Growing Businesses",
    description: "Vibe CRM consolidates all your essential business tools into one powerful platform, saving you time and money.",
    type: "website",
    locale: 'en_US',
    url: 'https://vibe.solvify.com/landing',
    images: [
      {
        url: 'https://vibe.solvify.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Vibe CRM Dashboard',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Vibe CRM | Modern CRM for Growing Businesses",
    description: "Vibe CRM consolidates all your essential business tools into one powerful platform, saving you time and money.",
    images: ['https://vibe.solvify.com/twitter-image.jpg'],
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Product structured data
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
    "description": "Vibe CRM consolidates all your essential business tools into one powerful platform, saving you time and money."
  };

  // Organization structured data
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
      "contactType": "customer service",
      "availableLanguage": ["English", "Swedish"]
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