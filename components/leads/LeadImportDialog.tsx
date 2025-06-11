'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Upload, 
  Mail, 
  Users, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Target,
  Brain,
  Calendar,
  MessageSquare,
  TrendingUp,
  Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PotentialLead {
  id: string;
  from: string;
  from_email: string;
  subject: string;
  snippet: string;
  date: string;
  aiScore: number;
  suggestedStage: string;
  suggestedCategory: string;
  extractedData: {
    company?: string;
    phone?: string;
    website?: string;
    serviceInterest?: string;
  };
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

interface LeadImportDialogProps {
  workspaceId: string;
  userId: string;
  trigger: React.ReactNode;
}

const defaultAutomations: AutomationRule[] = [
  {
    id: 'auto-assign',
    name: 'Auto-assign to Sales Rep',
    trigger: 'Lead Created',
    action: 'Assign based on territory/expertise',
    enabled: true
  },
  {
    id: 'welcome-email',
    name: 'Send Welcome Email',
    trigger: 'Lead Created',
    action: 'Send personalized welcome sequence',
    enabled: true
  },
  {
    id: 'schedule-followup',
    name: 'Schedule Follow-up',
    trigger: 'Lead Created',
    action: 'Create calendar task for 24 hours',
    enabled: true
  },
  {
    id: 'slack-notification',
    name: 'Team Notification',
    trigger: 'High-score Lead',
    action: 'Send Slack alert to sales team',
    enabled: false
  },
  {
    id: 'qualification-reminder',
    name: 'Qualification Reminder',
    trigger: 'No Response (3 days)',
    action: 'Send follow-up email sequence',
    enabled: true
  },
  {
    id: 'lead-scoring-update',
    name: 'Dynamic Lead Scoring',
    trigger: 'Response Received',
    action: 'Update lead score based on engagement',
    enabled: true
  }
];

export function LeadImportDialog({ workspaceId, userId, trigger }: LeadImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [potentialLeads, setPotentialLeads] = useState<PotentialLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [automations, setAutomations] = useState<AutomationRule[]>(defaultAutomations);
  const [currentStep, setCurrentStep] = useState<'analyze' | 'configure' | 'import'>('analyze');
  
  // Fetch and analyze emails from Gmail Hub
  const analyzeEmails = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gmail/analyze-for-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      
      if (!response.ok) throw new Error('Failed to analyze emails');
      
      const data = await response.json();
      setPotentialLeads(data.potentialLeads || []);
      
      // Auto-select high-scoring leads
      const highScoreLeads = data.potentialLeads
        .filter((lead: PotentialLead) => lead.aiScore >= 70)
        .map((lead: PotentialLead) => lead.id);
      setSelectedLeads(new Set(highScoreLeads));
      
      toast.success(`Found ${data.potentialLeads.length} potential leads`);
    } catch (error) {
      console.error('Error analyzing emails:', error);
      toast.error('Failed to analyze emails for leads');
    } finally {
      setLoading(false);
    }
  };

  // Import selected leads with automations
  const importLeads = async () => {
    setImporting(true);
    try {
      const leadsToImport = potentialLeads.filter(lead => selectedLeads.has(lead.id));
      const enabledAutomations = automations.filter(auto => auto.enabled);
      
      const response = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          leads: leadsToImport,
          automations: enabledAutomations
        })
      });
      
      if (!response.ok) throw new Error('Failed to import leads');
      
      const result = await response.json();
      
      toast.success(`Successfully imported ${result.imported} leads with ${enabledAutomations.length} automations`);
      setOpen(false);
      
    } catch (error) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeads(newSelection);
  };

  const toggleAutomation = (automationId: string) => {
    setAutomations(prev => prev.map(auto => 
      auto.id === automationId ? { ...auto, enabled: !auto.enabled } : auto
    ));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-6xl h-[90vh] bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Leads with Automation
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-full">
          {/* Step Navigation */}
          <div className="w-64 border-r border-border p-4">
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                currentStep === 'analyze' ? 'bg-blue-600/20 text-blue-400' : 'text-muted-foreground hover:text-foreground'
              }`} onClick={() => setCurrentStep('analyze')}>
                <Brain className="h-4 w-4" />
                <span className="text-sm font-medium">1. Analyze Emails</span>
              </div>
              
              <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                currentStep === 'configure' ? 'bg-blue-600/20 text-blue-400' : 'text-muted-foreground hover:text-foreground'
              }`} onClick={() => setCurrentStep('configure')}>
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">2. Configure Automations</span>
              </div>
              
              <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                currentStep === 'import' ? 'bg-blue-600/20 text-blue-400' : 'text-muted-foreground hover:text-foreground'
              }`} onClick={() => setCurrentStep('import')}>
                <Upload className="h-4 w-4" />
                <span className="text-sm font-medium">3. Import & Execute</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-8 space-y-3">
              <div className="bg-background p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Potential Leads</span>
                  <span className="text-sm font-bold text-foreground">{potentialLeads.length}</span>
                </div>
              </div>
              
              <div className="bg-background p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Selected</span>
                  <span className="text-sm font-bold text-blue-400">{selectedLeads.size}</span>
                </div>
              </div>
              
              <div className="bg-background p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Automations</span>
                  <span className="text-sm font-bold text-green-400">{automations.filter(a => a.enabled).length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Step 1: Analyze Emails */}
            {currentStep === 'analyze' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Analyze Gmail for Leads</h3>
                    <p className="text-muted-foreground text-sm">AI will analyze your Gmail for potential business leads</p>
                  </div>
                  <Button onClick={analyzeEmails} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                    {loading ? 'Analyzing...' : 'Analyze Emails'}
                  </Button>
                </div>

                {potentialLeads.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Potential Leads Found</h4>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedLeads(new Set(potentialLeads.map(l => l.id)))}
                        >
                          Select All
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedLeads(new Set())}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {potentialLeads.map((lead) => (
                        <Card key={lead.id} className="p-4 bg-background border-border dark:border-border">
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={selectedLeads.has(lead.id)}
                              onCheckedChange={() => toggleLeadSelection(lead.id)}
                              className="mt-1"
                            />
                            
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium">{lead.from}</h5>
                                  <Badge className={getScoreBadgeColor(lead.aiScore)}>
                                    AI Score: {lead.aiScore}%
                                  </Badge>
                                </div>
                                <span className="text-xs text-foreground0">
                                  {new Date(lead.date).toLocaleDateString()}
                                </span>
                              </div>
                              
                              <p className="text-sm font-medium text-gray-800 dark:text-foreground">{lead.subject}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{lead.snippet}</p>
                              
                              {lead.extractedData && (
                                <div className="flex gap-2 flex-wrap">
                                  {lead.extractedData.company && (
                                    <Badge variant="outline" className="text-xs">
                                      🏢 {lead.extractedData.company}
                                    </Badge>
                                  )}
                                  {lead.extractedData.serviceInterest && (
                                    <Badge variant="outline" className="text-xs">
                                      🎯 {lead.extractedData.serviceInterest}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <Button 
                      onClick={() => setCurrentStep('configure')}
                      className="w-full"
                      disabled={selectedLeads.size === 0}
                    >
                      Configure Automations for {selectedLeads.size} leads
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Configure Automations */}
            {currentStep === 'configure' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold">Configure Lead Automations</h3>
                  <p className="text-muted-foreground text-sm">Set up automated workflows for your imported leads</p>
                </div>

                <div className="grid gap-4">
                  {automations.map((automation) => (
                    <Card key={automation.id} className="p-4 bg-background border-border dark:border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={automation.enabled}
                            onCheckedChange={() => toggleAutomation(automation.id)}
                          />
                          <div>
                            <h5 className="font-medium">{automation.name}</h5>
                            <p className="text-sm text-muted-foreground">
                              <span className="text-blue-400">Trigger:</span> {automation.trigger} → 
                              <span className="text-green-400"> Action:</span> {automation.action}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {automation.enabled ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Clock className="h-4 w-4 text-foreground0" />
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Button 
                  onClick={() => setCurrentStep('import')}
                  className="w-full"
                  disabled={automations.filter(a => a.enabled).length === 0}
                >
                  Proceed to Import with {automations.filter(a => a.enabled).length} automations
                </Button>
              </div>
            )}

            {/* Step 3: Import & Execute */}
            {currentStep === 'import' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold">Ready to Import</h3>
                  <p className="text-muted-foreground text-sm">Review and execute the lead import with automations</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4 bg-blue-600/10 border-blue-600/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">Leads to Import</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{selectedLeads.size}</p>
                  </Card>
                  
                  <Card className="p-4 bg-green-600/10 border-green-600/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">Active Automations</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{automations.filter(a => a.enabled).length}</p>
                  </Card>
                  
                  <Card className="p-4 bg-purple-600/10 border-purple-600/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-400">Avg. AI Score</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {selectedLeads.size > 0 
                        ? Math.round(
                            potentialLeads
                              .filter(l => selectedLeads.has(l.id))
                              .reduce((sum, l) => sum + l.aiScore, 0) / selectedLeads.size
                          )
                        : 0}%
                    </p>
                  </Card>
                </div>

                <Card className="p-4 bg-background border-border dark:border-border">
                  <h4 className="font-medium mb-3">Automation Preview</h4>
                  <div className="space-y-2">
                    {automations.filter(a => a.enabled).map((automation, index) => (
                      <div key={automation.id} className="flex items-center gap-3 text-sm">
                        <span className="text-foreground0">{index + 1}.</span>
                        <span className="text-foreground">{automation.name}</span>
                        <span className="text-muted-foreground">will execute</span>
                        <Badge variant="outline" className="text-xs">
                          {automation.trigger}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                <Button 
                  onClick={importLeads}
                  disabled={importing || selectedLeads.size === 0}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Importing {selectedLeads.size} leads...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {selectedLeads.size} Leads with Automations
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 