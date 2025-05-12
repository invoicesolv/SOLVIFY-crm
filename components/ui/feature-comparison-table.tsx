"use client";

import { useState } from "react";
import { Check, HelpCircle, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FeatureDefinition {
  name: string;
  description: string;
}

interface PlanFeature {
  id: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  features: PlanFeature[];
}

interface FeatureComparisonTableProps {
  title?: string;
  subtitle?: string;
  featureDefinitions?: FeatureDefinition[];
  plans?: Plan[];
  lang?: 'en' | 'sv';
}

export function FeatureComparisonTable({
  title,
  subtitle,
  featureDefinitions = [],
  plans = [],
  lang = 'en'
}: FeatureComparisonTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const isSwedish = lang === 'sv';

  // Default texts based on language
  const defaultTitle = isSwedish 
    ? "Funktionsjämförelse" 
    : "Feature Comparison";
  
  const defaultSubtitle = isSwedish
    ? "Se vilka funktioner som ingår i respektive plan"
    : "See which features are included in each plan";
  
  // Use provided values or defaults
  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;

  // Default feature definitions if none provided
  const defaultFeatureDefinitions: FeatureDefinition[] = [
    { 
      name: isSwedish ? "CRM och kundhantering" : "CRM & Customer Management", 
      description: isSwedish 
        ? "Hantera kontakter, leads och kundresor" 
        : "Manage contacts, leads, and customer journeys"
    },
    { 
      name: isSwedish ? "Projekthantering" : "Project Management", 
      description: isSwedish 
        ? "Skapa projekt, uppgifter och sätt deadlines" 
        : "Create projects, tasks, and set deadlines"
    },
    { 
      name: isSwedish ? "Kalenderintegrering" : "Calendar Integration", 
      description: isSwedish 
        ? "Synkronisera med Google Calendar och andra kalendrar" 
        : "Sync with Google Calendar and other calendars"
    },
    { 
      name: isSwedish ? "E-post marketing" : "Email Marketing", 
      description: isSwedish 
        ? "Skapa, skicka och analysera e-postkampanjer" 
        : "Create, send, and analyze email campaigns"
    },
    { 
      name: isSwedish ? "Fakturering" : "Invoicing", 
      description: isSwedish 
        ? "Skapa och skicka fakturor, spåra betalningar" 
        : "Create and send invoices, track payments"
    },
    { 
      name: isSwedish ? "Fortnox integration" : "Fortnox Integration", 
      description: isSwedish 
        ? "Automatisk synkronisering med Fortnox" 
        : "Automatic synchronization with Fortnox"
    },
    { 
      name: isSwedish ? "Domänhantering" : "Domain Management", 
      description: isSwedish 
        ? "Hantera domäner och DNS-inställningar" 
        : "Manage domains and DNS settings"
    },
    { 
      name: isSwedish ? "AI-assistenter" : "AI Assistants", 
      description: isSwedish 
        ? "Få hjälp av AI med texter och analys" 
        : "Get AI help with copywriting and analysis"
    },
    { 
      name: isSwedish ? "Kvittohantering" : "Receipt Management", 
      description: isSwedish 
        ? "Scanna och organisera kvitton digitalt" 
        : "Scan and organize receipts digitally"
    },
    { 
      name: isSwedish ? "Flerspråksstöd" : "Multi-language Support", 
      description: isSwedish 
        ? "Stöd för svenska, engelska och fler språk" 
        : "Support for Swedish, English, and more languages"
    }
  ];

  // Default plans if none provided
  const defaultPlans: Plan[] = [
    {
      id: "free",
      name: isSwedish ? "Privatpersoner" : "Personal",
      features: [
        { id: "crm", included: true },
        { id: "project", included: true },
        { id: "calendar", included: true },
        { id: "email", included: false },
        { id: "invoicing", included: false },
        { id: "fortnox", included: false },
        { id: "domain", included: false },
        { id: "ai", included: false },
        { id: "receipt", included: false },
        { id: "multilang", included: true }
      ]
    },
    {
      id: "team",
      name: isSwedish ? "Team" : "Team",
      features: [
        { id: "crm", included: true },
        { id: "project", included: true },
        { id: "calendar", included: true },
        { id: "email", included: true },
        { id: "invoicing", included: true },
        { id: "fortnox", included: true },
        { id: "domain", included: false },
        { id: "ai", included: true },
        { id: "receipt", included: false },
        { id: "multilang", included: true }
      ]
    },
    {
      id: "business",
      name: isSwedish ? "Organisationer" : "Organizations",
      features: [
        { id: "crm", included: true },
        { id: "project", included: true },
        { id: "calendar", included: true },
        { id: "email", included: true },
        { id: "invoicing", included: true },
        { id: "fortnox", included: true },
        { id: "domain", included: true },
        { id: "ai", included: true },
        { id: "receipt", included: true },
        { id: "multilang", included: true }
      ]
    },
    {
      id: "enterprise",
      name: isSwedish ? "Enterprise" : "Enterprise",
      features: [
        { id: "crm", included: true },
        { id: "project", included: true },
        { id: "calendar", included: true },
        { id: "email", included: true },
        { id: "invoicing", included: true },
        { id: "fortnox", included: true },
        { id: "domain", included: true },
        { id: "ai", included: true },
        { id: "receipt", included: true },
        { id: "multilang", included: true }
      ]
    }
  ];

  // Use provided values or defaults
  const featuresToDisplay = featureDefinitions.length > 0 ? featureDefinitions : defaultFeatureDefinitions;
  const plansToDisplay = plans.length > 0 ? plans : defaultPlans;

  return (
    <section className="py-16 bg-neutral-950 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
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

        <motion.div 
          className="relative overflow-x-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="min-w-full inline-block align-middle border border-neutral-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-800">
              <thead className="bg-neutral-900">
                <tr>
                  <th scope="col" className="px-6 py-5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-1/4">
                    {isSwedish ? "Funktion" : "Feature"}
                  </th>
                  {plansToDisplay.map((plan) => (
                    <th 
                      key={plan.id} 
                      scope="col" 
                      className="px-6 py-5 text-center text-xs font-medium text-neutral-400 uppercase tracking-wider"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 bg-neutral-900/50">
                {featuresToDisplay.map((feature, index) => (
                  <tr 
                    key={index}
                    className={`${hoveredRow === `row-${index}` ? 'bg-neutral-800/40' : ''} transition-colors duration-150`}
                    onMouseEnter={() => setHoveredRow(`row-${index}`)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white flex items-center gap-2">
                      {feature.name}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-neutral-500 hover:text-blue-400 cursor-help transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs bg-neutral-900 border-neutral-700 text-neutral-200 p-4">
                            <p>{feature.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    
                    {plansToDisplay.map((plan) => {
                      const planFeature = plan.features[index];
                      const isIncluded = planFeature ? planFeature.included : false;
                      
                      return (
                        <td key={`${plan.id}-${index}`} className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          {isIncluded ? (
                            <div className="flex justify-center">
                              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <Check className="h-4 w-4 text-blue-500" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <div className="h-6 w-6 rounded-full bg-neutral-800 flex items-center justify-center">
                                <X className="h-4 w-4 text-neutral-600" />
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 