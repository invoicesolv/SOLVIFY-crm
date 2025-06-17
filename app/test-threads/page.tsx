'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function TestThreadsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [testContent, setTestContent] = useState('Hello from my CRM! Testing Threads API integration 🧵');

  const testThreadsConnection = async () => {
    if (!session?.user?.id) {
      toast.error('Please log in first');
      return;
    }

    setLoading(true);
    try {
      // First, let's connect to Threads
      const state = encodeURIComponent(JSON.stringify({ 
        platform: 'threads', 
        userId: session.user.id,
        returnTo: '/test-threads'
      }));
      
      window.location.href = `/api/oauth/threads?state=${state}`;
    } catch (error) {
      console.error('Error connecting to Threads:', error);
      toast.error('Failed to connect to Threads');
    } finally {
      setLoading(false);
    }
  };

  const testThreadsPost = async () => {
    if (!session?.user?.id) {
      toast.error('Please log in first');
      return;
    }

    if (!testContent.trim()) {
      toast.error('Please enter some content to post');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/social/threads/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: testContent,
          // We'll need to get the workspace ID and selected page ID
          workspaceId: 'test', // This should be replaced with actual workspace ID
          selectedPageId: 'test' // This should be replaced with actual page ID
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post to Threads');
      }

      const result = await response.json();
      toast.success('Successfully posted to Threads!');
      console.log('Threads post result:', result);
    } catch (error) {
      console.error('Error posting to Threads:', error);
      toast.error(`Failed to post to Threads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧵 Threads API Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Step 1: Connect to Threads</h3>
            <p className="text-sm text-gray-600 mb-4">
              First, you need to connect your Threads account to the CRM.
            </p>
            <Button 
              onClick={testThreadsConnection}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Connecting...' : 'Connect to Threads'}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Step 2: Test Posting</h3>
            <p className="text-sm text-gray-600 mb-4">
              After connecting, you can test posting to Threads.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Test Content
                </label>
                <Input
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  placeholder="Enter content to post to Threads..."
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {testContent.length}/500 characters
                </p>
              </div>
              
              <Button 
                onClick={testThreadsPost}
                disabled={loading || !testContent.trim()}
                className="w-full"
                variant="outline"
              >
                {loading ? 'Posting...' : 'Test Post to Threads'}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Current Status</h3>
            <div className="text-sm space-y-1">
              <p><strong>Session:</strong> {session?.user?.email || 'Not logged in'}</p>
              <p><strong>User ID:</strong> {session?.user?.id || 'N/A'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Threads API Endpoints</h3>
            <div className="text-xs space-y-1 font-mono bg-gray-100 p-3 rounded">
              <p><strong>OAuth:</strong> https://threads.net/oauth/authorize</p>
              <p><strong>Token:</strong> https://graph.threads.net/oauth/access_token</p>
              <p><strong>User Info:</strong> https://graph.threads.net/v1.0/me</p>
              <p><strong>Create Post:</strong> https://graph.threads.net/v1.0/USER_ID/threads</p>
              <p><strong>Publish:</strong> https://graph.threads.net/v1.0/USER_ID/threads_publish</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 