"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  companyLogo?: string;
  image: string;
  results?: string;
}

interface TestimonialsSectionProps {
  title?: string;
  subtitle?: string;
  testimonials?: Testimonial[];
  lang?: 'en' | 'sv';
}

export function TestimonialsSection({
  title,
  subtitle,
  testimonials = [],
  lang = 'en'
}: TestimonialsSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const isSwedish = lang === 'sv';

  // Default texts based on language
  const defaultTitle = isSwedish 
    ? "Vad våra kunder säger" 
    : "What our customers say";
  
  const defaultSubtitle = isSwedish
    ? "Upptäck hur Solvify hjälper företag att effektivisera sina arbetsflöden"
    : "Discover how Solvify helps businesses streamline their workflows";
  
  // Use provided values or defaults
  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;
  const previousButtonText = isSwedish ? "Föregående" : "Previous";
  const nextButtonText = isSwedish ? "Nästa" : "Next";
  const resultsLabel = isSwedish ? "Resultat" : "Results";

  // Default testimonials if none provided
  const defaultTestimonials: Testimonial[] = [
    {
      id: "1",
      quote: isSwedish 
        ? "Vi sparar över 15 timmar per vecka genom att använda Solvify. Det konsoliderade alla våra verktyg och gav oss en enhetlig plattform för alla våra affärsbehov."
        : "We're saving over 15 hours per week by using Solvify. It consolidated all our tools and gave us a unified platform for all our business needs.",
      author: "Erik Johansson",
      role: isSwedish ? "VD" : "CEO",
      company: "TechSweden AB",
      companyLogo: "/logos/techsweden.svg",
      image: "/testimonials/erik-johansson.jpg",
      results: isSwedish 
        ? "Minskade sina mjukvarukostnader med 40% och ökade produktiviteten med 25%"
        : "Reduced software costs by 40% and increased productivity by 25%"
    },
    {
      id: "2",
      quote: isSwedish 
        ? "Att kunna hantera våra kunder, projekt och fakturering på ett ställe har gjort underverk för vårt team. Solvify har verkligen förändrat hur vi arbetar."
        : "Being able to manage our customers, projects, and invoicing in one place has done wonders for our team. Solvify has truly transformed how we work.",
      author: "Maria Andersson",
      role: isSwedish ? "Marknadschef" : "Marketing Director",
      company: "CreativeMinds",
      companyLogo: "/logos/creativeminds.svg",
      image: "/testimonials/maria-andersson.jpg",
      results: isSwedish 
        ? "Förbättrade kundnöjdheten med 35% och automatiserade 60% av sina administrativa uppgifter"
        : "Improved customer satisfaction by 35% and automated 60% of their administrative tasks"
    },
    {
      id: "3",
      quote: isSwedish 
        ? "Den inbyggda Fortnox-integrationen sparade oss månader av problem. Vår bokföring är nu synkroniserad och våra revisorer älskar det."
        : "The built-in Fortnox integration saved us months of headaches. Our accounting is now in sync and our accountants love it.",
      author: "Johan Lindberg",
      role: isSwedish ? "Ekonomichef" : "Finance Manager",
      company: "NordicSupply",
      companyLogo: "/logos/nordicsupply.svg",
      image: "/testimonials/johan-lindberg.jpg",
      results: isSwedish 
        ? "Minskade sin bokföringstid med 70% och eliminerade manuella datainmatningsfel"
        : "Reduced accounting time by 70% and eliminated manual data entry errors"
    }
  ];

  // Use provided values or defaults
  const testimonialsToDisplay = testimonials.length > 0 ? testimonials : defaultTestimonials;

  const nextTestimonial = () => {
    setActiveIndex((prevIndex) => 
      prevIndex === testimonialsToDisplay.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevTestimonial = () => {
    setActiveIndex((prevIndex) => 
      prevIndex === 0 ? testimonialsToDisplay.length - 1 : prevIndex - 1
    );
  };

  return (
    <section className="py-20 bg-background overflow-hidden relative">
      {/* Gradient background and effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/10 via-neutral-950 to-neutral-950 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-14">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-foreground mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {displayTitle}
          </motion.h2>
          <motion.p 
            className="text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {displaySubtitle}
          </motion.p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Testimonial with image layout */}
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-background/50 border border-border rounded-xl overflow-hidden backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Testimonial Content */}
            <div className="p-8 md:p-12">
              <div className="mb-6 text-blue-400">
                <Quote size={36} className="opacity-50" />
              </div>
              
              <blockquote className="text-xl text-foreground mb-8 leading-relaxed">
                "{testimonialsToDisplay[activeIndex].quote}"
              </blockquote>
              
              <div className="flex items-center">
                <div className="mr-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden relative">
                    <Image 
                      src={testimonialsToDisplay[activeIndex].image} 
                      alt={testimonialsToDisplay[activeIndex].author}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {testimonialsToDisplay[activeIndex].author}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {testimonialsToDisplay[activeIndex].role}, {testimonialsToDisplay[activeIndex].company}
                  </p>
                </div>
              </div>

              {/* Results Badge */}
              {testimonialsToDisplay[activeIndex].results && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-start">
                    <div className="bg-blue-200 dark:bg-blue-900/30 text-blue-400 text-xs font-medium px-2.5 py-0.5 rounded-full mr-2 mt-1">
                      {resultsLabel}
                    </div>
                    <p className="text-foreground dark:text-neutral-300">
                      {testimonialsToDisplay[activeIndex].results}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Customer Image */}
            <div className="hidden lg:block relative h-full min-h-[400px]">
              <Image
                src={testimonialsToDisplay[activeIndex].image}
                alt={testimonialsToDisplay[activeIndex].author}
                fill
                style={{ objectFit: "cover" }}
              />
              {/* Company logo overlay */}
              <div className="absolute bottom-4 right-4 bg-background/80 border border-border p-2 rounded-lg backdrop-blur-sm">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {testimonialsToDisplay[activeIndex].company}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Navigation Controls */}
          <div className="flex justify-center items-center mt-8 space-x-4">
            <button
              onClick={prevTestimonial}
              className="flex items-center justify-center h-10 w-10 rounded-full bg-background border border-border text-muted-foreground hover:text-foreground hover:border-border dark:border-border transition-colors"
              aria-label={previousButtonText}
            >
              <ArrowLeft size={16} />
            </button>
            
            <div className="flex space-x-2">
              {testimonialsToDisplay.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === activeIndex 
                      ? "w-8 bg-blue-500" 
                      : "w-2 bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600"
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
            
            <button
              onClick={nextTestimonial}
              className="flex items-center justify-center h-10 w-10 rounded-full bg-background border border-border text-muted-foreground hover:text-foreground hover:border-border dark:border-border transition-colors"
              aria-label={nextButtonText}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
} 