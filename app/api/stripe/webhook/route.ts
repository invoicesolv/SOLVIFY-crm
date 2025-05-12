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
        if (priceId === 'price_1R3KiwKrzodQUsuF79bVaycE' || priceId === 'price_1R3Kj6KrzodQUsuFOsAVUeWl') {
          planId = 'team'
        } else if (priceId === 'price_1R3KjGKrzodQUsuFkBaoyjB2' || priceId === 'price_1R3KjTKrzodQUsuF2ULuAm7D') {
          planId = 'business'
        } else if (priceId === 'price_1R3KjdKrzodQUsuFRvxjWweU' || priceId === 'price_1R3KjpKrzodQUsuF0ZO54S4S') {
          planId = 'enterprise'
        }
        
        // Update user preferences with subscription info
        const { error } = await supabase
          .from('user_preferences')
          .update({
            plan_id: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
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
      break
      
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription
      // Handle subscription cancellations
      console.log('Subscription cancelled:', deletedSubscription.id)
      break
      
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return new NextResponse('Webhook received', { status: 200 })
} 