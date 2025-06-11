"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import ReCAPTCHA from 'react-google-recaptcha';

// reCAPTCHA site key from Google
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LflizkrAAAAACU7692bUxrhSuhzqOUnKXbQOuQC';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [company, setCompany] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<{
    email: string;
    workspace_name: string;
    workspace_id: string;
    is_admin: boolean;
    permissions: object;
  } | null>(null);

  useEffect(() => {
    if (token) {
      verifyInvitation(token);
    }
  }, [token]);

  const verifyInvitation = async (token: string) => {
    try {
      setLoading(true);
      console.log('Verifying invitation with token:', token);
      
      const { data: invitation, error } = await supabaseAdmin
        .from('invitations')
        .select('email, workspace_name, workspace_id, is_admin, permissions')
        .eq('token', token)
        .single();
      
      if (error) throw error;
      
      console.log('Invitation details:', invitation);
      setIsInvite(true);
      setInviteDetails({
        email: invitation.email,
        workspace_name: invitation.workspace_name,
        workspace_id: invitation.workspace_id,
        is_admin: invitation.is_admin,
        permissions: invitation.permissions || {},
      });
      setEmail(invitation.email);
    } catch (error) {
      console.error('Error verifying invitation:', error);
      toast.error('Invalid or expired invitation');
    } finally {
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
      
      console.log('Starting signup process for email:', email);

      console.log('Checking if user exists:', email);
      const { data: exists, error: checkError } = await supabase.rpc('check_user_exists', { user_email: email });
      if (checkError) {
        console.error('Error checking user existence:', checkError);
        throw checkError;
      }
      console.log('User exists:', exists);

      if (exists) {
        console.log('User exists, attempting sign-in:', email);
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log('Sign-in response:', { signInData, signInError });
        if (signInError) throw signInError;

        if (isInvite && token && inviteDetails) {
          console.log('Linking existing user to team_members for token:', token);
          const { data: teamData, error: teamError } = await supabaseAdmin
            .from('team_members')
            .upsert({
              user_id: (await supabase.auth.getUser()).data.user?.id,
              workspace_id: inviteDetails.workspace_id,
              name,
              email,
              is_admin: inviteDetails.is_admin,
              permissions: inviteDetails.permissions,
            });
          console.log('Team members upsert result:', { teamData, teamError });
          if (teamError) throw teamError;

          console.log('Updating invitation status for token:', token);
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from('invitations')
            .update({ status: 'accepted' })
            .eq('token', token);
          console.log('Invitation update result:', { updateData, updateError });
          if (updateError) throw updateError;
        }

        toast.success('Logged in successfully! You can now access the workspace.');
        router.push('/');
      } else {
        console.log('User does not exist, attempting signup:', email);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              company,
            },
          },
        });
        console.log('Signup response:', { authData, authError });
        if (authError) throw authError;
        if (!authData.user) throw new Error('No user data returned');

        const userId = authData.user.id;

        if (isInvite && token && inviteDetails) {
          console.log('Adding new user to team_members for token:', token);
          const { data: teamData, error: teamError } = await supabaseAdmin
            .from('team_members')
            .insert({
              user_id: userId,
              workspace_id: inviteDetails.workspace_id,
              name,
              email,
              is_admin: inviteDetails.is_admin,
              permissions: inviteDetails.permissions,
            });
          console.log('Team members insert result:', { teamData, teamError });
          if (teamError) throw teamError;

          console.log('Updating invitation status for token:', token);
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from('invitations')
            .update({ status: 'accepted' })
            .eq('token', token);
          console.log('Invitation update result:', { updateData, updateError });
          if (updateError) throw updateError;
        } else {
          console.log('Creating default workspace for new user:', userId);
          const defaultWorkspaceId = uuidv4();
          const { data: workspaceData, error: workspaceError } = await supabaseAdmin
            .from('workspaces')
            .insert({
              id: defaultWorkspaceId,
              name: company ? company : (name ? `${name}'s Workspace` : 'My Workspace'),
              owner_id: userId,
            });
          console.log('Workspace insert result:', { workspaceData, workspaceError });
          if (workspaceError) throw workspaceError;

          console.log('Adding new user to team_members for default workspace:', defaultWorkspaceId);
          const { data: teamData, error: teamError } = await supabaseAdmin
            .from('team_members')
            .insert({
              user_id: userId,
              workspace_id: defaultWorkspaceId,
              name,
              email,
              is_admin: true,
              permissions: { read: true, write: true },
            });
          console.log('Team members insert result:', { teamData, teamError });
          if (teamError) throw teamError;
        }

        console.log('Logging user_registration event');
        const { data: eventData, error: eventError } = await supabaseAdmin
          .from('event_tracking')
          .insert({
            event_type: 'user_registration',
            details: { user_id: userId, email, name, company, is_invite: isInvite },
          });
        console.log('Event tracking insert result:', { eventData, eventError });
        if (eventError) throw eventError;

        toast.success(
          isInvite
            ? 'Registration successful! You can now access the workspace.'
            : 'Registration successful! Please check your email to verify your account.'
        );
        router.push('/login');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred during registration');
      // Reset reCAPTCHA on error
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-background">
        <div className="space-y-1 p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            {isInvite ? `Join ${inviteDetails?.workspace_name || 'Team'}` : 'Create an account'}
          </h2>
          <p className="text-muted-foreground">
            {isInvite
              ? `You've been invited to join as a ${inviteDetails?.is_admin ? 'Administrator' : 'Team Member'}`
              : 'Enter your details to create your account'}
          </p>
        </div>
        <form onSubmit={handleSignUp}>
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <label htmlFor="name jack" className="text-sm font-medium text-gray-800 dark:text-foreground">Name</label>
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
                disabled={isInvite}
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
            {!isInvite && (
              <div className="space-y-2">
                <label htmlFor="company" className="text-sm font-medium text-gray-800 dark:text-foreground">Company (Optional)</label>
                <Input
                  id="company"
                  placeholder="Acme Inc."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
                />
              </div>
            )}
            
            {/* Add reCAPTCHA before the submit button */}
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
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-foreground"
              disabled={loading || !captchaToken}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              Already have an account? <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">Sign in</Link>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background p-4">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}