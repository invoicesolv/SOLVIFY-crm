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
  title = "Powerful Features for Your Business",
  subtitle = "Our CRM is packed with features to help you manage customers, track sales, and grow your business.",
  features = [
    {
      title: "Customer Management",
      description: "Organize and track all your customer interactions in one place.",
      icon: "👥",
    },
    {
      title: "Sales Pipeline",
      description: "Visualize and optimize your sales process from lead to close.",
      icon: "📊",
    },
    {
      title: "Analytics Dashboard",
      description: "Get real-time insights into your business performance.",
      icon: "📈",
    },
    {
      title: "Task Management",
      description: "Assign and track tasks to ensure nothing falls through the cracks.",
      icon: "✅",
    },
    {
      title: "Email Integration",
      description: "Connect your email to track all customer communications.",
      icon: "📧",
    },
    {
      title: "Mobile Access",
      description: "Access your CRM from anywhere with our mobile-friendly design.",
      icon: "📱",
    },
  ]
}: FeaturesSectionProps) {
  return (
    <section id="features" className="py-24 bg-neutral-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-neutral-400 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="bg-neutral-900 border-neutral-800 p-6 hover:border-blue-500/50 transition-colors"
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-neutral-400">{feature.description}</p>
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
  title = "About Solvify",
  subtitle = "We're on a mission to help businesses grow through better customer relationships.",
  content = [
    "Solvify was founded in 2020 with a simple goal: to create a CRM that people actually want to use. We believe that customer relationship management software should be intuitive, powerful, and enjoyable to use.",
    "Our team of experienced developers and designers has worked tirelessly to create a platform that streamlines your workflow, provides valuable insights, and helps you build stronger relationships with your customers.",
    "We're proud to serve businesses of all sizes, from startups to enterprise organizations, across a wide range of industries. Our commitment to continuous improvement means we're always adding new features and refining existing ones based on customer feedback."
  ]
}: AboutSectionProps) {
  return (
    <section id="about" className="py-24 bg-neutral-950">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {title}
            </h2>
            <p className="text-neutral-400">
              {subtitle}
            </p>
          </div>
          
          <div className="space-y-8 text-neutral-300">
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
    <section id="contact" className="py-24 bg-neutral-900">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {title}
            </h2>
            <p className="text-neutral-400">
              {subtitle}
            </p>
          </div>
          
          <Card className="bg-neutral-800 border-neutral-700 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">
                  {language === 'en' ? 'Contact Information' : 'Kontaktinformation'}
                </h3>
                <div className="space-y-4 text-neutral-300">
                  <p>Email: {currentContactInfo.email}</p>
                  <p>{language === 'en' ? 'Phone' : 'Telefon'}: {currentContactInfo.phone}</p>
                  <p>{language === 'en' ? 'Address' : 'Adress'}: {currentContactInfo.address}</p>
                  <p>{language === 'en' ? 'Hours' : 'Öppettider'}: {currentContactInfo.hours}</p>
                </div>
                
                <div className="mt-8">
                  <h4 className="text-lg font-medium text-white mb-3">
                    {language === 'en' ? 'Follow Us' : 'Följ Oss'}
                  </h4>
                  <div className="flex space-x-4">
                    <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                      Twitter
                    </a>
                    <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                      LinkedIn
                    </a>
                    <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                      Facebook
                    </a>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">
                  {language === 'en' ? 'Send Us a Message' : 'Skicka ett Meddelande'}
                </h3>
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                      {formLabels.name}
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                      {formLabels.email}
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                      {formLabels.message}
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
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
  description = "Powerful CRM solutions for businesses of all sizes. Streamline your workflow and build better customer relationships.",
  links = {
    product: {
      title: "Product",
      items: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Integrations", href: "#" },
        { label: "Updates", href: "#" }
      ]
    },
    company: {
      title: "Company",
      items: [
        { label: "About", href: "#about" },
        { label: "Careers", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Contact", href: "#contact" }
      ]
    },
    legal: {
      title: "Legal",
      items: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
        { label: "Cookie Policy", href: "#" },
        { label: "GDPR", href: "#" }
      ]
    }
  }
}: FooterProps) {
  return (
    <footer className="bg-neutral-950 py-12 border-t border-neutral-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <img 
                src="/Solvify-logo-WTE.png" 
                alt="Solvify" 
                className="h-8 object-contain"
              />
            </div>
            <p className="text-neutral-400 text-sm">
              {description}
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-4">{links.product.title}</h4>
            <ul className="space-y-2">
              {links.product.items.map((item, index) => (
                <li key={index}>
                  <a href={item.href} className="text-neutral-400 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-4">{links.company.title}</h4>
            <ul className="space-y-2">
              {links.company.items.map((item, index) => (
                <li key={index}>
                  <a href={item.href} className="text-neutral-400 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-4">{links.legal.title}</h4>
            <ul className="space-y-2">
              {links.legal.items.map((item, index) => (
                <li key={index}>
                  <a href={item.href} className="text-neutral-400 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-neutral-500 text-sm">
            © {new Date().getFullYear()} Solvify. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-neutral-500 hover:text-white transition-colors">
              Twitter
            </a>
            <a href="#" className="text-neutral-500 hover:text-white transition-colors">
              LinkedIn
            </a>
            <a href="#" className="text-neutral-500 hover:text-white transition-colors">
              Facebook
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
} 