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
import { MoveRight, Star, Calendar, Link2, Trash2, MoreHorizontal, Folder, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { ExportLeadsButton } from "@/components/leads/ExportLeadsButton";
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

interface Folder {
  id: string;
  name: string;
  workspace_id: string;
}

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
  folder_id?: string;
  folders?: {
    id: string;
    name: string;
  };
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
  onManageFolders: () => void;
  selectedFolder?: string | null;
}

export const LeadTable = forwardRef<{ loadLeads: () => Promise<void> }, LeadTableProps>(
  ({ workspaceId, userId, onMetricsChange, onManageFolders, selectedFolder }, ref) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);

  const loadFolders = async () => {
    if (!workspaceId) return;
    
    try {
      setLoadingFolders(true);
      const { data, error } = await supabase
        .from("lead_folders")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      if (error) throw error;
      console.log("Loaded folders:", data);
      setFolders(data || []);
    } catch (error) {
      console.error("Error loading folders:", error);
      toast.error("Failed to load folders");
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadLeads = async () => {
    if (!workspaceId) {
      console.log('[LeadTable] No workspaceId provided');
      return;
    }

    try {
      setLoading(true);
      console.log(`[LeadTable] Loading leads for workspace: ${workspaceId}`);
      
      let query = supabase
        .from("leads")
        .select(`
          *,
          folders:folder_id (
            id,
            name
          )
        `)
        .eq("workspace_id", workspaceId);
      
      // Apply folder filter if selected
      if (selectedFolder) {
        if (selectedFolder === 'unassigned') {
          // More explicit null check for folder_id
          query = query.is("folder_id", null);
          console.log("[LeadTable] Filtering for unassigned leads (folder_id is null)");
        } else {
          query = query.eq("folder_id", selectedFolder);
          console.log(`[LeadTable] Filtering for folder_id = ${selectedFolder}`);
        }
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error('[LeadTable] Error loading leads:', error);
        throw error;
      }
      
      console.log(`[LeadTable] Loaded ${data?.length || 0} leads for workspace ${workspaceId}`);
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
    loadFolders();
    loadLeads();
  }, [workspaceId, selectedFolder]);

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

  const assignToFolder = async (leadId: string, folderId: string | null) => {
    try {
      console.log("Assigning lead to folder:", { leadId, folderId });
      
      const { error } = await supabase
        .from("leads")
        .update({ folder_id: folderId })
        .eq("id", leadId);

      if (error) throw error;
      
      toast.success(folderId ? "Lead assigned to folder successfully" : "Lead removed from folder");
      loadLeads(); // Refresh the leads list
    } catch (error) {
      console.error("Error assigning lead to folder:", error);
      toast.error("Failed to assign lead to folder");
    }
  };

  const assignSelectedToFolder = async (folderId: string | null) => {
    if (selectedLeads.length === 0) {
      toast.error("No leads selected");
      return;
    }

    try {
      const { error } = await supabase
        .from("leads")
        .update({ folder_id: folderId })
        .in("id", selectedLeads);

      if (error) throw error;
      
      toast.success(`${selectedLeads.length} leads assigned to folder`);
      setSelectedLeads([]);
      loadLeads();
    } catch (error) {
      console.error("Error bulk assigning leads to folder:", error);
      toast.error("Failed to assign leads to folder");
    }
  };

  const getQualificationBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-green-500/10 text-green-400">High</Badge>;
    if (score >= 5) return <Badge className="bg-yellow-500/10 text-yellow-400">Medium</Badge>;
    return <Badge className="bg-red-500/10 text-red-400">Low</Badge>;
  };

    return (
    <Card className="bg-background border-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium text-foreground">
            {selectedFolder 
              ? selectedFolder === "unassigned"
                ? "Unassigned Leads" 
                : `Leads in "${folders.find(f => f.id === selectedFolder)?.name || ''}"` 
              : "All Leads"}
          </h3>

        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border">
                  <Folder className="h-4 w-4" />
                  Assign to Folder
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border-border dark:border-border">
                <DropdownMenuItem 
                  onClick={() => assignSelectedToFolder(null)}
                  className="cursor-pointer text-foreground hover:bg-gray-200 dark:bg-muted focus:bg-gray-200 dark:bg-muted"
                >
                  Unassign
                </DropdownMenuItem>
                {folders.map((folder) => (
                  <DropdownMenuItem 
                    key={folder.id} 
                    onClick={() => assignSelectedToFolder(folder.id)}
                    className="cursor-pointer text-foreground hover:bg-gray-200 dark:bg-muted focus:bg-gray-200 dark:bg-muted"
                  >
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button 
            variant="outline" 
            className="bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border flex items-center gap-2"
            onClick={onManageFolders}
            >
            <FolderOpen className="h-4 w-4" />
            Manage Folders
            </Button>
          <ExportLeadsButton 
            leads={leads} 
            selectedLeads={selectedLeads} 
            clearSelection={() => setSelectedLeads([])}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
            <TableRow className="border-border hover:bg-background/50">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedLeads.length > 0 && selectedLeads.length === leads.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedLeads(leads.map((lead) => lead.id));
                    } else {
                      setSelectedLeads([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>Name / Company</TableHead>
              <TableHead>Folder</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    <span className="mt-2 text-sm text-muted-foreground">Loading leads...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-sm text-muted-foreground">No leads found</p>
                    <Button 
                      variant="default" 
                      className="mt-2 text-blue-400"
                    >
                      No leads found
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="border-border hover:bg-background/50">
              <TableCell>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedLeads([...selectedLeads, lead.id]);
                      } else {
                          setSelectedLeads(selectedLeads.filter((id) => id !== lead.id));
                      }
                    }}
                  />
              </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{lead.lead_name}</p>
                      <p className="text-sm text-muted-foreground">{lead.company}</p>
                    </div>
              </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {lead.folders ? (
                        <Badge className="bg-blue-500/10 text-blue-400">
                          {lead.folders.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border dark:border-border">
                          Unassigned
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="h-6 w-6 p-0 hover:bg-background text-blue-400 relative"
                            title="Assign to folder"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-blue-500 ring-1 ring-white" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-background border-border dark:border-border w-56">
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Assign to folder
                          </div>
                          <DropdownMenuItem 
                            onClick={() => assignToFolder(lead.id, null)}
                            className="cursor-pointer text-foreground hover:bg-gray-200 dark:bg-muted focus:bg-gray-200 dark:bg-muted"
                          >
                            <span className="text-muted-foreground mr-2">⦸</span>
                            Unassign
                          </DropdownMenuItem>
                          {folders.map((folder) => (
                            <DropdownMenuItem 
                              key={folder.id} 
                              onClick={() => assignToFolder(lead.id, folder.id)}
                              className="cursor-pointer text-foreground hover:bg-gray-200 dark:bg-muted focus:bg-gray-200 dark:bg-muted"
                            >
                              <Folder className="h-4 w-4 mr-2 text-blue-400" />
                              {folder.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
              </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-foreground border-border dark:border-border">
                    {lead.source}
                    </Badge>
                </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-500/10 text-purple-400">
                    {lead.service_category}
                    </Badge>
              </TableCell>
                  <TableCell>
                    {getQualificationBadge(lead.qualification_score)}
              </TableCell>
              <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-100 dark:bg-green-900/20"
                        onClick={() => convertToDeal(lead.id)}
                        disabled={lead.converted_to_deal}
                        title={lead.converted_to_deal ? "Already converted to deal" : "Convert to deal"}
                      >
                        <MoveRight className="h-4 w-4" />
                    </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-100 dark:bg-red-900/20"
                            title="Delete lead"
                            onClick={() => setLeadToDelete(lead)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                      </AlertDialog>
                    </div>
                </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>
                  </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
                  <AlertDialogContent className="bg-background border-border text-foreground">
                    <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirm Deletion</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete the lead "{leadToDelete?.lead_name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
            <AlertDialogCancel className="bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteLead}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
    </Card>
  );
});

LeadTable.displayName = "LeadTable"; 