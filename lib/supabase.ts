import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!

const isBrowser = typeof window !== 'undefined'

// Create storage object based on environment
const customStorage = {
  getItem: (key: string) => {
    if (!isBrowser) return null
    console.log('[SUPABASE DEBUG] Getting item from localStorage:', key);
    const value = localStorage.getItem(key);
    console.log('[SUPABASE DEBUG] Value presence for', key, ':', value ? 'Present' : 'Missing');
    return value;
  },
  setItem: (key: string, value: string) => {
    if (!isBrowser) return
    console.log('[SUPABASE DEBUG] Setting item in localStorage:', key);
    try {
      localStorage.setItem(key, value);
      console.log('[SUPABASE DEBUG] Successfully set', key, 'in localStorage');
    } catch (err) {
      console.error('[SUPABASE DEBUG] Error setting localStorage item:', err);
    }
  },
  removeItem: (key: string) => {
    if (!isBrowser) return
    console.log('[SUPABASE DEBUG] Removing item from localStorage:', key);
    localStorage.removeItem(key);
  }
}

// Global variables to hold singleton instances
let supabaseClientSingleton: any = null;
let supabaseAdminSingleton: any = null;

// Properly implement the singleton pattern with a function that ensures only one client exists
function getSupabaseClient() {
  if (supabaseClientSingleton === null) {
    supabaseClientSingleton = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: customStorage,
        debug: process.env.NODE_ENV === 'development',
        // Prevent automatic redirects - let our app handle the flow
        flowType: 'pkce'
      }
    });
  }
  return supabaseClientSingleton;
}

