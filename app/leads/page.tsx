'use client';

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { 
  Users, 
  Filter,
  ArrowRight,
  Plus,
  FileSpreadsheet,
  MoveRight,
  Tags,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Glow } from "@/components/ui/glow";
import { SidebarDemo } from "@/components/ui/code.demo";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadDialog } from "@/components/leads/LeadDialog";
import { ImportCustomersDialog } from "@/components/leads/ImportCustomersDialog";
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

interface Workspace {
    id: string;
    name: string;
}

export default function LeadsPage() {
  const { data: session } = useSession();
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const tableRef = useRef<{ loadLeads: () => Promise<void> }>(null);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    newLeadsToday: 0,
    conversionRate: 0,
    averageQualificationScore: 0
  });

  // Load workspace data
  useEffect(() => {
    const loadWorkspace = async () => {
      if (!session?.user?.id) return;

      try {
        setLoadingWorkspace(true);
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("workspace_id")
          .eq("user_id", session.user.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          console.error("Error loading profile:", profileError);
          return;
        }

        let workspaceId = profileData?.workspace_id;

        if (!workspaceId) {
          // If no workspace set, use first available or create one
          const { data: teamData, error: teamError } = await supabase
          .from("team_members")
            .select(`
              workspace_id,
              workspaces:workspace_id (
                id,
                name
              )
            `)
          .eq("user_id", session.user.id);

          if (teamError) {
            console.error("Error loading team data:", teamError);
            return;
          }

          const workspaceData = teamData?.map(item => item.workspaces) || [];
          setWorkspaces(workspaceData);
          
          if (workspaceData?.length > 0) {
            workspaceId = workspaceData[0].id;
            setWorkspace(workspaceId);
          }
        } else {
          // Get the workspace name
          const { data: workspaceData, error: workspaceError } = await supabase
            .from("workspaces")
            .select("id, name")
            .eq("id", workspaceId);

          if (workspaceError) {
            console.error("Error loading workspace:", workspaceError);
            return;
          }

          setWorkspaces(workspaceData || []);
          setWorkspace(workspaceId);
        }
      } catch (error) {
        console.error("Error loading workspaces:", error);
      } finally {
        setLoadingWorkspace(false);
      }
    };

    loadWorkspace();
  }, [session?.user?.id]);

  const handleMetricsChange = (newMetrics: typeof metrics) => {
    setMetrics(newMetrics);
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
      <div className="min-h-screen bg-neutral-950 text-white p-8">
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
              <h1 className="text-3xl font-bold mb-2 text-neutral-100">
                Lead Management
              </h1>
              <p className="text-neutral-400">
                Track and qualify your SEO leads
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Workspace Selector */}
              {workspaces.length > 0 && (
              <select
                  value={workspace || ""}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                  <option value="" disabled className="text-white bg-neutral-900">
                  Select Workspace
                </option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id} className="text-white bg-neutral-900">
                      {ws.name}
                  </option>
                ))}
              </select>
              )}

              <Button 
                className="flex items-center gap-2"
                onClick={() => setImportDialog(true)}
                disabled={!workspace}
              >
                <UserPlus className="h-4 w-4" />
                Import Customers
              </Button>

              <Button 
                className="flex items-center gap-2"
                onClick={() => setOpenDialog(true)}
                disabled={!workspace}
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
            <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-neutral-800 p-6 relative group" gradient="blue-purple">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Total Leads</p>
                  <p className="text-xl font-bold text-white">{metrics.totalLeads}</p>
                </div>
              </div>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-neutral-800 p-6 relative group" gradient="green-blue">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <ArrowRight className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">New Today</p>
                  <p className="text-xl font-bold text-white">{metrics.newLeadsToday}</p>
                </div>
              </div>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-neutral-800 p-6 relative group" gradient="purple-pink">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <MoveRight className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Conversion Rate</p>
                  <p className="text-xl font-bold text-white">{metrics.conversionRate}%</p>
                </div>
              </div>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-neutral-800 p-6 relative group" gradient="orange-red">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <Tags className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Avg. Quality Score</p>
                  <p className="text-xl font-bold text-white">{metrics.averageQualificationScore}</p>
                </div>
              </div>
            </AnimatedBorderCard>
          </motion.div>

          {/* Service Category Filters */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex flex-wrap gap-2 mb-6"
          >
            {SERVICE_CATEGORIES.map((category) => (
              <Badge
                key={category.id}
                className={`px-3 py-1.5 cursor-pointer ${category.color}`}
                variant="outline"
              >
                {category.name}
              </Badge>
            ))}
          </motion.div>

          {/* Leads Table */}
          {session?.user?.id && workspace && (
            <>
              <LeadTable
                ref={tableRef}
                workspaceId={workspace}
                userId={session.user.id}
                onMetricsChange={handleMetricsChange}
              />
              <LeadDialog
                open={openDialog}
                onOpenChange={setOpenDialog}
                workspaceId={workspace}
                userId={session.user.id}
                onSuccess={() => {
                  setOpenDialog(false);
                  if (tableRef.current) {
                    tableRef.current.loadLeads();
                  }
                }}
              />
              <ImportCustomersDialog
                open={importDialog}
                onOpenChange={setImportDialog}
                workspaceId={workspace}
                userId={session.user.id}
                onSuccess={() => {
                  setImportDialog(false);
                  if (tableRef.current) {
                    tableRef.current.loadLeads();
                  }
                }}
              />
            </>
          )}
        </div>
      </div>
    </SidebarDemo>
  );
} 