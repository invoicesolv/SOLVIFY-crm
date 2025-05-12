import { NextResponse } from 'next/server';
import { getStripeInstance } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { payment_intent } = await req.json();

    if (!payment_intent) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    const stripe = getStripeInstance();
    
    // Retrieve the payment intent
    const intent = await stripe.paymentIntents.retrieve(payment_intent);

    return NextResponse.json({
      status: intent.status,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Error verifying payment' },
      { status: 500 }
    );
  }
} 