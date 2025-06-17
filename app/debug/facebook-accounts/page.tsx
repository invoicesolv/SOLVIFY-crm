'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function FacebookAccountsDebugPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  const logoutFacebookAndConnect = () => {
    setLoading(true);
    // First logout from Facebook, then redirect to our OAuth
    const oauthUrl = encodeURIComponent(`${window.location.origin}/api/oauth/facebook?force_business=true&state=debug_business_account`);
    window.location.href = `https://www.facebook.com/logout.php?next=${oauthUrl}`;
  };

  const connectFacebookWithAccountSelection = () => {
    setLoading(true);
    // Force account selection - this will show Meta's account picker
    window.location.href = '/api/oauth/facebook?force_account_selection=true&state=debug_business_account';
  };

  const connectFacebookBusiness = () => {
    setLoading(true);
    // Force business permissions and account selection
    window.location.href = '/api/oauth/facebook?force_business=true&force_account_selection=true&state=debug_business_account';
  };

  const testGraphAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/facebook-graph-api');
      const data = await response.json();
      console.log('Graph API Test Results:', data);
      alert('Check console for Graph API results');
    } catch (error) {
      console.error('Error testing Graph API:', error);
      alert('Error testing Graph API - check console');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Facebook Accounts Debug</h1>
        <p>Loading session...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Facebook Accounts Debug</h1>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-600">Please log in to use this debug tool.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Facebook Accounts Debug</h1>
        
        {/* Session Info */}
        <div className="mb-6 bg-blue-100 border border-blue-200 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-blue-900">Current Session</h2>
          <div className="text-blue-800">
            <p><strong>User ID:</strong> {session?.user?.id}</p>
            <p><strong>Email:</strong> {session?.user?.email}</p>
            <p><strong>Name:</strong> {session?.user?.name}</p>
          </div>
        </div>

        {/* Problem Explanation */}
        <div className="mb-6 bg-yellow-100 border border-yellow-200 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-yellow-900">🔍 The Problem</h2>
          <div className="text-yellow-800 space-y-2">
            <p>Your Instagram Business accounts are likely connected to your <strong>business Facebook account</strong> (solvifysearch), but our app is currently connected to your <strong>personal Facebook account</strong> (Kevin Mikael Negash).</p>
            <p>The Facebook Graph API only returns Instagram accounts connected to the currently logged-in Facebook account.</p>
          </div>
        </div>

        {/* Solution */}
        <div className="mb-6 bg-green-100 border border-green-200 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-green-900">✅ The Solution</h2>
          <div className="text-green-800 space-y-2">
            <p>We need to connect your <strong>business Facebook account</strong> (solvifysearch) to our app.</p>
            <p>The buttons below will force Facebook to show you the account selection screen where you can choose your business account.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3 text-gray-900">🎯 Connect Business Facebook Account</h3>
            <p className="text-gray-700 mb-4">
              Since Facebook keeps logging you into your personal account, try the logout method below to force account selection.
            </p>
            <div className="space-y-3">
              <div>
                <button
                  onClick={logoutFacebookAndConnect}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 font-medium mr-4"
                >
                  {loading ? 'Redirecting...' : '🚪 Logout Facebook & Connect Business Account'}
                </button>
                <span className="text-sm text-gray-600">← Try this first!</span>
              </div>
              <div className="space-x-4">
                <button
                  onClick={connectFacebookWithAccountSelection}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 font-medium"
                >
                  {loading ? 'Redirecting...' : 'Connect with Account Selection'}
                </button>
                <button
                  onClick={connectFacebookBusiness}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 font-medium"
                >
                  {loading ? 'Redirecting...' : 'Connect Business Account (Full Permissions)'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3 text-gray-900">🔬 Test Current Graph API</h3>
            <p className="text-gray-700 mb-4">
              Test what Instagram accounts are visible with your currently connected Facebook account.
            </p>
            <button
              onClick={testGraphAPI}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 font-medium"
            >
              {loading ? 'Testing...' : 'Test Graph API'}
            </button>
          </div>
          </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-100 border border-gray-200 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-3 text-gray-900">📋 Step-by-Step Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Click "Connect with Account Selection" above</li>
            <li>When Facebook shows the account picker, choose <strong>solvifysearch</strong> (not Kevin Mikael Negash)</li>
            <li>Grant the requested permissions</li>
            <li>Come back here and click "Test Graph API" to see if Instagram accounts appear</li>
            <li>If successful, your Instagram Business accounts should now be visible!</li>
          </ol>
        </div>

        {/* Debug Info */}
        <div className="mt-8 bg-gray-200 border border-gray-300 p-4 rounded-lg">
          <h3 className="text-sm font-semibold mb-2 text-gray-900">Debug Info</h3>
          <div className="text-xs font-mono text-gray-700">
            <p>Session User ID: {session?.user?.id}</p>
            <p>Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
            <p>Timestamp: {new Date().toISOString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}