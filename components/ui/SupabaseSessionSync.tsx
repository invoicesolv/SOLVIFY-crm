"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function SupabaseSessionSync({ 
  children 
}: { 
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();

  useEffect(() => {
    const syncSession = async () => {
      // Explicitly handle each status case
      if (status === "loading") {
        console.log("Session status: loading - waiting for session to resolve");
        return;
      }
      
      if (status === "authenticated" && session?.user?.id) {
        console.log("[Debug] Session sync starting with user details:", { 
          userId: session.user?.id,
          email: session.user?.email,
          hasAccessToken: !!session.access_token,
          hasRefreshToken: !!session.refresh_token
        });
        
        // Store user info in localStorage for debugging purposes
        if (typeof window !== 'undefined' && session.user?.email) {
          localStorage.setItem('current_user_email', session.user.email);
          localStorage.setItem('current_user_id', session.user.id || '');
        }
        
        try {
          try {
            // Skip JWT validation for Google OAuth
            // Google OAuth tokens have a different structure than Supabase tokens
            const isGoogleAuth = !!session.access_token && !(session as any).supabaseAccessToken;
            
            if (isGoogleAuth) {
              // For Google OAuth logins, use the token directly 
              console.log("[Debug] Detected Google OAuth. Skipping authentication - will rely on RLS policies");
              // Do NOT use anonymous auth
            } 
            else if ((session as any).supabaseAccessToken) {
              // For credential logins, we have proper Supabase tokens
              console.log("[Debug] Using Supabase token from session");
              try {
            const { error } = await supabase.auth.setSession({
                  access_token: (session as any).supabaseAccessToken,
                  refresh_token: "",
            });
            
            if (error) {
                  console.error("[Debug] Error setting Supabase session:", error);
                  // Don't fallback to anonymous auth, just log the error
                  console.log("[Debug] Session sync failed, but continuing without authentication");
                } else {
                  console.log("[Debug] Successfully set Supabase session");
                }
              } catch (err) {
                console.error("[Debug] Exception setting Supabase session:", err);
                // Don't fallback to anonymous auth, just log the error
                console.log("[Debug] Session sync failed, but continuing without authentication");
              }
            } 
            else {
              // No valid tokens, don't use anonymous auth
              console.log("[Debug] No valid tokens found. Skipping authentication");
                  }
            
            // Test queries to verify access with our RLS policies
            try {
              // Test team members access
              const { data: teamMembers, error: teamError } = await supabase
                    .from('team_members')
                    .select('workspace_id, email')
                    .eq('user_id', session.user.id)
                    .limit(1);
                    
              console.log("Team members table check:", {
                hasData: !!teamMembers?.length,
                error: teamError?.message,
                errorCode: teamError?.code
              });
              
              // Test workspaces access
              const { data: workspaces, error: workspacesError } = await supabase
                .from('workspaces')
                .select('id, name')
                .limit(5);
                
              console.log("Workspaces table check:", {
                hasData: !!workspaces?.length,
                error: workspacesError?.message,
                errorCode: workspacesError?.code
              });
              
              if (teamError || (!teamMembers?.length && session.user?.email)) {
                    // Try querying by email as fallback
                      console.log("[Debug] Trying to query team_members by email instead");
                      const { data: emailMemberships, error: emailError } = await supabase
                        .from('team_members')
                        .select('workspace_id, user_id, email')
                        .eq('email', session.user.email)
                        .limit(1);
                        
                      console.log("[Debug] Email-based query result:", {
                        success: !emailError,
                        hasData: !!emailMemberships?.length,
                        data: emailMemberships,
                        error: emailError
                      });
                    }
            } catch (queryErr) {
              console.error("Error during test queries:", queryErr);
            }
          } catch (sessionError) {
            console.error("Exception during auth:", sessionError);
            
            // Don't try anonymous auth, just log the error
            console.log("[Debug] Authentication process failed, but continuing without authentication");
          }
        } catch (error) {
          console.error("Exception during session sync:", error);
        }
      } else if (status === "unauthenticated") {
        // Clear Supabase session when NextAuth session is gone
        console.log("No NextAuth session, signing out of Supabase");
        await supabase.auth.signOut();
        
        // Also clear our debugging info
        if (typeof window !== 'undefined') {
          localStorage.removeItem('current_user_email');
          localStorage.removeItem('current_user_id');
        }
      } else {
        // This handles the "authenticated" case without an access token
        // or any other unexpected state
        console.log("Session status:", status, "but missing access token or unexpected state");
      }
    };

    syncSession();
  }, [session, status]);

  return <>{children}</>;
} 