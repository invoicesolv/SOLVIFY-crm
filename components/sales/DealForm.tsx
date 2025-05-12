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
              className="block text-sm font-medium text-neutral-200 mb-1"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="company"
              className="block text-sm font-medium text-neutral-200 mb-1"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-200 mb-1"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-neutral-200 mb-1"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="value"
              className="block text-sm font-medium text-neutral-200 mb-1"
            >
              Deal Value
            </label>
            <input
              type="number"
              id="value"
              value={formData.value}
              onChange={(e) =>
                setFormData({ ...formData, value: parseFloat(e.target.value) })
              }
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label
              htmlFor="stage"
              className="block text-sm font-medium text-neutral-200 mb-1"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="block text-sm font-medium text-neutral-200 mb-1"
            >
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-neutral-600 via-neutral-500 to-neutral-600 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                <button
              type="button"
              onClick={onCancel}
              disabled={loading}
                  className="px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
            >
              Cancel
                </button>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white flex items-center gap-2"
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