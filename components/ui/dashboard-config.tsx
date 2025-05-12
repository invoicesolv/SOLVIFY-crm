"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Plus, Settings } from "lucide-react";
import { toast } from "sonner";

// Data source constants
export const DATA_SOURCES = {
  REVENUE: "revenue",
  INVOICES: "invoices",
  LEADS: "leads",
  SALES: "sales",
};

// Widget type constants
export const WIDGET_TYPES = {
  STAT: "stat",
  LIST: "list",
  CHART: "chart",
};

// Metrics available for each data source
export const DATA_SOURCE_METRICS = {
  [DATA_SOURCES.REVENUE]: [
    { id: "total_revenue", name: "Total Revenue" },
    { id: "average_deal_size", name: "Average Deal Size" },
    { id: "revenue_growth", name: "Revenue Growth %" },
  ],
  [DATA_SOURCES.INVOICES]: [
    { id: "invoice_count", name: "Invoice Count" },
    { id: "unpaid_invoices", name: "Unpaid Invoices" },
    { id: "average_time_to_pay", name: "Average Time to Pay" },
  ],
  [DATA_SOURCES.LEADS]: [
    { id: "lead_count", name: "Lead Count" },
    { id: "conversion_rate", name: "Conversion Rate" },
    { id: "lead_sources", name: "Lead Sources" },
  ],
  [DATA_SOURCES.SALES]: [
    { id: "deals_closed", name: "Deals Closed" },
    { id: "win_rate", name: "Win Rate" },
    { id: "sales_cycle", name: "Sales Cycle Length" },
  ],
};

// Default widget configuration
export const DEFAULT_WIDGETS: Widget[] = [
  {
    id: "1",
    type: WIDGET_TYPES.STAT,
    title: "Total Revenue",
    dataSource: DATA_SOURCES.REVENUE,
    metric: "total_revenue",
    size: "medium" as const,
  },
  {
    id: "2",
    type: WIDGET_TYPES.LIST,
    title: "Recent Invoices",
    dataSource: DATA_SOURCES.INVOICES,
    metric: "invoice_count",
    size: "large" as const,
  },
  {
    id: "3",
    type: WIDGET_TYPES.STAT,
    title: "New Leads",
    dataSource: DATA_SOURCES.LEADS,
    metric: "lead_count",
    size: "small" as const,
  },
];

interface Widget {
  id: string;
  type: string;
  title: string;
  dataSource: string;
  metric: string;
  size: "small" | "medium" | "large";
}

interface DashboardConfigProps {
  workspaceId: string;
  className?: string;
}

