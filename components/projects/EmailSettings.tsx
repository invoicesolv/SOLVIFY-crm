import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface EmailSettingsProps {
  projectId: string;
  onClose: () => void;
}

interface CronJob {
  id: string;
  status: 'active' | 'disabled';
  next_run: string;
  settings: {
    send_day: string;
    send_time: string;
    recipients: string[];
  };
}

interface EmailSettings {
  enabled: boolean;
  sendDay: string;
  sendTime: string;
  recipients: string[];
}

export function EmailSettings({ projectId, onClose }: EmailSettingsProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    enabled: false,
    sendDay: 'monday',
    sendTime: '09:00',
    recipients: []
  });

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
        .eq('property_id', projectId)
        .eq('job_type', 'project_report')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const job = data[0];
        setEmailSettings({
          enabled: job.status === 'active',
          sendDay: job.settings.send_day,
          sendTime: job.settings.send_time,
          recipients: job.settings.recipients
        });
      }

      setCronJobs(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading cron jobs:', error);
      toast.error('Failed to load scheduled tasks');
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to save settings');
      return;
    }

    try {
      const { error } = await supabase
        .from('cron_jobs')
        .upsert({
          property_id: projectId,
          user_id: session.user.id,
          job_type: 'project_report',
          status: emailSettings.enabled ? 'active' : 'disabled',
          settings: {
            send_day: emailSettings.sendDay,
            send_time: emailSettings.sendTime,
            recipients: emailSettings.recipients
          },
          next_run: calculateNextRun(emailSettings.sendDay, emailSettings.sendTime)
        }, {
          onConflict: 'user_id,property_id,job_type'
        });

      if (error) throw error;

      toast.success('Email settings saved successfully');
      loadCronJobs();
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast.error('Failed to save email settings');
    }
  };

  const calculateNextRun = (day: string, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const today = new Date();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = daysOfWeek.indexOf(day.toLowerCase());
    const currentDay = today.getDay();
    
    let daysUntilNext = targetDay - currentDay;
    if (daysUntilNext <= 0) daysUntilNext += 7;
    
    const nextRun = new Date();
    nextRun.setDate(today.getDate() + daysUntilNext);
    nextRun.setHours(hours, minutes, 0, 0);
    
    return nextRun.toISOString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-neutral-900 p-8 rounded-lg w-full max-w-md border border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-6">Email Report Settings</h2>
        
        <div className="space-y-6">
          <div className="p-4 bg-neutral-800 rounded-md border border-neutral-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Switch
                  checked={emailSettings.enabled}
                  onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, enabled: checked }))}
                  className="data-[state=checked]:bg-blue-600"
                />
                <div>
                  <label className="text-white text-sm font-medium">Enable Weekly Reports</label>
                  <p className="text-xs text-neutral-400">Turn on to schedule automated weekly reports</p>
                </div>
              </div>
            </div>
          </div>

          {emailSettings.enabled && (
            <>
              <div>
                <label className="block mb-2 text-sm font-medium text-neutral-200">Recipients</label>
                <textarea
                  value={emailSettings.recipients.join('\n')}
                  onChange={(e) => setEmailSettings(prev => ({ 
                    ...prev, 
                    recipients: e.target.value.split('\n').map(email => email.trim()).filter(Boolean)
                  }))}
                  className="w-full h-32 p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm"
                  placeholder="Enter email addresses (one per line)"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-neutral-200">Send Day</label>
                <select
                  value={emailSettings.sendDay}
                  onChange={(e) => setEmailSettings(prev => ({ ...prev, sendDay: e.target.value }))}
                  className="w-full p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm"
                >
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-neutral-200">Send Time</label>
                <input
                  type="time"
                  value={emailSettings.sendTime}
                  onChange={(e) => setEmailSettings(prev => ({ ...prev, sendTime: e.target.value }))}
                  className="w-full p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm"
                />
              </div>
            </>
          )}

          {cronJobs.length > 0 && (
            <div className="pt-4 border-t border-neutral-800">
              <h3 className="text-sm font-medium text-neutral-200 mb-3">Current Schedule</h3>
              {cronJobs.map((job) => (
                <div key={job.id} className="p-3 rounded-md bg-neutral-800 border border-neutral-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Weekly Report</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      job.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-neutral-700 text-neutral-400'
                    )}>
                      {job.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-neutral-400">
                    <p>Every {job.settings.send_day} at {job.settings.send_time}</p>
                    <p>Next run: {new Date(job.next_run).toLocaleString()}</p>
                    <p>Recipients: {job.settings.recipients.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-neutral-800 text-white hover:bg-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 