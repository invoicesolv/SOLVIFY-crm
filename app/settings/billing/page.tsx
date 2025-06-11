'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarDemo } from '@/components/ui/code.demo';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Package 
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { TIERS } from '@/components/ui/pricing-demo';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UserSubscription {
  plan_id: string;
  trial_start_date: string;
  trial_end_date: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
}

const planNames = {
  'free': 'Free',
  'team': 'Team',
  'business': 'Business',
  'enterprise': 'Enterprise'
};

export default function BillingPage() {
  const { data: session, status } = useSession();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradePlanLoading, setUpgradePlanLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('subscription');

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      fetchSubscription();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [session, status]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_preferences')
        .select('plan_id, trial_start_date, trial_end_date, stripe_customer_id, stripe_subscription_id, subscription_status')
        .eq('user_id', session?.user?.id)
        .single();

      if (error) {
        // If no user preferences exist, create default free plan
        if (error.code === 'PGRST116') {
          console.log('No user preferences found, creating default free plan');
          const defaultPreferences = {
            plan_id: 'free',
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
            subscription_status: 'trial'
          };
          setSubscription(defaultPreferences);
          
          // Calculate days remaining for trial
          const endDate = new Date(defaultPreferences.trial_end_date);
          const today = new Date();
          const diffTime = endDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setDaysRemaining(diffDays > 0 ? diffDays : 0);
          
          setLoading(false);
          return;
        }
        
        console.error('Error fetching subscription:', error);
        toast.error('Failed to load subscription details');
        setLoading(false);
        return;
      }

      setSubscription(data);

      // Calculate days remaining in trial
      if (data?.trial_end_date) {
        const endDate = new Date(data.trial_end_date);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysRemaining(diffDays > 0 ? diffDays : 0);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
      toast.error('Failed to load subscription details');
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      setUpgradePlanLoading(true);
      
      // Find the plan data
      const planData = [...TIERS.en].find(tier => tier.id === planId);
      if (!planData || !planData.stripePriceId?.monthly) {
        toast.error('Invalid plan selection');
        setUpgradePlanLoading(false);
        return;
      }

      // Redirect to the direct checkout endpoint
      window.location.href = `/api/stripe/direct-checkout?plan=${planId}&interval=month`;
    } catch (error) {
      console.error('Error upgrading plan:', error);
      toast.error('Failed to upgrade plan');
      setUpgradePlanLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      
      if (!subscription?.stripe_subscription_id) {
        toast.error('No active subscription found');
        setCancelLoading(false);
        return;
      }

      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripe_subscription_id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      toast.success('Subscription cancelled successfully');
      fetchSubscription();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!subscription) return null;

    if (subscription.subscription_status === 'active') {
      return (
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </div>
      );
    }

    if (subscription.plan_id === 'free' && daysRemaining && daysRemaining > 0) {
      return (
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
          <Calendar className="w-3 h-3 mr-1" />
          Trial ({daysRemaining} days left)
        </div>
      );
    }

    if (subscription.subscription_status === 'canceled') {
      return (
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Cancelled
        </div>
      );
    }

    return (
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        Free
      </div>
    );
  };

  return (
    <SidebarDemo>
      <div className="min-h-screen">
        <main className="p-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Billing &amp; Subscription</h1>
            <p className="text-sm text-muted-foreground">Manage your subscription plan and payment methods</p>
          </div>

          <div className="mb-6">
            <div className="flex space-x-1 border-b border-border">
              <button 
                onClick={() => setActiveTab('subscription')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'subscription' 
                    ? 'text-foreground border-b-2 border-blue-500' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Subscription
              </button>
              <button 
                onClick={() => setActiveTab('payment')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'payment' 
                    ? 'text-foreground border-b-2 border-blue-500' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Payment Methods
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'history' 
                    ? 'text-foreground border-b-2 border-blue-500' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Billing History
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'subscription' && (
                <div className="space-y-6">
                  <Card className="p-6 bg-card border-border">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-xl font-medium text-foreground">Current Plan</h2>
                        <div className="mt-2 flex items-center">
                          <Package className="w-5 h-5 text-primary mr-2" />
                          <span className="font-semibold text-foreground mr-2">
                            {planNames[subscription?.plan_id as keyof typeof planNames] || 'Free'}
                          </span>
                          {getStatusBadge()}
                        </div>
                      </div>
                      
                      <div className="mt-4 md:mt-0">
                        {subscription?.plan_id === 'free' ? (
                          <Button
                            onClick={() => handleUpgrade('team')}
                            disabled={upgradePlanLoading}
                            className="bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground hover:from-violet-600 hover:to-indigo-600"
                          >
                            {upgradePlanLoading ? 'Processing...' : 'Upgrade to Team Plan'}
                          </Button>
                        ) : subscription?.subscription_status === 'active' ? (
                          <Button
                            onClick={handleCancelSubscription}
                            disabled={cancelLoading}
                            className="bg-red-600 hover:bg-red-700 text-foreground"
                          >
                            {cancelLoading ? 'Processing...' : 'Cancel Subscription'}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUpgrade('team')}
                            disabled={upgradePlanLoading}
                            className="bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground hover:from-violet-600 hover:to-indigo-600"
                          >
                            {upgradePlanLoading ? 'Processing...' : 'Reactivate Subscription'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {subscription?.plan_id === 'free' && daysRemaining && daysRemaining > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                        <div className="flex items-start">
                                                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2" />
                          <div>
                                                          <p className="text-sm text-blue-700 dark:text-blue-300">
                              Your free trial ends in <span className="font-bold">{daysRemaining} days</span>.
                              Upgrade now to continue accessing all features.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {TIERS.en.map((tier) => (
                        <div 
                          key={tier.id} 
                          className={`p-4 rounded-lg border ${
                            subscription?.plan_id === tier.id 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' 
                              : 'border-border bg-muted/50'
                          }`}
                        >
                          <h3 className="text-lg font-medium text-foreground">{tier.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                                                      <div className="mt-2 text-xl font-bold text-foreground">{tier.price.monthly} kr<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                          
                          {subscription?.plan_id === tier.id ? (
                            <div className="mt-3 inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Current plan
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 w-full bg-transparent border-border text-foreground hover:bg-muted"
                              onClick={() => handleUpgrade(tier.id)}
                              disabled={upgradePlanLoading}
                            >
                              {upgradePlanLoading ? 'Processing...' : tier.id === 'free' ? 'Downgrade' : 'Upgrade'}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6 bg-card border-border">
                    <h2 className="text-xl font-medium text-foreground mb-4">Plan Features</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subscription?.plan_id && TIERS.en.find(t => t.id === subscription.plan_id)?.features.map((feature, i) => (
                        <div key={i} className="flex items-start">
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 mr-2" />
                          <span className="text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'payment' && (
                <Card className="p-6 bg-card border-border">
                  <h2 className="text-xl font-medium text-foreground mb-4">Payment Methods</h2>
                  
                  {subscription?.stripe_customer_id ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        Manage your payment methods through our secure payment provider.
                      </p>
                      <Button 
                        className="bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground hover:from-violet-600 hover:to-indigo-600"
                        onClick={() => window.open('https://billing.stripe.com/p/login/test_eVa5lrf94dxV0JG8ww', '_blank')}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Manage Payment Methods
                      </Button>

                      <div className="mt-4 flex items-center">
                        <ShieldCheck className="w-5 h-5 text-muted-foreground mr-2" />
                        <span className="text-xs text-muted-foreground">
                          Your payment information is securely managed by Stripe.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-foreground mb-1">No Payment Methods</h3>
                                              <p className="text-muted-foreground text-sm mb-4">
                          You haven't added any payment methods yet.
                        </p>
                      <Button
                        onClick={() => handleUpgrade('team')}
                        className="bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground hover:from-violet-600 hover:to-indigo-600"
                      >
                        Add Payment Method
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {activeTab === 'history' && (
                <Card className="p-6 bg-card border-border">
                  <h2 className="text-xl font-medium text-foreground mb-4">Billing History</h2>
                  
                  {subscription?.stripe_customer_id ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        View your billing history and download invoices.
                      </p>
                      <Button 
                        className="bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground hover:from-violet-600 hover:to-indigo-600"
                        onClick={() => window.open('https://billing.stripe.com/p/login/test_eVa5lrf94dxV0JG8ww', '_blank')}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        View Billing History
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-foreground mb-1">No Billing History</h3>
                                              <p className="text-muted-foreground text-sm">
                          You don't have any billing history yet.
                        </p>
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
    </SidebarDemo>
  );
} 