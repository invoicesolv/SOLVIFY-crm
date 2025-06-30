import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

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

export async function POST(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get subscription ID from the request body
    const { subscriptionId } = await request.json();
    
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }
    
    // Verify that the subscription belongs to the current user
    const { data: userPreferences, error: fetchError } = await supabaseAdmin
      .from('user_preferences')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    
    if (fetchError || !userPreferences) {
      console.error('Error fetching user subscription:', fetchError);
      return NextResponse.json(
        { error: 'Subscription not found for this user' },
        { status: 404 }
      );
    }
    
    // Cancel the subscription in Stripe
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    
    // Update the subscription status in the database
    const { error: updateError } = await supabaseAdmin
      .from('user_preferences')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('stripe_subscription_id', subscriptionId);
    
    if (updateError) {
      console.error('Error updating subscription status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subscription status' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 