export function DashboardConfig({ workspaceId, className }: DashboardConfigProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const supabase = createClientComponentClient();

  // Fetch user's dashboard configuration
  useEffect(() => {
    async function fetchDashboardConfig() {
      try {
        setIsLoading(true);
        
        const { data: session } = await supabase.auth.getSession();
        
        if (!session.session) {
          throw new Error("Not authenticated");
        }
        
        const { data, error } = await supabase
          .from("dashboard_config")
          .select("widgets")
          .eq("workspace_id", workspaceId)
          .eq("user_id", session.session.user.id)
          .single();
        
        if (error && error.code !== "PGRST116") { // PGRST116 is "no rows returned" error
          throw error;
        }
        
        if (data) {
          setWidgets(data.widgets);
        } else {
          // If no configuration exists, create one with default widgets
          await saveDashboardConfig(DEFAULT_WIDGETS);
          setWidgets(DEFAULT_WIDGETS);
        }
      } catch (error) {
        console.error("Error fetching dashboard config:", error);
        toast.error("Failed to load dashboard configuration");
      } finally {
        setIsLoading(false);
      }
    }
    
    if (workspaceId) {
      fetchDashboardConfig();
    }
  }, [workspaceId, supabase]);

  // Save dashboard configuration to database
  async function saveDashboardConfig(widgetsToSave: Widget[]) {
    try {
      setIsSaving(true);
      
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        throw new Error("Not authenticated");
      }
      
      const { error } = await supabase
        .from("dashboard_config")
        .upsert({
          user_id: session.session.user.id,
          workspace_id: workspaceId,
          widgets: widgetsToSave,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,workspace_id" });
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error("Error saving dashboard config:", error);
      toast.error("Failed to save dashboard configuration");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  // Add a new widget
  function addWidget() {
    const newWidget: Widget = {
      id: crypto.randomUUID(),
      type: WIDGET_TYPES.STAT,
      title: "New Widget",
      dataSource: DATA_SOURCES.REVENUE,
      metric: "total_revenue",
      size: "medium",
    };
    
    setCurrentWidget(newWidget);
    setIsEditing(false);
    setIsDialogOpen(true);
  }

  // Edit an existing widget
  function editWidget(widget: Widget) {
    setCurrentWidget({ ...widget });
    setIsEditing(true);
    setIsDialogOpen(true);
  }

  // Save the current widget being edited or added
  async function saveWidget() {
    if (!currentWidget) return;
    
    let updatedWidgets;
    
    if (isEditing) {
      // Update existing widget
      updatedWidgets = widgets.map(w => 
        w.id === currentWidget.id ? currentWidget : w
      );
    } else {
      // Add new widget
      updatedWidgets = [...widgets, currentWidget];
    }
    
    const success = await saveDashboardConfig(updatedWidgets);
    
    if (success) {
      setWidgets(updatedWidgets);
      setIsDialogOpen(false);
      toast.success(isEditing ? "Widget updated" : "Widget added");
    }
  }

  // Remove a widget
  async function removeWidget(widgetId: string) {
    const updatedWidgets = widgets.filter(w => w.id !== widgetId);
    const success = await saveDashboardConfig(updatedWidgets);
    
    if (success) {
      setWidgets(updatedWidgets);
      toast.success("Widget removed");
    }
  }

  // Handle metric change based on selected data source
  function handleDataSourceChange(dataSource: string) {
    if (currentWidget) {
      const metrics = DATA_SOURCE_METRICS[dataSource];
      setCurrentWidget({
        ...currentWidget,
        dataSource,
        metric: metrics[0]?.id || "",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Dashboard Configuration</h2>
        <Button onClick={addWidget} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" /> Add Widget
        </Button>
      </div>
      
      {widgets.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted/10">
          <p className="text-muted-foreground">No widgets configured. Add your first widget to customize your dashboard.</p>
          <Button onClick={addWidget} className="mt-4">
            <Plus className="h-4 w-4 mr-2" /> Add Widget
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {widgets.map((widget) => (
            <div key={widget.id} className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <h3 className="font-medium">{widget.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {widget.type.charAt(0).toUpperCase() + widget.type.slice(1)} • {widget.size.charAt(0).toUpperCase() + widget.size.slice(1)}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button onClick={() => editWidget(widget)} size="sm" variant="ghost">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button onClick={() => removeWidget(widget.id)} size="sm" variant="ghost" className="text-destructive">
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Widget" : "Add Widget"}</DialogTitle>
            <DialogDescription>
              Configure how this widget will appear on your dashboard.
            </DialogDescription>
          </DialogHeader>
          
          {currentWidget && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Widget Title</Label>
                <Input
                  id="title"
                  value={currentWidget.title}
                  onChange={(e) => setCurrentWidget({ ...currentWidget, title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Widget Type</Label>
                <Select
                  value={currentWidget.type}
                  onValueChange={(value) => setCurrentWidget({ ...currentWidget, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WIDGET_TYPES.STAT}>Statistic</SelectItem>
                    <SelectItem value={WIDGET_TYPES.LIST}>List</SelectItem>
                    <SelectItem value={WIDGET_TYPES.CHART}>Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dataSource">Data Source</Label>
                <Select
                  value={currentWidget.dataSource}
                  onValueChange={handleDataSourceChange}
                >
                  <SelectTrigger id="dataSource">
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DATA_SOURCES.REVENUE}>Revenue</SelectItem>
                    <SelectItem value={DATA_SOURCES.INVOICES}>Invoices</SelectItem>
                    <SelectItem value={DATA_SOURCES.LEADS}>Leads</SelectItem>
                    <SelectItem value={DATA_SOURCES.SALES}>Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="metric">Metric</Label>
                <Select
                  value={currentWidget.metric}
                  onValueChange={(value) => setCurrentWidget({ ...currentWidget, metric: value })}
                >
                  <SelectTrigger id="metric">
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCE_METRICS[currentWidget.dataSource].map((metric) => (
                      <SelectItem key={metric.id} value={metric.id}>
                        {metric.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="size">Widget Size</Label>
                <Select
                  value={currentWidget.size}
                  onValueChange={(value) => setCurrentWidget({ ...currentWidget, size: value as "small" | "medium" | "large" })}
                >
                  <SelectTrigger id="size">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={saveWidget} 
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 