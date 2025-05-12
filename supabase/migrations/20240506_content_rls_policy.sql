-- Enable RLS on the generated_content table if it's not already enabled
ALTER TABLE IF EXISTS public.generated_content ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows the service role to bypass RLS
CREATE POLICY "Service role bypass for generated_content" 
ON public.generated_content 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create policy for users to access their workspace content
CREATE POLICY "Users can view content from their workspaces" 
ON public.generated_content 
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM team_members WHERE workspace_id = workspace_id
    UNION
    SELECT owner_id FROM workspaces WHERE id = workspace_id
  )
);

-- Allow all operations for users on their own content
CREATE POLICY "Users can manage their own content" 
ON public.generated_content 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id); 