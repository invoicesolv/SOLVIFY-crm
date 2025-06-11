"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Zap, BarChart3, FileText, Calendar, DollarSign } from "lucide-react";
import Image from "next/image";

export function AIFeaturesShowcase() {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Dashboard",
      description: "Get intelligent insights and automated recommendations from your business data",
      image: "/landingpage-img/Dashboard.png",
      benefits: ["Real-time analytics", "Smart notifications", "Predictive insights"]
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Comprehensive reporting with Google Analytics and Search Console integration",
      image: "/landingpage-img/Analytics.png",
      benefits: ["Automated reports", "Custom dashboards", "Performance tracking"]
    },
    {
      icon: FileText,
      title: "AI Content Generator",
      description: "Create SEO-optimized content and marketing materials with AI assistance",
      image: "/landingpage-img/Content Generator.png",
      benefits: ["Bulk article generation", "SEO optimization", "Multi-platform publishing"]
    },
    {
      icon: Calendar,
      title: "Project Management",
      description: "Streamlined project workflows with automated task management and invoicing",
      image: "/landingpage-img/Projects.png",
      benefits: ["Task automation", "Team collaboration", "Progress tracking"]
    },
    {
      icon: Zap,
      title: "AI Automation",
      description: "Intelligent lead scoring, email automation, and workflow optimization",
      image: "/landingpage-img/AI.png",
      benefits: ["Lead scoring", "Email automation", "Smart workflows"]
    },
    {
      icon: DollarSign,
      title: "Domain Portfolio",
      description: "Comprehensive domain management with performance tracking and analytics",
      image: "/landingpage-img/Domainportfoloio.png",
      benefits: ["Domain tracking", "Expiration alerts", "Performance metrics"]
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-blue-950/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 mb-6"
          >
            <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              AI-Powered Features
            </span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl md:text-5xl font-bold text-foreground mb-4"
          >
            See Solvify CRM in Action
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Experience the power of AI-driven business automation with real screenshots from our platform
          </motion.p>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group"
              >
                <Card className="overflow-hidden bg-background border-border hover:border-blue-300 transition-all duration-300 hover:shadow-xl">
                  {/* Screenshot */}
                  <div className="relative h-64 overflow-hidden">
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      fill
                      className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{feature.title}</h3>
                    </div>
                    
                    <p className="text-muted-foreground mb-4">
                      {feature.description}
                    </p>
                    
                    <div className="space-y-2 mb-6">
                      {feature.benefits.map((benefit, benefitIndex) => (
                        <div key={benefitIndex} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                          <span className="text-sm text-muted-foreground">{benefit}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button variant="outline" className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      Learn More
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-16"
        >
          <Card className="p-8 bg-gradient-to-br from-blue-600 to-indigo-600 border-0 text-white max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">
              Ready to Experience the Future of Business Management?
            </h3>
            <p className="text-blue-100 mb-6">
              Join thousands of businesses that have already made the switch to intelligent automation
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                Watch Demo
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
} 