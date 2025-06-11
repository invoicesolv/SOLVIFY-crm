"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, X, Check } from "lucide-react";
import Image from "next/image";

export function ToolReplacementSection() {
  const tools = [
    { name: "Salesforce", logo: "/logos/salesforce.png", price: "$150/mo" },
    { name: "Asana", logo: "/logos/asana.png", price: "$50/mo" },
    { name: "Mailchimp", logo: "/logos/mailchimp.png", price: "$60/mo" },
    { name: "QuickBooks", logo: "/logos/quickbooks.png", price: "$80/mo" },
    { name: "Slack", logo: "/logos/slack.png", price: "$25/mo" },
    { name: "Tableau", logo: "/logos/tableau.png", price: "$200/mo" },
    { name: "Zoom", logo: "/logos/zoom.png", price: "$20/mo" },
    { name: "HubSpot", logo: "/logos/hubspot.png", price: "$100/mo" },
  ];

  const totalCost = 685;

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-5xl font-bold text-foreground mb-4"
          >
            Stop Paying for 8 Different Tools
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Replace your entire software stack with one unified platform that costs less than what you're paying now
          </motion.p>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Before: Multiple Tools */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 mb-4">
                    <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                      Current Situation
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    8 Different Tools
                  </h3>
                  <p className="text-muted-foreground">
                    Fragmented, expensive, hard to manage
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {tools.map((tool, index) => (
                    <motion.div
                      key={tool.name}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="p-4 bg-background border-border hover:border-red-300 transition-colors">
                        <div className="flex flex-col items-center text-center">
                          <div className="w-12 h-12 mb-2 relative bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                            <Image
                              src={tool.logo}
                              alt={tool.name}
                              fill
                              style={{ objectFit: "contain" }}
                              className="p-1 rounded-lg"
                              unoptimized
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-xs font-bold text-gray-600">${tool.name.slice(0, 2)}</span>`;
                                }
                              }}
                            />
                          </div>
                          <p className="text-sm font-medium text-foreground">{tool.name}</p>
                          <p className="text-xs text-red-600 font-semibold">{tool.price}</p>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-center">
                    <p className="text-sm text-red-700 dark:text-red-300 mb-1">Total Monthly Cost</p>
                    <p className="text-2xl font-bold text-red-600">${totalCost}/month</p>
                    <p className="text-xs text-red-600">${totalCost * 12}/year</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Arrow */}
            <div className="lg:col-span-1 flex justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                  <ArrowRight className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-medium text-blue-600">Replace with</p>
              </motion.div>
            </div>

            {/* After: Solvify CRM */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 mb-4">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                      With Solvify CRM
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    One Unified Platform
                  </h3>
                  <p className="text-muted-foreground">
                    All features, seamless integration, lower cost
                  </p>
                </div>

                <Card className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                  <div className="text-center">
                    <div className="w-full mb-4 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-700">
                      <Image
                        src="/dashboard.png"
                        alt="Solvify CRM Dashboard"
                        width={300}
                        height={200}
                        className="w-full h-auto object-cover"
                      />
                    </div>
                    <h4 className="text-xl font-bold text-foreground mb-2">Solvify CRM</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      All-in-One Business Platform
                    </p>
                    
                    <div className="space-y-2 text-sm text-left mb-6">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>CRM & Sales Pipeline</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Project Management</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Email Marketing</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Financial Management</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Analytics & Reporting</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>AI Automation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Team Collaboration</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Domain Management</span>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-center">
                    <p className="text-sm text-green-700 dark:text-green-300 mb-1">Total Monthly Cost</p>
                    <p className="text-2xl font-bold text-green-600">$99/month</p>
                    <p className="text-xs text-green-600">$1,188/year</p>
                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                        Save ${totalCost - 99}/month
                      </p>
                      <p className="text-xs text-green-600">
                        ${(totalCost - 99) * 12}/year savings
                      </p>
                    </div>
                  </div>
                </div>

                <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white">
                  Start Free Trial
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 