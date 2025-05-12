'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

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
  updated_at: string;
}

export default function CronJobsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);

  useEffect(() => {
    if (session?.user?.id) {
      loadCronJobs();
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/10 text-green-400';
      case 'disabled':
        return 'bg-neutral-700/50 text-neutral-400';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400';
      default:
        return 'bg-neutral-700/50 text-neutral-400';
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
        return 'bg-neutral-700/50 text-neutral-400';
    }
  };

  const formatStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'Active';
      case 'disabled':
        return 'Disabled';
      case 'pending':
        return 'Pending';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Scheduled Tasks</h1>
            <p className="text-sm text-neutral-400">
              Manage your automated tasks and reports
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
          </div>
        ) : cronJobs.length === 0 ? (
          <Card className="bg-neutral-800 border-neutral-700 p-6">
            <div className="text-center py-8 text-neutral-400">
              No scheduled tasks found.
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {cronJobs.map((job) => (
              <Card key={job.id} className="bg-neutral-800 border-neutral-700 p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-white">
                        {job.job_type === 'analytics_report' ? 'Analytics Report' : job.job_type}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(job.status)}`}>
                        {formatStatus(job.status)}
                      </span>
                      {job.execution_status && (
                        <span className={`text-xs px-2 py-1 rounded ${getExecutionStatusColor(job.execution_status)}`}>
                          {formatStatus(job.execution_status)}
                          {job.error_message && 
                            <span className="ml-1 cursor-help" title={job.error_message}>⚠️</span>
                          }
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-neutral-400">
                      Property ID: {job.property_id}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-neutral-400">
                  <div>
                    Frequency: {job.settings.frequency}
                  </div>
                  <div>
                    Schedule: Every {job.settings.send_day} at {job.settings.send_time}
                  </div>
                  <div>
                    Recipients: {job.settings.recipients.join(', ')}
                  </div>
                  <div>
                    Last Run: {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                  </div>
                  <div>
                    Next Run: {new Date(job.next_run).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SidebarDemo>
  );
}