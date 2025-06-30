'use client';

import { useState, useEffect, useRef } from "react";
import { useAuth } from '@/lib/auth-client';
import { useWorkspace } from "@/hooks/useWorkspace";
import { motion } from "framer-motion";
import { 
  Users, 
  Filter,
  ArrowRight,
  Plus,
  FileSpreadsheet,
  MoveRight,
  Tags,
  UserPlus,
  Upload,
  FolderOpen,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Glow } from "@/components/ui/glow";
import { SidebarDemo } from "@/components/ui/code.demo";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadDialog } from "@/components/leads/LeadDialog";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { ImportCustomersDialog } from "@/components/leads/ImportCustomersDialog";
import { FolderManagementDialog } from "@/components/leads/FolderManagementDialog";
import { FolderSidebar } from "@/components/leads/FolderSidebar";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";
import { supabase } from "@/lib/supabase";
import { LeadsList } from "@/components/leads/LeadsList";

// SEO-specific lead source types
const LEAD_SOURCES = [
  { id: "website_form", name: "Website Form" },
  { id: "contact_page", name: "Contact Page" },
  { id: "blog_signup", name: "Blog Signup" },
  { id: "seo_audit", name: "SEO Audit Request" },
  { id: "keyword_research", name: "Keyword Research Request" },
  { id: "backlink_inquiry", name: "Backlink Inquiry" },
  { id: "content_optimization", name: "Content Optimization" },
  { id: "local_seo", name: "Local SEO Request" },
  { id: "referral", name: "Referral" },
  { id: "other", name: "Other" }
];

// SEO service categories
const SERVICE_CATEGORIES = [
  { id: "technical_seo", name: "Technical SEO", color: "bg-blue-500/10 text-blue-400" },
  { id: "content_seo", name: "Content SEO", color: "bg-green-500/10 text-green-400" },
  { id: "local_seo", name: "Local SEO", color: "bg-yellow-500/10 text-yellow-400" },
  { id: "ecommerce_seo", name: "E-commerce SEO", color: "bg-purple-500/10 text-purple-400" },
  { id: "international_seo", name: "International SEO", color: "bg-orange-500/10 text-orange-400" },
  { id: "link_building", name: "Link Building", color: "bg-cyan-500/10 text-cyan-400" }
];

