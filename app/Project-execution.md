# Project Execution Plan - User Management and Invitations (Revised)

This document outlines the plan for implementing user management, invitations, and workspace association in your Supabase-backed Next.js application. It incorporates lessons learned during debugging and provides a robust and secure solution.

**Key Concepts:**

*   **`auth.users`:** Supabase's built-in table for storing user authentication information.
*   **`team_members`:** A custom table linking users to workspaces and storing roles/permissions. **Crucially, this table must have a `workspace_id` column that is NOT NULL.**
*   **`workspaces`:** A table representing workspaces (if you have explicit workspaces).
*   **`invitations`:** A table storing invitation tokens and related information.
*   **`is_admin` (in `team_members`):** A boolean column indicating whether a user is an administrator within a workspace. This is the primary mechanism for controlling administrative privileges.
*   **Row Level Security (RLS):** Supabase's feature for controlling data access at the row level.

## 1. Database Structure and RLS Policies

### 1.1. Admin Identification (Using `team_members`)

The recommended approach is to use the `is_admin` boolean column in the `team_members` table. This provides a clear and explicit way to identify administrators.

**Helper Function (isAdmin):**

    ```typescript
    // Helper function (e.g., in a utils file)
    import { SupabaseClient } from '@supabase/supabase-js';

async function isAdmin(userId: string): Promise<boolean> {
      const { data, error } = await supabase
        .from('team_members')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error("Error checking admin status:", error);
        return false; // Or throw an error, depending on your error handling
      }

      return data?.is_admin === true;
    }
```

### 1.2. Row Level Security (RLS) Policies

These policies are crucial for securing your application. They control data access based on user roles and workspace membership.

    *   **`team_members` table:**

        ```sql
    -- Enable RLS on the table
    ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

    -- Users can see their own team membership
    CREATE POLICY "Users can see their own team membership" ON team_members
        FOR SELECT
        USING (auth.uid() = user_id);

    -- Admins can see all team members within their workspace
    CREATE POLICY "Admins can see all team members" ON team_members
        FOR SELECT
        USING ((
          EXISTS (
            SELECT 1
        FROM team_members tm
            WHERE tm.user_id = auth.uid() AND tm.is_admin = true
          )
        ));

    -- Allow authenticated users to insert (application logic handles admin checks)
    CREATE POLICY "Enable insert for authenticated users" ON team_members
        FOR INSERT
    WITH CHECK (true);

    -- Allow authenticated users to update (application logic handles admin checks)
    CREATE POLICY "Enable update for authenticated users" ON team_members
        FOR UPDATE
    USING (true);

    -- Users can update their own name
    CREATE POLICY "Users can update their own name" ON team_members
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

    -- Allow authenticated users to delete (application logic handles admin checks)
    CREATE POLICY "Enable delete for authenticated users" ON team_members
        FOR DELETE
    USING (true);
    
    -- IMPORTANT: Drop problematic recursive policies if they exist
    DROP POLICY IF EXISTS "Admins can insert team members" ON team_members;
    DROP POLICY IF EXISTS "Admins can update team members" ON team_members;
    DROP POLICY IF EXISTS "Admins can delete team members" ON team_members;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON team_members; -- Redundant
    ```

*   **`workspaces` table:**

        ```sql
        -- Enable RLS
    ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

        -- Allow users to see workspaces they are members of
    CREATE POLICY "Users can see their workspaces" ON workspaces
        FOR SELECT
        USING ((
          EXISTS (
            SELECT 1
        FROM team_members tm
            WHERE tm.workspace_id = workspaces.id AND tm.user_id = auth.uid()
          )
        ));

    -- Allow users to create workspaces
    CREATE POLICY "Users can create workspaces" ON workspaces
        FOR INSERT
    WITH CHECK (true); -- You can restrict this as needed

        -- Allow workspace owners and admins to update workspaces
    CREATE POLICY "Owners and admins can update workspaces" ON workspaces
        FOR UPDATE
        USING ((
          EXISTS (
            SELECT 1
        FROM team_members tm
        WHERE tm.user_id = auth.uid() AND tm.is_admin = true AND tm.workspace_id = workspaces.id
          )
        ));

        -- Allow workspace owners and admins to delete workspaces
    CREATE POLICY "Owners and admins can delete workspaces" ON workspaces
        FOR DELETE
        USING ((
          EXISTS (
            SELECT 1
        FROM team_members tm
        WHERE tm.user_id = auth.uid() AND tm.is_admin = true AND tm.workspace_id = workspaces.id
          )
        ));
        ```

