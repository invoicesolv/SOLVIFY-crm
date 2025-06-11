'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, Trash2 } from 'lucide-react';

export default function BlogPublishingTester() {
  const [blogUrl, setBlogUrl] = useState('https://crm.solvify.se');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<any>(null);

  const runTest = async () => {
    if (!blogUrl) {
      setError('Please enter a blog URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setDeleteResult(null);

    try {
      const response = await fetch('/api/debug-generation/blog-api-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          blogUrl,
          testContentTitle: 'API Test Post - Please Ignore',
          testContentBody: '<p>This is an automated test post to verify API connectivity.</p>'
        })
      });

      const data = await response.json();
      setResults(data);

      if (!response.ok) {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      setError('Failed to run test: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const deleteTestPosts = async () => {
    setDeleteLoading(true);
    setDeleteResult(null);
    setError(null);

    try {
      const response = await fetch('/api/debug-generation/delete-test-posts?isTestPost=true', {
        method: 'DELETE'
      });

      const data = await response.json();
      setDeleteResult(data);

      if (!response.ok) {
        setError(data.error || 'An error occurred while deleting test posts');
      }
    } catch (err) {
      setError('Failed to delete test posts: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteLoading(false);
    }
  };

  const deletePostById = async (id: string) => {
    if (!id) return;
    
    setDeleteLoading(true);
    setDeleteResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/debug-generation/delete-test-posts?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      setDeleteResult(data);

      if (!response.ok) {
        setError(data.error || 'An error occurred while deleting post');
      }
    } catch (err) {
      setError('Failed to delete post: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 border rounded-lg shadow-sm bg-background">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Blog Publishing Test Tool</h2>
        <p className="text-foreground0">
          Test the connection to your blog platform's API
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="blogUrl" className="text-sm font-medium">Blog URL</label>
          <Input
            id="blogUrl"
            value={blogUrl}
            onChange={(e) => setBlogUrl(e.target.value)}
            placeholder="https://yourblog.com"
          />
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={runTest} 
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : 'Run Blog API Test'}
          </Button>
          
          <Button 
            onClick={deleteTestPosts} 
            disabled={deleteLoading}
            variant="outline"
            className="flex-none bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
          >
            {deleteLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Test Posts
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700 rounded">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {deleteResult && (
          <div className="p-4 border-l-4 border-blue-500 bg-blue-50 text-blue-700 rounded">
            <p className="font-bold">Delete Operation Result</p>
            <p>{deleteResult.message}</p>
            {deleteResult.deleted && deleteResult.deleted.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold">Deleted posts:</p>
                <ul className="list-disc pl-5 mt-1">
                  {deleteResult.deleted.map((item: any) => (
                    <li key={item.id}>{item.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {results && (
          <div className="space-y-4 mt-4">
            <div className={`p-4 border-l-4 ${results.success ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'} rounded`}>
              <div className="flex items-center">
                {results.success ? (
                  <Check className="h-5 w-5 mr-2" />
                ) : (
                  <X className="h-5 w-5 mr-2" />
                )}
                <p className="font-bold">{results.success ? 'Success' : 'Failed'}</p>
              </div>
              <p className="mt-2">
                {results.success 
                  ? 'API connection successful! Your blog publishing should work properly.' 
                  : 'API connection test failed. Please check the details below.'}
              </p>
            </div>

            {results.steps && results.steps.map((step: any, index: number) => (
              <div key={index} className="border rounded overflow-hidden">
                <div className="bg-muted p-3 flex items-center">
                  {step.success ? (
                    <Check className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 mr-2 text-red-600 dark:text-red-400" />
                  )}
                  <h3 className="text-sm font-medium">{step.step}</h3>
                </div>
                <div className="p-3 text-xs font-mono bg-gray-50">
                  <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                    {JSON.stringify(step.details, null, 2)}
                  </pre>
                </div>
              </div>
            ))}

            {!results.success && (
              <div className="p-4 border border-yellow-300 bg-yellow-50 rounded">
                <div className="flex items-center mb-2">
                  <span className="font-bold">What to do next</span>
                </div>
                <div>
                  <p className="mt-2">
                    You need to implement an API endpoint at <code className="bg-muted px-1 py-0.5 rounded">{results.blogUrl}/api/create-post</code> that accepts POST requests with the following JSON structure:
                  </p>
                  <Textarea 
                    className="mt-2 font-mono text-xs h-40"
                    readOnly
                    value={`{
  "title": "Post Title",
  "content": "HTML Content",
  "slug": "post-slug",
  "category": "category-name",
  "featured": true,
  "path": "blog"
}`}
                  />
                  <p className="mt-2">The endpoint should return a JSON response with:</p>
                  <Textarea 
                    className="mt-2 font-mono text-xs h-24"
                    readOnly
                    value={`{
  "success": true,
  "postUrl": "https://yourblog.com/blog/post-slug"
}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 