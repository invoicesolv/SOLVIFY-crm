# Project Folder Fetching and Rendering Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROJECT FOLDER SYSTEM FLOW                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              1. INITIALIZATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

ProjectsView Component (index.tsx)
    │
    ├─ useState: selectedFolderId, workspaceId, refreshTrigger
    ├─ useState: availableFolders, projects
    │
    └─ useEffect → fetchProjects() + fetchAvailableFolders()

┌─────────────────────────────────────────────────────────────────────────────┐
│                          2. FOLDER SIDEBAR RENDERING                       │
└─────────────────────────────────────────────────────────────────────────────┘

ProjectFolderSidebar Component
    │
    ├─ Props: workspaceId, selectedFolderId, displayedProjects
    ├─ useState: folders[], folderCounts{}, unassignedCount, totalCount
    │
    └─ useEffect(workspaceId, refreshTrigger) → loadFolders()

┌─────────────────────────────────────────────────────────────────────────────┐
│                           3. FOLDER DATA FETCHING                          │
└─────────────────────────────────────────────────────────────────────────────┘

loadFolders() Function:
    │
    ├─ Step 1: Fetch folders from API
    │   └─ GET /api/project-folders?workspace_id=${workspaceId}
    │
    ├─ Step 2A: Count projects by folder (if displayedProjects provided)
    │   ├─ Loop through displayedProjects
    │   ├─ Count by folder_id (null = unassigned)
    │   └─ setFolderCounts(), setUnassignedCount(), setTotalCount()
    │
    └─ Step 2B: Fallback API count (if no displayedProjects)
        ├─ GET /api/projects
        ├─ Manual count by folder_id
        └─ Update state

┌─────────────────────────────────────────────────────────────────────────────┐
│                            4. API ENDPOINT FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

/api/project-folders/route.ts (GET):
    │
    ├─ withAuth() wrapper → validate user
    │
    ├─ Get user workspaces from team_members table
    │   └─ supabaseAdmin.from('team_members').select('workspace_id').eq('user_id', user.id)
    │
    ├─ Filter by requested workspace_id (if provided)
    │
    ├─ Fetch folders with workspace filtering
    │   └─ supabaseAdmin.from('project_folders').select('*').in('workspace_id', filterWorkspaceIds)
    │
    └─ Return: { folders: data || [] }

┌─────────────────────────────────────────────────────────────────────────────┐
│                              5. UI RENDERING                               │
└─────────────────────────────────────────────────────────────────────────────┘

ProjectFolderSidebar Render:
    │
    ├─ "All Projects" Button
    │   └─ Badge: {totalCount}
    │
    ├─ "Unassigned" Button  
    │   └─ Badge: {unassignedCount}
    │
    ├─ For each folder in folders[]:
    │   ├─ Button with folder name
    │   ├─ Icon: Folder/FolderOpen (based on selection)
    │   └─ Badge: {folderCounts[folder.id] || 0}
    │
    └─ "Manage Folders" Button
        └─ onClick: onManageFolders()

┌─────────────────────────────────────────────────────────────────────────────┐
│                          6. PROJECT FILTERING                              │
└─────────────────────────────────────────────────────────────────────────────┘

ProjectsView filteredProjects Logic:
    │
    ├─ Base: projects.filter(search match)
    │
    ├─ If selectedFolderId === null → Show all projects
    ├─ If selectedFolderId === "unassigned" → Show projects with folder_id === null
    └─ Else → Show projects with folder_id === selectedFolderId

┌─────────────────────────────────────────────────────────────────────────────┐
│                           7. FOLDER MANAGEMENT                             │
└─────────────────────────────────────────────────────────────────────────────┘

ProjectFolderManagementDialog:
    │
    ├─ Create Folder:
    │   └─ supabase.from('project_folders').insert()
    │
    ├─ Update Folder:
    │   └─ supabase.from('project_folders').update().eq('id', folderId)
    │
    └─ Delete Folder:
        ├─ supabase.from('projects').update({folder_id: null}).eq('folder_id', folderId)
        └─ supabase.from('project_folders').delete().eq('id', folderId)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            8. STATE UPDATES                                │
└─────────────────────────────────────────────────────────────────────────────┘

handleFoldersChanged() Flow:
    │
    ├─ fetchProjects() → Refresh main project list
    ├─ fetchAvailableFolders() → Refresh folder options
    └─ setRefreshTrigger(prev => prev + 1) → Force sidebar refresh

┌─────────────────────────────────────────────────────────────────────────────┐
│                            9. DATA FLOW SUMMARY                            │
└─────────────────────────────────────────────────────────────────────────────┘

User loads page
    ↓
ProjectsView mounts
    ↓
ProjectFolderSidebar mounts with workspaceId
    ↓
loadFolders() called
    ↓
API call to /api/project-folders
    ↓
Supabase query with RLS/workspace filtering
    ↓
Count projects by folder (from displayedProjects or API)
    ↓
Update sidebar state (folders, counts)
    ↓
Render sidebar with folder buttons and counts
    ↓
User clicks folder → onFolderSelect() → filters projects
    ↓
Project list updates based on selectedFolderId

┌─────────────────────────────────────────────────────────────────────────────┐
│                          10. KEY STATE VARIABLES                           │
└─────────────────────────────────────────────────────────────────────────────┘

ProjectsView:
- selectedFolderId: string | null (current filter)
- workspaceId: string | null (current workspace)
- refreshTrigger: number (forces sidebar refresh)
- availableFolders: {id, name}[] (for dropdowns)

ProjectFolderSidebar:
- folders: ProjectFolder[] (all folders)
- folderCounts: Record<string, number> (project count per folder)
- unassignedCount: number (projects without folder)
- totalCount: number (all projects)
```
