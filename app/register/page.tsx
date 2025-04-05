"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [company, setCompany] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
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
      
      const { data: invitation, error } = await supabase
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
          const { data: teamData, error: teamError } = await supabase
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
          const { data: updateData, error: updateError } = await supabase
            .from('invitations')
            .update({ status: 'accepted' })
            .eq('token', token);
          console.log('Invitation update result:', { updateData, updateError });
          if (updateError) throw updateError;
        }

        toast.success('Logged in successfully! You can now access the workspace.');
        router.push('/dashboard');
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
          const { data: teamData, error: teamError } = await supabase
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
          const { data: updateData, error: updateError } = await supabase
            .from('invitations')
            .update({ status: 'accepted' })
            .eq('token', token);
          console.log('Invitation update result:', { updateData, updateError });
          if (updateError) throw updateError;
        } else {
          console.log('Creating default workspace for new user:', userId);
          const defaultWorkspaceId = uuidv4();
          const { data: workspaceData, error: workspaceError } = await supabase
            .from('workspaces')
            .insert({
              id: defaultWorkspaceId,
              name: 'Default Workspace',
              owner_id: userId,
            });
          console.log('Workspace insert result:', { workspaceData, workspaceError });
          if (workspaceError) throw workspaceError;

          console.log('Adding new user to team_members for default workspace:', defaultWorkspaceId);
          const { data: teamData, error: teamError } = await supabase
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
        const { data: eventData, error: eventError } = await supabase
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900">
        <div className="space-y-1 p-6 border-b border-neutral-800">
          <h2 className="text-2xl font-bold text-white">
            {isInvite ? `Join ${inviteDetails?.workspace_name || 'Team'}` : 'Create an account'}
          </h2>
          <p className="text-neutral-400">
            {isInvite
              ? `You've been invited to join as a ${inviteDetails?.is_admin ? 'Administrator' : 'Team Member'}`
              : 'Enter your details to create your account'}
          </p>
        </div>
        <form onSubmit={handleSignUp}>
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <label htmlFor="name jack" className="text-sm font-medium text-neutral-200">Name</label>
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
                disabled={isInvite}
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
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>
            {!isInvite && (
              <div className="space-y-2">
                <label htmlFor="company" className="text-sm font-medium text-neutral-200">Company (Optional)</label>
                <Input
                  id="company"
                  placeholder="Acme Inc."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>
            )}
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
                  {isInvite ? 'Joining...' : 'Creating account...'}
                </div>
              ) : (
                isInvite ? 'Accept Invitation' : 'Create Account'
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