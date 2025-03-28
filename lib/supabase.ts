import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!

const isBrowser = typeof window !== 'undefined'

// Create storage object based on environment
const customStorage = {
  getItem: (key: string) => {
    if (!isBrowser) return null
    return localStorage.getItem(key)
  },
  setItem: (key: string, value: string) => {
    if (!isBrowser) return
    localStorage.setItem(key, value)
  },
  removeItem: (key: string) => {
    if (!isBrowser) return
    localStorage.removeItem(key)
  }
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storage: customStorage,
    debug: false
  }
})

// Create a service role client for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})

// Function to sync NextAuth session with Supabase
export const syncSupabaseSession = async (accessToken: string) => {
  try {
    if (!accessToken) {
      console.log('[Auth] No access token provided for sync');
      return null;
    }

    const { data: { session }, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: ''
    });

    if (error) {
      console.log('[Auth] Error syncing session:', error.message);
      return null;
    }

    if (session) {
      console.log('[Auth] Session synced successfully');
    }

    return session;
  } catch (error) {
    console.log('[Auth] Exception in syncSupabaseSession:', error);
    return null;
  }
};

// Only run client-side session checks in browser environment
if (isBrowser) {
  // Log initial session state
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      console.log('[Auth] Authenticated:', {
        user: session.user.email,
        role: session.user.user_metadata.role
      })
    }
  })

  // Log authentication state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      console.log('[Auth] State Change:', {
        event,
        user: session.user.email,
        role: session.user.user_metadata.role
      })
    }
  })
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

// Export for server-side usage
export const createServerSupabaseClient = () => createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false
    }
  }
) 