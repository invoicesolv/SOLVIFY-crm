'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Grid, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";

interface Lead {
  id: string;
  lead_name: string;
  company: string;
  service_category?: string;
  qualification_score?: number;
  created_at: string;
}

export function RecentLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentLeads = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("leads")
          .select("id, lead_name, company, service_category, qualification_score, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) {
          console.error("Error fetching recent leads:", error);
          return;
        }

        setLeads(data || []);
      } catch (err) {
        console.error("Failed to fetch recent leads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentLeads();
  }, []);

  // Get service category color
  const getServiceCategoryColor = (category?: string) => {
    switch (category) {
      case "technical_seo":
        return "bg-blue-600/20 text-blue-400";
      case "content_seo":
        return "bg-green-600/20 text-green-400";
      case "local_seo":
        return "bg-yellow-600/20 text-yellow-400";
      case "ecommerce_seo":
        return "bg-purple-600/20 text-purple-400";
      case "international_seo":
        return "bg-orange-600/20 text-orange-400";
      case "link_building":
        return "bg-cyan-600/20 text-cyan-400";
      default:
        return "bg-neutral-600/20 text-neutral-400";
    }
  };

  return (
    <Link href="/leads" className="block relative group">
      <span className="absolute right-3 top-3 text-sm font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center">
        View All Leads <ArrowRight className="h-4 w-4 ml-1" />
      </span>
      
      <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[400px]" gradient="green-blue">
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-white">Recent Leads</h3>
            <Grid className="w-6 h-6 text-green-400" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-neutral-400 mb-3">No leads found</p>
              <Link href="/leads">
                <span className="inline-flex items-center px-4 py-2 bg-green-600/20 text-green-400 rounded-md text-sm font-medium hover:bg-green-600/30 transition-colors">
                  Create your first lead <ArrowRight className="h-4 w-4 ml-2" />
                </span>
              </Link>
            </div>
          ) : (
            <div className="space-y-6 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
              {leads.map((lead) => {
                // Check if lead is less than 2 days old
                const isRecent = lead.created_at && 
                  (new Date().getTime() - new Date(lead.created_at).getTime()) < (2 * 24 * 60 * 60 * 1000);
                
                // Format date to just show day and month
                const formattedDate = lead.created_at 
                  ? new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : '';
                
                return (
                  <div key={lead.id} className="flex items-start space-x-4 group">
                    <div className={`flex-shrink-0 p-3 rounded-full ${isRecent ? 'bg-green-600/20' : 'bg-green-500/10'}`}>
                      <Grid className={`w-5 h-5 ${isRecent ? 'text-green-500' : 'text-green-400'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-base font-semibold text-white truncate" title={lead.lead_name}>
                          {lead.lead_name}
                        </h4>
                        <span className="text-xs text-neutral-500 flex-shrink-0 ml-2">{formattedDate}</span>
                      </div>
                      
                      <p className="text-sm font-medium text-neutral-200 truncate" title={lead.company}>
                        {lead.company}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {lead.service_category && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getServiceCategoryColor(lead.service_category)}`}>
                            {lead.service_category.replace('_', ' ')}
                          </span>
                        )}
                        
                        {lead.qualification_score !== undefined && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            lead.qualification_score >= 8 ? 'bg-green-600/20 text-green-400' :
                            lead.qualification_score >= 5 ? 'bg-yellow-600/20 text-yellow-400' :
                            'bg-red-600/20 text-red-400'
                          }`}>
                            Score: {lead.qualification_score}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AnimatedBorderCard>
    </Link>
  );
} 