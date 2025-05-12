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
        debug: process.env.NODE_ENV === 'development'
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
    if (!accessToken) {
      return null;
    }

    const { data: { session }, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: ''
    });

    if (error) {
      return null;
    }

    return session;
  } catch (error) {
    return null;
  }
};

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

// Helper function for ensuring consistent user identifiers across auth providers
export function getConsistentUserId(sessionUserId: string | undefined, email?: string | null): string | undefined {
  if (!sessionUserId) return undefined;
  
  // In a production environment, you'd want to maintain a mapping table
  // in your database rather than using hardcoded IDs or email checks
  
  // No special user mapping
  
  return sessionUserId;
} 