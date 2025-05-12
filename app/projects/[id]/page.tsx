"use client";

import { useEffect, useState } from "react";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar as CalendarIcon, Save, FileText, Plus, Loader2, AlertCircle, ExternalLink, User, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { TaskManager } from "@/components/projects/TaskManager";
import type { Project, Task } from "@/types/project";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useProjectAssignments } from "@/hooks/useProjectAssignments";

interface Invoice {
  id: string;
  document_number: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  total: number;
  status: string;
  project_id?: string;
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [savingDates, setSavingDates] = useState(false);
  const [linkedInvoices, setLinkedInvoices] = useState<Invoice[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [assigningUser, setAssigningUser] = useState(false);
  const { members } = useWorkspaceMembers();
  const { assignProject, getMemberByUserId } = useProjectAssignments();
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchProjectDetails() {
      if (!session?.user?.id) {
        console.log('No user session found, cannot fetch project details');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching project details for user ID:', session.user.id, 'project ID:', params.id);
        
        // Fetch project from Supabase
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', session.user.id)
          .single();

        if (projectError) {
          console.error('Error fetching project:', projectError);
          throw projectError;
        }

        // Fetch project tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('project_tasks')
          .select('*')
          .eq('project_id', params.id)
          .eq('user_id', session.user.id);

        if (tasksError) {
          console.error('Error fetching project tasks:', tasksError);
          throw tasksError;
        }

        // Format date strings properly 
        let formattedStartDate = projectData.start_date ? new Date(projectData.start_date) : null;
        let formattedEndDate = projectData.end_date ? new Date(projectData.end_date) : null;
        
        console.log('Raw start_date from DB:', projectData.start_date);
        console.log('Raw end_date from DB:', projectData.end_date);
        console.log('Parsed start date:', formattedStartDate);
        console.log('Parsed end date:', formattedEndDate);

        // Format the project data
        const formattedProject = {
          ...projectData,
          tasks: tasksData || [],
          status: (projectData.status?.toLowerCase() || 'active') as 'active' | 'completed' | 'on-hold',
          startDate: projectData.start_date || null,
          endDate: projectData.end_date || null,
          customerName: projectData.customer_name || 'Unknown Customer',
          customerId: projectData.customer_id,
          assigned_to: projectData.assigned_to
        };

        console.log('Fetched project:', formattedProject.name, 'with', formattedProject.tasks.length, 'tasks', 
                    'assigned to:', formattedProject.assigned_to || 'No one');
        setProject(formattedProject);
        
        // Set the date states for editing - ensure proper format for the date inputs (YYYY-MM-DD)
        if (formattedProject.startDate) {
          try {
            const date = new Date(formattedProject.startDate);
            if (!isNaN(date.getTime())) {
              setStartDate(date.toISOString().split('T')[0]);
              console.log('Setting start date input to:', date.toISOString().split('T')[0]);
            } else {
              console.warn('Invalid start date:', formattedProject.startDate);
              setStartDate('');
            }
          } catch (e) {
            console.error('Error formatting start date:', e);
            setStartDate('');
          }
        }
        
        if (formattedProject.endDate) {
          try {
            const date = new Date(formattedProject.endDate);
            if (!isNaN(date.getTime())) {
              setEndDate(date.toISOString().split('T')[0]);
              console.log('Setting end date input to:', date.toISOString().split('T')[0]);
            } else {
              console.warn('Invalid end date:', formattedProject.endDate);
              setEndDate('');
            }
          } catch (e) {
            console.error('Error formatting end date:', e);
            setEndDate('');
          }
        }
      } catch (err) {
        console.error('Error in fetchProjectDetails:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch project details'));
      } finally {
        setLoading(false);
      }
    }

