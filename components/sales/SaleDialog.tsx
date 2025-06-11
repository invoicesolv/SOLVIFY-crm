"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SaleForm } from "./SaleForm";

interface SaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onSuccess?: () => void;
  initialData?: {
    id: string;
    customer_name: string;
    amount: number;
    status: "pending" | "completed" | "cancelled";
  };
}

export function SaleDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onSuccess,
  initialData,
}: SaleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {initialData ? "Edit Sale" : "New Sale"}
          </DialogTitle>
        </DialogHeader>
        <SaleForm
          workspaceId={workspaceId}
          userId={userId}
          initialData={initialData}
          onSuccess={() => {
            onSuccess?.();
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
} 