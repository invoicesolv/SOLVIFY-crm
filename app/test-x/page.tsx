'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function TestXPage() {
  const { data: session } = useSession();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [tweetContent, setTweetContent] = useState('Testing my X integration from my CRM! 🚀 #buildinpublic');

  const connectX = async () => {
    if (!session?.user?.id) {
      toast.error('Please log in first');
      return;
    }

    setIsConnecting(true);
    try {
      const state = JSON.stringify({
        platform: 'twitter',
        userId: session.user.id,
        returnTo: '/test-x'
      });

      window.location.href = `/api/oauth/twitter?state=${encodeURIComponent(state)}`;
    } catch (error) {
      console.error('X connection error:', error);
      toast.error('Failed to connect X');
      setIsConnecting(false);
    }
  };

  const postTweet = async () => {
    if (!tweetContent.trim()) {
      toast.error('Please enter some content to tweet');
      return;
    }

    setIsPosting(true);
    try {
      // Get workspace ID (simplified for testing)
      const workspaceResponse = await fetch('/api/workspace/leave');
      const workspaceData = await workspaceResponse.json();
      const workspaceId = workspaceData.workspaces?.[0]?.id;

      if (!workspaceId) {
        throw new Error('No workspace found');
      }

      const response = await fetch('/api/social/twitter/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: tweetContent,
          workspaceId: workspaceId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post tweet');
      }

      const result = await response.json();
      toast.success(`Tweet posted successfully! ${result.tweetUrl ? 'View: ' + result.tweetUrl : ''}`);
      setTweetContent('');
    } catch (error) {
      console.error('Tweet posting error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to post tweet');
    } finally {
      setIsPosting(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">X (Twitter) Test</h1>
          <p className="text-gray-600">Please log in to test X integration</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold mb-6 flex items-center">
            <span className="mr-3">🐦</span>
            X (Twitter) Integration Test
          </h1>

          <div className="space-y-6">
            {/* Connection Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">1. Connect X Account</h2>
              <button
                onClick={connectX}
                disabled={isConnecting}
                className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect X (Twitter)'}
              </button>
              <p className="text-sm text-gray-600 mt-2">
                This will redirect you to X to authorize the connection
              </p>
            </div>

            {/* Posting Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">2. Post a Tweet</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tweet Content ({tweetContent.length}/280)
                  </label>
                  <textarea
                    value={tweetContent}
                    onChange={(e) => setTweetContent(e.target.value)}
                    maxLength={280}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What's happening?"
                  />
                </div>
                <button
                  onClick={postTweet}
                  disabled={isPosting || !tweetContent.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPosting ? 'Posting...' : 'Post Tweet'}
                </button>
              </div>
            </div>

            {/* Debug Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Debug Info</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>User ID:</strong> {session.user.id}</p>
                <p><strong>Email:</strong> {session.user.email}</p>
                <p><strong>Test URL:</strong> /test-x</p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Quick Links</h3>
              <div className="space-y-2 text-sm">
                <a href="/settings" className="text-blue-600 hover:underline block">
                  → Settings Page
                </a>
                <a href="/social-media" className="text-blue-600 hover:underline block">
                  → Social Media Dashboard
                </a>
                <a href="/api/debug/twitter-config" className="text-blue-600 hover:underline block">
                  → X Configuration Debug
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 