'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client'; // Use the new hook
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

export default function SessionDebug() {
  const { session, user, isLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  // Fetch workspace data when user is available
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        const { data: workspacesData } = await supabase
          .from('workspaces')
          .select('*')
          .eq('owner_id', user.id);
          
        setWorkspaces(workspacesData || []);
      } catch (e) {
        console.error('Error fetching workspace data:', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkspaces();
  }, [user]);
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const createDefaultWorkspace = async () => {
    if (!user?.id) {
      alert('No valid user ID found - cannot create workspace');
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert([{
          name: 'Default Workspace',
          owner_id: user.id,
          created_at: new Date().toISOString(),
          is_personal: true
        }])
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      alert(`Workspace created with ID: ${data.id}`);
      
      // Refresh data
      const { data: refreshedWorkspaces } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id);
        
      setWorkspaces(refreshedWorkspaces || []);
    } catch (e) {
      console.error('Error creating workspace:', e);
      alert(`Failed to create workspace: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button className="bg-gray-600 text-foreground px-4 py-2 rounded shadow-lg">
                Loading Auth...
            </button>
        </div>
    );
  }

  if (!session) {
    return null; // Don't render for unauthenticated users
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="bg-blue-600 hover:bg-blue-700 text-foreground px-4 py-2 rounded shadow-lg flex items-center"
      >
        {expanded ? 'Hide' : 'Debug'} Session
      </button>
      
      {expanded && (
        <div className="mt-2 p-4 bg-background rounded shadow-xl border border-border dark:border-border w-96 max-h-[80vh] overflow-auto">
          <h3 className="text-foreground font-bold">Session Debug</h3>
          
          <div className="mt-3">
            <h4 className="text-foreground dark:text-neutral-300 font-medium">Supabase Session</h4>
            <div className="mt-1 text-muted-foreground text-sm">
              Status: <span className="text-green-400">Authenticated</span>
            </div>
            <div className="text-muted-foreground text-sm">
              User ID: <span className="text-green-400">{user?.id || 'N/A'}</span>
            </div>
            <div className="text-muted-foreground text-sm">
              Email: <span className="text-foreground">{user?.email || 'N/A'}</span>
            </div>
          </div>
          
          <div className="mt-3">
            <h4 className="text-foreground dark:text-neutral-300 font-medium">Workspaces ({workspaces.length})</h4>
            {workspaces.length > 0 ? (
              <ul className="mt-1 text-sm">
                {workspaces.map(ws => (
                  <li key={ws.id} className="text-foreground mb-1">
                    {ws.name} (ID: {ws.id.substring(0, 8)}...)
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-yellow-400 text-sm mt-1">No workspaces found</div>
            )}
          </div>
          
          <div className="mt-4 flex gap-2 flex-wrap">
            {workspaces.length === 0 && user && (
              <button 
                onClick={createDefaultWorkspace}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-foreground px-3 py-1 text-sm rounded disabled:opacity-50"
              >
                Create Workspace
              </button>
            )}
            
            <button 
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 text-foreground px-3 py-1 text-sm rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 