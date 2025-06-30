import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const isBrowser = typeof window !== 'undefined'

// Create cookie-based storage for Supabase auth
const cookieStorage = {
  getItem: (key: string) => {
    if (!isBrowser) return null
    console.log('[SUPABASE DEBUG] Getting item from cookies:', key);
    
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [k, v] = cookie.trim().split('=');
      if (k && v) {
        acc[k] = v;
      }
      return acc;
    }, {} as Record<string, string>);
    
    // Get the value for the exact key
    let value = cookies[key] ? decodeURIComponent(cookies[key]) : null;
    
    console.log('[SUPABASE DEBUG] Value presence for', key, ':', value ? 'Present' : 'Missing');
    return value;
  },
  setItem: (key: string, value: string) => {
    if (!isBrowser) return
    console.log('[SUPABASE DEBUG] Setting item in cookies:', key, 'value length:', value.length);
    
    try {
      // Parse the session data to extract tokens
      let sessionData;
      try {
        sessionData = JSON.parse(value);
        console.log('[SUPABASE DEBUG] Parsed session data:', {
          hasAccessToken: !!sessionData.access_token,
          hasRefreshToken: !!sessionData.refresh_token,
          hasUser: !!sessionData.user,
          expires_at: sessionData.expires_at
        });
      } catch {
        console.log('[SUPABASE DEBUG] Value is not JSON, storing as plain text');
        // If it's not JSON, just store as is
        const encodedValue = encodeURIComponent(value);
        const maxAge = 7 * 24 * 60 * 60; // 7 days
        document.cookie = `${key}=${encodedValue}; max-age=${maxAge}; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
        return;
      }
      
      // Store the session data normally
      const encodedValue = encodeURIComponent(value);
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      document.cookie = `${key}=${encodedValue}; max-age=${maxAge}; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
      console.log('[SUPABASE DEBUG] Set cookie with key:', key);
      
      // If this is session data, also store it in the middleware-expected format
      if (key.includes('auth') && sessionData && sessionData.access_token) {
        // Store in the format middleware expects
        const middlewareSessionData = {
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
          expires_at: sessionData.expires_at,
          expires_in: sessionData.expires_in,
          token_type: sessionData.token_type,
          user: sessionData.user
        };
        const middlewareValue = encodeURIComponent(JSON.stringify(middlewareSessionData));
        document.cookie = `sb-jbspiufukrifntnwlrts-auth-token=${middlewareValue}; max-age=${maxAge}; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
        console.log('[SUPABASE DEBUG] Also set middleware cookie with session data');
        
        // Verify the cookie was set
        setTimeout(() => {
          const testCookies = document.cookie.split(';');
          const middlewareCookie = testCookies.find(c => c.trim().startsWith('sb-jbspiufukrifntnwlrts-auth-token='));
          console.log('[SUPABASE DEBUG] Cookie verification:', middlewareCookie ? 'FOUND' : 'NOT FOUND');
        }, 100);
      }
      
        console.log('[SUPABASE DEBUG] Successfully set', key, 'in cookies');
    } catch (err) {
      console.error('[SUPABASE DEBUG] Error setting cookie:', err);
    }
  },
  removeItem: (key: string) => {
    if (!isBrowser) return
      console.log('[SUPABASE DEBUG] Removing item from cookies:', key);
    
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // Also remove the middleware cookie if this is auth-related
    if (key.includes('auth')) {
      document.cookie = `sb-jbspiufukrifntnwlrts-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      console.log('[SUPABASE DEBUG] Also removed middleware cookie');
    }
  }
}

// Single global instance to prevent multiple clients
let globalSupabaseClient: any = null;
let globalSupabaseAdmin: any = null;

// Function to get or create the singleton client (auth disabled)
function getSupabaseClient() {
  if (globalSupabaseClient === null) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL and Anon Key are required');
    }
    globalSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // Auth is disabled - will use token-based authentication instead
      }
    });
  }
  return globalSupabaseClient;
}

// Function to fetch workspace data automatically using auth
export async function fetchWorkspaceData() {
  const client = createSupabaseAdmin();

  try {
    // Fetch all workspaces for now - you can add user filtering later
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .limit(10);

    if (error) {
      console.error('Error fetching workspace data:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching workspace data:', err);
    return [];
  }
}

// Function to get or create the singleton admin client
function getSupabaseAdmin() {
  if (globalSupabaseAdmin === null) {
    if (!supabaseUrl || !supabaseAdminKey) {
      throw new Error('Supabase URL and Admin Key are required');
    }
    globalSupabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return globalSupabaseAdmin;
}

// Export direct access to singleton clients
export const supabaseDb = (() => {
  try {
    if (supabaseUrl && supabaseAnonKey) {
      return getSupabaseClient();
    }
    return null;
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
    return null;
  }
})();

export const supabaseAdmin = (() => {
  try {
    if (supabaseUrl && supabaseAdminKey) {
      return getSupabaseAdmin();
    }
    return null;
  } catch (error) {
    console.warn('Failed to initialize Supabase admin client:', error);
    return null;
  }
})();

// For backward compatibility, also export as supabase (client)
export const supabase = supabaseDb;

// Auth state listener removed - using token-based authentication instead of Supabase auth

// NextAuth sync functionality removed - using pure Supabase authentication

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
      workspace: {
        Row: {
          id: string
          name: string
          token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          token: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          token?: string
          created_at?: string
          updated_at?: string
        }
      }
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
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required');
  }
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

// Create admin client for server-side admin operations
export const createSupabaseAdmin = () => {
  if (!supabaseUrl || !supabaseAdminKey) {
    throw new Error('Supabase URL and Service Role Key are required for admin operations');
  }
  return createClient(supabaseUrl, supabaseAdminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
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

  // Create admin client for this operation
  const adminClient = createSupabaseAdmin();

  // First, check if this is a Google ID in our mapping table
  try {
    console.log(`[getConsistentUserId] Checking oauth_provider_mapping for provider ID: ${userId}`);
    const { data: mappedUser, error: mappingError } = await adminClient
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
      const { data: profile, error } = await adminClient
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
            const { error: mappingError } = await adminClient
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