    fetchProjectDetails();
  }, [params.id, session?.user?.id]);

  useEffect(() => {
    if (project?.id && session?.user?.id) {
      fetchLinkedInvoices();
    }
  }, [project?.id, session?.user?.id]);

  const fetchLinkedInvoices = async () => {
    setLoadingInvoices(true);
    try {
      if (!project) return;
      
      const { data, error } = await supabase
        .from('project_invoice_links')
        .select('invoice_id')
        .eq('project_id', project.id);
      
      if (error) {
        console.error('Error fetching invoice links:', error);
        toast.error('Failed to load linked invoices');
        setLoadingInvoices(false);
        return;
      }
      
      if (!data || data.length === 0) {
        setLinkedInvoices([]);
        setLoadingInvoices(false);
        return;
      }
      
      const invoiceIds = data.map(link => link.invoice_id);
      
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .in('id', invoiceIds);
      
      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        toast.error('Failed to load invoices');
        setLoadingInvoices(false);
        return;
      }
      
      // Format invoice data to match the Invoice interface
      const formattedInvoices = invoicesData.map(invoice => ({
        id: invoice.id,
        document_number: invoice.document_number || '',
        invoice_number: invoice.invoice_number || invoice.document_number || `Invoice-${invoice.id.substring(0, 8)}`,
        customer_name: invoice.customer_name || 'Customer',
        invoice_date: invoice.invoice_date || invoice.created_at || new Date().toISOString(),
        due_date: invoice.due_date || new Date().toISOString(),
        total: invoice.total ? parseFloat(invoice.total) : 0,
        status: invoice.status || 'pending',
        project_id: project.id
      }));
      
      setLinkedInvoices(formattedInvoices);
    } catch (error) {
      console.error('Error in fetchLinkedInvoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };
  
  const fetchAvailableInvoices = async () => {
    if (!project?.id || !session?.user?.id) {
      console.error("Missing project ID or user ID for invoice fetch");
      return;
    }
    
    setLoadingInvoices(true);
    try {
      console.log("Fetching available invoices for project:", project.id);
      
      // Get customer ID matching this project's customer, if any
      let query = supabase
        .from('invoices')
        .select('*')
        .is('project_id', null) // Only get unlinked invoices
        .order('invoice_date', { ascending: false });
      
      // Filter by the current project's customer if available
      if (project.customerId) {
        console.log("Filtering by customer ID:", project.customerId);
        query = query.eq('customer_id', project.customerId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Supabase error fetching invoices:", error);
        throw error;
      }
      
      console.log("Fetched available invoices:", data?.length || 0);
      setAvailableInvoices(data || []);
    } catch (error) {
      console.error('Error fetching available invoices:', error);
      toast.error('Failed to load available invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };
  
  const handleLinkInvoice = async (invoiceId: string) => {
    if (!project?.id || !session?.user?.id) return;
    
    try {
      // Update the invoice to link it to this project
      const { error } = await supabase
        .from('invoices')
        .update({ project_id: project.id })
        .eq('id', invoiceId);
      
      if (error) throw error;
      
      toast.success('Invoice linked to project');
      
      // Refresh lists
      fetchLinkedInvoices();
      fetchAvailableInvoices();
    } catch (error) {
      console.error('Error linking invoice:', error);
      toast.error('Failed to link invoice');
    }
  };
  
  const handleUnlinkInvoice = async (invoiceId: string) => {
    if (!project?.id || !session?.user?.id) return;
    
    try {
      // Update the invoice to unlink it from this project
      const { error } = await supabase
        .from('invoices')
        .update({ project_id: null })
        .eq('id', invoiceId);
      
      if (error) throw error;
      
      toast.success('Invoice unlinked from project');
      
      // Refresh lists
      fetchLinkedInvoices();
    } catch (error) {
      console.error('Error unlinking invoice:', error);
      toast.error('Failed to unlink invoice');
    }
  };

  const handleTasksChange = async (tasks: Task[]) => {
    if (!project || !session?.user?.id) return;

    try {
      // Update tasks in Supabase
      for (const task of tasks) {
        const { error } = await supabase
          .from('project_tasks')
          .upsert({
            ...task,
            project_id: project.id,
            user_id: session.user.id
          });

        if (error) throw error;
      }
      
      setProject({ ...project, tasks });
      toast.success('Tasks updated successfully');
    } catch (error) {
      console.error('Error updating tasks:', error);
      toast.error('Failed to update tasks');
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    if (!project || !session?.user?.id) return;

    try {
      // Update task in Supabase
      const { error } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      const updatedTasks = project.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      );

      setProject({ ...project, tasks: updatedTasks });
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleChecklistItemUpdate = async (taskId: string, itemId: number, isDone: boolean) => {
    if (!project || !session?.user?.id) return;

    const updatedTasks = project.tasks.map(task => {
      if (task.id === taskId) {
        const updatedChecklist = task.checklist.map(item =>
          item.id === itemId ? { ...item, done: isDone } : item
        );
        return {
          ...task,
          checklist: updatedChecklist,
          progress: Math.round((updatedChecklist.filter(item => item.done).length / updatedChecklist.length) * 100)
        };
      }
      return task;
    });

    try {
      // Get the updated task
      const updatedTask = updatedTasks.find(task => task.id === taskId);
      if (!updatedTask) return;

      // Update task in Supabase
      const { error } = await supabase
        .from('project_tasks')
        .update({
          checklist: updatedTask.checklist,
          progress: updatedTask.progress
        })
        .eq('id', taskId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setProject({ ...project, tasks: updatedTasks });
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast.error('Failed to update checklist item');
    }
  };

  const handleSaveDates = async () => {
    if (!project || !session?.user?.id) return;
    
    setSavingDates(true);
    try {
      console.log('Saving project dates:', { startDate, endDate });
      
      if (!startDate) {
        toast.error('Start date is required');
        setSavingDates(false);
        return;
      }
      
      // Update project dates in Supabase
      const { error } = await supabase
        .from('projects')
        .update({
          start_date: startDate,
          end_date: endDate || null // Handle empty end date
        })
        .eq('id', project.id)
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Update local state
      setProject({
        ...project,
        startDate: startDate,
        endDate: endDate || undefined // Use undefined instead of null for TS compatibility
      });

      console.log('Successfully updated project dates in database');
      
      // Get workspace_id (always fetch it to be safe since it's not in the Project type)
      const workspace_id = await getWorkspaceId();
      
      // Sync with calendar events - first check if an event already exists for this project
      try {
        console.log('Syncing with calendar - checking for existing events');
        const { data: existingEvents, error: fetchError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('project_id', project.id);
          
        if (fetchError) {
          console.error('Error checking for existing calendar events:', fetchError);
          throw fetchError;
        }
        
        console.log('Found existing calendar events:', existingEvents?.length || 0);
        
        const calendarEvent = {
          title: `Project: ${project.name}`,
          start_time: startDate,
          end_time: endDate || startDate, // Use start date as fallback if no end date
          user_id: session.user.id,
          project_id: project.id,
          is_synced: true,
          workspace_id: workspace_id
        };
        
        console.log('Calendar event data to save:', calendarEvent);
        
        // If event exists, update it; otherwise create new
        if (existingEvents && existingEvents.length > 0) {
          console.log('Updating existing calendar event with ID:', existingEvents[0].id);
          const { error: updateError } = await supabase
            .from('calendar_events')
            .update(calendarEvent)
            .eq('id', existingEvents[0].id);
            
          if (updateError) {
            console.error('Error updating calendar event:', updateError);
            throw updateError;
          }
          
          console.log('Successfully updated calendar event');
        } else {
          console.log('Creating new calendar event for project');
          const { error: insertError } = await supabase
            .from('calendar_events')
            .insert([{
              id: crypto.randomUUID(), // Generate a UUID for the new event
              ...calendarEvent
            }]);
            
          if (insertError) {
            console.error('Error creating calendar event:', insertError);
            throw insertError;
          }
          
          console.log('Successfully created new calendar event');
        }
        
        toast.success('Project dates updated and synced with calendar');
      } catch (calendarError) {
        console.error('Error syncing with calendar:', calendarError);
        // Don't fail the whole operation if calendar sync fails
        toast.success('Project dates updated, but calendar sync failed');
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating project dates:', error);
      toast.error('Failed to update project dates');
    } finally {
      setSavingDates(false);
    }
  };

  // Helper function to get workspace_id if not in project
  const getWorkspaceId = async (): Promise<string> => {
    try {
      // Try to get workspace from team_members
      const { data, error } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session?.user?.id!)
        .limit(1)
        .single();
        
      if (error) throw error;
      
      return data.workspace_id;
    } catch (err) {
      console.error('Error getting workspace ID:', err);
      return ''; // Return empty string as fallback
    }
  };

  const getAssignedMemberName = (userId?: string) => {
    if (!userId) return null;
    const member = getMemberByUserId(userId);
    return member ? member.name : null;
  };

  const handleAssignProject = async (userId?: string) => {
    if (!project?.id) return;
    
    setAssigningUser(true);
    try {
      await assignProject(project.id, userId || '');
      
      // Update local state
      setProject({
        ...project,
        assigned_to: userId
      });
      
      toast.success(userId ? 'Project assigned successfully' : 'Project unassigned');
    } catch (error) {
      console.error('Error assigning project:', error);
      toast.error('Failed to assign project');
    } finally {
      setAssigningUser(false);
    }
  };

  // Format currency to SEK
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} SEK`;
  };

  // Get status display for invoices
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { text: string, className: string }> = {
      "ongoing": { text: "Pågående", className: "bg-blue-900/20 text-blue-400" },
      "draft": { text: "Utkast", className: "bg-neutral-800 text-neutral-400" },
      "completed": { text: "Färdig", className: "bg-green-900/20 text-green-400" },
      "paid": { text: "Betald", className: "bg-green-900/20 text-green-400" },
      "pending": { text: "Pågående", className: "bg-yellow-900/20 text-yellow-400" },
      "unpaid": { text: "Obetald", className: "bg-yellow-900/20 text-yellow-400" },
      "overdue": { text: "Försenad", className: "bg-red-900/20 text-red-400" }
    };

    const defaultStatus = { text: "Pågående", className: "bg-blue-900/20 text-blue-400" };
    return statusMap[status?.toLowerCase()] || defaultStatus;
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-neutral-400">
            Failed to load project details. Please try again later.
          </div>
        ) : project ? (
          <>
            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h1 className="text-2xl font-semibold text-white mb-4">{project.name}</h1>
                  <div className="space-y-2 text-sm">
                    <p className="text-neutral-400">Customer: <Link href={`/customers/${project.customerId}`} className="text-white hover:underline">{project.customerName}</Link></p>
                    <p className="text-neutral-400">Status: 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        project.status === "active" ? "bg-green-900/20 text-green-400" :
                        project.status === "completed" ? "bg-neutral-900/20 text-neutral-400" :
                        "bg-yellow-900/20 text-yellow-400"
                      }`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                      </span>
                    </p>
                    
                    {/* Assigned User Section */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-neutral-400 font-medium flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          Assigned To
                        </h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="default" 
                              size="sm"
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                              disabled={assigningUser}
                            >
                              {assigningUser ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <UserPlus className="h-3 w-3" />
                              )}
                              {project.assigned_to ? 'Reassign' : 'Assign User'}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56 bg-neutral-800 border-neutral-700 text-white">
                            {members.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-neutral-400">
                                No team members found
                              </div>
                            ) : (
                              <>
                                {members.map(member => (
                                  <DropdownMenuItem 
                                    key={member.id} 
                                    className="cursor-pointer flex items-center gap-2 text-sm"
                                    onClick={() => handleAssignProject(member.user_id)}
                                  >
                                    <User className="h-4 w-4 text-neutral-400" />
                                    <span>{member.name}</span>
                                    {project.assigned_to === member.user_id && (
                                      <span className="ml-auto text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                        Current
                                      </span>
                                    )}
                                  </DropdownMenuItem>
                                ))}
                                {project.assigned_to && (
                                  <DropdownMenuItem 
                                    className="cursor-pointer flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
                                    onClick={() => handleAssignProject(undefined)}
                                  >
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Unassign</span>
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="mt-2">
                        {project.assigned_to ? (
                          <p className="text-neutral-400 text-sm">
                            Assigned to: <span className="text-white">{getAssignedMemberName(project.assigned_to) || 'Unknown User'}</span>
                          </p>
                        ) : (
                          <p className="text-neutral-400 text-sm italic">Not assigned to any team member</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Date display and edit section */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-neutral-400 font-medium flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Dates
                        </h3>
                        {!isEditing ? (
                          <Button 
                            onClick={() => setIsEditing(true)} 
                            variant="outline" 
                            size="sm"
                            className="text-xs bg-neutral-900/60 hover:bg-neutral-700"
                          >
                            Edit Dates
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSaveDates}
                            variant="outline"
                            size="sm"
                            className="text-xs bg-blue-900/60 hover:bg-blue-800 text-blue-200"
                            disabled={savingDates}
                          >
                            {savingDates ? (
                              <span className="flex items-center">
                                <div className="animate-spin h-3 w-3 border-b-2 border-current rounded-full mr-2"></div>
                                Saving...
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <Save className="h-3 w-3 mr-2" />
                                Save Dates
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-2 mt-2">
                          <div className="space-y-1">
                            <label htmlFor="start_date" className="block text-xs text-neutral-400">
                              Start Date
                            </label>
                            <input
                              type="date"
                              id="start_date"
                              name="start_date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-md text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="end_date" className="block text-xs text-neutral-400">
                              End Date
                            </label>
                            <input
                              type="date"
                              id="end_date"
                              name="end_date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-md text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <p className="text-neutral-400 text-sm">Start Date: <span className="text-white">{new Date(project.startDate).toLocaleDateString()}</span></p>
                          {project.endDate && (
                            <p className="text-neutral-400 text-sm">End Date: <span className="text-white">{new Date(project.endDate).toLocaleDateString()}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Description</h2>
              <p className="text-neutral-400 whitespace-pre-wrap">{project.description || "No description provided."}</p>
            </Card>

            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-400" />
                  Linked Invoices
                </h2>
                
                <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="default" 
                      size="sm"
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white" 
                      onClick={() => {
                        console.log("Opening invoice linking dialog");
                        fetchAvailableInvoices();
                        setInvoiceDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Link Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-neutral-800 border-neutral-700 text-white">
                    <DialogHeader>
                      <DialogTitle>Link Invoice to Project</DialogTitle>
                      <DialogDescription className="text-neutral-400">
                        Select an invoice to link to this project.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                      <Input
                        placeholder="Search invoices..."
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        className="bg-neutral-900 border-neutral-700 mb-4"
                      />
                      
                      {loadingInvoices ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                        </div>
                      ) : availableInvoices.length === 0 ? (
                        <div className="text-center py-8 text-neutral-400">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-neutral-500" />
                          <p>No unlinked invoices found for this project's customer.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                          {availableInvoices
                            .filter(invoice => 
                              invoice.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                              invoice.customer_name?.toLowerCase().includes(invoiceSearch.toLowerCase())
                            )
                            .map(invoice => (
                              <div key={invoice.id} className="bg-neutral-700 p-3 rounded-md">
                                <div className="flex justify-between">
                                  <div>
                                    <div className="font-medium">{invoice.invoice_number}</div>
                                    <div className="text-sm text-neutral-400">{invoice.customer_name}</div>
                                    <div className="text-xs text-neutral-500 mt-1">
                                      Date: {new Date(invoice.invoice_date).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">{formatCurrency(invoice.total)}</div>
                                    {invoice.status && (
                                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusDisplay(invoice.status).className}`}>
                                        {getStatusDisplay(invoice.status).text}
                                      </span>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-2 bg-blue-900/20 border-blue-800 text-blue-400 hover:bg-blue-800/30"
                                      onClick={() => handleLinkInvoice(invoice.id)}
                                    >
                                      Link
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                        Close
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              {loadingInvoices ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                </div>
              ) : linkedInvoices.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-neutral-500" />
                  <p>No invoices are linked to this project yet.</p>
                  <p className="text-sm text-neutral-500 mt-1">Click "Link Invoice" to connect an invoice.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedInvoices.map(invoice => (
                    <div key={invoice.id} className="bg-neutral-900 p-4 rounded-md">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium text-white">{invoice.invoice_number}</div>
                          <div className="text-sm text-neutral-400">{invoice.customer_name}</div>
                          <div className="flex gap-4 text-xs text-neutral-500 mt-1">
                            <div>Date: {new Date(invoice.invoice_date).toLocaleDateString()}</div>
                            <div>Due: {new Date(invoice.due_date).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white">{formatCurrency(invoice.total)}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-neutral-800 hover:bg-neutral-700 border-neutral-700"
                              onClick={() => handleUnlinkInvoice(invoice.id)}
                            >
                              Unlink
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-neutral-800 hover:bg-neutral-700 border-neutral-700"
                              asChild
                            >
                              <Link href={`/invoices?id=${invoice.id}`} target="_blank">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-4 items-center">
                        {invoice.status && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusDisplay(invoice.status).className}`}>
                            {getStatusDisplay(invoice.status).text}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <TaskManager
                tasks={project.tasks}
                onTasksChange={handleTasksChange}
                onTaskUpdate={handleTaskUpdate}
                onChecklistItemUpdate={handleChecklistItemUpdate}
                projectDeadline={project.endDate || project.startDate}
                projectName={project.name}
                projectDescription={project.description}
                projectId={project.id || params.id}
              />
            </Card>
          </>
        ) : null}
      </div>
    </SidebarDemo>
  );
} 