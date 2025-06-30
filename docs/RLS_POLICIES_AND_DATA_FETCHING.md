# Row Level Security (RLS) Policies and Data Fetching Patterns

This document outlines the standardized approach to data fetching and RLS policies in the Vibe CRM system.

## Authentication Architecture

### NextAuth Global Authentication
- **Primary Authentication**: NextAuth with Google OAuth
- **Session Management**: Cookie-based sessions (no JWT tokens)
- **API Authentication**: `withAuth` wrapper function from `@/lib/global-auth`
- **Database Access**: Direct Supabase queries with manual workspace filtering
- **NO Supabase Auth**: We use NextAuth exclusively, Supabase is only for database

### Authentication Flow
```typescript
// Client Side (React Hooks)
const { user, session } = useAuth(); // From @/lib/auth-client

// API Routes
export const GET = withAuth(async (request: NextRequest, { user }) => {
  // user.id is automatically available
  // Session is verified via NextAuth cookies
});
```

## Standard Data Fetching Pattern

### 1. Client-Side Hook Pattern
```typescript
// hooks/useCustomers.ts
export function useCustomers() {
  const { user, session } = useAuth();
  
  const fetchCustomers = useCallback(async () => {
    if (!user?.id || !session) {
      setIsLoading(false);
      return;
    }

    const response = await fetch('/api/customers', {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include NextAuth cookies
    });
    
    // Process response...
  }, [user?.id, session]);
}
```

### 2. API Route Pattern
```typescript
// app/api/customers/route.ts
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  // Get user's workspace for manual filtering
  const { data: userWorkspaces } = await supabaseAdmin
    .from('team_members')
    .select('workspace_id')
    .eq('user_id', user.id);
  
  if (!userWorkspaces || userWorkspaces.length === 0) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 403 });
  }
  
  const workspaceIds = userWorkspaces.map(w => w.workspace_id);
  
  // Query with manual workspace filtering
  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('*, projects(*), invoices(*)')
    .in('workspace_id', workspaceIds); // Manual filtering
    
  return NextResponse.json({ customers });
});
```

## RLS Policy Patterns

### Core RLS Policy Structure
All tables follow this standardized workspace-based access pattern:

```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- SELECT Policy
CREATE POLICY "Users can view {table_name} in their workspace"
ON {table_name} FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- INSERT Policy
CREATE POLICY "Users can create {table_name} in their workspace"
ON {table_name} FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- UPDATE Policy
CREATE POLICY "Users can update {table_name} in their workspace"
ON {table_name} FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- DELETE Policy
CREATE POLICY "Users can delete {table_name} in their workspace"
ON {table_name} FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);
```

## Implemented Tables and Policies

### 1. Customers Table
**Table**: `customers`
**Access Pattern**: Workspace-based via `team_members` table

**Policies**:
- ✅ `Users can view customers in their workspace` (SELECT)
- ✅ `Users can create customers in their workspace` (INSERT)
- ✅ `Users can update customers in their workspace` (UPDATE)
- ✅ `Users can delete customers in their workspace` (DELETE)

**API Endpoint**: `/api/customers`
**Query Pattern**:
```sql
SELECT *, projects(*), invoices(*)
FROM customers
WHERE workspace_id IN (
  SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
);
```

### 2. Projects Table
**Table**: `projects`
**Access Pattern**: Hybrid - RLS policies + Manual workspace filtering (due to service role bypass)

**Policies**:
- ✅ `Users can view projects in their workspace` (SELECT)
- ✅ `Users can create projects in their workspace` (INSERT)
- ✅ `Users can update projects in their workspace` (UPDATE)
- ✅ `Users can delete projects in their workspace` (DELETE)
- ✅ `workspace_access_projects` (ALL - legacy policy)

**API Endpoint**: `/api/projects`
**Query Pattern** (Manual filtering due to supabaseAdmin bypass):
```typescript
// Get user's workspaces
const { data: userWorkspaces } = await supabaseAdmin
  .from('team_members')
  .select('workspace_id')
  .eq('user_id', user.id);

const workspaceIds = userWorkspaces.map(w => w.workspace_id);

// Manually filter projects by workspace
let query = supabaseAdmin
  .from('projects')
  .select(`
    *,
    project_tasks (*)
  `)
  .in('workspace_id', workspaceIds); // Manual workspace filtering
```

