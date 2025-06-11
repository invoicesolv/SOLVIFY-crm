"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, Users, DollarSign, Zap, Target } from "lucide-react";

export function ROISection() {
  const roiStats = [
    {
      icon: DollarSign,
      value: "586%",
      label: "Average ROI",
      description: "Return on investment within 12 months",
      color: "text-green-600"
    },
    {
      icon: Clock,
      value: "15hrs",
      label: "Time Saved Weekly",
      description: "Per team member through automation",
      color: "text-blue-600"
    },
    {
      icon: TrendingUp,
      value: "40%",
      label: "Revenue Increase",
      description: "Average growth in first year",
      color: "text-purple-600"
    },
    {
      icon: Users,
      value: "3 months",
      label: "Payback Period",
      description: "Time to break even on investment",
      color: "text-orange-600"
    }
  ];

  const benefits = [
    {
      icon: Zap,
      title: "Eliminate Tool Switching",
      description: "Stop wasting 2+ hours daily switching between different platforms",
      savings: "$2,400/month",
      detail: "Based on team productivity gains"
    },
    {
      icon: Target,
      title: "Reduce Software Costs",
      description: "Replace 8+ expensive tools with one affordable solution",
      savings: "$586/month",
      detail: "Average savings vs. tool stack"
    },
    {
      icon: Users,
      title: "Faster Team Onboarding",
      description: "Train new team members on one platform instead of multiple tools",
      savings: "$1,200/month",
      detail: "Reduced training time and costs"
    },
    {
      icon: TrendingUp,
      title: "Improved Lead Conversion",
      description: "AI-powered insights increase conversion rates by 25%",
      savings: "$3,500/month",
      detail: "Additional revenue from better leads"
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 mb-6"
          >
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300 font-medium">
              Proven ROI
            </span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl md:text-5xl font-bold text-foreground mb-4"
          >
            The Numbers Don't Lie
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            See the real impact Solvify CRM has on businesses like yours
          </motion.p>
        </div>

        {/* ROI Statistics */}
        <div className="max-w-6xl mx-auto mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roiStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="p-6 text-center bg-background border-border hover:border-blue-300 transition-colors">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <h3 className={`text-3xl font-bold mb-2 ${stat.color}`}>
                    {stat.value}
                  </h3>
                  <p className="font-semibold text-foreground mb-1">{stat.label}</p>
                  <p className="text-sm text-muted-foreground">{stat.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Benefits Breakdown */}
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              How We Deliver These Results
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every feature is designed to save you time and money while increasing your revenue
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="p-6 bg-background border-border hover:border-green-300 transition-all duration-300 hover:shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-foreground mb-2">
                        {benefit.title}
                      </h4>
                      <p className="text-muted-foreground mb-3">
                        {benefit.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {benefit.savings}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {benefit.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Total ROI Summary */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-4xl mx-auto mt-16"
        >
          <Card className="p-8 bg-gradient-to-br from-green-600 to-blue-600 border-0 text-white text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Total Monthly Savings: $7,686
            </h3>
            <p className="text-green-100 mb-2">
              That's $92,232 in annual savings for the average business
            </p>
            <p className="text-lg mb-6">
              Solvify CRM pays for itself in just 3 months
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-green-600 hover:bg-gray-100">
                Calculate Your ROI
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-green-600">
                Start Free Trial
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Case Study Teaser */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-4xl mx-auto mt-12"
        >
          <Card className="p-6 bg-background border-border">
            <div className="text-center">
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Real Customer Success Story
              </h4>
              <p className="text-muted-foreground mb-4">
                "We saved $8,400 per month and increased our revenue by 45% in the first year with Solvify CRM. 
                The ROI was immediate and continues to grow."
              </p>
              <p className="text-sm font-medium text-blue-600">
                - Sarah Johnson, CEO at TechStart Solutions
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
} 