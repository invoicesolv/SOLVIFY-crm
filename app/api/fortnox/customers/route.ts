import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';
const CLIENT_ID = '4LhJwn68IpdR';
const CLIENT_SECRET = 'pude4Qk6dK';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';

// Create Supabase client at runtime only
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Check for both variable names, preferring the non-public one if both exist
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper to load token from Supabase
async function loadTokenFromSupabase(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot load token: Supabase client not initialized');
    return null;
  }
  
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    // Token is expired
    if (expiresAt <= now) {
      return { refresh_token: data.refresh_token };
    }
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at
    };
  } catch (e) {
    console.error('Error loading token from Supabase:', e);
    return null;
  }
}

// Helper to refresh token
async function refreshToken(refreshToken: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot refresh token: Supabase client not initialized');
    return null;
  }
  
  try {
    const response = await fetch('https://apps5.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
      })
    });
    
    if (response.status === 200) {
      const newTokenData = await response.json();
      
      // Calculate expires_at
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);
      
      // Update token in Supabase
      const { error } = await supabaseAdmin
        .from('settings')
        .upsert({
          service_name: 'fortnox',
          user_id: userId,
          access_token: newTokenData.access_token,
          refresh_token: newTokenData.refresh_token,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'service_name,user_id'
        });
      
      if (error) {
        console.error('Error updating token in Supabase:', error);
        return null;
      }
      
      return {
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAt.toISOString()
      };
    }
    
    return null;
  } catch (e) {
    console.error('Error refreshing token:', e);
    return null;
  }
}

// Store customer email in our database if available
async function storeCustomerEmail(customerNumber: string, customerEmail: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return false;
    }
    
    // Check if customer exists in our database
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('customer_number, email')
      .eq('customer_number', customerNumber)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking if customer exists:', checkError);
      return false;
    }
    
    // Only update if the email is different or customer doesn't exist
    if (!existingCustomer || existingCustomer.email !== customerEmail) {
      if (existingCustomer) {
        // Update existing customer
        const { error: updateError } = await supabase
          .from('customers')
          .update({ email: customerEmail })
          .eq('customer_number', customerNumber);
        
        if (updateError) {
          console.error('Error updating customer email:', updateError);
          return false;
        }
      } else {
        // Insert new customer
        const { error: insertError } = await supabase
          .from('customers')
          .insert({ 
            customer_number: customerNumber,
            email: customerEmail,
            created_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Error inserting customer:', insertError);
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error storing customer email:', error);
    return false;
  }
}

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  console.log('\n=== Fetching Fortnox Customers ===');
  
  const supabaseAdmin = getSupabaseAdmin();
  // Check if Supabase is properly initialized
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error: Supabase not initialized' }, 
      { status: 500 }
    );
  }
  
  // First try to get user ID from headers (for compatibility with frontend)
  const workspaceId = req.headers.get('workspace-id');
  const userId = req.headers.get('user-id');
  
  // If headers don't have the user ID, try to get it from the session
  let sessionUserId: string | undefined;
  if (!userId) {
    const user = await getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    sessionUserId = user.id;
  }
  
  // Use either the header user ID or the session user ID
  const effectiveUserId = userId || sessionUserId;
  
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized - No user ID provided' }, { status: 401 });
  }
  
  console.log('Fetching Fortnox customers for user:', effectiveUserId);
  if (workspaceId) {
    console.log('Workspace ID from headers:', workspaceId);
  }
  
  // Load token using user ID
  let tokenData = await loadTokenFromSupabase(effectiveUserId);
  if (!tokenData) {
    return NextResponse.json({ error: 'Not connected to Fortnox' }, { status: 401 });
  }
  
  // Token expired, refresh it
  if (!tokenData.access_token && tokenData.refresh_token) {
    tokenData = await refreshToken(tokenData.refresh_token, effectiveUserId);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
    }
  }
  
  try {
    const headers = {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    // Fetch customers
    const response = await fetch(`${BASE_API_URL}customers`, {
      headers
    });
    
    if (response.status === 401) {
      // Try refreshing token if unauthorized
      if (tokenData.refresh_token) {
        const newTokenData = await refreshToken(tokenData.refresh_token, effectiveUserId);
        if (newTokenData && newTokenData.access_token) {
          // Retry with new token
          const retryResponse = await fetch(`${BASE_API_URL}customers`, {
            headers: {
              ...headers,
              'Authorization': `Bearer ${newTokenData.access_token}`
            }
          });
          
          if (retryResponse.status === 200) {
            const data = await retryResponse.json();
            return NextResponse.json(data);
          }
        }
      }
      
      return NextResponse.json({ error: 'Unauthorized access to Fortnox API' }, { status: 401 });
    }
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`Fetched ${data.Customers?.length || 0} customers from Fortnox`);
      
      // Store customer emails in database
      if (data.Customers && Array.isArray(data.Customers)) {
        console.log(`Storing emails for ${data.Customers.length} customers`);
        
        // Process each customer's email
        const emailPromises = data.Customers
          .filter(customer => customer.Email && customer.CustomerNumber)
          .map(customer => storeCustomerEmail(customer.CustomerNumber, customer.Email));
        
        // Execute all promises in parallel
        Promise.all(emailPromises)
          .then(results => {
            const successCount = results.filter(Boolean).length;
            console.log(`Successfully stored emails for ${successCount} customers`);
          })
          .catch(error => {
            console.error('Error storing customer emails:', error);
          });
      }
      
      return NextResponse.json(data);
    }
    
    // Other error
    const errorText = await response.text();
    console.error('Error fetching customers:', errorText);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: response.status });
  } catch (e) {
    console.error('Error fetching customers:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 