import Script from 'next/script'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Solvify CRM Blog | CRM & Business Insights",
  description: "Discover expert guides, tips and best practices for using Solvify CRM to improve customer relationships and grow your business.",
  keywords: ["CRM tips", "business efficiency", "customer management", "CRM best practices", "project management", "Solvify guides"],
  alternates: {
    canonical: 'https://crm.solvify.se/blog',
    languages: {
      'en-US': 'https://crm.solvify.se/blog',
      'sv-SE': 'https://crm.solvify.se/blog/sv',
    },
  },
  openGraph: {
    title: "Solvify CRM Blog | CRM & Business Insights",
    description: "Discover expert guides, tips and best practices for using Solvify CRM to improve customer relationships and grow your business.",
    type: "website",
    locale: 'en_US',
    url: 'https://crm.solvify.se/blog',
    images: [
      {
        url: 'https://crm.solvify.se/blog-og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Solvify CRM Blog',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Solvify CRM Blog | CRM & Business Insights",
    description: "Discover expert guides, tips and best practices for using Solvify CRM to improve customer relationships and grow your business.",
    images: ['https://crm.solvify.se/blog-twitter-image.jpg'],
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Blog structured data
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Solvify CRM Blog",
    "url": "https://crm.solvify.se/blog",
    "description": "Discover expert guides, tips and best practices for using Solvify CRM to improve customer relationships and grow your business.",
    "publisher": {
      "@type": "Organization",
      "name": "Solvify AB",
      "logo": {
        "@type": "ImageObject",
        "url": "https://crm.solvify.se/S-logo.png"
      }
    }
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