"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface DealFormProps {
  workspaceId: string;
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: {
    id: string;
    lead_name: string;
    company: string;
    email: string;
    phone: string;
    value: number;
    stage: "new" | "contacted" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
    notes: string;
    deal_type: "one_time" | "retainer";
    retainer_duration_months?: number;
    retainer_start_date?: string;
  };
}

export function DealForm({
  workspaceId,
  userId,
  onSuccess,
  onCancel,
  initialData,
}: DealFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lead_name: initialData?.lead_name || "",
    company: initialData?.company || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    value: initialData?.value || 0,
    stage: initialData?.stage || "new",
    notes: initialData?.notes || "",
    deal_type: initialData?.deal_type || "one_time",
    retainer_duration_months: initialData?.retainer_duration_months || 12,
    retainer_start_date: initialData?.retainer_start_date || new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.lead_name || !formData.company || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      if (initialData?.id) {
        // Update existing deal
        const { error } = await supabase
          .from("deals")
          .update({
            lead_name: formData.lead_name,
            company: formData.company,
            email: formData.email,
            phone: formData.phone,
            value: formData.value,
            stage: formData.stage,
            notes: formData.notes,
            deal_type: formData.deal_type,
            retainer_duration_months: formData.deal_type === 'retainer' ? formData.retainer_duration_months : null,
            retainer_start_date: formData.deal_type === 'retainer' ? formData.retainer_start_date : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id);

        if (error) throw error;
        toast.success("Deal updated successfully");
      } else {
        // Create new deal
        const { error } = await supabase.from("deals").insert({
          lead_name: formData.lead_name,
          company: formData.company,
          email: formData.email,
          phone: formData.phone,
          value: formData.value,
          stage: formData.stage,
          notes: formData.notes,
          deal_type: formData.deal_type,
          retainer_duration_months: formData.deal_type === 'retainer' ? formData.retainer_duration_months : null,
          retainer_start_date: formData.deal_type === 'retainer' ? formData.retainer_start_date : null,
          workspace_id: workspaceId,
          user_id: userId,
        });

        if (error) throw error;
        toast.success("Deal created successfully");
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error saving deal:", error);
      toast.error("Failed to save deal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="lead_name"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Lead Name *
            </label>
            <input
              type="text"
              id="lead_name"
              value={formData.lead_name}
              onChange={(e) =>
                setFormData({ ...formData, lead_name: e.target.value })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="company"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Company *
            </label>
            <input
              type="text"
              id="company"
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Email *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="deal_type"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Deal Type
            </label>
            <select
              id="deal_type"
              value={formData.deal_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  deal_type: e.target.value as "one_time" | "retainer",
                })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="one_time">One-time Deal</option>
              <option value="retainer">Monthly Retainer</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="value"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              {formData.deal_type === 'retainer' ? 'Monthly Retainer Amount' : 'Deal Value'}
            </label>
            <input
              type="number"
              id="value"
              value={formData.value}
              onChange={(e) =>
                setFormData({ ...formData, value: parseFloat(e.target.value) })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.01"
            />
          </div>

          {formData.deal_type === 'retainer' && (
            <>
              <div>
                <label
                  htmlFor="retainer_duration_months"
                  className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
                >
                  Retainer Duration (Months)
                </label>
                <input
                  type="number"
                  id="retainer_duration_months"
                  value={formData.retainer_duration_months}
                  onChange={(e) =>
                    setFormData({ ...formData, retainer_duration_months: parseInt(e.target.value) })
                  }
                  className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="60"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total value: ${(formData.value * formData.retainer_duration_months).toLocaleString()}
                </p>
              </div>

              <div>
                <label
                  htmlFor="retainer_start_date"
                  className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
                >
                  Retainer Start Date
                </label>
                <input
                  type="date"
                  id="retainer_start_date"
                  value={formData.retainer_start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, retainer_start_date: e.target.value })
                  }
                  className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="stage"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Stage
            </label>
            <select
              id="stage"
              value={formData.stage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stage: e.target.value as any,
                })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-neutral-600 via-neutral-500 to-neutral-600 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                <button
              type="button"
              onClick={onCancel}
              disabled={loading}
                  className="px-4 py-2 border-0 bg-transparent text-gray-800 dark:text-foreground hover:bg-transparent hover:text-foreground"
            >
              Cancel
                </button>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border-0 bg-transparent text-gray-800 dark:text-foreground hover:bg-transparent hover:text-foreground flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : initialData?.id ? "Update Deal" : "Create Deal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
} 