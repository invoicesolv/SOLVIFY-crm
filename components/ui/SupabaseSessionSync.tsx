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
      if (status === "authenticated" && session?.access_token) {
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
          
          // Special case for known problematic users
          if (session.user.email === 'kevin@amptron.com') {
            console.log("[Debug] Special handling for kevin@amptron.com");
            localStorage.setItem('is_special_user', 'true');
          }
        }
        
        try {
          // Check if this is kevin@amptron.com and handle the user ID mapping issue
          if (session.user?.email === 'kevin@amptron.com') {
            console.log("[Debug] Detected kevin@amptron.com login, checking ID mapping");
            const { data, error } = await supabase.rpc('check_user_match', {
              input_nextauth_id: session.user.id,
              input_email: 'kevin@amptron.com'
            });
            
            if (error) {
              console.error("[Debug] Error checking user match:", error);
            } else {
              console.log("[Debug] ID mapping check result:", data);
              
              // If there's a mismatch between NextAuth ID and Supabase ID
              if (data && data[0] && data[0].nextauth_id !== data[0].supabase_id) {
                console.log("[Debug] DETECTED ID MISMATCH:", {
                  nextAuthId: data[0].nextauth_id,
                  supabaseId: data[0].supabase_id
                });
                
                // Store the mismatch in localStorage for debugging
                if (typeof window !== 'undefined') {
                  localStorage.setItem('id_mismatch_data', JSON.stringify({
                    nextAuthId: data[0].nextauth_id,
                    supabaseId: data[0].supabase_id,
                    email: 'kevin@amptron.com',
                    timestamp: new Date().toISOString()
                  }));
                }
              }
            }
          }
        
          const { error } = await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token || "",
          });
          
          if (error) {
            console.error("Error setting Supabase session:", error);
          } else {
            console.log("Supabase session successfully synchronized");
            
            // Verify the session worked by getting the user
            const { data, error: userError } = await supabase.auth.getUser();
            if (userError) {
              console.error("Failed to get user after session sync:", userError);
              
              // If we can't get the user, try to refresh the session
              try {
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) {
                  console.error("Failed to refresh Supabase session:", refreshError);
                } else {
                  console.log("Successfully refreshed Supabase session:", refreshData.session?.user?.email);
                }
              } catch (refreshErr) {
                console.error("Exception during session refresh:", refreshErr);
              }
            } else {
              console.log("Supabase session verified, user:", {
                id: data.user?.id,
                email: data.user?.email,
                role: data.user?.role
              });
              
              console.log("[Debug] Session/Database user comparison:", {
                nextAuthId: session.user?.id,
                nextAuthEmail: session.user?.email,
                supabaseId: data.user?.id,
                supabaseEmail: data.user?.email,
                emailMatch: session.user?.email === data.user?.email,
                idMatch: session.user?.id === data.user?.id
              });
              
              // Test query to verify permissions with authenticated user ID
              try {
                const { data: testMemberships, error: testError } = await supabase
                  .from('team_members')
                  .select('workspace_id, email')
                  .eq('user_id', session.user.id)
                  .limit(1);
                  
                if (testError) {
                  console.log("Initial database access test failed:", testError);
                  console.log("This could be due to RLS policies. This is normal.");
                  
                  // Try querying by email as fallback
                  if (session.user?.email) {
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
                    
                    // If we found the user by email but not by ID, there's a mismatch
                    if (emailMemberships?.length && session.user.id) {
                      console.log("[Debug] ID MISMATCH CONFIRMED: NextAuth ID doesn't match team_members.user_id");
                    }
                  }
                } else {
                  console.log("Test query result:", {
                    success: !testError,
                    hasData: !!testMemberships?.length,
                    data: testMemberships,
                    error: testError
                  });
                }
              } catch (queryErr) {
                console.error("Error during test query:", queryErr);
              }
            }
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
          localStorage.removeItem('is_special_user');
        }
      } else {
        console.log("Session status:", status);
      }
    };

    syncSession();
  }, [session, status]);

  return <>{children}</>;
} 