// Properly implement the singleton pattern for admin client
function getSupabaseAdmin() {
  if (supabaseAdminSingleton === null) {
    supabaseAdminSingleton = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return supabaseAdminSingleton;
}

// Export the singleton instances
export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdmin();

// Function to sync NextAuth session with Supabase
export const syncSupabaseSession = async (accessToken: string) => {
  try {
    console.log("=============== SUPABASE SESSION SYNC DEBUG ===============");
    console.log("[Supabase] Starting session sync with token length:", accessToken?.length || 0);
    
    if (!accessToken) {
      console.error("[Supabase] Cannot sync session: No access token provided");
      return null;
    }

    console.log("[Supabase] Syncing session with token");
    
    // Instead of using setSession which expects a Supabase token,
    // we'll use signInWithPassword which creates a proper Supabase session
    try {
      // Try to get user information from NextAuth session
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      console.log("[Supabase] Fetching session from:", `${baseUrl}/api/auth/session`);
      
      const sessionResponse = await fetch(`${baseUrl}/api/auth/session`);
      if (!sessionResponse.ok) {
        console.error("[Supabase] Failed to fetch session:", sessionResponse.status, sessionResponse.statusText);
        try {
          const errorText = await sessionResponse.text();
          console.error("[Supabase] Session error response:", errorText);
        } catch (e) {
          console.error("[Supabase] Couldn't read error response");
        }
        return null;
      }
      
      const sessionData = await sessionResponse.json();
      console.log("[Supabase] Session data received:", {
        hasUser: !!sessionData?.user,
        userEmail: sessionData?.user?.email,
        userId: sessionData?.user?.id
      });
      
      const { user } = sessionData;
      
      if (!user?.email) {
        console.error("[Supabase] No user email found in NextAuth session");
        return null;
      }

      console.log(`[Supabase] Authenticating user: ${user.email} (ID: ${user.id})`);
      
      // Before proceeding, verify the user exists in Supabase Auth to catch mismatches
      console.log("[Supabase] Pre-check: Verifying user exists in Supabase Auth");
      try {
        const { data: authUserData, error: authError } = await supabaseAdmin.auth.admin.getUserById(user.id);
        
        if (authError) {
          console.warn("[Supabase] Auth user lookup failed:", authError.message);
          console.log("[Supabase] Checking if user exists with email instead");
          
          // Try to find by email
          const { data: emailUsers, error: emailError } = await supabaseAdmin.auth.admin.listUsers({
            filter: { email: user.email }
          });
          
          if (!emailError && emailUsers?.users?.length > 0) {
            const existingUser = emailUsers.users[0];
            console.log(`[Supabase] Found user in auth.users with email, but ID mismatch:
              Session ID: ${user.id}
              Auth User ID: ${existingUser.id}`);
            
            // Update oauth mapping to fix the mismatch
            const { error: mappingError } = await supabaseAdmin
              .from('oauth_provider_mapping')
              .upsert({
                provider_id: user.id,
                provider_name: 'google',
                user_uuid: existingUser.id,
                email: user.email,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              }, {
                onConflict: 'provider_id,provider_name'
              });
            
            if (mappingError) {
              console.error("[Supabase] Failed to update oauth mapping:", mappingError);
            } else {
              console.log("[Supabase] Updated oauth mapping to fix ID mismatch");
            }
            
            // Continue using the auth user ID from this point
            console.log("[Supabase] Proceeding with existing auth user ID:", existingUser.id);
            user.id = existingUser.id; // Update user ID for the rest of the function
          } else {
            console.warn("[Supabase] User does not exist in auth.users. Proceeding anyway, the API will attempt to create or match user.");
          }
        } else {
          console.log("[Supabase] User exists in auth.users with matching ID:", authUserData.user.id);
        }
      } catch (authCheckError) {
        console.error("[Supabase] Error checking auth user:", authCheckError);
      }
      
      // Look up user in profiles table
      console.log("[Supabase] Looking up user in profiles table");
      const profileLookup = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('email', user.email)
          .maybeSingle();
          
      if (profileLookup.error) {
        console.error("[Supabase] Error finding user:", profileLookup.error.code, profileLookup.error.message, profileLookup.error.details);
        return null;
      }
      
      // Store the profile data in a variable we can modify later
      let userData = profileLookup.data;
      
      if (!userData) {
        console.error("[Supabase] User not found in Supabase profiles table");
        
        // Try to create a profile
        console.log("[Supabase] Attempting to create profile for user:", user.id);
        try {
          const { error: createError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              name: user.name || user.email.split('@')[0] || 'User',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              phone: '',
              company: '',
              role: '',
              address: '',
              city: '',
              country: '',
              website: '',
              password: ''
            });
            
          if (createError) {
            console.error("[Supabase] Failed to create profile:", createError);
          } else {
            console.log("[Supabase] Successfully created profile for user:", user.id);
            // Refetch the profile
            const newProfileLookup = await supabaseAdmin
              .from('profiles')
              .select('id, email')
              .eq('id', user.id)
              .single();
              
            if (!newProfileLookup.error && newProfileLookup.data) {
              console.log("[Supabase] Using newly created profile:", newProfileLookup.data);
              userData = newProfileLookup.data;
            }
          }
        } catch (createError) {
          console.error("[Supabase] Exception creating profile:", createError);
        }
      }

      // Use profile ID if available
      const userId = userData?.id || user.id;
      
      console.log("[Supabase] Found user in profiles:", {
        id: userId,
        email: userData?.email || user.email,
        matchesSessionId: userId === user.id
      });
      
      // Create a custom token via an API endpoint
      console.log("[Supabase] Calling create-supabase-token API endpoint");
      const tokenResponse = await fetch('/api/auth/create-supabase-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          email: userData?.email || user.email,
          accessToken
        })
      });
              
      if (!tokenResponse.ok) {
        console.error("[Supabase] Failed to create custom token:", tokenResponse.status, tokenResponse.statusText);
        try {
          const errorData = await tokenResponse.json();
          console.error("[Supabase] Token API error:", errorData);
          
          // If error is about user not found in auth.users table
          if (errorData?.error?.includes('User not found') || 
              (errorData?.details?.message && errorData.details.message.includes('User not found'))) {
            
            console.log("[Supabase] User exists in profiles but not in auth.users - attempting direct auth fix");
            
            // Try to do a direct admin API call to fix this
            try {
              // Create a temp password
              const tempPassword = generateRandomPassword(16);
              
              // Create user with admin API
              const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
                email: userData?.email || user.email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                  full_name: user.name || 'User',
                  from_oauth: true,
                  oauth_provider: 'google'
                }
              });
              
              if (createAuthError) {
                console.error("[Supabase] Failed direct auth user creation:", createAuthError);
              } else {
                console.log("[Supabase] Created auth user directly:", newAuthUser.user.id);
                
                // Now try the sign in
                const { data, error } = await supabase.auth.signInWithPassword({
                  email: userData?.email || user.email,
                  password: tempPassword
                });
                
                if (error) {
                  console.error("[Supabase] Direct auth sign-in failed:", error);
                } else {
                  console.log("[Supabase] Direct auth sign-in successful");
                  console.log("[Supabase] Session info:", {
                    hasSession: !!data?.session,
                    accessTokenLength: data?.session?.access_token?.length,
                    refreshTokenLength: data?.session?.refresh_token?.length,
                    expiresAt: data?.session?.expires_at
                  });
                  console.log("=============== END SUPABASE SESSION SYNC DEBUG ===============");
                  return data.session;
                }
              }
            } catch (directAuthError) {
              console.error("[Supabase] Exception in direct auth fix:", directAuthError);
            }
          }
        } catch (e) {
          try {
            const errorText = await tokenResponse.text();
            console.error("[Supabase] Token API error text:", errorText);
          } catch (textError) {
            console.error("[Supabase] Couldn't read token API error response");
          }
        }
        return null;
      }
      
      const tokenData = await tokenResponse.json();
      console.log("[Supabase] Received token from API:", {
        hasToken: !!tokenData?.token,
        tokenLength: tokenData?.token?.length
      });
      
      if (!tokenData.token) {
        console.error("[Supabase] No token returned from API");
        return null;
      }
      
      // Sign in with the custom token
      console.log("[Supabase] Signing in with password (token)");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData?.email || user.email,
        password: tokenData.token // This isn't a real password, but a token exchange mechanism
      });
      
      if (error) {
        console.error("[Supabase] Auth error:", error.message, error.cause);
        return null;
      }
      
      console.log("[Supabase] Successfully authenticated user:", userId);
      console.log("[Supabase] Session info:", {
        hasSession: !!data?.session,
        accessTokenLength: data?.session?.access_token?.length,
        refreshTokenLength: data?.session?.refresh_token?.length,
        expiresAt: data?.session?.expires_at
      });
      console.log("=============== END SUPABASE SESSION SYNC DEBUG ===============");
      return data.session;
      
    } catch (error) {
      console.error("[Supabase] Authentication error:", error);
      if (error instanceof Error) {
        console.error("[Supabase] Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return null;
    }
  } catch (error) {
    console.error("[Supabase] Unexpected error during authentication:", error);
    if (error instanceof Error) {
      console.error("[Supabase] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return null;
  }
};

// Helper function to generate a random password
function generateRandomPassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Type-safe database functions
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          company: string
          role: string
          address: string
          city: string
          country: string
          website: string
          password: string
          avatarUrl?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          company: string
          role: string
          address: string
          city: string
          country: string
          website: string
          password: string
          avatarUrl?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          company?: string
          role?: string
          address?: string
          city?: string
          country?: string
          website?: string
          password?: string
          avatarUrl?: string
          created_at?: string
          updated_at?: string
        }
      }
      payment_methods: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      currencies: {
        Row: {
          id: string
          code: string
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          created_at?: string
        }
      }
      invoice_types: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          document_number: string
          customer_id: string | null
          invoice_date: string
          total: number
          balance: number
          due_date: string
          currency_id: string | null
          invoice_type_id: string | null
          payment_method_id: string | null
          external_reference: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_number: string
          customer_id?: string | null
          invoice_date: string
          total: number
          balance: number
          due_date: string
          currency_id?: string | null
          invoice_type_id?: string | null
          payment_method_id?: string | null
          external_reference?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_number?: string
          customer_id?: string | null
          invoice_date?: string
          total?: number
          balance?: number
          due_date?: string
          currency_id?: string | null
          invoice_type_id?: string | null
          payment_method_id?: string | null
          external_reference?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      recurring_invoices: {
        Row: {
          id: string
          original_invoice_id: string
          customer_id: string
          next_invoice_date: string
          total: number
          currency_id: string | null
          invoice_type_id: string | null
          payment_method_id: string | null
          status: 'draft' | 'pending' | 'sent_to_finance' | 'test_sent'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          original_invoice_id: string
          customer_id: string
          next_invoice_date: string
          total: number
          currency_id?: string | null
          invoice_type_id?: string | null
          payment_method_id?: string | null
          status?: 'draft' | 'pending' | 'sent_to_finance' | 'test_sent'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          original_invoice_id?: string
          customer_id?: string
          next_invoice_date?: string
          total?: number
          currency_id?: string | null
          invoice_type_id?: string | null
          payment_method_id?: string | null
          status?: 'draft' | 'pending' | 'sent_to_finance' | 'test_sent'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      // Add your view types here
    }
    Functions: {
      // Add your function types here
    }
  }
}

