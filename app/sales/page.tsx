"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from '@/lib/auth-client';
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
import { supabase, supabaseAdmin } from "@/lib/supabase";
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
  const { user, session } = useAuth();
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalDeals: 0,
    averageDeal: 0,
    conversionRate: 0,
    monthlyRecurringRevenue: 0,
    annualizedRevenue: 0
  });
  const [currency, setCurrency] = useState({ value: "USD", symbol: "$", label: "USD", prefix: true });
  const [dealDialogOpen, setDealDialogOpen] = useState(false);

  // Format currency values
  const formatCurrency = (amount: number) => {
    const formattedAmount = amount.toLocaleString();
    return currency.prefix ? `${currency.symbol}${formattedAmount}` : `${formattedAmount}${currency.symbol}`;
  };

  const calculateConversionRate = useCallback((totalDeals: number) => {
    // Calculate based on closed won deals vs total deals
    return totalDeals > 0 ? (totalDeals / (totalDeals * 2)) * 100 : 0;
  }, []);

  const handleMetricsChange = useCallback((boardMetrics: { 
    totalRevenue: number; 
    totalDeals: number;
    monthlyRecurringRevenue: number;
    annualizedRevenue: number;
    currency?: { value: string; symbol: string; label: string; prefix: boolean };
  }) => {
    setMetrics(current => ({
      totalRevenue: boardMetrics.totalRevenue,
      totalDeals: boardMetrics.totalDeals,
      averageDeal: boardMetrics.totalDeals > 0 ? boardMetrics.totalRevenue / boardMetrics.totalDeals : 0,
      conversionRate: calculateConversionRate(boardMetrics.totalDeals),
      monthlyRecurringRevenue: boardMetrics.monthlyRecurringRevenue,
      annualizedRevenue: boardMetrics.annualizedRevenue
    }));
    
    // Update currency if provided
    if (boardMetrics.currency) {
      setCurrency(boardMetrics.currency);
    }
  }, [calculateConversionRate]);

  // Load workspaces using API endpoint
  useEffect(() => {
    async function loadWorkspaces() {
      if (!user?.id || !session?.access_token) return;

      try {
        const response = await fetch('/api/workspace/leave', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch workspaces');
        }
        
        const data = await response.json();
        const workspaceData = data.workspaces || [];

        setWorkspaces(workspaceData);
        if (workspaceData?.length > 0 && !activeWorkspace) {
          setActiveWorkspace(workspaceData[0].id);
        }
      } catch (error) {
        console.error("Error loading workspaces:", error);
      }
    }

    loadWorkspaces();
  }, [user?.id, session?.access_token]);

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
      <div className="p-6 flex-1 overflow-auto bg-background">
        <div className="max-w-7xl mx-auto">
          {/* Main content area with the same styling as dashboard */}
          <div className="rounded-xl overflow-hidden relative">
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
              <h1 className="text-3xl font-bold mb-2 text-foreground">
                Sales Pipeline
              </h1>
              <p className="text-muted-foreground">
                Track and manage your deals across different stages
              </p>
                    </div>
                  </div>
            </div>

            <div className="flex items-center gap-4">
                  {/* Workspace Selector with animated border */}
                  <div className="group relative overflow-hidden rounded-lg">
                    <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                    
                    <div className="relative z-10 m-[1px] bg-muted rounded-lg hover:bg-muted/80 transition-colors duration-300">
              <select
                value={activeWorkspace || ""}
                onChange={(e) => setActiveWorkspace(e.target.value)}
                        className="h-10 px-3 text-sm font-medium bg-transparent border-0 rounded-lg text-foreground focus:outline-none focus:ring-0 appearance-none pr-8"
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
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* New Deal Button with animated border */}
                  <div className="group relative overflow-hidden rounded-lg">
                    <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                    
                    <div className="relative z-10 m-[1px] bg-muted rounded-lg hover:bg-muted/80 transition-colors duration-300">
                      <button 
                onClick={() => setDealDialogOpen(true)}
                disabled={!activeWorkspace}
                        className="flex items-center gap-1.5 px-3 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8"
          >
                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0 p-4" gradient="blue-purple">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <DollarSign className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Total Pipeline</p>
                </div>
                <p className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0 p-4" gradient="purple-pink">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <BarChart2 className="h-4 w-4 text-indigo-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Total Deals</p>
                </div>
                <p className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {metrics.totalDeals}
                </p>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0 p-4" gradient="green-blue">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <PieChart className="h-4 w-4 text-cyan-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Average Deal</p>
                </div>
                <p className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatCurrency(metrics.averageDeal)}
                </p>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0 p-4" gradient="orange-red">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
                <p className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {metrics.conversionRate.toFixed(1)}%
                </p>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0 p-4" gradient="green-blue">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Monthly Recurring</p>
                </div>
                <p className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatCurrency(metrics.monthlyRecurringRevenue)}
                </p>
              </div>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0 p-4" gradient="blue-purple">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <BarChart2 className="h-4 w-4 text-indigo-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Annualized Revenue</p>
                </div>
                <p className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatCurrency(metrics.annualizedRevenue)}
                </p>
              </div>
                </AnimatedBorderCard>
          </motion.div>

          {/* Deal Board */}
          {user?.id && activeWorkspace && (
            <>
              <DealBoard
                workspaceId={activeWorkspace}
                userId={user.id}
                onMetricsChange={handleMetricsChange}
              />
              <DealDialog
                open={dealDialogOpen}
                onOpenChange={setDealDialogOpen}
                workspaceId={activeWorkspace}
                userId={user.id}
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