"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { DollarSign, TrendingDown, Calculator, CheckCircle2 } from "lucide-react";

interface Tool {
  name: string;
  category: string;
  monthlyPrice: number;
  yearlyPrice: number;
  checked: boolean;
}

export function CostSavingsCalculator() {
  const [tools, setTools] = useState<Tool[]>([
    { name: "Salesforce", category: "CRM", monthlyPrice: 150, yearlyPrice: 1800, checked: false },
    { name: "HubSpot", category: "CRM", monthlyPrice: 100, yearlyPrice: 1200, checked: false },
    { name: "Asana", category: "Project Management", monthlyPrice: 50, yearlyPrice: 600, checked: false },
    { name: "Monday.com", category: "Project Management", monthlyPrice: 40, yearlyPrice: 480, checked: false },
    { name: "Mailchimp", category: "Email Marketing", monthlyPrice: 60, yearlyPrice: 720, checked: false },
    { name: "Constant Contact", category: "Email Marketing", monthlyPrice: 45, yearlyPrice: 540, checked: false },
    { name: "QuickBooks", category: "Accounting", monthlyPrice: 80, yearlyPrice: 960, checked: false },
    { name: "FreshBooks", category: "Accounting", monthlyPrice: 50, yearlyPrice: 600, checked: false },
    { name: "Google Analytics Pro", category: "Analytics", monthlyPrice: 150, yearlyPrice: 1800, checked: false },
    { name: "Tableau", category: "Analytics", monthlyPrice: 200, yearlyPrice: 2400, checked: false },
    { name: "Slack", category: "Communication", monthlyPrice: 25, yearlyPrice: 300, checked: false },
    { name: "Zoom", category: "Communication", monthlyPrice: 20, yearlyPrice: 240, checked: false },
  ]);

  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');

  const toggleTool = (index: number) => {
    const newTools = [...tools];
    newTools[index].checked = !newTools[index].checked;
    setTools(newTools);
  };

  const selectedTools = tools.filter(tool => tool.checked);
  const totalCurrentCost = selectedTools.reduce((sum, tool) => 
    sum + (viewMode === 'monthly' ? tool.monthlyPrice : tool.yearlyPrice), 0
  );
  
  const SolvifyCRMCost = viewMode === 'monthly' ? 99 : 990; // $99/month or $990/year
  const savings = totalCurrentCost - SolvifyCRMCost;
  const savingsPercentage = totalCurrentCost > 0 ? Math.round((savings / totalCurrentCost) * 100) : 0;

  return (
    <section className="py-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 mb-6"
          >
            <Calculator className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300 font-medium">
              Calculate Your Savings
            </span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl md:text-5xl font-bold text-foreground mb-4"
          >
            How Much Are You Overpaying?
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Select the tools you're currently using and see how much you could save by switching to Solvify CRM
          </motion.p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tool Selection */}
            <div className="lg:col-span-2">
              <Card className="p-6 bg-background border-border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-foreground">
                    Select Your Current Tools
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'monthly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('monthly')}
                    >
                      Monthly
                    </Button>
                    <Button
                      variant={viewMode === 'yearly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('yearly')}
                    >
                      Yearly
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tools.map((tool, index) => (
                    <motion.div
                      key={tool.name}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        tool.checked 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                          : 'border-border hover:border-blue-300'
                      }`}
                      onClick={() => toggleTool(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={tool.checked}
                            onChange={() => toggleTool(index)}
                          />
                          <div>
                            <p className="font-medium text-foreground">{tool.name}</p>
                            <p className="text-sm text-muted-foreground">{tool.category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            ${viewMode === 'monthly' ? tool.monthlyPrice : tool.yearlyPrice}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            /{viewMode}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Savings Summary */}
            <div className="space-y-6">
              <Card className="p-6 bg-background border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Your Savings Summary
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current Tools Cost:</span>
                    <span className="font-semibold text-foreground">
                      ${totalCurrentCost.toLocaleString()}/{viewMode}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Solvify CRM Cost:</span>
                    <span className="font-semibold text-foreground">
                      ${SolvifyCRMCost}/{viewMode}
                    </span>
                  </div>
                  
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-semibold text-foreground">Your Savings:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${savings > 0 ? savings.toLocaleString() : 0}
                      </span>
                    </div>
                    
                    {savings > 0 && (
                      <div className="flex items-center gap-2 text-green-600">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {savingsPercentage}% cost reduction
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {viewMode === 'monthly' && savings > 0 && (
                    <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        <strong>Annual Savings: ${(savings * 12).toLocaleString()}</strong>
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {selectedTools.length > 0 && (
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      What You Get Instead
                    </h4>
                  </div>
                  
                  <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li>• All features of your selected tools</li>
                    <li>• AI-powered automation</li>
                    <li>• Seamless data integration</li>
                    <li>• 24/7 support included</li>
                    <li>• No setup or migration fees</li>
                  </ul>
                  
                  <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                    Start Free Trial
                  </Button>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 