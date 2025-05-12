import { NextResponse } from 'next/server';
import { getStripeInstance } from '@/lib/stripe';
import { getServerSession } from 'next-auth';
import authOptions from "@/lib/auth";

// Define the Session user type with expected properties
interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}

// Extend the Session type
declare module "next-auth" {
  interface Session {
    user: SessionUser;
    access_token: string;
    refresh_token: string;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { amount, currency = 'sek', plan } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const stripe = getStripeInstance();
    
    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents/öre
      currency,
      metadata: {
        plan,
        userId: session.user.id || 'guest', // Provide a fallback for undefined
      },
      receipt_email: session.user.email || undefined,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Error creating payment intent' },
      { status: 500 }
    );
  }
} 