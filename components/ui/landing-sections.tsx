"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface FeaturesSectionProps {
  title?: string;
  subtitle?: string;
  features?: Feature[];
}

// Features Section
export function FeaturesSection({ 
  title = "Replace 8 Different Software Tools With One Solution",
  subtitle = "Solvify CRM consolidates all your essential business tools into one powerful platform, saving you time and money.",
  features = [
    {
      title: "CRM & Sales Pipeline",
      description: "Replaces Salesforce & HubSpot with powerful lead management and sales tracking.",
      icon: "💼",
    },
    {
      title: "Project Management",
      description: "Replaces Asana & Monday.com with intuitive task tracking and team collaboration.",
      icon: "✅",
    },
    {
      title: "Financial Management",
      description: "Replaces QuickBooks & FreshBooks with invoicing, billing and financial reporting.",
      icon: "💰",
    },
    {
      title: "Email Marketing",
      description: "Replaces Mailchimp & Constant Contact with integrated email campaign tools.",
      icon: "📧",
    },
    {
      title: "Analytics Dashboard",
      description: "Get comprehensive insights into all aspects of your business in one place.",
      icon: "📈",
    },
    {
      title: "Domain & Lead Management",
      description: "Track domains, capture leads, and convert prospects all in one system.",
      icon: "🌐",
    },
  ]
}: FeaturesSectionProps) {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {title}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="bg-background border-border p-6 hover:border-blue-500/50 transition-colors"
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

interface AboutSectionProps {
  title?: string;
  subtitle?: string;
  content?: string[];
}

// About Section
export function AboutSection({ 
  title = "About Solvify CRM",
  subtitle = "We're on a mission to help businesses grow by eliminating software fragmentation.",
  content = [
    "Solvify CRM was founded with a clear vision: to end the era of disconnected business tools. We were tired of seeing businesses juggle 8+ different subscriptions, wasting time switching between platforms, and losing critical data in the gaps.",
    "Our team of experienced developers and designers has created an all-in-one platform that consolidates CRM, project management, invoicing, email marketing, analytics, and more into a single, cohesive solution that costs less than what you're currently paying for multiple tools.",
    "Businesses using Solvify CRM report saving an average of $12,000 per year in software costs while increasing productivity by eliminating context switching between applications. Join the growing number of companies simplifying their tech stack with our unified platform."
  ]
}: AboutSectionProps) {
  return (
    <section id="about" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-muted-foreground">
              {subtitle}
            </p>
          </div>
          
          <div className="space-y-8 text-foreground dark:text-neutral-300">
            {content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface ContactInfo {
  email: string;
  phone: string;
  address: string;
  hours: string;
}

interface FormLabels {
  name: string;
  email: string;
  message: string;
  submit: string;
}

interface ContactSectionProps {
  title?: string;
  subtitle?: string;
  contactInfo?: ContactInfo;
  formLabels?: FormLabels;
  language?: 'en' | 'sv';
}

// Contact Section
export function ContactSection({ 
  title = "Get in Touch",
  subtitle = "Have questions about our CRM? Our team is here to help.",
  language = 'en',
  formLabels = {
    name: "Name",
    email: "Email",
    message: "Message",
    submit: "Send Message"
  }
}: ContactSectionProps) {
  const contactInfo = {
    en: {
      email: "contact@solvify.com",
      phone: "+46 70 736 80 87",
      address: "Artillerigatan 6, 114 51 Stockholm, Sweden",
      hours: "Open 24/7"
    },
    sv: {
      email: "contact@solvify.com",
      phone: "+46 70 736 80 87",
      address: "Artillerigatan 6, 114 51 Stockholm, Sverige",
      hours: "Öppet dygnet runt"
    }
  };

  const currentContactInfo = contactInfo[language];

  return (
    <section id="contact" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-muted-foreground">
              {subtitle}
            </p>
          </div>
          
          <Card className="bg-background border-border dark:border-border p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Contact Information
                </h3>
                <div className="space-y-4 text-foreground dark:text-neutral-300">
                  <p>Email: {currentContactInfo.email}</p>
                  <p>Phone: {currentContactInfo.phone}</p>
                  <p>Address: {currentContactInfo.address}</p>
                  <p>Hours: {currentContactInfo.hours}</p>
                </div>
                
                <div className="mt-8">
                  <h4 className="text-lg font-medium text-foreground mb-3">
                    Follow Us
                  </h4>
                  <div className="flex space-x-4">
                    <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                      Twitter
                    </a>
                    <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                      LinkedIn
                    </a>
                    <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                      Facebook
                    </a>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Send Us a Message
                </h3>
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      {formLabels.name}
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      {formLabels.email}
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-2 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      {formLabels.message}
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-4 py-2 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-foreground">
                    {formLabels.submit}
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  items: FooterLink[];
}

interface FooterLinks {
  product: FooterSection;
  company: FooterSection;
  legal: FooterSection;
}

interface FooterProps {
  description?: string;
  links?: FooterLinks;
}

// Footer
export function Footer({ 
  description = "Solvify CRM: The all-in-one solution that replaces 8+ separate business tools. Save money, streamline workflows, and eliminate software fragmentation.",
  links = {
    product: {
      title: "Product",
      items: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Software We Replace", href: "#features" },
        { label: "Updates", href: "#" }
      ]
    },
    company: {
      title: "Company",
      items: [
        { label: "About", href: "#about" },
        { label: "Testimonials", href: "#" },
        { label: "Case Studies", href: "#" },
        { label: "Contact", href: "#contact" }
      ]
    },
    legal: {
      title: "Legal",
      items: [
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Terms of Service", href: "/terms-of-service" },
        { label: "Cookie Policy", href: "/privacy-policy#cookies" },
        { label: "GDPR", href: "/privacy-policy#gdpr" }
      ]
    }
  }
}: FooterProps) {
  return (
    <footer className="bg-background py-16 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-blue-500"></div>
              <span className="text-foreground font-bold text-xl">Solvify CRM</span>
            </div>
            <p className="text-muted-foreground mb-4">{description}</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">{links.product.title}</h3>
            <ul className="space-y-3">
              {links.product.items.map((link, i) => (
                <li key={i}>
                  <a 
                    href={link.href} 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">{links.company.title}</h3>
            <ul className="space-y-3">
              {links.company.items.map((link, i) => (
                <li key={i}>
                  <a 
                    href={link.href} 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">{links.legal.title}</h3>
            <ul className="space-y-3">
              {links.legal.items.map((link, i) => (
                <li key={i}>
                  <a 
                    href={link.href} 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-foreground0 text-sm mb-4 md:mb-0">
            © 2023 Solvify CRM. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a href="#" className="text-foreground0 hover:text-foreground transition-colors">
              Twitter
            </a>
            <a href="#" className="text-foreground0 hover:text-foreground transition-colors">
              LinkedIn
            </a>
            <a href="#" className="text-foreground0 hover:text-foreground transition-colors">
              Facebook
            </a>
            <a href="#" className="text-foreground0 hover:text-foreground transition-colors">
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
} 