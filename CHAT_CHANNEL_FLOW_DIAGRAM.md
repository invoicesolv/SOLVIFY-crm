# Chat Channel Fetching and Rendering Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHAT CHANNEL SYSTEM FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              1. INITIALIZATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

ChatView Component (page.tsx)
    │
    ├─ useState: selectedChannelId, workspaceId, refreshTrigger
    ├─ useState: showChannelManagement
    │
    └─ useEffect → initializeData() + fetchChannels()

┌─────────────────────────────────────────────────────────────────────────────┐
│                        2. CHANNEL SIDEBAR RENDERING                        │
└─────────────────────────────────────────────────────────────────────────────┘

ChatChannelSidebar Component
    │
    ├─ Props: workspaceId, selectedChannelId, currentUserId
    ├─ useState: channels[], channelCounts{}, totalMembers
    │
    └─ useEffect(workspaceId, refreshTrigger) → loadChannels()

┌─────────────────────────────────────────────────────────────────────────────┐
│                         3. CHANNEL DATA FETCHING                           │
└─────────────────────────────────────────────────────────────────────────────┘

loadChannels() Function:
    │
    ├─ Step 1: Fetch channels from API
    │   └─ GET /api/chat-channels?workspace_id=${workspaceId}
    │
    └─ Step 2: Fetch channel stats
        ├─ For each channel:
        │   ├─ GET /api/chat-channels/${channelId}/members
        │   └─ GET /api/chat-channels/${channelId}/unread?user_id=${currentUserId}
        │
        └─ Update channelCounts{}, totalMembers

┌─────────────────────────────────────────────────────────────────────────────┐
│                            4. API ENDPOINT FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

/api/chat-channels/route.ts (GET):
    │
    ├─ withAuth() wrapper → validate user
    │
    ├─ Get user workspaces from team_members table
    │   └─ supabaseAdmin.from('team_members').select('workspace_id').eq('user_id', user.id)
    │
    ├─ Filter by requested workspace_id (if provided)
    │
    ├─ Fetch channels with workspace + membership filtering
    │   └─ supabaseAdmin.from('chat_channels')
    │       .select('*, chat_channel_members!inner(user_id)')
    │       .in('workspace_id', filterWorkspaceIds)
    │       .eq('chat_channel_members.user_id', user.id)
    │
    └─ Return: { channels: data || [] }

/api/chat-channels/[channelId]/members/route.ts (GET):
    │
    ├─ Verify user access to channel
    │   └─ Check chat_channel_members table
    │
    ├─ Count channel members
    │   └─ SELECT count(*) FROM chat_channel_members WHERE channel_id = ?
    │
    └─ Return: { count, members }

/api/chat-channels/[channelId]/unread/route.ts (GET):
    │
    ├─ Verify user access to channel
    │   └─ Get user's last_read_at timestamp
    │
    ├─ Count unread messages
    │   └─ SELECT count(*) FROM chat_messages 
    │       WHERE channel_id = ? AND user_id != ? AND created_at > last_read_at
    │
    └─ Return: { count, last_read_at }

┌─────────────────────────────────────────────────────────────────────────────┐
│                              5. UI RENDERING                               │
└─────────────────────────────────────────────────────────────────────────────┘

ChatChannelSidebar Render:
    │
    ├─ "General Chat" Button
    │   └─ Badge: {totalMembers}
    │
    ├─ For each channel in channels[]:
    │   ├─ Button with channel name
    │   ├─ Icon: Hash (public) / Lock (private)
    │   ├─ Unread Badge: {channelCounts[id].unread} (if > 0)
    │   └─ Member Badge: {channelCounts[id].members}
    │
    └─ "Manage Channels" Button
        └─ onClick: onManageChannels()

┌─────────────────────────────────────────────────────────────────────────────┐
│                        6. MESSAGE FILTERING BY CHANNEL                     │
└─────────────────────────────────────────────────────────────────────────────┘

ChatInterface Message Logic:
    │
    ├─ If selectedChannelId === null → Show general workspace chat
    ├─ If selectedChannelId → Show channel-specific messages
    │   └─ Filter: chat_messages.channel_id = selectedChannelId
    │
    └─ Real-time subscription filters by channel_id

┌─────────────────────────────────────────────────────────────────────────────┐
│                           7. CHANNEL MANAGEMENT                            │
└─────────────────────────────────────────────────────────────────────────────┘

ChatChannelManagementDialog:
    │
    ├─ Create Channel:
    │   ├─ POST /api/chat-channels
    │   └─ Auto-add creator as admin member
    │
    ├─ Update Channel:
    │   └─ supabase.from('chat_channels').update().eq('id', channelId)
    │
    └─ Delete Channel:
        ├─ Delete chat_channel_members
        ├─ Delete chat_messages  
        └─ Delete chat_channels

┌─────────────────────────────────────────────────────────────────────────────┐
│                            8. STATE UPDATES                                │
└─────────────────────────────────────────────────────────────────────────────┘

handleChannelsChanged() Flow:
    │
    ├─ fetchChannels() → Refresh channel list
    ├─ fetchChannelStats() → Refresh member/unread counts
    └─ setRefreshTrigger(prev => prev + 1) → Force sidebar refresh

┌─────────────────────────────────────────────────────────────────────────────┐
│                            9. DATA FLOW SUMMARY                            │
└─────────────────────────────────────────────────────────────────────────────┘

User loads chat page
    ↓
ChatView mounts
    ↓
ChatChannelSidebar mounts with workspaceId
    ↓
loadChannels() called
    ↓
API call to /api/chat-channels
    ↓
Supabase query with RLS/workspace/membership filtering
    ↓
For each channel: fetch member count + unread count
    ↓
Update sidebar state (channels, counts)
    ↓
Render sidebar with channel buttons and badges
    ↓
User clicks channel → onChannelSelect() → filters messages
    ↓
Chat interface updates based on selectedChannelId

┌─────────────────────────────────────────────────────────────────────────────┐
│                          10. KEY STATE VARIABLES                           │
└─────────────────────────────────────────────────────────────────────────────┘

ChatView:
- selectedChannelId: string | null (current channel filter)
- workspaceId: string | null (current workspace)
- refreshTrigger: number (forces sidebar refresh)
- showChannelManagement: boolean (dialog state)

ChatChannelSidebar:
- channels: ChatChannel[] (all accessible channels)
- channelCounts: Record<string, {members: number, unread: number}>
- totalMembers: number (all workspace members)
- loading: boolean (fetch state)

┌─────────────────────────────────────────────────────────────────────────────┐
│                        11. DATABASE SCHEMA OVERVIEW                        │
└─────────────────────────────────────────────────────────────────────────────┘

Tables involved:
- chat_channels (id, name, description, workspace_id, channel_type, created_by)
- chat_channel_members (channel_id, user_id, role, joined_at, last_read_at)
- chat_messages (id, content, user_id, workspace_id, channel_id, message_type)
- team_members (workspace_id, user_id) [for authorization]

Key relationships:
- chat_channels.workspace_id → workspaces.id
- chat_channel_members.channel_id → chat_channels.id
- chat_channel_members.user_id → auth.users.id
- chat_messages.channel_id → chat_channels.id
```
