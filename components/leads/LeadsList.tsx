'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Grid, ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Lead {
  id: string;
  lead_name: string;
  company: string;
  service_category: string;
  qualification_score: number;
  created_at: string;
}

export function LeadsList({ workspaceId }: { workspaceId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchLeads = async () => {
      if (!workspaceId) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('leads')
          .select('id, lead_name, company, service_category, qualification_score, created_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setLeads(data || []);
      } catch (err) {
        console.error('Error fetching leads:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeads();
  }, [workspaceId]);
  
  // Filter leads based on search query
  const filteredLeads = leads.filter(lead => {
    const query = searchQuery.toLowerCase();
    return (
      lead.lead_name?.toLowerCase().includes(query) ||
      lead.company?.toLowerCase().includes(query) ||
      lead.service_category?.toLowerCase().includes(query)
    );
  });
  
  // Get service category color
  const getServiceCategoryColor = (category?: string) => {
    switch (category) {
      case "technical_seo": return "bg-blue-600/20 text-blue-400";
      case "content_seo": return "bg-green-600/20 text-green-400";
      case "local_seo": return "bg-yellow-600/20 text-yellow-400";
      case "ecommerce_seo": return "bg-purple-600/20 text-purple-400";
      case "international_seo": return "bg-orange-600/20 text-orange-400";
      case "link_building": return "bg-cyan-600/20 text-cyan-400";
      default: return "bg-gray-300 dark:bg-muted-foreground/20 text-muted-foreground";
    }
  };
  
  return (
    <Card className="bg-background/50 backdrop-blur-sm border-border p-6">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Recent Leads</h2>
          <p className="text-sm text-muted-foreground">Manage and qualify your potential clients</p>
        </div>
        
        <div className="flex w-full sm:w-auto gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground0" />
            <Input 
              type="text"
              placeholder="Search leads..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border dark:border-border text-foreground w-full"
            />
          </div>
          
          <Link href="/leads">
            <Button className="bg-blue-600 hover:bg-blue-700 text-foreground">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border dark:border-border rounded-lg">
          <Grid className="h-12 w-12 mx-auto text-foreground0 mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No leads found</h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery ? 'No leads match your search query' : 'Start by adding your first lead'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLeads.map(lead => {
            // Check if lead is less than 2 days old
            const isRecent = lead.created_at && 
              (new Date().getTime() - new Date(lead.created_at).getTime()) < (2 * 24 * 60 * 60 * 1000);
              
            return (
              <Link key={lead.id} href={`/leads/${lead.id}`}>
                <div className="group bg-background hover:bg-neutral-750 border border-border dark:border-border hover:border-gray-400 dark:border-border rounded-lg p-5 transition-all duration-200 h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${isRecent ? 'bg-green-600/20' : 'bg-gray-200 dark:bg-muted/30'} rounded-lg`}>
                      <Grid className={`h-5 w-5 ${isRecent ? 'text-green-400' : 'text-muted-foreground'}`} />
                    </div>
                    
                    {isRecent && (
                      <Badge className="bg-green-600/20 text-green-400 group-hover:bg-green-600/30">
                        New
                      </Badge>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-foreground mb-2 truncate" title={lead.lead_name}>
                    {lead.lead_name}
                  </h3>
                  
                  <p className="text-base text-foreground mb-4 truncate" title={lead.company}>
                    {lead.company}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border dark:border-border">
                    {lead.service_category && (
                      <Badge className={getServiceCategoryColor(lead.service_category)}>
                        {lead.service_category.replace('_', ' ')}
                      </Badge>
                    )}
                    
                    {lead.qualification_score !== undefined && (
                      <Badge className={lead.qualification_score >= 8 ? "bg-green-600/20 text-green-400" :
                                         lead.qualification_score >= 5 ? "bg-yellow-600/20 text-yellow-400" :
                                         "bg-red-600/20 text-red-400"}>
                        Score: {lead.qualification_score}
                      </Badge>
                    )}
                    
                    <Badge className="bg-gray-300 dark:bg-muted-foreground/20 text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
} 