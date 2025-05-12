"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DealForm } from "./DealForm";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onSuccess?: () => void;
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

export function DealDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onSuccess,
  initialData,
}: DealDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-neutral-900 border-neutral-800 text-white p-0 overflow-hidden">
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
          <DialogHeader className="border-b border-neutral-700 p-6 relative z-10">
          <DialogTitle className="text-xl font-semibold text-white">
            {initialData ? "Edit Deal" : "New Deal"}
          </DialogTitle>
            <DialogDescription className="text-neutral-400 mt-1">
              {initialData 
                ? "Update the information for this deal" 
                : "Enter information for your new deal"}
            </DialogDescription>
        </DialogHeader>
          <div className="relative z-10">
        <DealForm
          workspaceId={workspaceId}
          userId={userId}
          initialData={initialData}
          onSuccess={() => {
            onSuccess?.();
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 