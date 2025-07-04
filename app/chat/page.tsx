"use client";

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Calendar, FolderOpen, Users, X, Bot } from 'lucide-react'
import { ChatInterface } from '@/components/ui/chat-interface'
import { CalendarSidebar } from '@/components/ui/calendar-sidebar'
import { ProjectSidebar } from '@/components/ui/project-sidebar'
import { ChatWindow } from '@/components/ChatWindow'
import { SidebarDemo } from '@/components/ui/code.demo'
import { useAuth } from '@/lib/auth-client';
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/lib/notification-context'
import { cn } from '@/lib/utils'

type ViewType = 'chat' | 'calendar' | 'projects' | 'ai-assistant'

type WorkspaceUser = {
  id: string
  name: string
  avatar: string | null
  status: 'online' | 'away' | 'offline'
}

export default function ChatPage() {
  const { user, session } = useAuth()
  const router = useRouter()
  const [activeView, setActiveView] = useState<ViewType>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { unreadMessages, markAllAsRead } = useNotifications()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user && session === null) {
      router.push('/login')
      return
    }
  }, [user, session, router])

  // Get active workspace using API only (skip localStorage to avoid stale data)
  const getActiveWorkspace = async () => {
    try {
      console.log('Chat: Fetching active workspace from API...');
      const response = await fetch('/api/user/active-workspace', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'Cache-Control': 'no-cache',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.workspaceId) {
          console.log('Chat: Found active workspace from API:', data.workspaceId);
          // Clear any stale localStorage data and save the correct workspace
          if (user?.id) {
            localStorage.removeItem('dashboardSettings'); // Clear potentially stale data
            localStorage.setItem(`workspace_${user.id}`, data.workspaceId);
          }
          return data.workspaceId;
        }
      } else {
        console.error('Chat: Error response from active-workspace API:', response.status, response.statusText);
        const errorData = await response.json().catch(() => null);
        console.error('Chat: API error details:', errorData);
      }
    } catch (e) {
      console.error('Chat: Error fetching workspace from API:', e);
    }
    
    return null;
  };

  // Fetch workspace and user data dynamically
  const initializeData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log('Chat: Initializing data for user:', user?.id)
      
      // Get active workspace using the same logic as other pages
      const activeWorkspaceId = await getActiveWorkspace();
      
      if (!activeWorkspaceId) {
        console.error('Chat: No active workspace found')
        setError('No active workspace found. Please create or join a workspace first.')
        return
      }

      // Get workspace details using API
      const workspaceResponse = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!workspaceResponse.ok) {
        console.error('Chat: Error fetching workspace details:', workspaceResponse.statusText)
        setError('Failed to load workspace details.')
        return
      }

      const workspaceData = await workspaceResponse.json();
      if (!workspaceData.workspace) {
        console.error('Chat: No workspace data received')
        setError('Failed to load workspace details.')
        return
      }

      const workspaceId = workspaceData.workspace.id
      const workspaceName = workspaceData.workspace.name
      
      console.log('Chat: Using workspace:', { workspaceId, workspaceName })
      setWorkspaceId(workspaceId)
      setWorkspaceName(workspaceName)

      // Now get all team members for this workspace using API
      const membersResponse = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!membersResponse.ok) {
        console.error('Chat: Error fetching team members:', membersResponse.statusText)
        setError('Failed to load team members.')
        return
      }

      const membersData = await membersResponse.json();
      const teamMembers = membersData.members || [];

      console.log('Chat: Team members query result:', { teamMembers })

      if (teamMembers.length === 0) {
        console.error('No team members found in workspace')
        setError('No team members found in this workspace.')
        return
      }

      // Set current user (the session user)
      setCurrentUserId(user?.id || '')

      // Set other users from the same workspace (excluding current user)
      const otherUsers: WorkspaceUser[] = teamMembers
        .filter(member => member.user_id !== user?.id)
        .map((member, index) => ({
          id: member.user_id,
          name: member.name || member.email || 'Unknown User',
          avatar: null, // We don't have avatar info in team_members
          status: ['online', 'away', 'offline'][index % 3] as 'online' | 'away' | 'offline'
        }))

      setWorkspaceUsers(otherUsers)
      console.log('Chat: Initialization complete:', {
        workspaceId,
        workspaceName,
        currentUserId: user?.id,
        otherUsersCount: otherUsers.length,
        totalTeamMembers: teamMembers.length
      })
      
    } catch (error) {
      console.error('Error initializing data:', error)
      setError('Failed to initialize chat. Please try refreshing the page.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, session?.access_token])

  useEffect(() => {
    if (user && user.id) {
      initializeData()
    }
  }, [user, initializeData])

  // Note: Chat notifications are handled separately from task notifications
  // No need to auto-mark task notifications as read when visiting chat page

  // Show loading while checking authentication
  if (!user && session === null) {
    return (
      <SidebarDemo>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </SidebarDemo>
    )
  }

  // Show error state
  if (error) {
    return (
      <SidebarDemo>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">⚠️</div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => initializeData()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </SidebarDemo>
    )
  }

  const views = [
    { id: 'chat' as ViewType, label: 'Team Chat', icon: MessageSquare },
    { id: 'ai-assistant' as ViewType, label: 'AI Assistant', icon: Bot },
    { id: 'calendar' as ViewType, label: 'Calendar', icon: Calendar },
    { id: 'projects' as ViewType, label: 'Projects', icon: FolderOpen },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const renderMainContent = () => {
    if (!workspaceId || !currentUserId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading workspace...</p>
          </div>
        </div>
      )
    }

    if (selectedUser) {
      // Private chat mode
      return (
        <div className="flex-1 flex flex-col">
          {/* Private Chat Header */}
          <div className="bg-background border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {workspaceUsers.find(u => u.id === selectedUser)?.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {workspaceUsers.find(u => u.id === selectedUser)?.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">Private conversation</p>
                  </div>
              </div>
              
                              {/* Workspace Display for Private Chat */}
                <div className="bg-muted rounded-lg px-4 py-2 flex items-center">
                  <span className="text-foreground font-medium">
                    {workspaceName || 'Loading workspace...'}
                  </span>
                </div>
            </div>
          </div>
          
          {/* Private Chat Interface */}
          <ChatInterface 
            workspaceId={workspaceId} 
            currentUserId={currentUserId}
            isPrivateChat={true}
            otherUserId={selectedUser}
          />
        </div>
      )
    }

    // Regular team chat mode
    switch (activeView) {
      case 'chat':
        return (
          <div className="flex-1 flex flex-col">
            {/* Team Chat Header */}
            <div className="bg-background border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Team Chat
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Real-time team communication
                  </p>
                </div>
                
                {/* Workspace Display */}
                <div className="flex items-center space-x-3">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center">
                    <span className="text-foreground font-medium">
                      {workspaceName || 'Loading workspace...'}
                    </span>
                  </div>
                
                  {/* View Toggle Buttons */}
                  <div className="flex bg-muted rounded-lg p-1">
                    {views.map((view) => {
                      const Icon = view.icon
                      return (
                        <motion.button
                          key={view.id}
                          onClick={() => setActiveView(view.id)}
                          className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            activeView === view.id
                              ? 'text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {activeView === view.id && (
                            <motion.div
                              layoutId="activeTab"
                              className="absolute inset-0 bg-background rounded-md shadow-sm"
                              initial={false}
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                          <div className="relative flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{view.label}</span>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex min-h-0">
              <ChatInterface workspaceId={workspaceId} currentUserId={currentUserId} />
              
              {/* Right Sidebar */}
              {sidebarOpen && (
                <div className="w-80 border-l border-border bg-background flex flex-col">
                  {/* Sidebar Header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground">Workspace</h3>
                      <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium text-foreground">Team Members</h4>
                    </div>
                    {isLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading team...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {workspaceUsers.map((user) => {
                          const userUnreadCount = unreadMessages[user.id]?.length || 0;
                          return (
                            <button
                              key={user.id}
                              onClick={() => setSelectedUser(user.id)}
                              className={cn(
                                "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left",
                                userUnreadCount > 0 && "relative after:absolute after:inset-0 after:bg-red-500/10 after:rounded-lg after:border after:border-red-500/20"
                              )}
                            >
                              <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                                  {user.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(user.status)}`}></div>
                                {userUnreadCount > 0 && (
                                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                                    {userUnreadCount}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {user.name}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {user.status}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Mini Calendar */}
                  <div className="flex-1 border-b border-border overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium text-foreground">Upcoming Events</h4>
                      </div>
                    </div>
                    <div className="h-64 overflow-y-auto">
                      <CalendarSidebar workspaceId={workspaceId} currentUserId={currentUserId} />
                    </div>
                  </div>

                  {/* Mini Projects */}
                  <div className="flex-1 overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium text-foreground">Active Projects</h4>
                      </div>
                    </div>
                    <div className="h-64 overflow-y-auto">
                      <ProjectSidebar workspaceId={workspaceId} currentUserId={currentUserId} />
                    </div>
                  </div>
                </div>
              )}

              {/* Show sidebar toggle when closed */}
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="fixed top-4 right-4 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-10"
                >
                  <Users className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )
      case 'calendar':
        return (
          <div className="flex-1 flex flex-col">
            <div className="bg-background border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Calendar</h2>
              <p className="text-sm text-muted-foreground">Schedule and manage events</p>
            </div>
            <CalendarSidebar workspaceId={workspaceId} currentUserId={currentUserId} isMainView={true} />
          </div>
        )
      case 'projects':
        return (
          <div className="flex-1 flex flex-col">
            <div className="bg-background border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Projects</h2>
              <p className="text-sm text-muted-foreground">Track project progress</p>
            </div>
            <ProjectSidebar workspaceId={workspaceId} currentUserId={currentUserId} isMainView={true} />
          </div>
        )
      case 'ai-assistant':
        return (
          <div className="flex-1 flex flex-col">
            <div className="bg-background border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-500" />
                    AI Assistant
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Intelligent automation with Claude reasoning
                  </p>
                </div>
                
                {/* Workspace Display */}
                <div className="flex items-center space-x-3">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center">
                    <span className="text-foreground font-medium">
                      {workspaceName || 'Loading workspace...'}
                    </span>
                  </div>
                
                  {/* View Toggle Buttons */}
                  <div className="flex bg-muted rounded-lg p-1">
                    {views.map((view) => {
                      const Icon = view.icon
                      return (
                        <motion.button
                          key={view.id}
                          onClick={() => setActiveView(view.id)}
                          className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            activeView === view.id
                              ? 'text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {activeView === view.id && (
                            <motion.div
                              layoutId="activeTab"
                              className="absolute inset-0 bg-background rounded-md shadow-sm"
                              initial={false}
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                          <div className="relative flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{view.label}</span>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            <ChatWindow fullPage={true} />
          </div>
        )
      default:
        return <ChatInterface workspaceId={workspaceId} currentUserId={currentUserId} />
    }
  }

  return (
    <SidebarDemo>
      <div className="flex-1 flex flex-col h-full min-h-0">
        {renderMainContent()}
      </div>
    </SidebarDemo>
  )
} 