**Note**: Service role (`supabaseAdmin`) bypasses RLS, so manual workspace filtering is required.

### 3. Project Folders Table
**Table**: `project_folders`
**Access Pattern**: Workspace-based via `team_members` table

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS public.project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Policies**:
- ✅ `Users can view folders in their workspace` (SELECT)
- ✅ `Users can create folders in their workspace` (INSERT)
- ✅ `Users can update folders in their workspace` (UPDATE)
- ✅ `Users can delete folders in their workspace` (DELETE)

**API Endpoint**: `/api/project-folders`
**Query Pattern**:
```typescript
// Fetch folders using admin client with workspace filtering
const { data } = await supabaseAdmin
  .from("project_folders")
  .select("*")
  .eq("workspace_id", workspaceId)
  .order("created_at", { ascending: false });
```

**Relationship**: Projects reference folders via `folder_id` field

### 4. Project Tasks Table
**Table**: `project_tasks`
**Access Pattern**: Workspace-based via `team_members` table + Project relationship

**Schema**:
```sql
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  progress INTEGER DEFAULT 0,
  checklist JSONB DEFAULT '[]',
  due_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  completion_percentage INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Policies**:
- ✅ `Users can view tasks in their workspace` (SELECT)
- ✅ `Users can create tasks in their workspace` (INSERT)
- ✅ `Users can update tasks in their workspace` (UPDATE)
- ✅ `Users can delete tasks in their workspace` (DELETE)

**API Endpoints**: `/api/project-tasks`, `/api/project-tasks/[id]`

**Query Pattern** (via Projects API):
```typescript
// Tasks are loaded with projects in nested query
let query = supabaseAdmin
  .from('projects')
  .select(`
    *,
    project_tasks (
      id, title, status, priority, progress, checklist,
      due_date, deadline, assigned_to, created_at,
      tags, estimated_hours, actual_hours,
      completion_percentage, dependencies, attachments
    )
  `)
  .in('workspace_id', workspaceIds);
```

**Relationship**: Tasks belong to projects and inherit workspace access through project

### 5. Chat Tables

#### 5.1. Chat Channels Table
**Table**: `chat_channels`
**Access Pattern**: Workspace-based via `team_members` table + Channel membership

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL DEFAULT 'public' CHECK (channel_type IN ('public', 'private')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS chat_channels_workspace_id_idx ON public.chat_channels(workspace_id);
CREATE INDEX IF NOT EXISTS chat_channels_created_by_idx ON public.chat_channels(created_by);
CREATE INDEX IF NOT EXISTS chat_channels_type_idx ON public.chat_channels(channel_type);
```

**Policies**:
```sql
-- Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view channels they are members of in their workspace
CREATE POLICY "Users can view channels they are members of in their workspace"
ON public.chat_channels FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
  AND (
    channel_type = 'public' 
    OR id IN (
      SELECT channel_id 
      FROM chat_channel_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- INSERT: Users can create channels in their workspace
CREATE POLICY "Users can create channels in their workspace"
ON public.chat_channels FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- UPDATE: Channel creators and admins can update channels
CREATE POLICY "Channel creators and admins can update channels"
ON public.chat_channels FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM chat_channel_members ccm 
      WHERE ccm.channel_id = id 
      AND ccm.user_id = auth.uid() 
      AND ccm.role = 'admin'
    )
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- DELETE: Only channel creators can delete channels
CREATE POLICY "Only channel creators can delete channels"
ON public.chat_channels FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);
```

**API Endpoint**: `/api/chat-channels`
**Query Pattern**:
```typescript
// Fetch channels with membership filtering
const { data } = await supabaseAdmin
  .from("chat_channels")
  .select(`
    *,
    chat_channel_members!inner(user_id)
  `)
  .in("workspace_id", filterWorkspaceIds)
  .eq('chat_channel_members.user_id', user.id); // Only channels user is a member of
```

