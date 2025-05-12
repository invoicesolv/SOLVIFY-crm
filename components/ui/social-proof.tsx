"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface MetricItem {
  value: string;
  label: string;
}

interface LogoItem {
  name: string;
  logo: string;
  alt?: string;
}

interface SocialProofProps {
  title?: string;
  subtitle?: string;
  metrics?: MetricItem[];
  logos?: LogoItem[];
  lang?: 'en' | 'sv';
}

export function SocialProof({
  title,
  subtitle,
  metrics = [],
  logos = [],
  lang = 'en'
}: SocialProofProps) {
  const [mounted, setMounted] = useState(false);
  const isSwedish = lang === 'sv';

  // Default texts based on language
  const defaultTitle = isSwedish 
    ? "Betrodd av företag i alla storlekar" 
    : "Trusted by businesses of all sizes";
  
  const defaultSubtitle = isSwedish
    ? "Tusentals företag använder Solvify för att strömlinjeforma sina arbetsflöden"
    : "Thousands of businesses use Solvify to streamline their workflows";
  
  // Use provided values or defaults
  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;

  // Default metrics if none provided
  const defaultMetrics: MetricItem[] = [
    { 
      value: "10,000+", 
      label: isSwedish ? "Kunder" : "Customers" 
    },
    { 
      value: "94%", 
      label: isSwedish ? "Kundnöjdhet" : "Customer Satisfaction" 
    },
    { 
      value: "40+", 
      label: isSwedish ? "Länder" : "Countries" 
    },
    { 
      value: "700k+", 
      label: isSwedish ? "Fakturor Skapade" : "Invoices Generated" 
    }
  ];

  // Default logos if none provided
  const defaultLogos: LogoItem[] = [
    { name: "Volvo", logo: "/logos/volvo-logo.svg" },
    { name: "SEB", logo: "/logos/seb-logo.svg" },
    { name: "Klarna", logo: "/logos/klarna-logo.svg" },
    { name: "Scania", logo: "/logos/scania-logo.svg" },
    { name: "H&M", logo: "/logos/hm-logo.svg" },
    { name: "Ericsson", logo: "/logos/ericsson-logo.svg" }
  ];

  // Use provided values or defaults
  const metricsToDisplay = metrics.length > 0 ? metrics : defaultMetrics;
  const logosToDisplay = logos.length > 0 ? logos : defaultLogos;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="py-16 bg-neutral-950 overflow-hidden relative">
      {/* Gradient background and effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-neutral-950 to-neutral-950 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-14">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {displayTitle}
          </motion.h2>
          <motion.p 
            className="text-neutral-400 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {displaySubtitle}
          </motion.p>
        </div>

        {/* Key Metrics */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {metricsToDisplay.map((metric, index) => (
            <div 
              key={index} 
              className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-6 text-center backdrop-blur-sm"
            >
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {metric.value}
              </h3>
              <p className="text-neutral-400">{metric.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Partner Logos */}
        <div className="mb-10">
          <motion.h3 
            className="text-center text-neutral-400 text-sm uppercase tracking-wider mb-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {isSwedish ? "Vi samarbetar med" : "We partner with"}
          </motion.h3>
          
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ 
              duration: 0.5, 
              delay: 0.4,
              staggerChildren: 0.1
            }}
          >
            {logosToDisplay.map((logo, index) => (
              <motion.div 
                key={index}
                className="flex items-center justify-center h-12 opacity-70 hover:opacity-100 transition-opacity"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
              >
                {mounted && (
                  <div className="relative h-8 w-full">
                    <Image
                      src={logo.logo}
                      alt={logo.alt || logo.name}
                      fill
                      style={{ objectFit: "contain" }}
                      className="filter grayscale hover:grayscale-0 transition-all"
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Call to action */}
        <motion.div 
          className="flex justify-center mt-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <a 
            href={isSwedish ? "/sv/register" : "/register"} 
            className="inline-flex items-center px-6 py-3 border border-blue-500 rounded-md text-blue-400 hover:bg-blue-500/10 transition-colors text-sm"
          >
            {isSwedish ? "Läs kundberättelser" : "Read customer stories"} →
          </a>
        </motion.div>
      </div>
    </section>
  );
} 