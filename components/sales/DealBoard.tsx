"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Button } from "@/components/ui/button";
import { DealDialog } from "./DealDialog";
import { supabase } from "@/lib/supabase";
import { DollarSign, Loader2, AlertOctagon, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type DealStage = "new" | "contacted" | "proposal" | "negotiation" | "closed_won" | "closed_lost";

interface Deal {
  id: string;
  lead_name: string;
  company: string;
  email: string;
  phone: string;
  value: number;
  stage: DealStage;
  notes: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  user_id: string;
}

const STAGES: { id: DealStage; name: string; color: string }[] = [
  { id: "new", name: "New Leads", color: "bg-blue-500/10 text-blue-400" },
  { id: "contacted", name: "Contacted", color: "bg-purple-500/10 text-purple-400" },
  { id: "proposal", name: "Proposal", color: "bg-yellow-500/10 text-yellow-400" },
  { id: "negotiation", name: "Negotiation", color: "bg-orange-500/10 text-orange-400" },
  { id: "closed_won", name: "Won", color: "bg-green-500/10 text-green-400" },
  { id: "closed_lost", name: "Lost", color: "bg-red-500/10 text-red-400" }
];

const CURRENCIES = [
  { value: "USD", symbol: "$", label: "USD", prefix: true },
  { value: "EUR", symbol: "€", label: "EUR", prefix: true },
  { value: "GBP", symbol: "£", label: "GBP", prefix: true },
  { value: "SEK", symbol: " kr", label: "SEK", prefix: false },
  { value: "JPY", symbol: "¥", label: "JPY", prefix: true },
  { value: "AUD", symbol: "A$", label: "AUD", prefix: true },
  { value: "CAD", symbol: "C$", label: "CAD", prefix: true }
];

interface DealBoardProps {
  workspaceId: string;
  userId: string;
  onMetricsChange?: (metrics: { totalRevenue: number; totalDeals: number }) => void;
}

const formatCurrency = (amount: number, currency: typeof CURRENCIES[0]) => {
  const formattedAmount = amount.toLocaleString();
  return currency.prefix ? `${currency.symbol}${formattedAmount}` : `${formattedAmount}${currency.symbol}`;
};

export function DealBoard({ workspaceId, userId, onMetricsChange }: DealBoardProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  // Memoize the metrics calculation to prevent unnecessary recalculations
  const currentMetrics = useMemo(() => {
    if (deals.length === 0) return { totalRevenue: 0, totalDeals: 0 };
    return {
      totalRevenue: deals.reduce((sum, deal) => sum + deal.value, 0),
      totalDeals: deals.length
    };
  }, [deals]);

  // Update parent component with metrics only when they actually change
  useEffect(() => {
    onMetricsChange?.(currentMetrics);
  }, [currentMetrics.totalRevenue, currentMetrics.totalDeals]);

  const loadDeals = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error("Error loading deals:", error);
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const handleDragStart = (dealId: string) => {
    setDraggedDeal(dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stage: DealStage) => {
    if (!draggedDeal) return;

    const deal = deals.find(d => d.id === draggedDeal);
    if (!deal || deal.stage === stage) return;

    try {
      const { error } = await supabase
        .from("deals")
        .update({ stage, updated_at: new Date().toISOString() })
        .eq("id", draggedDeal);

      if (error) throw error;

      setDeals(deals.map(d => 
        d.id === draggedDeal ? { ...d, stage, updated_at: new Date().toISOString() } : d
      ));
      toast.success("Deal moved successfully");
    } catch (error) {
      console.error("Error moving deal:", error);
      toast.error("Failed to move deal");
    } finally {
      setDraggedDeal(null);
    }
  };

  const calculateStageTotal = (stageId: DealStage) => {
    return deals
      .filter(d => d.stage === stageId)
      .reduce((sum, deal) => sum + deal.value, 0);
  };

  const handleDeleteDeal = async () => {
    if (!dealToDelete) return;
    try {
      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", dealToDelete.id);

      if (error) throw error;
      toast.success(`Deal "${dealToDelete.lead_name}" deleted successfully`);
      setDealToDelete(null);
      loadDeals();
    } catch (error) {
      console.error("Error deleting deal:", error);
      toast.error("Failed to delete deal");
      setDealToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0 mt-8" gradient="blue-purple">
      <div className="relative">
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
        <div className="p-4 border-b border-border flex justify-end relative z-10">
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-muted rounded-lg hover:bg-muted transition-colors duration-300">
        <Select
          value={currency.value}
          onValueChange={(value) => setCurrency(CURRENCIES.find(c => c.value === value) || CURRENCIES[0])}
        >
                <SelectTrigger className="w-32 border-0 bg-transparent text-foreground">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border dark:border-border">
            {CURRENCIES.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-foreground">
                {c.label} ({c.symbol.trim()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-6 gap-4 p-6 h-[calc(100vh-20rem)] overflow-hidden">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter(d => d.stage === stage.id);
          const stageTotal = calculateStageTotal(stage.id);
          
          return (
            <div
              key={stage.id}
              className="flex flex-col h-full"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.id)}
            >
              <div className="flex flex-col gap-2 mb-4">
                <div className={`px-2 py-1 rounded-md text-xs font-medium ${stage.color}`}>
                  {stage.name}
                  <span className="ml-2 opacity-60">
                    {stageDeals.length}
                  </span>
                </div>
                <div className={`px-2 py-1 rounded-md text-xs font-medium ${stage.color} bg-opacity-5`}>
                  <span className="flex items-center gap-1">
                    {currency.prefix && <DollarSign className="h-3 w-3" />}
                    {formatCurrency(stageTotal, currency)}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {stageDeals.map(deal => (
                  <AlertDialog key={deal.id} onOpenChange={(open) => !open && setDealToDelete(null)}>
                      <AnimatedBorderCard
                        className="p-3 bg-muted/50 backdrop-blur-sm border-0 cursor-move hover:bg-muted transition-all group relative"
                        gradient="purple-pink"
                      draggable
                      onDragStart={() => handleDragStart(deal.id)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 p-1 text-foreground0 hover:text-red-600 dark:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { 
                              e.stopPropagation();
                              setDealToDelete(deal);
                          }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      
                        <div className="flex flex-col gap-1 relative z-10" onClick={() => setEditingDeal(deal)}>
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm text-foreground overflow-hidden text-ellipsis whitespace-nowrap pr-6">
                              {deal.lead_name}
                            </h3>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            {deal.company}
                          </div>
                          
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-sm font-medium text-foreground flex items-center">
                              {currency.prefix && <DollarSign className="h-3 w-3 mr-0.5" />}
                              {formatCurrency(deal.value, currency)}
                        </div>
                            
                            <div className="text-xs opacity-70 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(deal.created_at).toLocaleDateString()}
                        </div>
                      </div>
                        </div>
                      </AnimatedBorderCard>
                  </AlertDialog>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
      
      <AlertDialog open={!!dealToDelete} onOpenChange={(open) => !open && setDealToDelete(null)}>
        <AlertDialogContent className="bg-background border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete the deal "{dealToDelete?.lead_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <div className="flex gap-3">
              <div className="group relative overflow-hidden rounded-lg">
                <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                
                <div className="relative z-10 m-[1px] bg-muted rounded-lg hover:bg-muted transition-colors duration-300">
                  <AlertDialogCancel className="border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground">
                    Cancel
                  </AlertDialogCancel>
                </div>
              </div>
              
              <div className="group relative overflow-hidden rounded-lg">
                <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-red-500 via-red-600 to-red-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                
                <div className="relative z-10 m-[1px] bg-muted rounded-lg hover:bg-muted transition-colors duration-300">
                  <AlertDialogAction className="border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground" onClick={handleDeleteDeal}>
                    Delete
                  </AlertDialogAction>
                </div>
              </div>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {editingDeal && (
      <DealDialog
        open={!!editingDeal}
          onOpenChange={(open) => !open && setEditingDeal(null)}
        workspaceId={workspaceId}
        userId={userId}
          initialData={editingDeal}
        onSuccess={() => {
            setEditingDeal(null);
          loadDeals();
        }}
      />
      )}
    </AnimatedBorderCard>
  );
} 