#### 5.2. Chat Channel Members Table
**Table**: `chat_channel_members`
**Access Pattern**: Channel membership + Workspace access

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(channel_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS chat_channel_members_channel_id_idx ON public.chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS chat_channel_members_user_id_idx ON public.chat_channel_members(user_id);
CREATE INDEX IF NOT EXISTS chat_channel_members_role_idx ON public.chat_channel_members(role);
```

**Policies**:
```sql
-- Enable RLS
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view channel members for channels they have access to
CREATE POLICY "Users can view channel members for accessible channels"
ON public.chat_channel_members FOR SELECT
TO authenticated
USING (
  channel_id IN (
    SELECT c.id FROM chat_channels c
    WHERE c.workspace_id IN (
      SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
    )
    AND (
      c.channel_type = 'public'
      OR EXISTS (
        SELECT 1 FROM chat_channel_members ccm
        WHERE ccm.channel_id = c.id AND ccm.user_id = auth.uid()
      )
    )
  )
);

-- INSERT: Channel admins and creators can add members
CREATE POLICY "Channel admins can add members"
ON public.chat_channel_members FOR INSERT
TO authenticated
WITH CHECK (
  channel_id IN (
    SELECT c.id FROM chat_channels c
    WHERE c.workspace_id IN (
      SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
    )
    AND (
      c.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM chat_channel_members ccm
        WHERE ccm.channel_id = c.id AND ccm.user_id = auth.uid() AND ccm.role = 'admin'
      )
    )
  )
  AND user_id IN (
    SELECT user_id FROM team_members tm
    WHERE tm.workspace_id IN (
      SELECT workspace_id FROM chat_channels WHERE id = channel_id
    )
  )
);

-- UPDATE: Users can update their own membership, admins can update all
CREATE POLICY "Users can update their membership, admins can update all"
ON public.chat_channel_members FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM chat_channels c
    WHERE c.id = channel_id
    AND c.workspace_id IN (
      SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
    )
    AND (
      c.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM chat_channel_members ccm
        WHERE ccm.channel_id = c.id AND ccm.user_id = auth.uid() AND ccm.role = 'admin'
      )
    )
  )
)
WITH CHECK (
  channel_id IN (
    SELECT c.id FROM chat_channels c
    WHERE c.workspace_id IN (
      SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
    )
  )
);

-- DELETE: Users can remove themselves, admins can remove others
CREATE POLICY "Users can remove themselves, admins can remove others"
ON public.chat_channel_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM chat_channels c
    WHERE c.id = channel_id
    AND c.workspace_id IN (
      SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
    )
    AND (
      c.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM chat_channel_members ccm
        WHERE ccm.channel_id = c.id AND ccm.user_id = auth.uid() AND ccm.role = 'admin'
      )
    )
  )
);
```

**API Endpoints**: `/api/chat-channels/[channelId]/members`

#### 5.3. Chat Messages Table
**Table**: `chat_messages`
**Access Pattern**: Channel membership + Workspace access + Message type

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'private', 'calendar_event', 'project_update')),
  metadata JSONB DEFAULT '{}',
  reply_to UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS chat_messages_workspace_id_idx ON public.chat_messages(workspace_id);
CREATE INDEX IF NOT EXISTS chat_messages_channel_id_idx ON public.chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_type_idx ON public.chat_messages(message_type);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages(created_at DESC);
```

