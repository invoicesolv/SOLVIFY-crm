'use client';

import React from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { AutomationFlowVisualization } from "@/components/leads/AutomationFlowVisualization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Play, 
  FileText, 
  ExternalLink,
  ArrowRight
} from "lucide-react";

export default function AutomationDemoPage() {
  return (
    <SidebarDemo>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold text-foreground">Lead Automation Workflow</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            See how our Gmail Hub seamlessly integrates with lead management to create a fully automated 
            customer acquisition pipeline with AI-powered lead scoring and intelligent workflow triggers.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Button asChild className="bg-green-600 hover:bg-green-700">
            <a href="/gmail-hub" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Try Gmail Hub
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/leads" className="flex items-center gap-2">
              View Leads
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/AUTOMATION_WORKFLOW.md" target="_blank" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View Documentation
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            ✅ Gmail Integration Active
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            🤖 AI Lead Scoring
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            ⚡ 6 Automations Ready
          </Badge>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            📧 Email Templates
          </Badge>
        </div>

        {/* Main Visualization */}
        <AutomationFlowVisualization />

        {/* Implementation Guide */}
        <Card className="p-6 bg-background border-border dark:border-border">
          <h3 className="text-xl font-semibold text-foreground mb-4">How to Get Started</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="text-lg font-medium text-blue-400">1. Connect Gmail</div>
              <p className="text-foreground dark:text-neutral-300 text-sm">
                Connect your Gmail account in Settings → Integrations to enable email analysis and lead detection.
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/settings">Configure Gmail</a>
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="text-lg font-medium text-green-400">2. Import Leads</div>
              <p className="text-foreground dark:text-neutral-300 text-sm">
                Use the Gmail Hub to analyze emails and import potential leads with AI scoring and automation setup.
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/gmail-hub">Import Leads</a>
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="text-lg font-medium text-purple-400">3. Manage Pipeline</div>
              <p className="text-foreground dark:text-neutral-300 text-sm">
                Track your leads through the automated pipeline stages and watch as they convert to customers.
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/leads">View Pipeline</a>
              </Button>
            </div>
          </div>
        </Card>

        {/* Technical Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-background border-border dark:border-border">
            <h4 className="font-semibold text-foreground mb-3">AI Features</h4>
            <ul className="space-y-2 text-sm text-foreground dark:text-neutral-300">
              <li>• Smart email content analysis</li>
              <li>• Automatic business lead detection</li>
              <li>• Dynamic scoring (0-100 scale)</li>
              <li>• Company & contact extraction</li>
              <li>• Service interest categorization</li>
              <li>• Spam & promotional filtering</li>
            </ul>
          </Card>
          
          <Card className="p-6 bg-background border-border dark:border-border">
            <h4 className="font-semibold text-foreground mb-3">Automation Capabilities</h4>
            <ul className="space-y-2 text-sm text-foreground dark:text-neutral-300">
              <li>• Automatic sales rep assignment</li>
              <li>• Scheduled follow-up reminders</li>
              <li>• Welcome email sequences</li>
              <li>• Lead stage progression</li>
              <li>• Response tracking & scoring</li>
              <li>• Calendar integration</li>
            </ul>
          </Card>
        </div>
      </div>
    </SidebarDemo>
  );
} 