"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import { Glow } from "@/components/ui/glow";
import { ArrowRight, BarChart2, Users, PieChart, Activity } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

interface HeroCRMProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  lang?: 'en' | 'sv';
}

export function HeroCRM({
  title,
  subtitle,
  ctaText,
  ctaHref = "/login",
  lang = 'en'
}: HeroCRMProps) {
  const [mounted, setMounted] = useState(false);
  const isSwedish = lang === 'sv';

  // Default texts based on language
  const defaultTitle = isSwedish 
    ? "8 verktyg i 1: Slipp flera prenumerationer" 
    : "8 Tools in 1: Ditch the Multiple Subscriptions";
  
  const defaultSubtitle = isSwedish
    ? "Den kompletta affärslösningen som ersätter din fragmenterade mjukvarustack och sparar tusentals kronor per år"
    : "The all-in-one business solution that replaces your fragmented software stack while saving thousands per year";
  
  const defaultCtaText = isSwedish ? "Kom igång" : "Get Started";
  
  // Use provided values or defaults
  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;
  const displayCtaText = ctaText || defaultCtaText;

  useEffect(() => {
    setMounted(true);
  }, []);

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.3 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  const replacedSoftware = [
    { 
      name: "Slack", 
      category: isSwedish ? "Kommunikation" : "Communication", 
      logo: "/logos/slack.png"
    },
    { 
      name: "Asana", 
      category: isSwedish ? "Projekthantering" : "Project Management", 
      logo: "/logos/asana.png"
    },
    { 
      name: "Notion", 
      category: isSwedish ? "Dokumentation" : "Documentation", 
      logo: "/logos/notion.png"
    },
    { 
      name: "Teams", 
      category: isSwedish ? "Samarbete" : "Collaboration", 
      logo: "/logos/teams.png"
    },
    { 
      name: "Salesforce", 
      category: "CRM", 
      logo: "/logos/salesforce.png"
    },
    { 
      name: "Atlassian", 
      category: isSwedish ? "Projekthantering" : "Project Management", 
      logo: "/logos/atlassian.png"
    }
  ];

  const replaceText = isSwedish ? "Ersätt alla dessa" : "Replace all of these";
  const withText = isSwedish ? "med" : "with";
  const solutionBadgeText = isSwedish ? "Komplett Affärslösning" : "All-In-One Business Solution";

  return (
    <section className="relative bg-background text-foreground overflow-hidden min-h-screen flex flex-col items-center justify-center py-16 px-4 pt-24 md:pt-32">
      {/* Dark background with blue accent gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-neutral-950 to-indigo-900/20 pointer-events-none" />
      
      <div className="relative z-10 container mx-auto max-w-7xl">
        <div className="flex flex-col items-center text-center mb-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-200 dark:bg-blue-900/30 border border-blue-700/20 mb-8"
          >
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm text-blue-300 tracking-wide">
              {solutionBadgeText}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 max-w-4xl"
          >
            {displayTitle}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl"
          >
            {displaySubtitle}
          </motion.p>

          {/* "Replace all of these" section */}
          <motion.div
            custom={1.5}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-10 w-full max-w-6xl"
          >
            <div className="text-2xl md:text-3xl font-bold text-foreground mb-12">
              {replaceText}
            </div>
            
            <div className="relative px-2">
              {/* Software logos with strikethrough */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                {replacedSoftware.map((software, index) => (
                  <div 
                    key={index} 
                    className="relative bg-background border border-border rounded-xl p-4 flex flex-col items-center justify-center h-[180px]"
                  >
                    <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
                      <Image
                        src={software.logo}
                        alt={software.name}
                        fill
                        style={{ objectFit: "contain" }}
                        className="p-1"
                        unoptimized
                      />
                    </div>
                    <p className="text-lg font-medium text-foreground">{software.name}</p>
                    <p className="text-sm text-muted-foreground">{software.category}</p>
                  </div>
                ))}
              </div>
              
              {/* Red strikethrough line - positioned absolutely to cross all logos */}
              <div className="absolute top-1/2 left-0 right-0 h-3 bg-red-600 transform -translate-y-1/2 -rotate-[2deg]"></div>
            </div>
            
            <div className="text-2xl md:text-3xl font-bold text-foreground mt-16 mb-8">
              {withText}
            </div>
          </motion.div>

        </div>

        {/* Dashboard Mockup */}
        <div className="relative mt-16 w-full">
          <MockupFrame
            className="opacity-0 animate-[appear_1s_forwards_0.7s] max-w-5xl mx-auto"
            size="large"
          >
            <Mockup>
              {mounted && (
                <div className="relative bg-background overflow-hidden rounded-lg">
                  <Image
                    src="/dashboard.png"
                    alt="Solvify CRM Dashboard"
                    width={1200}
                    height={800}
                    className="w-full h-auto object-cover"
                    priority
                  />
                </div>
              )}
            </Mockup>
          </MockupFrame>
          <Glow
            variant="center"
            className="opacity-0 animate-[appear-zoom_1.5s_forwards_1s]"
          />
        </div>

        {/* CTA Button - Below Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="flex justify-center mt-12"
        >
          <Button
            size="lg"
            asChild
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 h-14 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
          >
            <a href={ctaHref}>
              {displayCtaText}
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
} 