"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { 
  DollarSign, 
  Users, 
  BarChart2, 
  ArrowRight, 
  PieChart,
  Calendar,
  CheckCircle2,
  Plus,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Badge } from "@/components/ui/badge";
import { Glow } from "@/components/ui/glow";
import { MockupFrame } from "@/components/ui/mockup";
import { SaleDialog } from "@/components/sales/SaleDialog";
import { DealDialog } from "@/components/sales/DealDialog";
import { DealBoard } from "@/components/sales/DealBoard";
import { supabase } from "@/lib/supabase";
import { SelectItem } from "@/components/ui/select";
import { SidebarDemo } from "@/components/ui/code.demo";

interface Sale {
  id: string;
  customer_name: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  workspace_id: string;
}

interface TeamMember {
  workspace_id: string;
  workspaces: {
    id: string;
    name: string;
  };
}

export default function SalesPage() {
  const { data: session } = useSession();
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalDeals: 0,
    averageDeal: 0,
    conversionRate: 0
  });
  const [dealDialogOpen, setDealDialogOpen] = useState(false);

  const calculateConversionRate = useCallback((totalDeals: number) => {
    // Calculate based on closed won deals vs total deals
    return totalDeals > 0 ? (totalDeals / (totalDeals * 2)) * 100 : 0;
  }, []);

  const handleMetricsChange = useCallback((boardMetrics: { totalRevenue: number; totalDeals: number }) => {
    setMetrics(current => ({
      totalRevenue: boardMetrics.totalRevenue,
      totalDeals: boardMetrics.totalDeals,
      averageDeal: boardMetrics.totalDeals > 0 ? boardMetrics.totalRevenue / boardMetrics.totalDeals : 0,
      conversionRate: calculateConversionRate(boardMetrics.totalDeals)
    }));
  }, [calculateConversionRate]);

  // Load workspaces
  useEffect(() => {
    async function loadWorkspaces() {
      if (!session?.user?.id) return;

      try {
        const { data: memberships, error: membershipError } = await supabase
          .from("team_members")
          .select("workspace_id, workspaces(id, name)")
          .eq("user_id", session.user.id);

        if (membershipError) throw membershipError;

        const workspaceData = (memberships as TeamMember[] | null)
          ?.map((m) => m.workspaces)
          .filter(Boolean)
          .map((w) => ({
            id: w.id,
            name: w.name,
          })) || [];

        setWorkspaces(workspaceData);
        if (workspaceData?.length > 0 && !activeWorkspace) {
          setActiveWorkspace(workspaceData[0].id);
        }
      } catch (error) {
        console.error("Error loading workspaces:", error);
      }
    }

    loadWorkspaces();
  }, [session?.user?.id]);

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
      <div className="p-6 flex-1 overflow-auto bg-neutral-950">
        <div className="max-w-7xl mx-auto">
          {/* Main content area with the same styling as dashboard */}
          <div className="rounded-xl overflow-hidden relative">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-950 opacity-50"></div>

            {/* Content with proper z-index */}
            <div className="relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex items-center justify-between mb-8"
          >
                <div className="group relative flex-1 mr-4 overflow-hidden rounded-lg">
                  <div className="relative z-10 m-[2px] bg-transparent p-2 rounded-lg">
                    <GlowingEffect 
                      spread={30} 
                      glow={true} 
                      disabled={false} 
                      proximity={60} 
                      inactiveZone={0.01}
                      borderWidth={1.5}
                      movementDuration={1.5}
                      variant="default"
                    />
                    <div className="relative z-20">
              <h1 className="text-3xl font-bold mb-2 text-neutral-100">
                Sales Pipeline
              </h1>
              <p className="text-neutral-400">
                Track and manage your deals across different stages
              </p>
                    </div>
                  </div>
            </div>

            <div className="flex items-center gap-4">
                  {/* Workspace Selector with animated border */}
                  <div className="group relative overflow-hidden rounded-lg">
                    <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                    
                    <div className="relative z-10 m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <select
                value={activeWorkspace || ""}
                onChange={(e) => setActiveWorkspace(e.target.value)}
                        className="h-10 px-3 text-sm font-medium bg-transparent border-0 rounded-lg text-neutral-200 focus:outline-none focus:ring-0 appearance-none pr-8"
              >
                <option value="" disabled>
                  Select Workspace
                </option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-neutral-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* New Deal Button with animated border */}
                  <div className="group relative overflow-hidden rounded-lg">
                    <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                    
                    <div className="relative z-10 m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                      <button 
                onClick={() => setDealDialogOpen(true)}
                disabled={!activeWorkspace}
                        className="flex items-center gap-1.5 px-3 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
              >
                <Plus className="h-4 w-4" />
                New Deal
                      </button>
                    </div>
                  </div>
            </div>
          </motion.div>

          {/* Metrics Grid */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
                <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-0 p-6" gradient="blue-purple">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Total Pipeline</p>
                  <p className="text-xl font-bold text-white">${metrics.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-0 p-6" gradient="purple-pink">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-lg">
                  <BarChart2 className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Total Deals</p>
                  <p className="text-xl font-bold text-white">{metrics.totalDeals}</p>
                </div>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-0 p-6" gradient="green-blue">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-500/10 rounded-lg">
                  <PieChart className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Average Deal</p>
                  <p className="text-xl font-bold text-white">${metrics.averageDeal.toLocaleString()}</p>
                </div>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-neutral-900/50 backdrop-blur-sm border-0 p-6" gradient="orange-red">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Win Rate</p>
                  <p className="text-xl font-bold text-white">{metrics.conversionRate.toFixed(1)}%</p>
                </div>
              </div>
                </AnimatedBorderCard>
          </motion.div>

          {/* Deal Board */}
          {session?.user?.id && activeWorkspace && (
            <>
              <DealBoard
                workspaceId={activeWorkspace}
                userId={session.user.id}
                onMetricsChange={handleMetricsChange}
              />
              <DealDialog
                open={dealDialogOpen}
                onOpenChange={setDealDialogOpen}
                workspaceId={activeWorkspace}
                userId={session.user.id}
                onSuccess={() => setDealDialogOpen(false)}
              />
            </>
          )}
            </div>
          </div>
        </div>
      </div>
    </SidebarDemo>
  );
} 