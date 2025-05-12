import Script from 'next/script'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Solvify CRM Blogg | CRM & Affärsinsikter",
  description: "Upptäck expertguider, tips och bästa praxis för att använda Solvify CRM för att förbättra kundrelationer och få ditt företag att växa.",
  keywords: ["CRM-tips", "företagseffektivitet", "kundhantering", "CRM bästa praxis", "projektledning", "Solvify guider"],
  alternates: {
    canonical: 'https://crm.solvify.se/blog/sv',
    languages: {
      'en-US': 'https://crm.solvify.se/blog',
      'sv-SE': 'https://crm.solvify.se/blog/sv',
    },
  },
  openGraph: {
    title: "Solvify CRM Blogg | CRM & Affärsinsikter",
    description: "Upptäck expertguider, tips och bästa praxis för att använda Solvify CRM för att förbättra kundrelationer och få ditt företag att växa.",
    type: "website",
    locale: 'sv_SE',
    url: 'https://crm.solvify.se/blog/sv',
    images: [
      {
        url: 'https://crm.solvify.se/blog-og-image-sv.jpg',
        width: 1200,
        height: 630,
        alt: 'Solvify CRM Blogg',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Solvify CRM Blogg | CRM & Affärsinsikter",
    description: "Upptäck expertguider, tips och bästa praxis för att använda Solvify CRM för att förbättra kundrelationer och få ditt företag att växa.",
    images: ['https://crm.solvify.se/blog-twitter-image-sv.jpg'],
  },
};

export default function SwedishBlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Blog structured data in Swedish
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Solvify CRM Blogg",
    "url": "https://crm.solvify.se/blog/sv",
    "description": "Upptäck expertguider, tips och bästa praxis för att använda Solvify CRM för att förbättra kundrelationer och få ditt företag att växa.",
    "publisher": {
      "@type": "Organization",
      "name": "Solvify AB",
      "logo": {
        "@type": "ImageObject",
        "url": "https://crm.solvify.se/S-logo.png"
      }
    },
    "inLanguage": "sv-SE"
  };

  return (
    <>
      {children}
      <Script id="blog-json-ld" type="application/ld+json">
        {JSON.stringify(blogJsonLd)}
      </Script>
    </>
  )
} 