**Policies**:
```sql
-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view messages in their workspace channels or private messages to/from them
CREATE POLICY "Users can view accessible chat messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
  AND (
    -- General workspace messages (no channel)
    (channel_id IS NULL AND message_type != 'private')
    OR
    -- Channel messages (user must be channel member)
    (channel_id IS NOT NULL AND channel_id IN (
      SELECT ccm.channel_id FROM chat_channel_members ccm
      WHERE ccm.user_id = auth.uid()
    ))
    OR
    -- Private messages (user is sender or recipient)
    (message_type = 'private' AND (
      user_id = auth.uid()
      OR (metadata->>'private_chat_with')::uuid = auth.uid()
    ))
  )
);

-- INSERT: Users can create messages in their workspace
CREATE POLICY "Users can create messages in their workspace"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
  AND (
    -- General workspace messages
    (channel_id IS NULL AND message_type != 'private')
    OR
    -- Channel messages (user must be channel member)
    (channel_id IS NOT NULL AND channel_id IN (
      SELECT ccm.channel_id FROM chat_channel_members ccm
      WHERE ccm.user_id = auth.uid()
    ))
    OR
    -- Private messages (recipient must be in same workspace)
    (message_type = 'private' AND (
      (metadata->>'private_chat_with')::uuid IN (
        SELECT user_id FROM team_members 
        WHERE workspace_id = chat_messages.workspace_id
      )
    ))
  )
);

-- UPDATE: Users can only update their own messages
CREATE POLICY "Users can update their own messages"
ON public.chat_messages FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- DELETE: Users can delete their own messages, channel admins can delete channel messages
CREATE POLICY "Users can delete their own messages, admins can delete channel messages"
ON public.chat_messages FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
  AND (
    user_id = auth.uid()
    OR (
      channel_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM chat_channel_members ccm
        WHERE ccm.channel_id = chat_messages.channel_id
        AND ccm.user_id = auth.uid()
        AND ccm.role = 'admin'
      )
    )
  )
);
```

**API Endpoints**: Embedded in `ChatInterface` component
**Query Patterns**:
```typescript
// General workspace chat
const { data: messages } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('workspace_id', workspaceId)
  .neq('message_type', 'private')
  .is('channel_id', null)
  .order('created_at', { ascending: true });

// Private chat messages
const { data: messages } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('message_type', 'private')
  .or(`and(user_id.eq.${currentUserId},metadata->>private_chat_with.eq.${otherUserId}),and(user_id.eq.${otherUserId},metadata->>private_chat_with.eq.${currentUserId})`)
  .order('created_at', { ascending: true });

// Channel messages
const { data: messages } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('channel_id', channelId)
  .order('created_at', { ascending: true });
```

#### 5.4. Chat History Table (Optional)
**Table**: `chat_history`
**Access Pattern**: Same as chat_messages but for archival purposes

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_message_id UUID NOT NULL,
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'edited', 'deleted')),
  action_timestamp TIMESTAMPTZ DEFAULT NOW(),
  action_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS chat_history_original_message_id_idx ON public.chat_history(original_message_id);
CREATE INDEX IF NOT EXISTS chat_history_workspace_id_idx ON public.chat_history(workspace_id);
CREATE INDEX IF NOT EXISTS chat_history_action_timestamp_idx ON public.chat_history(action_timestamp DESC);
```

**Policies**: Same pattern as `chat_messages` but for audit purposes

### 6. Project Assignments Table
**Table**: `projects` (assignment via `assigned_to` field)
**Access Pattern**: Workspace-based via `team_members` table

**Policies**:
- ✅ Uses existing project policies for workspace access
- ✅ Assignment validation ensures target user exists in same workspace

**API Endpoint**: `/api/project-assignments`
**Query Pattern**:
```typescript
// Assign project to user
const response = await fetch('/api/project-assignments', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    project_id: 'project-uuid',
    assigned_to: 'user-uuid' // or null to unassign
  })
});

// Get assignment info
const response = await fetch('/api/project-assignments?project_id=project-uuid', {
  credentials: 'include'
});
```

**Hook**: `useProjectAssignments`
**Features**:
- Workspace-aware assignment validation
- Automatic workspace membership verification
- Assignment history tracking
- Notification integration

### 5. Invoices Table
**Table**: `invoices`
**Access Pattern**: Workspace-based via `team_members` table

**Policies**:
- ✅ `Users can view invoices in their workspace` (SELECT)
- ✅ `Users can create invoices in their workspace` (INSERT)
- ✅ `Users can update invoices in their workspace` (UPDATE)
- ✅ `Users can delete invoices in their workspace` (DELETE)
- ✅ `Service role can access invoices with workspace check` (ALL)
- ✅ `workspace_access_invoices` (ALL - legacy policy)

**API Endpoint**: `/api/invoices`
**Query Pattern**:
```sql
SELECT *, 
       customers(id, name, customer_number, email),
       currencies(code, symbol),
       invoice_types(name)
