"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function TestAutomationSave() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testSaveAutomation = async () => {
    if (!session?.user?.id) {
      toast.error('Please log in first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Create a simple test workflow
      const testWorkflow = {
        id: crypto.randomUUID(),
        name: 'Test Automation',
        description: 'Test automation workflow',
        status: 'draft',
        trigger_type: 'schedule',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            subtype: 'schedule',
            position: { x: 100, y: 100 },
            data: {
              frequency: 'weekly',
              send_day: 'monday',
              send_time: '09:00'
            },
            title: 'Schedule Trigger',
            description: 'Weekly on Monday at 09:00'
          },
          {
            id: 'action-1',
            type: 'action',
            subtype: 'analytics_report',
            position: { x: 400, y: 100 },
            data: {
              recipients: 'test@example.com',
              property_id: 'test-property',
              site_url: 'https://example.com'
            },
            title: 'Analytics Report',
            description: 'Send analytics report'
          }
        ],
        connections: [
          {
            id: 'connection-1',
            from: 'trigger-1',
            to: 'action-1'
          }
        ],
        created_at: new Date().toISOString(),
        stats: {
          triggered: 0,
          completed: 0,
          active_contacts: 0
        }
      };

      // Create cron job data
      const cronJobData = {
        id: testWorkflow.id,
        user_id: session.user.id,
        job_type: 'workflow',
        status: 'disabled',
        execution_status: 'pending',
        property_id: null,
        site_url: null,
        settings: {
          frequency: 'weekly',
          send_day: 'monday',
          send_time: '09:00',
          recipients: ['test@example.com'],
          workflow_data: testWorkflow,
          automation_config: {
            workflow_id: testWorkflow.id,
            nodes: testWorkflow.nodes,
            connections: testWorkflow.connections
          }
        },
        next_run: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Testing automation save with data:', cronJobData);

      const { data, error } = await supabase
        .from('cron_jobs')
        .upsert(cronJobData, { onConflict: 'id' })
        .select();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('Automation saved successfully:', data);
      setResult({ success: true, data });
      toast.success('Test automation saved successfully!');

    } catch (error) {
      console.error('Error saving test automation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setResult({ success: false, error: errorMessage });
      toast.error(`Failed to save test automation: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Automation Save</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>This page tests if automation saving is working properly.</p>
          
          <Button 
            onClick={testSaveAutomation}
            disabled={loading || !session?.user?.id}
          >
            {loading ? 'Testing...' : 'Test Save Automation'}
          </Button>

          {!session?.user?.id && (
            <p className="text-red-500">Please log in to test automation saving</p>
          )}

          {result && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className={result.success ? 'text-green-600' : 'text-red-600'}>
                  {result.success ? 'Success' : 'Error'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 