'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2, Edit2, Check, X, Plus, Calendar, BarChart3, Search, FolderOpen } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface CronJob {
  id: string;
  job_type: string;
  status: string;
  execution_status: string;
  error_message?: string;
  last_run: string | null;
  next_run: string;
  settings: {
    frequency: string;
    send_day: string;
    send_time: string;
    recipients: string[];
  };
  property_id: string;
  site_url?: string;
  updated_at: string;
}

interface AutomationForm {
  type: 'analytics_report' | 'search_console_report' | 'project_report';
  name: string;
  property_id?: string;
  site_url?: string;
  project_id?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  send_day: string;
  send_time: string;
  recipients: string;
  enabled: boolean;
}

export default function CronJobsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [editedSettings, setEditedSettings] = useState<any>(null);
  
  // New automation creation state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [automationForm, setAutomationForm] = useState<AutomationForm>({
    type: 'analytics_report',
    name: '',
    frequency: 'weekly',
    send_day: 'monday',
    send_time: '09:00',
    recipients: '',
    enabled: true
  });
  const [availableProperties, setAvailableProperties] = useState<any[]>([]);
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      loadCronJobs();
      loadAvailableResources();
    }
  }, [session?.user?.id]);

  const loadCronJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('cron_jobs')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Format the jobs with proper defaults
      const formattedJobs = (data || []).map(job => ({
        ...job,
        status: job.status || 'pending',
        execution_status: job.execution_status || (job.last_run ? 'success' : 'pending')
      }));
      
      setCronJobs(formattedJobs);
    } catch (error) {
      console.error('Error loading cron jobs:', error);
      toast.error('Failed to load scheduled tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableResources = async () => {
    try {
      // Load Analytics properties
      const analyticsResponse = await fetch('/api/ga4/properties');
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAvailableProperties(analyticsData.properties || []);
      }

      // Load Search Console sites
      const searchResponse = await fetch('/api/search-console/sites');
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        setAvailableSites(searchData.sites || []);
      }

      // Load Projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      
      if (!projectsError) {
        setAvailableProjects(projects || []);
      }
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  const createAutomation = async () => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to create automations');
      return;
    }

    setCreating(true);
    try {
      const recipients = automationForm.recipients
        .split('\n')
        .map(email => email.trim())
        .filter(Boolean);

      if (recipients.length === 0) {
        toast.error('Please add at least one recipient email');
        return;
      }

      // Calculate next run time
      const now = new Date();
      const nextRun = calculateNextRunTime(automationForm.frequency, automationForm.send_day, automationForm.send_time);

      const cronJobData: any = {
        user_id: session.user.id,
        job_type: automationForm.type,
        status: automationForm.enabled ? 'active' : 'disabled',
        next_run: nextRun.toISOString(),
        settings: {
          frequency: automationForm.frequency,
          send_day: automationForm.send_day,
          send_time: automationForm.send_time,
          recipients: recipients
        },
        updated_at: now.toISOString()
      };

      // Add type-specific fields
      if (automationForm.type === 'analytics_report' && automationForm.property_id) {
        cronJobData.property_id = automationForm.property_id;
      } else if (automationForm.type === 'search_console_report' && automationForm.site_url) {
        cronJobData.site_url = automationForm.site_url;
      } else if (automationForm.type === 'project_report' && automationForm.project_id) {
        cronJobData.property_id = automationForm.project_id; // Using property_id field for project_id
      }

      const { data, error } = await supabase
        .from('cron_jobs')
        .insert([cronJobData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Automation created successfully');
      setCreateDialogOpen(false);
      resetAutomationForm();
      loadCronJobs();
    } catch (error) {
      console.error('Error creating automation:', error);
      toast.error('Failed to create automation');
    } finally {
      setCreating(false);
    }
  };

  const calculateNextRunTime = (frequency: string, sendDay: string, sendTime: string): Date => {
    const now = new Date();
    const [hours, minutes] = sendTime.split(':').map(Number);
    
    if (frequency === 'daily') {
      const nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      return nextRun;
    } else if (frequency === 'weekly') {
      const dayMap = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 0
      };
      const targetDay = dayMap[sendDay.toLowerCase()];
      const nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);
      
      const daysUntilTarget = (targetDay - now.getDay() + 7) % 7;
      if (daysUntilTarget === 0 && nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      } else {
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      }
      return nextRun;
    } else if (frequency === 'monthly') {
      const nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);
      nextRun.setDate(1); // First day of month
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      return nextRun;
    }
    
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to tomorrow
  };

  const resetAutomationForm = () => {
    setAutomationForm({
      type: 'analytics_report',
      name: '',
      frequency: 'weekly',
      send_day: 'monday',
      send_time: '09:00',
      recipients: '',
      enabled: true
    });
  };

  const getAutomationIcon = (type: string) => {
    switch (type) {
      case 'analytics_report':
        return <BarChart3 className="h-4 w-4" />;
      case 'search_console_report':
        return <Search className="h-4 w-4" />;
      case 'project_report':
        return <FolderOpen className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getAutomationTitle = (type: string) => {
    switch (type) {
      case 'analytics_report':
        return 'Analytics Report';
      case 'search_console_report':
        return 'Search Console Report';
      case 'project_report':
        return 'Project Report';
      default:
        return 'Unknown Report';
    }
  };

  const handleDelete = async (id: string) => {
    setJobToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;
    
    try {
      const response = await fetch(`/api/cron?id=${jobToDelete}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
      
      toast.success('Task deleted successfully');
      setCronJobs(cronJobs.filter(job => job.id !== jobToDelete));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    } finally {
      setJobToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleEdit = (job: CronJob) => {
    setEditingJob(job.id);
    setEditedSettings({ ...job.settings });
  };

  const cancelEdit = () => {
    setEditingJob(null);
    setEditedSettings(null);
  };

  const saveEdit = async (job: CronJob) => {
    try {
      const response = await fetch('/api/cron', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: job.id,
          settings: editedSettings,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task');
      }
      
      const updatedJob = { ...job, settings: editedSettings };
      setCronJobs(cronJobs.map(j => j.id === job.id ? updatedJob : j));
      toast.success('Task updated successfully');
      setEditingJob(null);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const toggleStatus = async (job: CronJob) => {
    const newStatus = job.status === 'active' ? 'disabled' : 'active';
    
    try {
      const response = await fetch('/api/cron', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: job.id,
          status: newStatus,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${newStatus === 'active' ? 'enable' : 'disable'} task`);
      }
      
      setCronJobs(cronJobs.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
      toast.success(`Task ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error(`Failed to ${newStatus === 'active' ? 'enable' : 'disable'} task`);
    }
  };

  const handleManualRun = async (id: string) => {
    try {
      const response = await fetch(`/api/cron/process-scheduled-tasks?jobId=${id}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Failed to run task');
      }
      
      toast.success('Task executed successfully');
      loadCronJobs(); // Reload to get updated status
    } catch (error) {
      console.error('Error running task:', error);
      toast.error('Failed to run task');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/10 text-green-400';
      case 'disabled':
        return 'bg-gray-200 dark:bg-muted/50 text-muted-foreground';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400';
      default:
        return 'bg-gray-200 dark:bg-muted/50 text-muted-foreground';
    }
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'bg-green-500/10 text-green-400';
      case 'failed':
        return 'bg-red-500/10 text-red-400';
      case 'running':
        return 'bg-blue-500/10 text-blue-400';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400';
      default:
        return 'bg-gray-200 dark:bg-muted/50 text-muted-foreground';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <SidebarDemo>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading scheduled tasks...</div>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Scheduled Tasks</h1>
              <p className="text-muted-foreground">Manage your automated tasks and reports</p>
            </div>
          </div>
          
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Automation
          </Button>
        </div>

        {cronJobs.length === 0 ? (
          <Card className="bg-background border-border dark:border-border p-8">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No scheduled tasks found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first automation to start receiving automated reports
              </p>
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Automation
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {cronJobs.map((job) => (
              <Card key={job.id} className="bg-background border-border dark:border-border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      {getAutomationIcon(job.job_type)}
                      <h3 className="text-lg font-medium text-foreground">
                        {getAutomationTitle(job.job_type)}
                      </h3>
                      <button
                        onClick={() => toggleStatus(job)}
                        className={`text-xs px-2 py-1 rounded cursor-pointer ${getStatusColor(job.status)}`}
                      >
                        {formatStatus(job.status)}
                      </button>
                      {job.execution_status && (
                        <span className={`text-xs px-2 py-1 rounded ${getExecutionStatusColor(job.execution_status)}`}>
                          {formatStatus(job.execution_status)}
                          {job.error_message && 
                            <span className="ml-1 cursor-help" title={job.error_message}>⚠️</span>
                          }
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {job.property_id && (
                        <p>Property/Project ID: {job.property_id}</p>
                      )}
                      {job.site_url && (
                        <p>Site URL: {job.site_url}</p>
                      )}
                      <p>Schedule: {job.settings.frequency} on {job.settings.send_day} at {job.settings.send_time}</p>
                      <p>Recipients: {job.settings.recipients.join(', ')}</p>
                      <p>Next run: {new Date(job.next_run).toLocaleString()}</p>
                      {job.last_run && (
                        <p>Last run: {new Date(job.last_run).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManualRun(job.id)}
                      className="bg-background hover:bg-muted"
                    >
                      Run Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(job)}
                      className="bg-background hover:bg-muted"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(job.id)}
                      className="bg-background hover:bg-muted text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {editingJob === job.id && (
                  <div className="mt-4 p-4 bg-muted rounded-lg space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="send_day">Send Day</Label>
                        <Select
                          value={editedSettings.send_day}
                          onValueChange={(value) => setEditedSettings({...editedSettings, send_day: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monday">Monday</SelectItem>
                            <SelectItem value="tuesday">Tuesday</SelectItem>
                            <SelectItem value="wednesday">Wednesday</SelectItem>
                            <SelectItem value="thursday">Thursday</SelectItem>
                            <SelectItem value="friday">Friday</SelectItem>
                            <SelectItem value="saturday">Saturday</SelectItem>
                            <SelectItem value="sunday">Sunday</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="send_time">Send Time</Label>
                        <Input
                          type="time"
                          value={editedSettings.send_time}
                          onChange={(e) => setEditedSettings({...editedSettings, send_time: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="recipients">Recipients (one per line)</Label>
                      <Textarea
                        value={editedSettings.recipients.join('\n')}
                        onChange={(e) => setEditedSettings({
                          ...editedSettings, 
                          recipients: e.target.value.split('\n').filter(Boolean)
                        })}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button onClick={() => saveEdit(job)}>
                        <Check className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Create Automation Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Automation</DialogTitle>
              <DialogDescription>
                Set up automated reports for analytics, search console, or projects
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="type">Report Type</Label>
                <Select
                  value={automationForm.type}
                  onValueChange={(value: any) => setAutomationForm({...automationForm, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analytics_report">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Analytics Report
                      </div>
                    </SelectItem>
                    <SelectItem value="search_console_report">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Search Console Report
                      </div>
                    </SelectItem>
                    <SelectItem value="project_report">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Project Report
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Type-specific fields */}
              {automationForm.type === 'analytics_report' && (
                <div className="space-y-2">
                  <Label htmlFor="property_id">Analytics Property</Label>
                  <Select
                    value={automationForm.property_id || ''}
                    onValueChange={(value) => setAutomationForm({...automationForm, property_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an Analytics property" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProperties.map((property) => (
                        <SelectItem key={property.name} value={property.name}>
                          {property.displayName || property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {automationForm.type === 'search_console_report' && (
                <div className="space-y-2">
                  <Label htmlFor="site_url">Search Console Site</Label>
                  <Select
                    value={automationForm.site_url || ''}
                    onValueChange={(value) => setAutomationForm({...automationForm, site_url: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Search Console site" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSites.map((site) => (
                        <SelectItem key={site.siteUrl} value={site.siteUrl}>
                          {site.siteUrl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {automationForm.type === 'project_report' && (
                <div className="space-y-2">
                  <Label htmlFor="project_id">Project</Label>
                  <Select
                    value={automationForm.project_id || ''}
                    onValueChange={(value) => setAutomationForm({...automationForm, project_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={automationForm.frequency}
                    onValueChange={(value: any) => setAutomationForm({...automationForm, frequency: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {automationForm.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label htmlFor="send_day">Send Day</Label>
                    <Select
                      value={automationForm.send_day}
                      onValueChange={(value) => setAutomationForm({...automationForm, send_day: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="send_time">Send Time</Label>
                <Input
                  type="time"
                  value={automationForm.send_time}
                  onChange={(e) => setAutomationForm({...automationForm, send_time: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipients">Recipients (one per line)</Label>
                <Textarea
                  placeholder="Enter email addresses, one per line"
                  value={automationForm.recipients}
                  onChange={(e) => setAutomationForm({...automationForm, recipients: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={automationForm.enabled}
                  onCheckedChange={(checked) => setAutomationForm({...automationForm, enabled: checked})}
                />
                <Label htmlFor="enabled">Enable automation immediately</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createAutomation} disabled={creating}>
                {creating ? 'Creating...' : 'Create Automation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the scheduled task.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarDemo>
  );
}