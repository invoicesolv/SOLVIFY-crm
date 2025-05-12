import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Solvify CRM | Modern Customer Relationship Management",
    template: "%s | Solvify CRM"
  },
  description: "Modern CRM solution that consolidates all your essential business tools into one powerful platform, saving you time and money.",
  keywords: ["CRM", "customer management", "project management", "invoicing", "business software", "productivity tools", "sales tracking"],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    }
  },
  icons: {
    icon: [
      {
        url: "/S-logo.png",
        type: "image/png",
      }
    ],
    shortcut: "/S-logo.png",
    apple: "/S-logo.png",
  },
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#3b82f6",
  creator: "Solvify AB",
  metadataBase: new URL('https://solvify.com'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': 'https://solvify.com',
      'sv-SE': 'https://solvify.com/sv',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://solvify.com',
    title: 'Solvify CRM | Modern Customer Relationship Management',
    description: 'Modern CRM solution that consolidates all your essential business tools into one powerful platform.',
    siteName: 'Solvify CRM',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solvify CRM | Modern Customer Relationship Management',
    description: 'Modern CRM solution that consolidates all your essential business tools into one powerful platform.',
    creator: '@solvify',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-gray-100">
      <head>
        <link rel="canonical" href="https://solvify.com" />
      </head>
      <body className={`${inter.className} h-full`}>
        <Providers>
          {children}
        </Providers>
        <div id="portal-root" />
      </body>
    </html>
  );
} 