import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from "next-auth/next";
import authOptions from '@/lib/auth';
import { getOrCreateWorkspaceForAPI } from '@/lib/workspace';

export async function DELETE(req: NextRequest) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('API: No user ID in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const customerId = url.searchParams.get('id');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    console.log('API: Processing customer deletion for:', {
      customerId,
      userId: session.user.id,
      email: session.user.email
    });

    // Use the workspace utility to get the user's workspace
    const workspaceId = await getOrCreateWorkspaceForAPI(
      session.user.id,
      session.user.email || '',
      session.user.name
    );

    if (!workspaceId) {
      console.error('API: Failed to get workspace');
      return NextResponse.json({ 
        error: 'No workspace found',
        details: 'Could not find a workspace for your account. Please contact support.'
      }, { status: 404 });
    }

    // First, verify that the customer belongs to the user's workspace
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, workspace_id')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('API: Error checking customer:', customerError);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (customerData.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Unauthorized access to this customer' }, { status: 403 });
    }

    // Delete the customer
    const { error: deleteError } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('workspace_id', workspaceId);

    if (deleteError) {
      console.error('API: Error deleting customer:', deleteError);
      return NextResponse.json({ error: 'Failed to delete customer', details: deleteError.message }, { status: 500 });
    }

    console.log('API: Customer deleted successfully:', customerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API: Unexpected error deleting customer:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 