export default function LeadsPage() {
  const { user, session } = useAuth();
  const { activeWorkspaceId, workspaces, isLoading: loadingWorkspace, error: workspaceError, setActiveWorkspace } = useWorkspace();

  // Debug session state and clear stale localStorage
  useEffect(() => {
    console.log('[Leads Page] User:', user?.email || 'none');
    console.log('[Leads Page] Session:', session ? 'present' : 'none');
    console.log('[Leads Page] Active workspace:', activeWorkspaceId || 'none');
    
    // Clear any stale dashboard settings that might interfere with workspace resolution
    if (typeof window !== 'undefined' && user?.id) {
      localStorage.removeItem('dashboardSettings');
    }
  }, [user, session, activeWorkspaceId]);
  const [openDialog, setOpenDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [importCustomersDialog, setImportCustomersDialog] = useState(false);
  const [folderManagementDialog, setFolderManagementDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const tableRef = useRef<{ loadLeads: () => Promise<void> }>(null);
  const [trialInfo, setTrialInfo] = useState<{daysRemaining: number | null; plan: string}>({
    daysRemaining: null,
    plan: 'free'
  });
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    newLeadsToday: 0,
    conversionRate: 0,
    averageQualificationScore: 0
  });

  // Load trial information
  useEffect(() => {
    const loadTrialInfo = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('plan_id, trial_end_date')
          .eq('user_id', user.id)
          .single();
          
        if (error) {
          console.error('Error loading trial info:', error);
          return;
        }
        
        if (data?.trial_end_date) {
          const endDate = new Date(data.trial_end_date);
          const today = new Date();
          const diffTime = endDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          setTrialInfo({
            daysRemaining: diffDays > 0 ? diffDays : 0,
            plan: data.plan_id || 'free'
          });
        }
      } catch (error) {
        console.error('Error in loadTrialInfo:', error);
      }
    };
    
    loadTrialInfo();
  }, [user?.id]);



  const handleMetricsChange = (newMetrics: typeof metrics) => {
    setMetrics(newMetrics);
  };

  const handleFoldersChanged = () => {
    // Refresh leads to update folder information
    if (tableRef.current) {
      tableRef.current.loadLeads();
    }
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolder(folderId);
    if (tableRef.current) {
      tableRef.current.loadLeads();
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.4, 0.25, 1],
      }
    },
  };

  return (
    <SidebarDemo>
      <div className="min-h-screen bg-background text-foreground p-8">
        {/* Background Glow */}
        <Glow className="fixed inset-0" />

        {/* Header Section */}
        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold mb-2 text-foreground">
                Lead Management
                {trialInfo.daysRemaining !== null && trialInfo.plan === 'free' && (
                  <Badge variant="outline" className="ml-2 bg-blue-500/10 text-blue-400">
                    Trial: {trialInfo.daysRemaining} days left
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground">
                Track and qualify your leads
                {trialInfo.daysRemaining !== null && trialInfo.daysRemaining <= 5 && trialInfo.plan === 'free' && (
                  <span className="ml-2 text-blue-400 hover:text-blue-300">
                    <a href="/settings/billing" className="inline-flex items-center">
                      Upgrade now <ArrowRight className="h-3 w-3 ml-1" />
                    </a>
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Workspace Selector */}
              {workspaces.length > 0 && (
              <select
                  value={activeWorkspaceId || ""}
                  onChange={(e) => setActiveWorkspace(e.target.value)}
                  className="bg-background border border-border rounded-md px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                  <option value="" disabled className="text-foreground bg-background">
                  Select Workspace
                </option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id} className="text-foreground bg-background">
                      {ws.name}
                  </option>
                ))}
              </select>
              )}

              <Button 
                className="flex items-center gap-2"
                onClick={() => setFolderManagementDialog(true)}
                disabled={!activeWorkspaceId}
              >
                <FolderOpen className="h-4 w-4" />
                Manage Folders
              </Button>

              <Button 
                className="flex items-center gap-2"
                onClick={() => setImportCustomersDialog(true)}
                disabled={!activeWorkspaceId}
              >
                <UserPlus className="h-4 w-4" />
                Import Customers
              </Button>

              <Button 
                className="flex items-center gap-2"
                onClick={() => setImportDialog(true)}
                disabled={!activeWorkspaceId}
              >
                <Upload className="h-4 w-4" />
                Import Leads
              </Button>

              <Button 
                className="flex items-center gap-2"
                onClick={() => setOpenDialog(true)}
                disabled={!activeWorkspaceId}
              >
                <Plus className="h-4 w-4" />
                New Lead
              </Button>
            </div>
          </motion.div>

          {/* Metrics Grid */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-border p-6 relative group" gradient="blue-purple">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Leads</p>
                  <p className="text-xl font-bold text-foreground">{metrics.totalLeads}</p>
                </div>
              </div>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-border p-6 relative" gradient="green-blue">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Plus className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New Today</p>
                  <p className="text-xl font-bold text-foreground">{metrics.newLeadsToday}</p>
                </div>
              </div>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-border p-6 relative" gradient="purple-pink">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <ArrowRight className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  <p className="text-xl font-bold text-foreground">{metrics.conversionRate}%</p>
                </div>
              </div>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-border p-6 relative" gradient="orange-red">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Star className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Qualification</p>
                  <p className="text-xl font-bold text-foreground">{metrics.averageQualificationScore}</p>
                </div>
              </div>
            </AnimatedBorderCard>
          </motion.div>

          {/* Main Content with Folder Sidebar and Leads Table */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="mb-8"
          >
            {loadingWorkspace ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading workspace...</span>
              </div>
            ) : !activeWorkspaceId ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No workspace found. Please check your permissions or contact support.</p>
              </div>
            ) : (
              <div className="flex bg-background border border-border rounded-md overflow-hidden">
                {/* Folder Sidebar */}
                <FolderSidebar 
                  workspaceId={activeWorkspaceId}
                  selectedFolderId={selectedFolder}
                  onFolderSelect={handleFolderSelect}
                  onManageFolders={() => setFolderManagementDialog(true)}
                />

          {/* Leads Table */}
                <div className="flex-1">
              <LeadTable
                ref={tableRef}
                workspaceId={activeWorkspaceId || ''}
                userId={user?.id || ''}
                selectedFolder={selectedFolder}
                onMetricsChange={handleMetricsChange}
                onManageFolders={() => setFolderManagementDialog(true)}
              />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Add Lead Dialog */}
              <LeadDialog
                open={openDialog}
                onOpenChange={setOpenDialog}
                workspaceId={activeWorkspaceId || ''}
                userId={user?.id || ''}
                onSuccess={() => tableRef.current?.loadLeads()}
              />

      {/* Import Leads Dialog */}
      <ImportLeadsDialog
                open={importDialog}
                onOpenChange={setImportDialog}
                workspaceId={activeWorkspaceId || ''}
                userId={user?.id || ''}
                onSuccess={() => tableRef.current?.loadLeads()}
              />

      {/* Import Customers Dialog */}
      <ImportCustomersDialog
        open={importCustomersDialog}
        onOpenChange={setImportCustomersDialog}
        workspaceId={activeWorkspaceId || ''}
        userId={user?.id || ''}
        onSuccess={() => tableRef.current?.loadLeads()}
      />

      {/* Folder Management Dialog */}
      <FolderManagementDialog
        open={folderManagementDialog}
        onOpenChange={setFolderManagementDialog}
        workspaceId={activeWorkspaceId || ''}
        userId={user?.id || ''}
        onFoldersChanged={handleFoldersChanged}
      />
    </SidebarDemo>
  );
} 