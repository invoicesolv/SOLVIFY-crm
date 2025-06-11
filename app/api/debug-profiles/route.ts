import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Generate a simple ID without external dependencies
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function GET() {
  try {
    // Get Supabase connection info
    const connectionInfo = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    };

    // First, fetch all profiles to see what's already there
    const { data: existingProfiles, error: fetchError } = await supabase
      .from('profiles')
      .select('*');
    
    if (fetchError) {
      throw new Error(`Error fetching profiles: ${fetchError.message}`);
    }

    // Create a test profile if none exist
    let insertResult: { success: boolean; error?: string; profile?: any } | null = null;
    if (!existingProfiles || existingProfiles.length === 0) {
      const testUser = {
        id: generateId(),
        name: 'Test User',
        email: 'test@example.com',
        user_id: generateId(), 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([testUser])
        .select();
      
      if (insertError) {
        insertResult = { success: false, error: insertError.message };
      } else {
        insertResult = { success: true, profile: newProfile };
      }
    }

    // Fetch profiles again
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      throw new Error(`Error fetching profiles after insert: ${profilesError.message}`);
    }

    // Also try with admin client to check if it's a permissions issue
    const { data: adminProfiles, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    // Return the profiles data and connection info
    return NextResponse.json({ 
      success: true, 
      connectionInfo,
      profiles,
      adminProfiles,
      profilesCount: profiles?.length || 0,
      adminProfilesCount: adminProfiles?.length || 0,
      insertResult
    });
  } catch (error) {
    console.error('Error in debug-profiles endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 