FROM invoices
WHERE workspace_id IN (
  SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
);
```

**Hook**: `useInvoices`
**Features**:
- Pagination support
- Search filtering (document_number, customer_name)
- Status filtering (paid, unpaid, overdue)
- Date range filtering (thisMonth, lastMonth, thisYear)
- Sorting by multiple fields
- Real-time statistics calculation

## Data Fetching Examples

### Customer Page Data Flow

1. **Client Component** (`components/customers/index.tsx`):
```typescript
const { customers, isLoading, error } = useCustomers();
```

2. **Hook** (`hooks/useCustomers.ts`):
```typescript
const response = await fetch('/api/customers', {
  credentials: 'include'
});
```

3. **API Route** (`app/api/customers/route.ts`):
```typescript
export const GET = withAuth(async (request, { user }) => {
  // Get user's workspaces for manual filtering
  const { data: userWorkspaces } = await supabaseAdmin
    .from('team_members')
    .select('workspace_id')
    .eq('user_id', user.id);
  
  const workspaceIds = userWorkspaces.map(w => w.workspace_id);
  
  // Query with manual workspace filtering
  const { data } = await supabaseAdmin
    .from('customers')
    .select(`
      *,
      projects (*),
      invoices (*)
    `)
    .in('workspace_id', workspaceIds);
});
```

4. **Database Query** (executed with RLS):
```sql
-- RLS automatically filters to user's workspace
SELECT c.*, p.*, i.*
FROM customers c
LEFT JOIN projects p ON p.customer_id = c.id
LEFT JOIN invoices i ON i.customer_id = c.id
WHERE c.workspace_id IN (
  SELECT workspace_id FROM team_members WHERE user_id = 'current-user-id'
);
```

### Invoice Page Data Flow

1. **Client Component** (`app/invoices/page.tsx`):
```typescript
const { invoices, stats, pagination, isLoading, error, refetch } = useInvoices({
  search: search || undefined,
  status: filters.status,
  dateRange: filters.dateRange,
  orderBy: 'invoice_date',
  orderDir: 'desc'
});
```

2. **Hook** (`hooks/useInvoices.ts`):
```typescript
const searchParams = new URLSearchParams();
if (options.search) searchParams.set('search', options.search);
if (options.status !== 'all') searchParams.set('status', options.status);

