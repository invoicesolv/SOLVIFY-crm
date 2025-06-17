'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function FacebookConfigDebugPage() {
  const { data: session, status } = useSession();
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const testFacebookConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/facebook-config-test');
      const data = await response.json();
      
      data._responseStatus = response.status;
      data._responseOk = response.ok;
      
      setDebugData(data);
    } catch (error) {
      setDebugData({ 
        error: 'Failed to test Facebook config', 
        details: error instanceof Error ? error.message : String(error),
        _fetchError: true
      });
    } finally {
      setLoading(false);
    }
  };

  const testLiveRequest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/facebook-live-test');
      const data = await response.json();
      
      data._responseStatus = response.status;
      data._responseOk = response.ok;
      
      setTestResults(data);
    } catch (error) {
      setTestResults({ 
        error: 'Failed to make live request', 
        details: error instanceof Error ? error.message : String(error),
        _fetchError: true
      });
    } finally {
      setLoading(false);
    }
  };

  const initiateConfigAuth = () => {
    // Redirect to Facebook OAuth with your config ID
    const clientId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '1419856225687613';
    const redirectUri = `${window.location.origin}/api/oauth/instagram/callback`;
    const configId = '2197969850643897';
    const state = JSON.stringify({
      platform: 'instagram',
      userId: session?.user?.id || 'debug',
      debug: true
    });

    const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('config_id', configId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
  };

  if (status === 'loading') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Facebook Config Debug</h1>
        <p>Loading session...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Facebook Config Debug</h1>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-600">Please log in to use this debug tool.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Facebook Login for Business Config Debug</h1>
      
      {/* Configuration Info */}
      <div className="mb-6 bg-blue-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Configuration Details</h2>
        <div className="text-sm space-y-1">
          <p><strong>Config ID:</strong> 2197969850643897</p>
          <p><strong>App ID:</strong> 1419856225687613</p>
          <p><strong>Expected Permissions:</strong> business_management, pages_manage_engagement, pages_manage_posts, pages_read_engagement, pages_read_user_content, pages_show_list, read_insights</p>
          <p><strong>User ID:</strong> {session?.user?.id}</p>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="mb-6 space-x-4">
        <button
          onClick={initiateConfigAuth}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          🔐 Test Facebook Login with Config ID
        </button>
        
        <button
          onClick={testFacebookConfig}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : '🧪 Test Current Facebook Tokens'}
        </button>

        <button
          onClick={testLiveRequest}
          disabled={loading}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : '🚀 Make Live Instagram API Request'}
        </button>
      </div>

      {/* Debug Results */}
      {debugData && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Facebook Token Test Results</h2>
            <div className="text-sm">
              <p><strong>Status:</strong> {debugData._responseStatus} {debugData._responseOk ? '✅' : '❌'}</p>
              {debugData.success ? (
                <div className="text-green-600 mt-2">✅ {debugData.message}</div>
              ) : (
                <div className="text-red-600 mt-2">❌ {debugData.error}</div>
              )}
            </div>
          </div>

          {/* Permissions Found */}
          {debugData.permissions && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3">Granted Permissions</h2>
              <div className="grid grid-cols-2 gap-2">
                {debugData.permissions.map((permission: string, index: number) => (
                  <div key={index} className="text-sm bg-white p-2 rounded border">
                    ✅ {permission}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Facebook Accounts */}
          {debugData.facebookAccounts && debugData.facebookAccounts.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3">Facebook Accounts/Pages</h2>
              {debugData.facebookAccounts.map((account: any, index: number) => (
                <div key={index} className="bg-white p-3 rounded border mb-2">
                  <p><strong>Name:</strong> {account.name}</p>
                  <p><strong>ID:</strong> {account.id}</p>
                  <p><strong>Access Token:</strong> {account.access_token ? `${account.access_token.substring(0, 20)}...` : 'None'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Raw Response */}
          <details className="bg-gray-50 p-4 rounded-lg">
            <summary className="cursor-pointer font-semibold">Raw Debug Data</summary>
            <pre className="mt-3 text-xs overflow-auto">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </details>
        </div>
      )}

                {/* Live Test Results */}
      {testResults && (
        <div className="space-y-6 mt-8">
          <div className="bg-purple-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Live Instagram API Test Results</h2>
            <div className="text-sm">
              <p><strong>Status:</strong> {testResults._responseStatus} {testResults._responseOk ? '✅' : '❌'}</p>
              {testResults.success ? (
                <div className="text-green-600 mt-2">✅ {testResults.message}</div>
              ) : (
                <div className="text-red-600 mt-2">❌ {testResults.error}</div>
              )}
            </div>
          </div>

          {/* Troubleshooting Information */}
          {testResults.troubleshooting && testResults.troubleshooting.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3">🔧 Troubleshooting & Solutions</h2>
              <div className="space-y-1">
                {testResults.troubleshooting.map((step: string, index: number) => (
                  <div key={index} className="text-sm">
                    {step === '' ? (
                      <div className="h-2"></div>
                    ) : step.startsWith('🔍') || step.startsWith('📋') || step.startsWith('🔄') ? (
                      <div className="font-semibold text-blue-700 mt-2">{step}</div>
                    ) : step.startsWith('✅') ? (
                      <div className="text-green-600">{step}</div>
                    ) : step.startsWith('❌') ? (
                      <div className="text-red-600">{step}</div>
                    ) : step.startsWith('💡') ? (
                      <div className="text-orange-600 ml-4">{step}</div>
                    ) : step.startsWith('⚠️') ? (
                      <div className="text-red-700 font-medium">{step}</div>
                    ) : step.match(/^\d+\./) ? (
                      <div className="ml-4 text-gray-700">{step}</div>
                    ) : (
                      <div className="text-gray-600">{step}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instagram Accounts Found */}
          {testResults.instagramAccounts && testResults.instagramAccounts.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3">Instagram Business Accounts Found</h2>
              {testResults.instagramAccounts.map((account: any, index: number) => (
                <div key={index} className="bg-white p-3 rounded border mb-2">
                  <p><strong>Username:</strong> @{account.username}</p>
                  <p><strong>Name:</strong> {account.name}</p>
                  <p><strong>ID:</strong> {account.id}</p>
                  <p><strong>Followers:</strong> {account.followers_count}</p>
                </div>
              ))}
            </div>
          )}

          {/* API Responses */}
          {testResults.apiResponses && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3">API Responses</h2>
              {testResults.apiResponses.map((response: any, index: number) => (
                <div key={index} className="bg-white p-3 rounded border mb-2">
                  <p><strong>Endpoint:</strong> {response.endpoint}</p>
                  <p><strong>Status:</strong> {response.status} {response.success ? '✅' : '❌'}</p>
                  {response.error && (
                    <p className="text-red-600"><strong>Error:</strong> {response.error}</p>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm">Raw Response</summary>
                    <pre className="text-xs mt-1 overflow-auto">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}

          {/* Raw Test Results */}
          <details className="bg-gray-50 p-4 rounded-lg">
            <summary className="cursor-pointer font-semibold">Raw Live Test Data</summary>
            <pre className="mt-3 text-xs overflow-auto">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
} 