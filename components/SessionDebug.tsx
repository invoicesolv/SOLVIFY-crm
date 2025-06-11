'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SessionDebug() {
  const { data: session, status, update } = useSession();
  const [supabaseSession, setSupabaseSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  // Fetch Supabase session and workspace data
  useEffect(() => {
    const fetchData = async () => {
      if (status !== 'authenticated') return;
      
      setLoading(true);
      try {
        // Get current Supabase session
        const { data: { session: sbSession }, error } = await supabase.auth.getSession();
        setSupabaseSession(sbSession);
        
        // Fetch profile by email to verify ID mapping
        if (session?.user?.email) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', session.user.email)
            .single();
            
          setProfile(profileData || null);
          
          // Fetch workspaces using profile ID (should be the same as session.user.id)
          if (profileData?.id) {
            const { data: workspacesData } = await supabase
              .from('workspaces')
              .select('*')
              .eq('owner_id', profileData.id);
              
            setWorkspaces(workspacesData || []);
          }
        }
      } catch (e) {
        console.error('Error fetching debug data:', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [session, status]);
  
  const handleForceRefresh = async () => {
    setLoading(true);
    try {
      await update(); // Update NextAuth session
      router.refresh(); // Refresh the page
    } catch (e) {
      console.error('Failed to refresh session:', e);
    } finally {
      setLoading(false);
    }
  };
  
  const createDefaultWorkspace = async () => {
    if (!profile?.id) {
      alert('No valid profile ID found - cannot create workspace');
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert([{
          name: 'Default Workspace',
          owner_id: profile.id, // Always use profile.id, not session.user.id
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
        .eq('owner_id', profile.id);
        
      setWorkspaces(refreshedWorkspaces || []);
      router.refresh();
    } catch (e) {
      console.error('Error creating workspace:', e);
      alert(`Failed to create workspace: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  if (status !== 'authenticated') {
    return null; // Don't render for unauthenticated users
  }

  // Check for ID consistency issues
  const idMatches = profile?.id === session?.user?.id;
  const idMatchClass = idMatches ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400 font-bold";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="bg-blue-600 hover:bg-blue-700 text-foreground px-4 py-2 rounded shadow-lg flex items-center"
      >
        {expanded ? 'Hide' : 'Debug'} Session {!idMatches && '⚠️'}
      </button>
      
      {expanded && (
        <div className="mt-2 p-4 bg-background rounded shadow-xl border border-border dark:border-border w-96 max-h-[80vh] overflow-auto">
          <h3 className="text-foreground font-bold">Session Debug</h3>
          
          <div className="mt-3">
            <h4 className="text-foreground dark:text-neutral-300 font-medium">NextAuth Status: <span className="text-green-400">{status}</span></h4>
            <div className="mt-1 text-muted-foreground text-sm">
              Session User ID: <span className={idMatchClass}>{session?.user?.id || 'N/A'}</span>
            </div>
            <div className="text-muted-foreground text-sm">
              Email: <span className="text-foreground">{session?.user?.email || 'N/A'}</span>
            </div>
          </div>
          
          <div className="mt-3">
            <h4 className="text-foreground dark:text-neutral-300 font-medium">Supabase Profile</h4>
            {profile ? (
              <>
                <div className="text-muted-foreground text-sm">
                  Profile ID: <span className={idMatchClass}>{profile.id}</span>
                </div>
                <div className="text-muted-foreground text-sm">
                  Email: <span className="text-foreground">{profile.email}</span>
                </div>
                {!idMatches && (
                  <div className="text-red-400 text-xs mt-1 font-medium">
                    ⚠️ ID MISMATCH DETECTED - Session and Profile IDs don't match!
                  </div>
                )}
              </>
            ) : (
              <div className="text-red-400 text-sm">No profile found</div>
            )}
          </div>
          
          <div className="mt-3">
            <h4 className="text-foreground dark:text-neutral-300 font-medium">Supabase Session</h4>
            <div className="mt-1 text-muted-foreground text-sm">
              Status: <span className="text-foreground">{supabaseSession ? 'Active' : 'None'}</span>
            </div>
            {supabaseSession?.user && (
              <div className="text-muted-foreground text-sm">
                Supabase User ID: <span className="text-foreground">{supabaseSession.user.id}</span>
              </div>
            )}
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
          
          <div className="mt-4 flex gap-2">
            <button 
              onClick={handleForceRefresh}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-foreground px-3 py-1 text-sm rounded disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Force Refresh'}
            </button>
            
            {workspaces.length === 0 && profile && (
              <button 
                onClick={createDefaultWorkspace}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-foreground px-3 py-1 text-sm rounded disabled:opacity-50"
              >
                Create Workspace
              </button>
            )}
            
            <button 
              onClick={() => router.push('/login-debug')}
              className="bg-gray-300 dark:bg-muted-foreground hover:bg-gray-200 dark:bg-muted text-foreground px-3 py-1 text-sm rounded"
            >
              Login Debug
            </button>
            
            <button 
              onClick={() => signOut()}
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