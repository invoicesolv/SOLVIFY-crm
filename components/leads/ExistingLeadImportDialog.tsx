'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Upload, 
  Users, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Target,
  Database,
  Search,
  Filter,
  TrendingUp,
  Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ExistingLead {
  id: string;
  lead_name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  service_category: string;
  qualification_score: number;
  status: string;
  stage: string;
  created_at: string;
  last_contacted: string | null;
  next_followup: string | null;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

interface ExistingLeadImportDialogProps {
  workspaceId: string;
  userId: string;
  trigger: React.ReactNode;
}

const defaultAutomations: AutomationRule[] = [
  {
    id: 'auto-assign',
    name: 'Auto-assign to Sales Rep',
    trigger: 'Lead Selected',
    action: 'Assign based on territory/expertise',
    enabled: true
  },
  {
    id: 'welcome-email',
    name: 'Send Welcome Email',
    trigger: 'Lead Selected',
    action: 'Send personalized welcome sequence',
    enabled: false
  },
  {
    id: 'schedule-followup',
    name: 'Schedule Follow-up',
    trigger: 'Lead Selected',
    action: 'Create calendar task for next contact',
    enabled: true
  },
  {
    id: 'update-status',
    name: 'Update Lead Status',
    trigger: 'Lead Selected',
    action: 'Mark as active and ready for outreach',
    enabled: true
  },
  {
    id: 'qualification-call',
    name: 'Schedule Qualification Call',
    trigger: 'High-score Lead',
    action: 'Schedule qualification call for qualified leads',
    enabled: false
  },
  {
    id: 'nurture-sequence',
    name: 'Start Nurture Sequence',
    trigger: 'Cold Lead',
    action: 'Add to email nurture campaign',
    enabled: true
  }
];

export function ExistingLeadImportDialog({ workspaceId, userId, trigger }: ExistingLeadImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [existingLeads, setExistingLeads] = useState<ExistingLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<ExistingLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [automations, setAutomations] = useState<AutomationRule[]>(defaultAutomations);
  const [currentStep, setCurrentStep] = useState<'select' | 'configure' | 'apply'>('select');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');

  // Load existing leads from database
  const loadExistingLeads = async () => {
    setLoading(true);
    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setExistingLeads(leads || []);
      setFilteredLeads(leads || []);
      
      toast.success(`Loaded ${leads?.length || 0} existing leads`);
    } catch (error) {
      console.error('Error loading existing leads:', error);
      toast.error('Failed to load existing leads');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = existingLeads;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.lead_name.toLowerCase().includes(query) ||
        lead.company.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.service_category.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(lead => lead.source === sourceFilter);
    }

    // Score filter
    if (scoreFilter !== 'all') {
      filtered = filtered.filter(lead => {
        const score = lead.qualification_score || 0;
        switch (scoreFilter) {
          case 'high': return score >= 80;
          case 'medium': return score >= 50 && score < 80;
          case 'low': return score < 50;
          default: return true;
        }
      });
    }

    setFilteredLeads(filtered);
  }, [existingLeads, searchQuery, statusFilter, sourceFilter, scoreFilter]);

  // Apply automations to selected leads
  const applyAutomations = async () => {
    setApplying(true);
    try {
      const leadsToUpdate = filteredLeads.filter(lead => selectedLeads.has(lead.id));
      const enabledAutomations = automations.filter(auto => auto.enabled);
      
      const response = await fetch('/api/leads/apply-automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          leadIds: Array.from(selectedLeads),
          automations: enabledAutomations
        })
      });
      
      if (!response.ok) throw new Error('Failed to apply automations');
      
      const result = await response.json();
      
      toast.success(`Applied ${enabledAutomations.length} automations to ${result.processed} leads`);
      setOpen(false);
      
    } catch (error) {
      console.error('Error applying automations:', error);
      toast.error('Failed to apply automations');
    } finally {
      setApplying(false);
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

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400';
    if (score >= 50) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new': return 'bg-blue-500/20 text-blue-400';
      case 'contacted': return 'bg-yellow-500/20 text-yellow-400';
      case 'qualified': return 'bg-green-500/20 text-green-400';
      case 'converted': return 'bg-purple-500/20 text-purple-400';
      case 'lost': return 'bg-red-500/20 text-red-400';
      default: return 'bg-neutral-500/20 text-muted-foreground';
    }
  };

  // Get unique values for filters
  const uniqueStatuses = [...new Set(existingLeads.map(lead => lead.status))];
  const uniqueSources = [...new Set(existingLeads.map(lead => lead.source))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-6xl h-[90vh] bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import Existing Leads with Automation
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-full">
          {/* Step Navigation */}
          <div className="w-64 border-r border-border p-4">
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                currentStep === 'select' ? 'bg-blue-600/20 text-blue-400' : 'text-muted-foreground hover:text-gray-900 dark:hover:text-primary-foreground'
              }`} onClick={() => setCurrentStep('select')}>
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">1. Select Leads</span>
              </div>
              
              <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                currentStep === 'configure' ? 'bg-blue-600/20 text-blue-400' : 'text-muted-foreground hover:text-gray-900 dark:hover:text-primary-foreground'
              }`} onClick={() => setCurrentStep('configure')}>
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">2. Configure Automations</span>
              </div>
              
              <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                currentStep === 'apply' ? 'bg-blue-600/20 text-blue-400' : 'text-muted-foreground hover:text-gray-900 dark:hover:text-primary-foreground'
              }`} onClick={() => setCurrentStep('apply')}>
                <Upload className="h-4 w-4" />
                <span className="text-sm font-medium">3. Apply Automations</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-8 space-y-3">
              <div className="bg-background p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Leads</span>
                  <span className="text-sm font-bold text-foreground">{filteredLeads.length}</span>
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
            {/* Step 1: Select Leads */}
            {currentStep === 'select' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Select Existing Leads</h3>
                    <p className="text-muted-foreground text-sm">Choose leads from your database to apply automations</p>
                  </div>
                  <Button onClick={loadExistingLeads} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                    {loading ? 'Loading...' : 'Load Leads'}
                  </Button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground0" />
                    <Input
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background border-border dark:border-border"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-background border-border dark:border-border">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {uniqueStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="bg-background border-border dark:border-border">
                      <SelectValue placeholder="Filter by source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {uniqueSources.map(source => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={scoreFilter} onValueChange={setScoreFilter}>
                    <SelectTrigger className="bg-background border-border dark:border-border">
                      <SelectValue placeholder="Filter by score" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scores</SelectItem>
                      <SelectItem value="high">High (80+)</SelectItem>
                      <SelectItem value="medium">Medium (50-79)</SelectItem>
                      <SelectItem value="low">Low (&lt;50)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredLeads.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Existing Leads ({filteredLeads.length})</h4>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedLeads(new Set(filteredLeads.map(l => l.id)))}
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

                    <div className="grid gap-4 max-h-96 overflow-y-auto">
                      {filteredLeads.map((lead) => (
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
                                  <h5 className="font-medium">{lead.lead_name}</h5>
                                  <Badge className={getScoreBadgeColor(lead.qualification_score || 0)}>
                                    Score: {lead.qualification_score || 0}%
                                  </Badge>
                                  <Badge className={getStatusBadgeColor(lead.status)}>
                                    {lead.status}
                                  </Badge>
                                </div>
                                <span className="text-xs text-foreground0">
                                  {new Date(lead.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Company:</span> {lead.company || 'N/A'}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Email:</span> {lead.email}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Source:</span> {lead.source}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Service:</span> {lead.service_category}
                                </div>
                              </div>
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
                  <p className="text-muted-foreground text-sm">Set up automated workflows for your selected leads</p>
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
                  onClick={() => setCurrentStep('apply')}
                  className="w-full"
                  disabled={automations.filter(a => a.enabled).length === 0}
                >
                  Proceed to Apply {automations.filter(a => a.enabled).length} automations
                </Button>
              </div>
            )}

            {/* Step 3: Apply Automations */}
            {currentStep === 'apply' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold">Ready to Apply Automations</h3>
                  <p className="text-muted-foreground text-sm">Review and apply automations to selected leads</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4 bg-blue-600/10 border-blue-600/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">Selected Leads</span>
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
                      <span className="text-sm font-medium text-purple-400">Avg. Score</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {selectedLeads.size > 0 
                        ? Math.round(
                            filteredLeads
                              .filter(l => selectedLeads.has(l.id))
                              .reduce((sum, l) => sum + (l.qualification_score || 0), 0) / selectedLeads.size
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
                        <span className="text-muted-foreground">will be applied to</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedLeads.size} leads
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                <Button 
                  onClick={applyAutomations}
                  disabled={applying || selectedLeads.size === 0}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {applying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Applying to {selectedLeads.size} leads...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Apply Automations to {selectedLeads.size} Leads
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