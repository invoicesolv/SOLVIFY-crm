'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { MoveRight, Star, Calendar, Link2, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Checkbox,
} from "@/components/ui/checkbox";

interface Lead {
  id: string;
  lead_name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  service_category: string;
  website_url: string;
  monthly_traffic: number;
  current_rank: string;
  target_keywords: string[];
  qualification_score: number;
  notes: string;
  created_at: string;
  workspace_id: string;
  user_id: string;
  status?: string;
  converted_to_deal?: boolean;
  deal_id?: string;
}

interface LeadTableProps {
  workspaceId: string;
  userId: string;
  onMetricsChange: (metrics: {
    totalLeads: number;
    newLeadsToday: number;
    conversionRate: number;
    averageQualificationScore: number;
  }) => void;
}

export const LeadTable = forwardRef<{ loadLeads: () => Promise<void> }, LeadTableProps>(
  ({ workspaceId, userId, onMetricsChange }, ref) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const loadLeads = async () => {
    if (!workspaceId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);

      // Calculate metrics
      const today = new Date().toISOString().split('T')[0];
      const newToday = data?.filter((lead: Lead) => 
        lead.created_at.startsWith(today)
      ).length || 0;

      const totalQualificationScore = data?.reduce(
        (sum: number, lead: Lead) => sum + (lead.qualification_score || 0), 
        0
      );

      onMetricsChange({
        totalLeads: data?.length || 0,
        newLeadsToday: newToday,
        conversionRate: 0, // This will be calculated when we implement deal conversion
        averageQualificationScore: data?.length 
          ? Math.round((totalQualificationScore / data.length) * 10) / 10
          : 0
      });
    } catch (error) {
      console.error("Error loading leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  // Expose the loadLeads method to parent components
  useImperativeHandle(ref, () => ({
    loadLeads
  }));

  useEffect(() => {
    loadLeads();
  }, [workspaceId]);

  const convertToDeal = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    try {
      // First, create the deal
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert([
          {
            lead_name: lead.lead_name,
            company: lead.company,
            email: lead.email,
            phone: lead.phone,
            value: 0, // This will be set during deal qualification
            stage: "new",
            notes: lead.notes,
            workspace_id: workspaceId,
            user_id: userId,
            source_lead_id: lead.id,
            service_category: lead.service_category
          }
        ])
        .select()
        .single();

      if (dealError) throw dealError;

      // Then, update the lead's status
      const { error: updateError } = await supabase
        .from("leads")
        .update({ converted_to_deal: true, deal_id: deal.id })
        .eq("id", leadId);

      if (updateError) throw updateError;

      toast.success("Lead converted to deal successfully");
      loadLeads(); // Refresh the leads list
    } catch (error) {
      console.error("Error converting lead to deal:", error);
      toast.error("Failed to convert lead to deal");
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;

    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadToDelete.id);

      if (error) throw error;

      toast.success(`Lead "${leadToDelete.lead_name}" deleted successfully`);
      setLeadToDelete(null); // Close dialog
      loadLeads(); // Refresh list
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error(`Failed to delete lead "${leadToDelete.lead_name}"`);
      setLeadToDelete(null); // Close dialog even on error
    }
  };

  const getQualificationBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-green-500/10 text-green-400">High</Badge>;
    if (score >= 5) return <Badge className="bg-yellow-500/10 text-yellow-400">Medium</Badge>;
    return <Badge className="bg-red-500/10 text-red-400">Low</Badge>;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-neutral-900/50 backdrop-blur-sm border-neutral-800">
      <div className="p-4 border-b border-neutral-800">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Leads</h2>
            <p className="text-sm text-neutral-400">
              Manage and qualify your leads
            </p>
          </div>
          {selectedLeads.length > 0 && (
            <Button
              onClick={() => {
                selectedLeads.forEach(leadId => convertToDeal(leadId));
                setSelectedLeads([]);
              }}
              className="flex items-center gap-2"
            >
              <MoveRight className="h-4 w-4" />
              Convert to Deals
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-neutral-800">
      <Table>
        <TableHeader>
            <TableRow className="hover:bg-neutral-800/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLeads.length === leads.length && leads.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedLeads(leads.map(lead => lead.id));
                    } else {
                      setSelectedLeads([]);
                    }
                  }}
                  aria-label="Select all"
                  className="translate-y-[2px]"
                />
              </TableHead>
              <TableHead className="text-white">Name</TableHead>
              <TableHead className="text-white">Company</TableHead>
              <TableHead className="text-white">Email</TableHead>
              <TableHead className="text-white">Phone</TableHead>
              <TableHead className="text-white">Source</TableHead>
              <TableHead className="text-white">Service</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
              <TableRow key={lead.id} className="hover:bg-neutral-800/50">
              <TableCell>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedLeads([...selectedLeads, lead.id]);
                      } else {
                        setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                      }
                    }}
                    aria-label={`Select ${lead.lead_name}`}
                    className="translate-y-[2px]"
                  />
              </TableCell>
                <TableCell className="font-medium text-white">
                  <div className="truncate max-w-[150px]">{lead.lead_name}</div>
              </TableCell>
                <TableCell className="text-white">
                  <div className="truncate max-w-[220px]" title={lead.company || '-'}>{lead.company || '-'}</div>
              </TableCell>
                <TableCell className="text-white">
                  <div className="truncate max-w-[180px]">{lead.email || '-'}</div>
              </TableCell>
                <TableCell className="text-white">{lead.phone || '-'}</TableCell>
                <TableCell className="text-white">
                  <Badge variant="outline" className="bg-neutral-800 text-white">
                    {lead.source}
                    </Badge>
                </TableCell>
                <TableCell className="text-white">
                  <Badge variant="outline" className="bg-neutral-800 text-white">
                    {lead.service_category}
                    </Badge>
              </TableCell>
                <TableCell className="text-white">
                  <Badge variant="outline" className="bg-neutral-800 text-white">
                    {lead.status || 'New'}
                  </Badge>
              </TableCell>
              <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 text-white">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800">
                      <DropdownMenuItem 
                        onClick={() => {
                          setLeadToDelete(lead);
                        }}
                        className="text-red-500 hover:text-red-400 hover:bg-neutral-800 focus:bg-neutral-800 focus:text-red-400 cursor-pointer"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
                  </div>

      <AlertDialog open={!!leadToDelete} onOpenChange={(open: boolean) => !open && setLeadToDelete(null)}>
                  <AlertDialogContent className="bg-neutral-900 border-neutral-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription className="text-neutral-400">
              This action cannot be undone. This will permanently delete the lead{" "}
              <strong className="text-white">{leadToDelete?.lead_name}</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel 
                        className="bg-neutral-800 hover:bg-neutral-700 border-neutral-700"
                        onClick={() => setLeadToDelete(null)}
                      >Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        className="bg-red-600 hover:bg-red-700"
                        onClick={handleDeleteLead}
                      >Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
    </Card>
  );
});

LeadTable.displayName = "LeadTable"; 