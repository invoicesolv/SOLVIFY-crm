'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import ReCAPTCHA from 'react-google-recaptcha';

// reCAPTCHA site key from Google
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LflizkrAAAAACU7692bUxrhSuhzqOUnKXbQOuQC';

function InviteRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<{
    email: string;
    workspace_name: string;
    workspace_id: string;
    is_admin: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verify the invitation token
    if (token) {
      verifyInvitation(token);
    } else {
      setError('No invitation token provided');
      setVerifying(false);
      setLoading(false);
    }
  }, [token]);

  const verifyInvitation = async (token: string) => {
    try {
      setVerifying(true);
      
      // Call the API to verify the invitation
      const response = await fetch(`/api/invite/${token}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid invitation');
      }
      
      setInviteDetails({
        email: data.invitation.email,
        workspace_name: data.invitation.workspace_name,
        workspace_id: data.invitation.workspace_id,
        is_admin: data.invitation.is_admin
      });
      
      // Pre-fill the email field
      setEmail(data.invitation.email);
      
      setVerifying(false);
      setLoading(false);
    } catch (error) {
      console.error('Error verifying invitation:', error);
      setError(error instanceof Error ? error.message : 'Invalid or expired invitation');
      setVerifying(false);
      setLoading(false);
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!agreed) {
      toast.error('Please agree to the terms and conditions');
      return;
    }
    
    if (!captchaToken) {
      toast.error('Please complete the reCAPTCHA verification');
      return;
    }

    try {
      setLoading(true);
      
      // Verify reCAPTCHA token server-side
      const verifyResponse = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: captchaToken }),
      });
      
      const verifyData = await verifyResponse.json();
      
      if (!verifyData.success) {
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }

      // Handle invitation-based registration
      const response = await fetch('/api/register/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          token
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      toast.success('Registration successful! You can now log in.');
      router.push('/login');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred during registration');
      // Reset reCAPTCHA on error
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border bg-background p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white"></div>
            <p className="text-foreground">Verifying invitation...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !inviteDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border bg-background p-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full h-12 w-12 bg-red-500/10 flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Invalid Invitation</h2>
            <p className="text-muted-foreground">{error || 'This invitation is invalid or has expired.'}</p>
            <Button
              onClick={() => router.push('/login')}
              className="mt-4 bg-blue-600 hover:bg-blue-500"
            >
              Go to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-background">
        <div className="space-y-1 p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            Join {inviteDetails.workspace_name}
          </h2>
          <p className="text-muted-foreground">
            You've been invited to join as a {inviteDetails.is_admin ? 'Administrator' : 'Team Member'}
          </p>
        </div>
        <form onSubmit={handleSignUp}>
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-800 dark:text-foreground">Name</label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-800 dark:text-foreground">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled // Email is pre-filled and fixed for invitations
                className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-800 dark:text-foreground">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-800 dark:text-foreground">Confirm Password</label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
              />
            </div>
            
            <div className="mt-6 flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={handleCaptchaChange}
                theme="dark"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms" 
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                className="data-[state=checked]:bg-blue-600 border-border dark:border-border"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground">
                I agree to the <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link>
              </label>
            </div>
          </div>
          <div className="flex flex-col space-y-4 p-6 border-t border-border">
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-foreground"
              disabled={loading || !captchaToken}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white mr-2" />
                  Joining...
                </div>
              ) : (
                'Accept Invitation'
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
                Log in
              </Link>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function InviteRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border bg-background p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white"></div>
            <p className="text-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    }>
      <InviteRegisterForm />
    </Suspense>
  );
} 