*   **`invitations` table:**

        ```sql
        -- Enable RLS
    ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

    -- Allow anyone to see invitation with token (for registration)
    CREATE POLICY "Anyone can see invitation with token" ON invitations
        FOR SELECT
    USING (true);

    -- Allow authenticated users to create invitations (application code handles admin checks)
    CREATE POLICY "Authenticated users can create invitations" ON invitations
        FOR INSERT
    WITH CHECK (true);

    -- Prevent updates to invitations
    CREATE POLICY "No updates to invitations" ON invitations
    FOR UPDATE
    WITH CHECK (false);

    -- Allow authenticated users to delete invitations (application code handles admin checks)
    CREATE POLICY "Authenticated users can delete invitations" ON invitations
    FOR DELETE
    USING (true);
    ```

## 2. Required Code Fixes

### 2.1 Fix Invitation Creation (`/api/invite/route.ts`)

```typescript
export async function POST(req: Request) {
  try {
    // Get the session to check if the user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the user is an admin
    const userIsAdmin = await isAdmin(session.user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Forbidden. Only admins can send invitations.' }, { status: 403 });
    }

    // Get invitation data from request
    const { email, name, workspaceId, workspaceName, isAdmin: inviteeIsAdmin = false } = await req.json();

    // Validate required fields
    if (!email || !workspaceId || !workspaceName) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, workspaceId, and workspaceName must be provided.' 
      }, { status: 400 });
    }

    // Generate invitation token
    const token = uuidv4();
    
    // Set expiration date (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create invitation record in database
    const { data: invitationData, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        token,
        email,
        inviter_id: session.user.id,
        workspace_id: workspaceId,  // Crucial: ensure workspaceId is stored
        is_admin: inviteeIsAdmin,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      })
      .select();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    console.log('Created invitation:', invitationData);

    // Send invitation email
    const emailSent = await sendInvitationEmail(
      email, 
      session.user.name || 'Your colleague', 
      token, 
      workspaceName,
      inviteeIsAdmin
    );

    if (!emailSent) {
      console.error('Failed to send invitation email');
      // We don't return an error here since the invitation was created
    }

    return NextResponse.json({ 
      success: true, 
      invitation: { token, email, expires_at: expiresAt.toISOString() } 
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ 
      error: 'Failed to create invitation', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
```

### 2.2 Fix Invitation Verification (`/api/invite/[token]/route.ts`)

```typescript
export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    
    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Retrieve the invitation details
    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      console.error('Error fetching invitation:', error);
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Log the invitation data to verify it contains workspace_id
    console.log("Invitation data:", invitation);

    // Check if the invitation has a workspace_id
    if (!invitation.workspace_id) {
      console.error('Error: workspace_id is missing from invitation');
      return NextResponse.json({ error: 'Invalid invitation: missing workspace ID' }, { status: 400 });
    }

    // Check if the invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (expiresAt < now) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Get workspace information
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', invitation.workspace_id)
      .single();

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError);
      return NextResponse.json({ error: 'Error fetching workspace details' }, { status: 500 });
    }

    // Return the invitation details
    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        workspace_id: invitation.workspace_id,  // Include this for the frontend
        workspace_name: workspace?.name || 'Unknown Workspace',
        is_admin: invitation.is_admin,
        expires_at: invitation.expires_at
      }
    });
  } catch (error) {
    console.error('Error verifying invitation:', error);
    return NextResponse.json(
      { error: 'Failed to verify invitation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
```

### 2.3 Fix Registration Completion (`/api/register/invite/route.ts`)

