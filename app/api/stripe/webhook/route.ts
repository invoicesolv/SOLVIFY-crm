import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic';

// This is your Stripe CLI webhook secret for testing your endpoint locally
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: Request) {
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature') as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret!)
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Handle the event
  console.log(`Webhook received: ${event.type}`)

  switch (event.type) {
    case 'checkout.session.completed':
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      
      // Extract customer and subscription info
      const customerId = checkoutSession.customer as string
      const subscriptionId = checkoutSession.subscription as string
      const userId = checkoutSession.metadata?.userId
      
      if (!userId) {
        console.error('No user ID found in session metadata')
        return new NextResponse('No user ID found', { status: 400 })
      }
      
      console.log(`Processing completed checkout for user ${userId}`)
      
      try {
        // Get subscription details to determine the plan
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0].price.id
        
        // Determine plan based on price ID
        let planId = 'team' // Default
        
        // Check which plan this price belongs to
        // Get price IDs from environment variables to support both test/live modes
        const teamPriceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID
        const teamYearlyPriceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID
        const businessPriceId = process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID
        const businessYearlyPriceId = process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID
        const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID
        const enterpriseYearlyPriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID
        
        // Use environment variables instead of hardcoded price IDs
        if (priceId === teamPriceId || priceId === teamYearlyPriceId) {
          planId = 'team'
        } else if (priceId === businessPriceId || priceId === businessYearlyPriceId) {
          planId = 'business'
        } else if (priceId === enterprisePriceId || priceId === enterpriseYearlyPriceId) {
          planId = 'enterprise'
        }
        
        // Get current period end from subscription
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        
        // Update user preferences with subscription info
        const { error } = await supabase
          .from('user_preferences')
          .update({
            plan_id: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
        
        if (error) {
          console.error('Error updating user preferences:', error)
          return new NextResponse('Error updating user preferences', { status: 500 })
        }
        
        console.log(`Successfully updated subscription for user ${userId} to plan ${planId}`)
      } catch (error) {
        console.error('Error processing checkout session:', error)
        return new NextResponse('Error processing checkout session', { status: 500 })
      }
      break
      
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription
      // Handle subscription updates (e.g., plan changes, payment failures)
      console.log('Subscription updated:', subscription.id)
      
      try {
        // Find the user with this subscription ID
        const { data: userData, error: userError } = await supabase
          .from('user_preferences')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();
        
        if (userError || !userData) {
          console.error('Error finding user for subscription update:', userError)
          return new NextResponse('Error finding user', { status: 400 })
        }
        
        // Get current period end and status from subscription
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const status = subscription.status === 'canceled' ? 'canceled' : 
                     subscription.status === 'active' ? 'active' : 
                     subscription.status === 'trialing' ? 'trial' : 
                     subscription.status;
        
        // Update user preferences with new subscription info
        const { error } = await supabase
          .from('user_preferences')
          .update({
            subscription_status: status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userData.user_id)
        
        if (error) {
          console.error('Error updating subscription status:', error)
          return new NextResponse('Error updating subscription status', { status: 500 })
        }
        
        console.log(`Successfully updated subscription status for user ${userData.user_id} to ${status}`)
      } catch (error) {
        console.error('Error processing subscription update:', error)
        return new NextResponse('Error processing subscription update', { status: 500 })
      }
      break
      
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription
      // Handle subscription cancellations
      console.log('Subscription cancelled:', deletedSubscription.id)
      
      try {
        // Find the user with this subscription ID
        const { data: userData, error: userError } = await supabase
          .from('user_preferences')
          .select('user_id')
          .eq('stripe_subscription_id', deletedSubscription.id)
          .single();
        
        if (userError || !userData) {
          console.error('Error finding user for subscription deletion:', userError)
          return new NextResponse('Error finding user', { status: 400 })
        }
        
        // Update user preferences to reflect cancellation
        const { error } = await supabase
          .from('user_preferences')
          .update({
            subscription_status: 'canceled',
            plan_id: 'free', // Revert to free plan
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userData.user_id)
        
        if (error) {
          console.error('Error updating subscription after cancellation:', error)
          return new NextResponse('Error updating subscription status', { status: 500 })
        }
        
        console.log(`Successfully marked subscription as cancelled for user ${userData.user_id}`)
      } catch (error) {
        console.error('Error processing subscription cancellation:', error)
        return new NextResponse('Error processing subscription cancellation', { status: 500 })
      }
      break
      
    case 'invoice.payment_succeeded':
      const invoice = event.data.object as Stripe.Invoice;
      // Handle successful payments
      if (invoice.subscription) {
        console.log(`Successful payment for subscription: ${invoice.subscription}`);
        
        try {
          // Find the user with this subscription ID
          const { data: userData, error: userError } = await supabase
            .from('user_preferences')
            .select('user_id')
            .eq('stripe_subscription_id', invoice.subscription)
            .single();
          
          if (userError || !userData) {
            console.error('Error finding user for invoice payment:', userError)
            return new NextResponse('Error finding user', { status: 400 })
          }
          
          // Update the subscription status to active (in case it was previously canceled or past due)
          const { error } = await supabase
            .from('user_preferences')
            .update({
              subscription_status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userData.user_id)
          
          if (error) {
            console.error('Error updating subscription after payment:', error)
            return new NextResponse('Error updating subscription status', { status: 500 })
          }
          
          console.log(`Successfully updated subscription status to active for user ${userData.user_id}`)
        } catch (error) {
          console.error('Error processing invoice payment:', error)
          return new NextResponse('Error processing invoice payment', { status: 500 })
        }
      }
      break;
      
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      // Handle failed payments
      if (failedInvoice.subscription) {
        console.log(`Failed payment for subscription: ${failedInvoice.subscription}`);
        
        try {
          // Find the user with this subscription ID
          const { data: userData, error: userError } = await supabase
            .from('user_preferences')
            .select('user_id')
            .eq('stripe_subscription_id', failedInvoice.subscription)
            .single();
          
          if (userError || !userData) {
            console.error('Error finding user for failed invoice payment:', userError)
            return new NextResponse('Error finding user', { status: 400 })
          }
          
          // Update the subscription status to past_due
          const { error } = await supabase
            .from('user_preferences')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userData.user_id)
          
          if (error) {
            console.error('Error updating subscription after failed payment:', error)
            return new NextResponse('Error updating subscription status', { status: 500 })
          }
          
          console.log(`Updated subscription status to past_due for user ${userData.user_id}`)
        } catch (error) {
          console.error('Error processing failed invoice payment:', error)
          return new NextResponse('Error processing failed invoice payment', { status: 500 })
        }
      }
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return new NextResponse('Webhook received', { status: 200 })
} 