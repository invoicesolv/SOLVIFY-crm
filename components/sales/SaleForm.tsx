"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface SaleFormProps {
  workspaceId: string;
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: {
    id: string;
    customer_name: string;
    amount: number;
    status: "pending" | "completed" | "cancelled";
  };
}

export function SaleForm({
  workspaceId,
  userId,
  onSuccess,
  onCancel,
  initialData,
}: SaleFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: initialData?.customer_name || "",
    amount: initialData?.amount || 0,
    status: initialData?.status || "pending",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_name || formData.amount <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      if (initialData?.id) {
        // Update existing sale
        const { error } = await supabase
          .from("sales")
          .update({
            customer_name: formData.customer_name,
            amount: formData.amount,
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id);

        if (error) throw error;
        toast.success("Sale updated successfully");
      } else {
        // Create new sale
        const { error } = await supabase.from("sales").insert({
          customer_name: formData.customer_name,
          amount: formData.amount,
          status: formData.status,
          workspace_id: workspaceId,
          user_id: userId,
        });

        if (error) throw error;
        toast.success("Sale created successfully");
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error saving sale:", error);
      toast.error("Failed to save sale");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-background border-border p-6">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="customer_name"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Customer Name
            </label>
            <input
              type="text"
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) =>
                setFormData({ ...formData, customer_name: e.target.value })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Amount
            </label>
            <input
              type="number"
              id="amount"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-800 dark:text-foreground mb-1"
            >
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "pending" | "completed" | "cancelled",
                })
              }
              className="w-full bg-background border border-border dark:border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving..."
                : initialData
                ? "Update Sale"
                : "Create Sale"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
} 