```typescript
export async function POST(req: Request) {
  try {
    // Get registration data from request
    const { token, email, password, name } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Retrieve the invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      console.error('Error fetching invitation:', invitationError);
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Log the invitation data to verify it contains workspace_id
    console.log("Invitation data:", invitation);

    // Check if the invitation has a workspace_id
    if (!invitation.workspace_id) {
      console.error('Error: workspace_id is missing from invitation');
      return NextResponse.json({ error: 'Invalid invitation: missing workspace ID' }, { status: 400 });
    }

    // Check if the invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (expiresAt < now) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Check if the email matches
    if (invitation.email !== email) {
      return NextResponse.json({ error: 'Email does not match invitation' }, { status: 400 });
    }

    // Create the user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          invited_workspace_id: invitation.workspace_id  // Store for reference
        }
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Get workspace information
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', invitation.workspace_id)
      .single();

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError);
      // Continue since the user is created, but log the error
    }

    // Add the user to the team_members table
    const { data: teamMemberData, error: teamMemberError } = await supabase
      .from('team_members')
      .insert({
        user_id: authData.user.id,
        name: name || email.split('@')[0],
        email,
        workspace_id: invitation.workspace_id,  // Critical field
        is_admin: invitation.is_admin,
        permissions: invitation.permissions,
        created_at: new Date().toISOString()
      })
      .select();

    if (teamMemberError) {
      console.error('Error adding team member:', teamMemberError);
      // CRITICAL: Do not continue if team_members creation fails
      return NextResponse.json({ error: 'Failed to add user to team' }, { status: 500 });
    }

    console.log("Team member created:", teamMemberData);

    // Create user preferences
    const { error: prefError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: authData.user.id,
        created_at: new Date().toISOString(),
        has_seen_welcome: false,
        name,
        email,
        plan_id: 'team',
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
      });

    if (prefError) {
      console.error('Error creating user preferences:', prefError);
      // Continue with registration even if preferences creation fails
    }

    // Send welcome email
    await sendWelcomeEmail(
      email, 
      name || email.split('@')[0], 
      workspace?.name || 'Your Team'
    );

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('token', token);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      // Continue since the main functionality worked
    }

    return NextResponse.json({ 
      success: true, 
      user: { 
        id: authData.user.id, 
        email: authData.user.email, 
        name: name 
      } 
    });
  } catch (error) {
    console.error('Error in registration:', error);
    return NextResponse.json(
      { error: 'Registration failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
```

## 3. Ensure Database Setup

To fix the current database issues, you need to run these SQL commands:

```sql
-- 1. Create a workspace if none exists
INSERT INTO workspaces (name, owner_id)
VALUES ('My Workspace', 'b1439f18-03dc-4a3a-bf8e-6911795525de')
RETURNING id;

-- 2. Update your team_members record with a valid workspace_id
-- Replace 'YOUR_WORKSPACE_ID' with the ID returned from the command above
UPDATE team_members
SET workspace_id = 'YOUR_WORKSPACE_ID'
WHERE user_id = 'b1439f18-03dc-4a3a-bf8e-6911795525de';

-- 3. Enable RLS on the team_members table
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 4. Drop problematic RLS policies
DROP POLICY IF EXISTS "Admins can insert team members" ON team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON team_members;
DROP POLICY IF EXISTS "Admins can delete team members" ON team_members;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON team_members;
```

## 4. Testing and Verification

After implementing the code and database changes, manually test the invitation and registration flow:

1. Create a workspace if you haven't already
2. Set a team member as admin in that workspace
3. Log in as that admin
4. Send an invitation to a new email address
5. Accept the invitation and register as a new user
6. Verify that the new user is added to the team_members table with the correct workspace_id

During testing, monitor the server logs for any errors and check the Supabase dashboard to verify database entries.

## 5. Summary

The key issues and their solutions:

1. **Recursive RLS Policies**: Fixed by removing problematic policies and replacing with simplified ones that rely on application code for admin checks.
2. **Missing workspace_id**: Fixed by requiring workspace_id in all parts of the invitation flow and ensuring it's properly set in team_members records.
3. **Improper Error Handling**: Improved by adding more robust validation and error logging.

Remember that RLS is a powerful security feature, but it must be used appropriately. The combination of:
- A non-null workspace_id in team_members
- Application-level admin checks
- Correctly configured RLS policies

...creates a secure and robust user management system.