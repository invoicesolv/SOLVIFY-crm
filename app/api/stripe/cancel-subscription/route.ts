import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    // Verify the user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get subscription ID from the request body
    const { subscriptionId } = await req.json();
    
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }
    
    // Verify that the subscription belongs to the current user
    const { data: userPreferences, error: fetchError } = await supabase
      .from('user_preferences')
      .select('stripe_subscription_id')
      .eq('user_id', session.user.id)
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
    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', session.user.id)
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