const response = await fetch(`/api/invoices?${searchParams.toString()}`, {
  credentials: 'include'
});
```

3. **API Route** (`app/api/invoices/route.ts`):
```typescript
export const GET = withAuth(async (request, { user }) => {
  // Set RLS context
  await supabaseAdmin.rpc('set_config', {
    setting_name: 'request.jwt.claim.sub',
    setting_value: user.id
  });
  
  // Build query with filters and pagination
  let query = supabaseAdmin
    .from('invoices')
    .select(`
      *,
      customers(id, name, customer_number, email),
      currencies(code, symbol),
      invoice_types(name)
    `, { count: 'exact' });
    
  // Apply search, status, date filters
  if (search) query = query.or(`document_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
  if (status === 'paid') query = query.eq('balance', 0);
  
  // Add pagination and ordering
  query = query.order(orderBy, { ascending: orderDir === 'asc' })
               .range(offset, offset + pageSize - 1);
});
```

4. **Database Query** (executed with RLS):
```sql
-- RLS automatically filters to user's workspace
SELECT i.*, c.name as customer_name, cur.code as currency_code
FROM invoices i
LEFT JOIN customers c ON c.id = i.customer_id
LEFT JOIN currencies cur ON cur.id = i.currency_id
WHERE i.workspace_id IN (
  SELECT workspace_id FROM team_members WHERE user_id = 'current-user-id'
)
AND (i.document_number ILIKE '%search%' OR i.customer_name ILIKE '%search%')
ORDER BY i.invoice_date DESC
LIMIT 50 OFFSET 0;
```

## Security Considerations

### 1. Authentication Context
- Always use `withAuth` wrapper for API routes
- Set `request.jwt.claim.sub` to user ID for RLS context
- Set `role` to `authenticated` for proper policy execution

### 2. Workspace Isolation
- All data access is scoped to user's workspace(s) via `team_members` table
- Users can be members of multiple workspaces
- RLS policies automatically filter data based on workspace membership

### 3. Client-Side Security
- Never rely on client-side filtering for security
- Always validate access on the server side
- Use `credentials: 'include'` for API calls to include session cookies

### 4. Service Role vs Authenticated Role
- **`supabaseAdmin` (service role)**: Bypasses ALL RLS policies - requires manual filtering
- **Regular client (authenticated role)**: Respects RLS policies automatically
- **When to use each**:
  - Use `supabaseAdmin` for complex queries, admin operations, or when RLS causes issues
  - Use regular client for simple CRUD operations where RLS is sufficient
  - Always implement manual workspace filtering when using `supabaseAdmin`

## Creating New Tables with RLS

When adding a new table that should follow the workspace pattern:

1. **Add workspace_id column**:
```sql
ALTER TABLE new_table ADD COLUMN workspace_id UUID REFERENCES workspaces(id);
```

2. **Enable RLS**:
```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
```

3. **Apply standard policies** using the template above

4. **Create API route** using `withAuth` wrapper

5. **Create React hook** following the standard pattern

6. **Update this documentation** with the new table details

## Troubleshooting

### Common Issues

1. **"No rows returned"**: Check if RLS context is set correctly
2. **"Permission denied"**: Verify workspace membership in `team_members`
3. **"Unauthorized"**: Ensure NextAuth session is valid and cookies are included

### Debug Queries

```sql
-- Check current auth context
SELECT current_setting('request.jwt.claim.sub', true) as user_id;
SELECT current_setting('role', true) as current_role;

-- Check user's workspace memberships
SELECT * FROM team_members WHERE user_id = 'user-id-here';

-- Test RLS policy manually
SELECT workspace_id FROM team_members WHERE user_id = auth.uid();

-- Verify project workspace distribution
SELECT COUNT(*) as total_projects, workspace_id 
FROM projects 
GROUP BY workspace_id 
ORDER BY total_projects DESC;

-- Check if service role is bypassing RLS
-- (If this returns all projects regardless of workspace, RLS is bypassed)
SELECT id, name, workspace_id FROM projects LIMIT 10;
```

### Workspace Filtering Issues

1. **All projects showing instead of workspace-filtered**:
   - Verify that manual workspace filtering is implemented in API routes
   - Check if `userWorkspaces` array is populated correctly
   - Ensure `.in('workspace_id', workspaceIds)` is added to queries

2. **Service role bypassing RLS**:
   - Expected behavior: `supabaseAdmin` bypasses all RLS policies
   - Solution: Implement manual workspace filtering as shown in Projects API
   - Pattern: Get user workspaces first, then filter queries manually

3. **"No workspace found for user" error**:
   - Check if user exists in `team_members` table
   - Verify workspace assignment for the user
   - Ensure workspace ID exists in `workspaces` table

## Migration Commands

To apply RLS policies to a new table:

```typescript
// Using MCP call
await call_mcp_tool('apply_migration', {
  name: 'table_name_rls_policies',
  project_id: 'jbspiufukrifntnwlrts',
  query: `
    ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view table_name in their workspace"
    ON table_name FOR SELECT TO authenticated
    USING (workspace_id IN (
      SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
    ));
    
    -- Add INSERT, UPDATE, DELETE policies...
  `
});
```

---

**Last Updated**: 2025-01-30
**Maintainer**: Development Team
**Related Files**:
- `/lib/global-auth.ts` - Authentication wrapper
- `/hooks/useCustomers.ts` - Customer data hook
- `/app/api/customers/route.ts` - Customer API endpoint
- `/hooks/useInvoices.ts` - Invoice data hook
- `/app/api/invoices/route.ts` - Invoice API endpoint
- `/app/invoices/page.tsx` - Invoice page implementation
