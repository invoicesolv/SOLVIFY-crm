-- Drop all existing policies on team_members
DROP POLICY IF EXISTS "Admins can insert team members" ON team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON team_members;
DROP POLICY IF EXISTS "Admins can delete team members" ON team_members;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON team_members;
DROP POLICY IF EXISTS "Users can see their own team membership" ON team_members;
DROP POLICY IF EXISTS "Admins can see all team members" ON team_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON team_members;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON team_members;
DROP POLICY IF EXISTS "Users can update their own name" ON team_members;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON team_members;
