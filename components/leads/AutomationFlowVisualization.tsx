'use client';

import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Brain, 
  Users, 
  Zap, 
  Calendar, 
  MessageSquare, 
  Target, 
  Trophy,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";

const stages = [
  {
    id: 'gmail',
    title: 'Gmail Hub',
    description: 'Emails received & analyzed',
    icon: Mail,
    color: 'bg-blue-500',
    items: ['New emails', 'AI content analysis', 'Lead scoring']
  },
  {
    id: 'analysis',
    title: 'AI Analysis',
    description: 'Smart lead identification',
    icon: Brain,
    color: 'bg-purple-500',
    items: ['Business keyword detection', 'Sentiment analysis', 'Company extraction']
  },
  {
    id: 'import',
    title: 'Lead Import',
    description: 'Convert to structured leads',
    icon: Users,
    color: 'bg-green-500',
    items: ['Create lead record', 'Extract contact info', 'Set initial stage']
  },
  {
    id: 'automation',
    title: 'Automations',
    description: 'Trigger automated workflows',
    icon: Zap,
    color: 'bg-yellow-500',
    items: ['Auto-assign sales rep', 'Schedule follow-ups', 'Send welcome emails']
  },
  {
    id: 'tracking',
    title: 'Progress Tracking',
    description: 'Monitor lead journey',
    icon: Target,
    color: 'bg-red-500',
    items: ['Stage progression', 'Response tracking', 'Score updates']
  },
  {
    id: 'conversion',
    title: 'Customer Success',
    description: 'Convert to customers',
    icon: Trophy,
    color: 'bg-orange-500',
    items: ['Qualification', 'Proposal', 'Onboarding']
  }
];

const automationExamples = [
  {
    trigger: 'New Lead Created',
    actions: [
      { icon: Users, text: 'Auto-assign to sales rep', time: 'Immediate' },
      { icon: MessageSquare, text: 'Send welcome email', time: '1 hour' },
      { icon: Calendar, text: 'Schedule follow-up', time: '24 hours' }
    ],
    color: 'border-blue-500'
  },
  {
    trigger: 'No Response (3 days)',
    actions: [
      { icon: MessageSquare, text: 'Send follow-up email', time: 'Immediate' },
      { icon: AlertCircle, text: 'Notify sales rep', time: 'Immediate' },
      { icon: Calendar, text: 'Schedule call reminder', time: '2 days' }
    ],
    color: 'border-yellow-500'
  },
  {
    trigger: 'Lead Responds',
    actions: [
      { icon: Target, text: 'Update lead score +20', time: 'Immediate' },
      { icon: Calendar, text: 'Schedule qualification call', time: '1 hour' },
      { icon: Users, text: 'Notify assigned rep', time: 'Immediate' }
    ],
    color: 'border-green-500'
  }
];

export function AutomationFlowVisualization() {
  return (
    <div className="space-y-8">
      {/* Main Flow */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Gmail to Customer Journey Automation</h2>
          <p className="text-muted-foreground">Complete workflow from email to customer conversion</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="relative">
                <Card className="p-6 bg-background border-border dark:border-border h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${stage.color}/20`}>
                      <Icon className={`h-5 w-5 text-foreground`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{stage.title}</h3>
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                    </div>
                  </div>
                  
                  <ul className="space-y-2">
                    {stage.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-center gap-2 text-sm text-foreground dark:text-neutral-300">
                        <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
                
                {/* Arrow to next stage */}
                {index < stages.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-6 w-6 text-neutral-600" />
                  </div>
                )}
                
                {/* Arrow down for mobile */}
                {index < stages.length - 1 && (
                  <div className="lg:hidden flex justify-center mt-4">
                    <ArrowDown className="h-6 w-6 text-neutral-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Automation Examples */}
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-foreground mb-2">Automation Examples</h3>
          <p className="text-muted-foreground">See how different triggers create automated workflows</p>
        </div>

        <div className="grid gap-6">
          {automationExamples.map((example, index) => (
            <Card key={index} className={`p-6 bg-background border-2 ${example.color}`}>
              <div className="mb-4">
                <Badge variant="outline" className="text-foreground bg-gray-200 dark:bg-muted">
                  Trigger: {example.trigger}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {example.actions.map((action, actionIndex) => {
                  const ActionIcon = action.icon;
                  return (
                    <div key={actionIndex} className="flex items-center gap-3 p-3 bg-gray-200 dark:bg-muted rounded-lg">
                      <ActionIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{action.text}</p>
                        <p className="text-xs text-muted-foreground">{action.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Integration Benefits */}
      <Card className="p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30">
        <h3 className="text-xl font-semibold text-foreground mb-4">Key Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">95%</div>
            <div className="text-sm text-muted-foreground">Time Saved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">3x</div>
            <div className="text-sm text-muted-foreground">Faster Response</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">85%</div>
            <div className="text-sm text-muted-foreground">Lead Quality</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">50%</div>
            <div className="text-sm text-muted-foreground">More Conversions</div>
          </div>
        </div>
      </Card>
    </div>
  );
} 