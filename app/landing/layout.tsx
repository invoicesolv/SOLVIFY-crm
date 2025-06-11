import Script from 'next/script'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Solvify CRM | Modern CRM for Growing Businesses",
  description: "Solvify CRM consolidates all your essential business tools into one powerful platform, saving you time and money.",
  keywords: "CRM, customer management, project management, invoicing, accounting",
  alternates: {
    canonical: 'https://crm.solvify.com/',
    languages: {
      'en-US': 'https://crm.solvify.com/',
    },
  },
  openGraph: {
    title: "Solvify CRM | Modern CRM for Growing Businesses",
    description: "Solvify CRM consolidates all your essential business tools into one powerful platform, saving you time and money.",
    type: "website",
    locale: 'en_US',
    url: 'https://crm.solvify.com/',
    images: [
      {
        url: 'https://crm.solvify.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Solvify CRM Dashboard',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Solvify CRM | Modern CRM for Growing Businesses",
    description: "Solvify CRM consolidates all your essential business tools into one powerful platform, saving you time and money.",
    images: ['https://Solvify.solvify.com/twitter-image.jpg'],
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
    "name": "Solvify CRM",
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
    "description": "Solvify CRM consolidates all your essential business tools into one powerful platform, saving you time and money."
  };

  // Organization structured data
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Solvify AB",
    "url": "https://Solvify.solvify.com",
    "logo": "https://Solvify.solvify.com/S-logo.png",
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