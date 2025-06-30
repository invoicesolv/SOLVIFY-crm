import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin;
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize database connection' }, { status: 500 });
    }

    console.log('Starting customer workspace fix for user:', user.id);

    // Get the user's workspace
    const { data: teamMembership, error: teamError } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (teamError || !teamMembership) {
      console.error('Error fetching user workspace:', teamError);
      return NextResponse.json({ error: 'No workspace found for user' }, { status: 400 });
    }

    const workspaceId = teamMembership.workspace_id;
    console.log('User workspace ID:', workspaceId);

    // Find customers with null workspace_id that were created by this user
    const { data: customersToFix, error: fetchError } = await supabase
      .from('customers')
      .select('id, name, user_id')
      .is('workspace_id', null)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching customers to fix:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Also find customers with null or empty names
    const { data: customersWithBadNames, error: badNamesError } = await supabase
      .from('customers')
      .select('id, name, customer_number')
      .eq('user_id', user.id)
      .or('name.is.null,name.eq.');

    if (badNamesError) {
      console.error('Error fetching customers with bad names:', badNamesError);
    }

    let totalFixed = 0;

    // Fix workspace_id issues
    if (customersToFix && customersToFix.length > 0) {
      console.log(`Found ${customersToFix.length} customers to fix workspace_id`);

      // Update customers to have the correct workspace_id
      const { error: updateError } = await supabase
        .from('customers')
        .update({ workspace_id: workspaceId })
        .is('workspace_id', null)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating customers workspace_id:', updateError);
        return NextResponse.json({ error: 'Failed to update customers workspace_id' }, { status: 500 });
      }

      totalFixed += customersToFix.length;
      console.log(`Successfully updated ${customersToFix.length} customers with workspace_id`);
    }

    // Fix customers with null/empty names
    if (customersWithBadNames && customersWithBadNames.length > 0) {
      console.log(`Found ${customersWithBadNames.length} customers with null/empty names`);
      
      for (const customer of customersWithBadNames) {
        let newName = 'Unknown Customer';
        
        // Try to use customer_number as name if available
        if (customer.customer_number) {
          newName = `Customer ${customer.customer_number}`;
        } else {
          // Use a generic name with the customer ID
          newName = `Customer ${customer.id.substring(0, 8)}`;
        }
        
        const { error: nameUpdateError } = await supabase
          .from('customers')
          .update({ name: newName })
          .eq('id', customer.id);
          
        if (nameUpdateError) {
          console.error(`Error updating customer ${customer.id} name:`, nameUpdateError);
        } else {
          console.log(`Updated customer ${customer.id} name to: ${newName}`);
        }
      }
      
      totalFixed += customersWithBadNames.length;
    }

    if (totalFixed === 0) {
      return NextResponse.json({ 
        message: 'No customers found that need fixing',
        fixed_count: 0 
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully fixed ${totalFixed} customers`,
      fixed_count: totalFixed,
      workspace_id: workspaceId
    });

  } catch (error) {
    console.error('Error in customer workspace fix:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }, { status: 500 });
  }
} 