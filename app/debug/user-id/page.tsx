'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useConsistentUserId } from '@/hooks/useConsistentUserId';
import { isValidUUID } from '@/lib/supabase';

export default function UserIdDebugPage() {
  const { data: session, status } = useSession();
  const { consistentId, isLoading, error, originalId } = useConsistentUserId();
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);

  async function fetchDebugData() {
    try {
      setIsLoadingDebug(true);
      const response = await fetch('/api/auth/debug/id');
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Error fetching debug data:', error);
    } finally {
      setIsLoadingDebug(false);
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchDebugData();
    }
  }, [session]);

  if (status === 'loading' || isLoading) {
    return <div className="p-4">Loading user information...</div>;
  }

  if (status === 'unauthenticated') {
    return <div className="p-4">Please sign in to view this page.</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">User ID Debug Page</h1>
      
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="text-xl font-semibold mb-2">User ID Information</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="font-semibold">Session User ID:</div>
          <div className={`font-mono ${isValidUUID(session?.user?.id || '') ? 'text-green-600' : 'text-red-600'}`}>
            {session?.user?.id || 'Not available'}
          </div>
          
          <div className="font-semibold">Consistent User ID:</div>
          <div className="font-mono text-green-600">{consistentId || 'Not available'}</div>
          
          <div className="font-semibold">Valid UUID Format:</div>
          <div className={isValidUUID(session?.user?.id || '') ? 'text-green-600' : 'text-red-600'}>
            {isValidUUID(session?.user?.id || '') ? 'Yes' : 'No'}
          </div>
          
          <div className="font-semibold">Original Google ID:</div>
          <div className="font-mono">{(session?.user as any)?.originalGoogleId || 'Not available'}</div>
          
          <div className="font-semibold">Email:</div>
          <div>{session?.user?.email || 'Not available'}</div>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 border border-red-300 rounded bg-red-50 text-red-700">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{error.message}</p>
        </div>
      )}
      
      <div className="mb-6">
        <button 
          onClick={fetchDebugData} 
          className="px-4 py-2 bg-blue-500 text-foreground rounded hover:bg-blue-600 transition"
          disabled={isLoadingDebug}
        >
          {isLoadingDebug ? 'Loading...' : 'Refresh Debug Data'}
        </button>
      </div>
      
      {debugData && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">API Debug Results</h2>
          
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Session Data</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="font-semibold">User ID:</div>
              <div className="font-mono">{debugData.sessionUserId}</div>
              
              <div className="font-semibold">Valid UUID:</div>
              <div className={debugData.isValidUUID ? 'text-green-600' : 'text-red-600'}>
                {debugData.isValidUUID ? 'Yes' : 'No'}
              </div>
              
              <div className="font-semibold">Original Google ID:</div>
              <div className="font-mono">{debugData.originalGoogleId || 'N/A'}</div>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Profile Data</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="font-semibold">Profile by ID:</div>
              <div className={debugData.profileByIdExists ? 'text-green-600' : 'text-red-600'}>
                {debugData.profileByIdExists ? 'Found' : 'Not Found'}
              </div>
              
              {debugData.profileByIdError && (
                <>
                  <div className="font-semibold">Profile ID Error:</div>
                  <div className="text-red-600">{debugData.profileByIdError}</div>
                </>
              )}
              
              <div className="font-semibold">Profile by Email:</div>
              <div className={debugData.profileByEmailExists ? 'text-green-600' : 'text-red-600'}>
                {debugData.profileByEmailExists ? 'Found' : 'Not Found'}
              </div>
              
              {debugData.profileByEmailError && (
                <>
                  <div className="font-semibold">Profile Email Error:</div>
                  <div className="text-red-600">{debugData.profileByEmailError}</div>
                </>
              )}
              
              {debugData.profileIdsMatch !== undefined && (
                <>
                  <div className="font-semibold">Profile IDs Match:</div>
                  <div className={debugData.profileIdsMatch ? 'text-green-600' : 'text-red-600'}>
                    {debugData.profileIdsMatch ? 'Yes' : 'No'}
                  </div>
                </>
              )}
            </div>
            
            {debugData.profileById && (
              <div className="mt-2 p-2 bg-muted rounded">
                <div className="font-semibold">Profile by ID:</div>
                <pre className="text-xs overflow-auto p-2">{JSON.stringify(debugData.profileById, null, 2)}</pre>
              </div>
            )}
            
            {debugData.profileByEmail && (
              <div className="mt-2 p-2 bg-muted rounded">
                <div className="font-semibold">Profile by Email:</div>
                <pre className="text-xs overflow-auto p-2">{JSON.stringify(debugData.profileByEmail, null, 2)}</pre>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Team Members & Workspaces</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="font-semibold">Team Members:</div>
              <div className={debugData.teamMembersFound ? 'text-green-600' : 'text-red-600'}>
                {debugData.teamMembersFound ? 'Found' : 'Not Found'}
              </div>
              
              {debugData.teamMembersError && (
                <>
                  <div className="font-semibold">Team Members Error:</div>
                  <div className="text-red-600">{debugData.teamMembersError}</div>
                </>
              )}
              
              <div className="font-semibold">Workspaces:</div>
              <div className={debugData.workspacesFound ? 'text-green-600' : 'text-red-600'}>
                {debugData.workspacesFound ? 'Found' : 'Not Found'}
              </div>
              
              {debugData.workspacesError && (
                <>
                  <div className="font-semibold">Workspaces Error:</div>
                  <div className="text-red-600">{debugData.workspacesError}</div>
                </>
              )}
            </div>
            
            {debugData.teamMember && (
              <div className="mt-2 p-2 bg-muted rounded">
                <div className="font-semibold">Team Member:</div>
                <pre className="text-xs overflow-auto p-2">{JSON.stringify(debugData.teamMember, null, 2)}</pre>
              </div>
            )}
            
            {debugData.workspace && (
              <div className="mt-2 p-2 bg-muted rounded">
                <div className="font-semibold">Workspace:</div>
                <pre className="text-xs overflow-auto p-2">{JSON.stringify(debugData.workspace, null, 2)}</pre>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Raw Debug Data</h3>
            <pre className="text-xs overflow-auto p-2 bg-muted rounded">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
} 