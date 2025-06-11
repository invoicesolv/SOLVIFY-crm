"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, CheckCircle2, ArrowRight } from "lucide-react";
import Image from "next/image";

export function IntegrationsSection() {
  const integrations = [
    {
      name: "Google Analytics",
      category: "Analytics",
      description: "Track website performance and user behavior",
      logo: "/logos/google-analytics.png",
      connected: true
    },
    {
      name: "Google Search Console",
      category: "SEO",
      description: "Monitor search performance and indexing",
      logo: "/logos/search-console.png",
      connected: true
    },
    {
      name: "Gmail",
      category: "Email",
      description: "Sync emails and automate communications",
      logo: "/logos/gmail.png",
      connected: true
    },
    {
      name: "Fortnox",
      category: "Accounting",
      description: "Seamless financial management integration",
      logo: "/logos/fortnox.png",
      connected: true
    },
    {
      name: "OpenAI",
      category: "AI",
      description: "Power AI content generation and automation",
      logo: "/logos/openai.png",
      connected: true
    },
    {
      name: "Stripe",
      category: "Payments",
      description: "Process payments and manage subscriptions",
      logo: "/logos/stripe.png",
      connected: false
    },
    {
      name: "Slack",
      category: "Communication",
      description: "Team notifications and collaboration",
      logo: "/logos/slack.png",
      connected: false
    },
    {
      name: "Zapier",
      category: "Automation",
      description: "Connect with 5000+ apps and services",
      logo: "/logos/zapier.png",
      connected: false
    }
  ];

  const categories = [
    { name: "Analytics & SEO", count: 2, color: "bg-blue-100 text-blue-700" },
    { name: "Email & Communication", count: 2, color: "bg-green-100 text-green-700" },
    { name: "Financial & Payments", count: 2, color: "bg-purple-100 text-purple-700" },
    { name: "AI & Automation", count: 2, color: "bg-orange-100 text-orange-700" }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 mb-6"
          >
            <Plug className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              Seamless Integrations
            </span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl md:text-5xl font-bold text-foreground mb-4"
          >
            Connect Everything You Use
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Solvify CRM integrates with all your favorite tools, so you can keep using what works while gaining the power of unified data
          </motion.p>
        </div>

        {/* Integration Categories */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((category, index) => (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="p-4 text-center bg-background border-border">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-2 ${category.color}`}>
                    <span>{category.count}</span>
                    <span>integrations</span>
                  </div>
                  <p className="font-semibold text-foreground">{category.name}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Integration Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="p-6 bg-background border-border hover:border-blue-300 transition-all duration-300 hover:shadow-lg group">
                  <div className="text-center">
                    {/* Logo placeholder */}
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                        {integration.name.slice(0, 2)}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-foreground mb-1">
                      {integration.name}
                    </h3>
                    
                    <p className="text-sm text-blue-600 font-medium mb-2">
                      {integration.category}
                    </p>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      {integration.description}
                    </p>
                    
                    {integration.connected ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Connect
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* API Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-4xl mx-auto mt-16"
        >
          <Card className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-950/20 border-border">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Need a Custom Integration?
              </h3>
              <p className="text-muted-foreground mb-6">
                Use our powerful REST API to connect Solvify CRM with any tool or service. 
                Our developer-friendly documentation makes integration simple.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  View API Docs
                </Button>
                <Button variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
                  Request Integration
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Integration Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-6xl mx-auto mt-16"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Plug className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                One-Click Setup
              </h4>
              <p className="text-muted-foreground">
                Connect your tools in seconds with our pre-built integrations
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Real-Time Sync
              </h4>
              <p className="text-muted-foreground">
                Data flows seamlessly between all your connected tools
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Automated Workflows
              </h4>
              <p className="text-muted-foreground">
                Trigger actions across platforms based on your business rules
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 