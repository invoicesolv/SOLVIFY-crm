'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, FileIcon, CheckIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface ExportLeadsButtonProps {
  leads: Lead[];
  selectedLeads: string[];
  clearSelection: () => void;
  workspaceId?: string;
}

export function ExportLeadsButton({ leads, selectedLeads, clearSelection, workspaceId }: ExportLeadsButtonProps) {
  const [exporting, setExporting] = useState(false);

  const getLeadsForExport = (): Lead[] => {
    if (selectedLeads && selectedLeads.length > 0) {
      // Filter leads based on selected IDs
      return leads.filter(lead => selectedLeads.includes(lead.id));
    }
    return leads;
  };

  const formatLeadsForExport = (leads: Lead[]) => {
    return leads.map(lead => ({
      "Lead Name": lead.lead_name,
      "Company": lead.company,
      "Email": lead.email,
      "Phone": lead.phone,
      "Source": lead.source,
      "Service Category": lead.service_category,
      "Folder": lead.folders ? lead.folders.name : "Unassigned",
      "Website URL": lead.website_url,
      "Monthly Traffic": lead.monthly_traffic,
      "Current Rank": lead.current_rank,
      "Target Keywords": Array.isArray(lead.target_keywords) ? lead.target_keywords.join(", ") : lead.target_keywords,
      "Qualification Score": lead.qualification_score,
      "Notes": lead.notes,
      "Created At": new Date(lead.created_at).toLocaleString(),
      "Status": lead.status || "New",
      "Converted to Deal": lead.converted_to_deal ? "Yes" : "No"
    }));
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const leadsToExport = getLeadsForExport();
      if (leadsToExport.length === 0) {
        toast.error("No leads to export");
        setExporting(false);
        return;
      }

      const formattedLeads = formatLeadsForExport(leadsToExport);
      
      // Convert to CSV
      const worksheet = XLSX.utils.json_to_sheet(formattedLeads);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      
      // Create and download file
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${leadsToExport.length} leads to CSV`);
      
      // Clear selection after export
      if (selectedLeads.length > 0) {
        clearSelection();
      }
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      toast.error("Failed to export leads to CSV");
    } finally {
      setExporting(false);
    }
  };

  const exportToXLSX = async () => {
    setExporting(true);
    try {
      const leadsToExport = getLeadsForExport();
      if (leadsToExport.length === 0) {
        toast.error("No leads to export");
        setExporting(false);
        return;
      }

      const formattedLeads = formatLeadsForExport(leadsToExport);
      
      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(formattedLeads);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
      
      // Create and download file
      XLSX.writeFile(workbook, `leads_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success(`Exported ${leadsToExport.length} leads to Excel`);
      
      // Clear selection after export
      if (selectedLeads.length > 0) {
        clearSelection();
      }
    } catch (error) {
      console.error("Error exporting to XLSX:", error);
      toast.error("Failed to export leads to Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          disabled={exporting || leads.length === 0}
          className="flex items-center gap-2 bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border"
        >
          {exporting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white/50 border-t-gray-900 dark:border-t-white rounded-full" />
              Exporting...
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-4 w-4" />
              Export {selectedLeads?.length ? `(${selectedLeads.length})` : ''}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-background border-border dark:border-border text-foreground">
        <DropdownMenuItem 
          onClick={exportToCSV} 
          className="cursor-pointer text-foreground hover:bg-gray-200 dark:bg-muted focus:bg-gray-200 dark:bg-muted"
        >
          <FileIcon className="mr-2 h-4 w-4" />
          <span>Export to CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={exportToXLSX} 
          className="cursor-pointer text-foreground hover:bg-gray-200 dark:bg-muted focus:bg-gray-200 dark:bg-muted"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Export to Excel</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 