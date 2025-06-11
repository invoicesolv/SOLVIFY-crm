import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as jose from 'jose';
import authOptions from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Generate a random password for the user
function generateSecurePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function POST(request: Request) {
  console.log("=============== CREATE SUPABASE TOKEN DEBUG ===============");
  console.log("[Auth Token API] Received request");
  
  try {
    // Verify the request is coming from an authenticated user
    console.log("[Auth Token API] Getting server session");
    const session = await getServerSession(authOptions);
    console.log("[Auth Token API] Session info:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    });
    
    if (!session?.user) {
      console.error('[Auth Token API] No authenticated session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log("[Auth Token API] Parsing request body");
    let requestBody;
    try {
      requestBody = await request.json();
      console.log("[Auth Token API] Request body:", {
        userId: requestBody.userId,
        hasEmail: !!requestBody.email,
        hasAccessToken: !!requestBody.accessToken,
      });
    } catch (error) {
      console.error("[Auth Token API] Error parsing request body:", error);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { userId, email } = requestBody;
    
    if (!userId || !email) {
      console.error("[Auth Token API] Missing required fields");
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Verify the requested userId matches the authenticated user
    console.log("[Auth Token API] Session user ID:", session.user.id);
    console.log("[Auth Token API] Requested user ID:", userId);
    
    if (session.user.id !== userId) {
      console.error('[Auth Token API] User ID mismatch');
      return NextResponse.json({ error: 'Unauthorized - User ID mismatch' }, { status: 403 });
    }
    
    // Check if user exists in Supabase
    console.log("[Auth Token API] Checking if user exists in profiles");
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .maybeSingle();
      
    if (userError) {
      console.error('[Auth Token API] Error checking user:', userError.code, userError.message, userError.details);
      return NextResponse.json({ error: 'Database error', details: userError }, { status: 500 });
    }
    
    console.log("[Auth Token API] User check result:", {
      found: !!userData,
      email: userData?.email
    });
    
    // Create temporary access credentials for this user
    const tempPassword = generateSecurePassword();
    console.log("[Auth Token API] Generated temporary password");
    
    // Now checking if user exists in Supabase Auth
    console.log("[Auth Token API] Checking if user exists in auth.users");
    try {
      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      console.log("[Auth Token API] Auth user check result:", {
        found: !!authUserData?.user,
        authId: authUserData?.user?.id,
        authEmail: authUserData?.user?.email,
        error: authUserError ? `${authUserError.name}: ${authUserError.message}` : null
      });
      
      if (authUserError) {
        // This may indicate user doesn't exist in auth.users
        console.log("[Auth Token API] Auth user check error - user might not exist in auth.users");
        
        if (!userData) {
          console.error('[Auth Token API] User not found in profiles or auth.users');
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
      
        // Create a new user in Supabase Auth
        console.log("[Auth Token API] Creating new auth user with exact payload:", {
          email: email,
          // Not logging password for security
          has_password: !!tempPassword,
          password_length: tempPassword?.length || 0,
          email_confirm: true,
          user_metadata: {
            full_name: session.user.name,
            from_oauth: true,
            oauth_provider: 'google'
          }
        });
        
        // Add detailed API error logging
        try {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: session.user.name,
              from_oauth: true,
              oauth_provider: 'google'
            }
          });
          
          if (authError) {
            console.error('[Auth Token API] Error creating auth user:', authError.message, authError.cause);
            // Detailed error logging
            console.error('[Auth Token API] Auth error details:', {
              status: authError.status,
              name: authError.name,
              message: authError.message,
              code: (authError as any).code,
              details: (authError as any).details,
              hint: (authError as any).hint
            });
            
            // Check for common error cases
            if (authError.message.includes('duplicate')) {
              console.log('[Auth Token API] This appears to be a duplicate user error. Trying to get existing user...');
              
              // Try to get the user by email
              const { data: existingUser, error: existingUserError } = await supabaseAdmin.auth.admin.listUsers({
                filter: { email }
              });
              
              if (existingUserError) {
                console.error('[Auth Token API] Error looking up existing user:', existingUserError);
              } else if (existingUser?.users?.length) {
                const user = existingUser.users[0];
                console.log(`[Auth Token API] Found existing auth user: ${user.id}, attempting to update password`);
                
                // Try to update the existing user's password
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                  user.id,
                  { password: tempPassword }
                );
                
                if (updateError) {
                  console.error('[Auth Token API] Error updating existing user password:', updateError);
                  return NextResponse.json({ 
                    error: 'Failed to update credentials',
                    details: {
                      message: updateError.message,
                      code: updateError.name
                    }
                  }, { status: 500 });
                }
                
                console.log('[Auth Token API] Successfully updated existing user password, proceeding with token');
                return NextResponse.json({ token: tempPassword });
              }
            }
            
            return NextResponse.json({ 
              error: 'Failed to create user', 
              details: { 
                message: authError.message,
                code: authError.name
              } 
            }, { status: 500 });
          }
          
          console.log('[Auth Token API] Created new Supabase auth user:', authData.user.id);
        } catch (createError) {
          console.error('[Auth Token API] Exception during auth user creation:', createError);
          if (createError instanceof Error) {
            console.error('[Auth Token API] Error details:', {
              name: createError.name,
              message: createError.message,
              stack: createError.stack
            });
          }
          
          return NextResponse.json({ 
            error: 'Exception during user creation', 
            details: String(createError)
          }, { status: 500 });
        }
      } else {
        // User exists in auth.users, update password
        console.log("[Auth Token API] Updating existing auth user password");
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: tempPassword }
        );
        
        if (updateError) {
          console.error('[Auth Token API] Error updating user password:', updateError.message, updateError.cause);
          return NextResponse.json({ 
            error: 'Failed to update credentials',
            details: {
              message: updateError.message,
              code: updateError.name
            }
          }, { status: 500 });
        }
        
        console.log('[Auth Token API] Updated user credentials for:', userId);
      }
    } catch (error) {
      console.error('[Auth Token API] Error checking/updating auth user:', error);
      if (error instanceof Error) {
        console.error('[Auth Token API] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return NextResponse.json({ error: 'Auth user check/update error' }, { status: 500 });
    }
    
    // Return the temporary token for client-side authentication
    console.log('[Auth Token API] Successfully created/updated auth user, returning token');
    console.log("=============== END CREATE SUPABASE TOKEN DEBUG ===============");
    return NextResponse.json({ token: tempPassword });
    
  } catch (error) {
    console.error('[Auth Token API] Unexpected error:', error);
    if (error instanceof Error) {
      console.error('[Auth Token API] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
} 