// Create a truly unique client for server-side use
export const createServerSupabaseClient = () => {
  return createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    }
  }
  );
};

  /**
 * Utility to check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Gets a consistent user ID by checking if the provided ID is a valid UUID
 * and falling back to looking up the user by email if not
 * 
 * @param userId The ID to check (could be numeric Google ID)
 * @param email User's email for fallback lookup
 * @returns Promise resolving to a valid UUID or undefined if not found
 */
export async function getConsistentUserId(userId: string | undefined, email?: string | null): Promise<string | undefined> {
  if (!userId) {
    console.log('[getConsistentUserId] No user ID provided');
    return undefined;
  }
  
  // If the ID is already a valid UUID, return it
  if (isValidUUID(userId)) {
    console.log(`[getConsistentUserId] ID is already a valid UUID: ${userId}`);
    return userId;
  }
  
  console.log(`[getConsistentUserId] Non-UUID ID detected: ${userId}, attempting to find valid ID`);

  // First, check if this is a Google ID in our mapping table
  try {
    console.log(`[getConsistentUserId] Checking oauth_provider_mapping for provider ID: ${userId}`);
    const { data: mappedUser, error: mappingError } = await supabaseAdmin
      .from('oauth_provider_mapping')
      .select('user_uuid')
      .eq('provider_id', userId)
      .eq('provider_name', 'google')
      .single();
      
    if (mappingError && mappingError.code !== 'PGRST116') {
      console.error(`[getConsistentUserId] Error checking oauth mapping:`, mappingError);
    } else if (mappedUser && mappedUser.user_uuid) {
      console.log(`[getConsistentUserId] Found mapped UUID: ${mappedUser.user_uuid} for Google ID: ${userId}`);
      return mappedUser.user_uuid;
    }
  } catch (error) {
    console.error(`[getConsistentUserId] Unexpected error checking oauth mapping:`, error);
  }
  
  // If we have an email, try to find the user by email
  if (email) {
    try {
      console.log(`[getConsistentUserId] Looking up user by email: ${email}`);
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
        
      if (error) {
        console.error(`[getConsistentUserId] Error looking up user by email:`, error);
        return undefined;
      }
      
      if (profile && profile.id) {
        console.log(`[getConsistentUserId] Found user ID ${profile.id} for email ${email}`);
        
        // Create or update the mapping for future use
        if (!isNaN(Number(userId))) {
          try {
            const { error: mappingError } = await supabaseAdmin
              .from('oauth_provider_mapping')
              .upsert({
                provider_id: userId,
                provider_name: 'google',
                user_uuid: profile.id,
                email: email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'provider_id,provider_name',
                ignoreDuplicates: false
              });
              
            if (mappingError) {
              console.error(`[getConsistentUserId] Error creating/updating oauth mapping:`, mappingError);
            } else {
              console.log(`[getConsistentUserId] Created/updated oauth mapping for Google ID: ${userId}`);
            }
          } catch (error) {
            console.error(`[getConsistentUserId] Unexpected error creating oauth mapping:`, error);
          }
        }
        
        return profile.id;
      }
    } catch (error) {
      console.error(`[getConsistentUserId] Unexpected error looking up user by email:`, error);
    }
  }
  
  // No special cases for specific emails - all users handled the same way
  
  console.log(`[getConsistentUserId] Could not find valid UUID for user ID: ${userId}`);
  return undefined;
} 