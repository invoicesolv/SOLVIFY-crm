'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function InviteRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
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

    try {
      setLoading(true);

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
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
        <Card className="w-full max-w-md border-neutral-800 bg-neutral-900 p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-white"></div>
            <p className="text-white">Verifying invitation...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !inviteDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
        <Card className="w-full max-w-md border-neutral-800 bg-neutral-900 p-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full h-12 w-12 bg-red-500/10 flex items-center justify-center">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Invalid Invitation</h2>
            <p className="text-neutral-400">{error || 'This invitation is invalid or has expired.'}</p>
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900">
        <div className="space-y-1 p-6 border-b border-neutral-800">
          <h2 className="text-2xl font-bold text-white">
            Join {inviteDetails.workspace_name}
          </h2>
          <p className="text-neutral-400">
            You've been invited to join as a {inviteDetails.is_admin ? 'Administrator' : 'Team Member'}
          </p>
        </div>
        <form onSubmit={handleSignUp}>
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-neutral-200">Name</label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-neutral-200">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled // Email is pre-filled and fixed for invitations
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-neutral-200">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-neutral-200">Confirm Password</label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms" 
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
                className="border-neutral-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label htmlFor="terms" className="text-sm text-neutral-400">
                I agree to the <Link href="/terms" className="text-blue-500 hover:underline">terms of service</Link> and <Link href="/privacy" className="text-blue-500 hover:underline">privacy policy</Link>
              </label>
            </div>
          </div>
          <div className="flex flex-col space-y-4 p-6 border-t border-neutral-800">
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-white mr-2" />
                  Joining...
                </div>
              ) : (
                'Accept Invitation'
              )}
            </Button>
            <div className="text-center text-sm text-neutral-400">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-500 hover:underline">
                Log in
              </Link>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
} 