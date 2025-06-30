-- Enable Row Level Security on lead_folders table
-- This migration adds workspace-based RLS policies to the lead_folders table

-- Enable RLS on lead_folders table
ALTER TABLE lead_folders ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage lead folders in their workspaces" ON lead_folders;
DROP POLICY IF EXISTS "Users can create lead folders in their workspaces" ON lead_folders;

-- Create comprehensive policy for workspace-based access
-- This policy allows all operations (SELECT, INSERT, UPDATE, DELETE) for users who are members of the workspace
CREATE POLICY "Users can manage lead folders in their workspaces" ON lead_folders
FOR ALL USING (
  workspace_id IN (
    SELECT tm.workspace_id 
    FROM team_members tm 
    WHERE tm.user_id = auth.uid()
  )
);

-- Additional policy for inserts to ensure users can only create folders in their workspaces
CREATE POLICY "Users can create lead folders in their workspaces" ON lead_folders
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT tm.workspace_id 
    FROM team_members tm 
    WHERE tm.user_id = auth.uid()
  )
);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON lead_folders TO authenticated;

-- Ensure the table has the correct structure (if needed)
-- Uncomment if the table needs to be created or modified
/*
CREATE TABLE IF NOT EXISTS lead_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lead_folders_workspace_id ON lead_folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_folders_user_id ON lead_folders(user_id);
*/

-- Verify the policies are working
-- Test query: SELECT * FROM lead_folders WHERE workspace_id = 'your-workspace-id';
