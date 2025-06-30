import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromToken } from '@/lib/auth-utils'

const BASE_API_URL = 'https://api.fortnox.se/3/'
const CLIENT_ID = '4LhJwn68IpdR'
const CLIENT_SECRET = 'pude4Qk6dK'

// Create Supabase client at runtime only
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return null
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

// Helper to load token from Supabase
async function loadTokenFromSupabase(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('Cannot load token: Supabase client not initialized')
    return null
  }
  
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      console.error('Error retrieving Fortnox token from database:', error.message)
      return null
    }
    
    if (!data) {
      console.error('No Fortnox token found for user')
      return null
    }

    let accessToken = data.access_token
    let refreshTokenValue = data.refresh_token
    let expiresAt = data.expires_at
    
    if ((!accessToken || !refreshTokenValue) && data.settings_data) {
      if (typeof data.settings_data === 'string') {
        try {
          const settingsData = JSON.parse(data.settings_data)
          accessToken = accessToken || settingsData.access_token
          refreshTokenValue = refreshTokenValue || settingsData.refresh_token
          expiresAt = expiresAt || settingsData.expires_at
        } catch (e) {
          console.error('Failed to parse settings_data string:', e)
        }
      } else if (typeof data.settings_data === 'object' && data.settings_data !== null) {
        accessToken = accessToken || data.settings_data.access_token
        refreshTokenValue = refreshTokenValue || data.settings_data.refresh_token
        expiresAt = expiresAt || data.settings_data.expires_at
      }
    }
    
    const now = new Date()
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null
    
    if (!accessToken || (expiresAtDate && expiresAtDate <= now)) {
      return { refresh_token: refreshTokenValue }
    }
    
    return {
      access_token: accessToken,
      refresh_token: refreshTokenValue,
      expires_at: expiresAt
    }
  } catch (e) {
    console.error('Error loading token from Supabase:', e)
    return null
  }
}

// Helper to refresh token
async function refreshToken(refreshTokenValue: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return null
  }
  
  if (!refreshTokenValue) {
    return null
  }
  
  try {
    const response = await fetch('https://apps.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshTokenValue,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
      })
    })
    
    if (response.ok) {
      const newTokenData = await response.json()
      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in)
      const expiresAtStr = expiresAt.toISOString()

      const { data: existingRecord, error: fetchError } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('service_name', 'fortnox')
        .eq('user_id', userId)
        .maybeSingle()

      const updateRecord: any = {
        service_name: 'fortnox',
        user_id: userId,
        updated_at: new Date().toISOString()
      }

      if (existingRecord) {
        if ('access_token' in existingRecord) updateRecord.access_token = newTokenData.access_token
        if ('refresh_token' in existingRecord) updateRecord.refresh_token = newTokenData.refresh_token
        if ('expires_at' in existingRecord) updateRecord.expires_at = expiresAtStr
        
        if ('settings_data' in existingRecord) {
          let settingsData: any = {}
          if (typeof existingRecord.settings_data === 'string') {
            try {
              settingsData = JSON.parse(existingRecord.settings_data)
            } catch (e) { console.error('Failed to parse existing settings_data string:', e) }
          } else if (existingRecord.settings_data && typeof existingRecord.settings_data === 'object') {
            settingsData = { ...existingRecord.settings_data }
          }
          settingsData.access_token = newTokenData.access_token
          settingsData.refresh_token = newTokenData.refresh_token
          settingsData.expires_at = expiresAtStr
          updateRecord.settings_data = settingsData
        }
      } else {
        updateRecord.access_token = newTokenData.access_token
        updateRecord.refresh_token = newTokenData.refresh_token
        updateRecord.expires_at = expiresAtStr
      }
      
      const { error: updateError } = await supabaseAdmin
        .from('settings')
        .upsert(updateRecord)

      if (updateError) {
        console.error('Error updating Fortnox token:', updateError)
      }

      return {
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAtStr
      }
    }
    return null
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    let tokenData = await loadTokenFromSupabase(userId)

    if (!tokenData || !tokenData.access_token) {
      if (tokenData?.refresh_token) {
        tokenData = await refreshToken(tokenData.refresh_token, userId)
      }
      if (!tokenData) {
        return NextResponse.json({ error: 'Fortnox token unavailable' }, { status: 401 })
      }
    }
    
    const response = await fetch(`${BASE_API_URL}supplierinvoicepayments`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Fortnox API Error: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json({ error: `Failed to fetch data from Fortnox: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    // Make the Amount negative for each payment
    if (data.SupplierInvoicePayments) {
      data.SupplierInvoicePayments = data.SupplierInvoicePayments.map((payment: any) => ({
        ...payment,
        Amount: payment.Amount * -1
      }));
    }

    return NextResponse.json(data);

  } catch (error) {
    if (error instanceof Error) {
      console.error('An unexpected error occurred:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error('An unexpected error occurred:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 