'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Import constants from the leads page
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

const SERVICE_CATEGORIES = [
  { id: "technical_seo", name: "Technical SEO" },
  { id: "content_seo", name: "Content SEO" },
  { id: "local_seo", name: "Local SEO" },
  { id: "ecommerce_seo", name: "E-commerce SEO" },
  { id: "international_seo", name: "International SEO" },
  { id: "link_building", name: "Link Building" }
];

interface Lead {
  id: string;
  lead_name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  service_category: string;
  website_url: string;
  monthly_traffic: number;
  current_rank: string;
  target_keywords: string[];
  qualification_score: number;
  notes: string;
}

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  initialData?: Partial<Lead>;
  onSuccess: () => void;
}

export function LeadDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  initialData,
  onSuccess,
}: LeadDialogProps) {
  const [formData, setFormData] = useState<Partial<Lead>>(
    initialData || {
      lead_name: "",
      company: "",
      email: "",
      phone: "",
      source: "",
      service_category: "",
      website_url: "",
      monthly_traffic: 0,
      current_rank: "",
      target_keywords: [],
      qualification_score: 5,
      notes: "",
    }
  );

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(initialData || {
      lead_name: "",
      company: "",
      email: "",
      phone: "",
      source: "",
      service_category: "",
      website_url: "",
      monthly_traffic: 0,
      current_rank: "",
      target_keywords: [],
      qualification_score: 5,
      notes: "",
    });
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !userId) return;

    try {
      setLoading(true);

      const data = {
        ...formData,
        workspace_id: workspaceId,
        user_id: userId,
      };

      if (initialData?.id) {
        // Update existing lead
        const { error } = await supabase
          .from("leads")
          .update(data)
          .eq("id", initialData.id);

        if (error) throw error;
        toast.success("Lead updated successfully");
      } else {
        // Create new lead
        const { error } = await supabase
          .from("leads")
          .insert([data]);

        if (error) throw error;
        toast.success("Lead created successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Failed to save lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Lead" : "Add New Lead"}
          </DialogTitle>
          <DialogDescription className="text-foreground dark:text-neutral-300">
            Enter the lead's information and SEO requirements
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead_name" className="text-foreground">Lead Name</Label>
              <Input
                id="lead_name"
                value={formData.lead_name}
                onChange={(e) =>
                  setFormData({ ...formData, lead_name: e.target.value })
                }
                className="bg-background border-border dark:border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="text-foreground">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                className="bg-background border-border dark:border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="bg-background border-border dark:border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="bg-background border-border dark:border-border text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source" className="text-foreground">Lead Source</Label>
              <Select
                value={formData.source}
                onValueChange={(value) =>
                  setFormData({ ...formData, source: value })
                }
              >
                <SelectTrigger className="bg-background border-border dark:border-border text-foreground">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border dark:border-border text-foreground">
                  {LEAD_SOURCES.map((source) => (
                    <SelectItem key={source.id} value={source.id} className="text-foreground hover:text-foreground focus:text-foreground focus:bg-background data-[highlighted]:bg-background data-[highlighted]:text-foreground">
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_category" className="text-foreground">Service Category</Label>
              <Select
                value={formData.service_category}
                onValueChange={(value) =>
                  setFormData({ ...formData, service_category: value })
                }
              >
                <SelectTrigger className="bg-background border-border dark:border-border text-foreground">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border dark:border-border text-foreground">
                  {SERVICE_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-foreground hover:text-foreground focus:text-foreground focus:bg-background data-[highlighted]:bg-background data-[highlighted]:text-foreground">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url" className="text-foreground">Website URL</Label>
            <Input
              id="website_url"
              type="url"
              value={formData.website_url}
              onChange={(e) =>
                setFormData({ ...formData, website_url: e.target.value })
              }
              className="bg-background border-border dark:border-border text-foreground"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly_traffic" className="text-foreground">Monthly Traffic</Label>
              <Input
                id="monthly_traffic"
                type="number"
                value={formData.monthly_traffic}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    monthly_traffic: parseInt(e.target.value) || 0,
                  })
                }
                className="bg-background border-border dark:border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_rank" className="text-foreground">Current Google Ranking</Label>
              <Input
                id="current_rank"
                value={formData.current_rank}
                onChange={(e) =>
                  setFormData({ ...formData, current_rank: e.target.value })
                }
                className="bg-background border-border dark:border-border text-foreground"
                placeholder="e.g., 'Position 15 for main keyword'"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_keywords" className="text-foreground">Target Keywords</Label>
            <Input
              id="target_keywords"
              value={formData.target_keywords?.join(", ")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  target_keywords: e.target.value.split(",").map((k) => k.trim()),
                })
              }
              className="bg-background border-border dark:border-border text-foreground"
              placeholder="Enter keywords separated by commas"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualification_score" className="text-foreground">
              Qualification Score (1-10)
            </Label>
            <Input
              id="qualification_score"
              type="number"
              min="1"
              max="10"
              value={formData.qualification_score}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  qualification_score: parseInt(e.target.value) || 5,
                })
              }
              className="bg-background border-border dark:border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-foreground">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="bg-background border-border dark:border-border text-foreground"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-foreground"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="text-foreground">
              {loading ? "Saving..." : initialData ? "Update Lead" : "Add Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}