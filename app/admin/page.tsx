"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { SidebarDemo } from "@/components/ui/code.demo"
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { 
  BarChart, Users, Mail, ArrowUpRight, Activity, UserPlus, 
  Shield, Trash2, Ban, AlertTriangle, Search, Lock, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Your email for admin access
const ADMIN_EMAIL = "kevin@solvify.se"

interface AdminStats {
  totalSignups: number
  recentSignups: number
  welcomeEmailsSent: number
  apiCalls: number
  registrationClicks: number
  signupConversionRate: number
}

interface TimelineEvent {
  id: string
  event_type: string
  created_at: string
  details: any
}

interface UserData {
  id: string
  name: string
  email: string
  company: string | null
  role: string | null
  created_at: string
  updated_at: string
  last_active?: string
  status: string  // For UI representation of user status
  selected?: boolean // For bulk operations
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats>({
    totalSignups: 0,
    recentSignups: 0,
    welcomeEmailsSent: 0,
    apiCalls: 0,
    registrationClicks: 0,
    signupConversionRate: 0
  })
  const [recentEvents, setRecentEvents] = useState<TimelineEvent[]>([])
  const [recentUsers, setRecentUsers] = useState<UserData[]>([])
  const [allUsers, setAllUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [confirmActionUser, setConfirmActionUser] = useState<UserData | null>(null)
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'ban' | 'unban' | 'delete' | null>(null)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ title: string; description: string; isError?: boolean } | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedBulkAction, setSelectedBulkAction] = useState<'delete' | 'suspend' | 'ban' | null>(null)
  const [isConfirmBulkDialogOpen, setIsConfirmBulkDialogOpen] = useState(false)

  useEffect(() => {
    if (status === "loading") return

    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      router.push('/')
      return
    }

    fetchAdminData()
  }, [session, status])

  useEffect(() => {
    // Apply filters when search query or status filter changes
    if (allUsers.length > 0) {
      let filtered = [...allUsers]
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(user => 
          user.name?.toLowerCase().includes(query) || 
          user.email?.toLowerCase().includes(query) ||
          user.company?.toLowerCase().includes(query)
        )
      }
      
      // Apply status filter
      if (userStatusFilter !== 'all') {
        if (userStatusFilter === 'active') {
          filtered = filtered.filter(user => user.status === 'Active')
        } else if (userStatusFilter === 'suspended') {
          filtered = filtered.filter(user => user.status === 'Suspended')
        } else if (userStatusFilter === 'banned') {
          filtered = filtered.filter(user => user.status === 'Banned')
        }
      }
      
      setFilteredUsers(filtered)
    }
  }, [searchQuery, userStatusFilter, allUsers])

  useEffect(() => {
    // Reset selected users when filtered users change
    setSelectedUsers([])
  }, [filteredUsers])

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      
      // Get total signups - use admin client to bypass RLS
      const { count: totalSignups, error: totalSignupsError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' })
      
      if (totalSignupsError) throw new Error(`Failed to fetch total signups: ${totalSignupsError.message}`)

      // Get recent signups (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { count: recentSignups, error: recentSignupsError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' })
        .gte('created_at', sevenDaysAgo.toISOString())

      if (recentSignupsError) throw new Error(`Failed to fetch recent signups: ${recentSignupsError.message}`)

      // Get welcome emails count - safely handle if it fails
      let welcomeEmailsSent = 0
      try {
        // No direct way to track welcome emails, set to 0 or use a different metric
        welcomeEmailsSent = 0
      } catch (e) {
        console.warn('Unable to fetch welcome email data', e)
      }

      // Get API calls - safely handle if the table doesn't exist
      let apiCalls = 0
      try {
        const { count: callCount, error: apiCountError } = await supabase
        .from('api_tracking')
        .select('*', { count: 'exact' })

        if (!apiCountError) {
          apiCalls = callCount || 0
        }
      } catch (e) {
        console.warn('Unable to fetch API call data', e)
      }

      // Get registration button clicks - safely handle if the table doesn't exist
      let registrationClicks = 0
      let eventTrackingExists = false
      try {
        const { count: clickCount, error: clickCountError } = await supabase
        .from('event_tracking')
        .select('*', { count: 'exact' })
        .eq('event_type', 'registration_click')
        
        if (!clickCountError) {
          registrationClicks = clickCount || 0
          eventTrackingExists = true
        }
      } catch (e) {
        console.warn('Unable to fetch registration click data', e)
      }

      // Calculate conversion rate
      const conversionRate = (registrationClicks ?? 0) > 0 
        ? ((totalSignups ?? 0) / (registrationClicks ?? 0)) * 100 
        : 0

      setStats({
        totalSignups: totalSignups ?? 0,
        recentSignups: recentSignups ?? 0,
        welcomeEmailsSent,
        apiCalls,
        registrationClicks,
        signupConversionRate: Math.round(conversionRate * 100) / 100
      })

      // Get recent events if table exists
      if (eventTrackingExists) {
        try {
          const { data: events, error: eventsError } = await supabase
        .from('event_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

          if (!eventsError && events) {
        setRecentEvents(events)
      }
        } catch (e) {
          console.warn('Unable to fetch event data', e)
        }
      }

      // Get recent users - fetch using admin client to bypass RLS
      const { data: recentProfilesData, error: recentProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, email, name, company, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentProfilesError) {
        throw new Error(`Failed to fetch recent users: ${recentProfilesError.message}`)
      }

      // Map the data directly without joining with user_preferences
      if (recentProfilesData) {
        const recentUsers = recentProfilesData.map(profile => ({
          id: profile.id,
          name: profile.name || 'Unknown',
          email: profile.email || '',
          company: profile.company || 'N/A',
          created_at: profile.created_at
        }))

        setRecentUsers(recentUsers)
      }

      // Get all users with extended information - use admin client to bypass RLS
      const { data: allProfilesData, error: allProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, name, email, company, role, created_at, updated_at')
        .order('created_at', { ascending: false })
      
      if (allProfilesError) {
        throw new Error(`Error fetching profiles: ${allProfilesError.message}`)
      }

      // Map profiles directly to user objects
      const formattedUsers = allProfilesData?.map(profile => ({
        id: profile.id,
        email: profile.email || '',
        name: profile.name || 'Unknown',
        company: profile.company || 'N/A',
        role: profile.role || 'User',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        last_active: profile.updated_at || null,
        status: 'Active' // Default status since we don't have suspended/banned fields
      })) || []
      
      setAllUsers(formattedUsers)
      setFilteredUsers(formattedUsers)
      
      // Show success message when data is fetched
      setActionMessage({
        title: "Data Refreshed",
        description: `Successfully loaded real-time data: ${totalSignups} total users, ${recentSignups} new this week.`,
        isError: false
      })

      setLoading(false)
    } catch (error) {
      console.error('Error fetching admin data:', error)
      setActionMessage({
        title: "Data Fetch Failed",
        description: error instanceof Error ? error.message : "Failed to fetch admin data",
        isError: true
      })
      setLoading(false)
    }
  }

  const confirmAction = (user: UserData, action: 'suspend' | 'unsuspend' | 'ban' | 'unban' | 'delete') => {
    setConfirmActionUser(user)
    setActionType(action)
    setIsConfirmDialogOpen(true)
  }

  const executeUserAction = async () => {
    if (!confirmActionUser || !actionType) return
    
    setIsProcessing(true)
    
    try {
      switch (actionType) {
        case 'suspend':
        case 'unsuspend':
        case 'ban':
        case 'unban':
          // Since the columns don't exist in DB, update local state only with status changes
          const updatedUsers = allUsers.map(u => {
            if (u.id === confirmActionUser.id) {
              // Set new status based on action
              if (actionType === 'suspend') u.status = 'Suspended'
              else if (actionType === 'unsuspend') u.status = 'Active'
              else if (actionType === 'ban') u.status = 'Banned'
              else if (actionType === 'unban') u.status = 'Active'
            }
            return u
          })
          
          setAllUsers(updatedUsers)
          setFilteredUsers(updatedUsers.filter(u => 
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            u.email.toLowerCase().includes(searchQuery.toLowerCase())
          ))
          
          setActionMessage({
            title: actionType === 'suspend' ? "User Suspended" : 
                  actionType === 'unsuspend' ? "User Unsuspended" :
                  actionType === 'ban' ? "User Banned" : "User Unbanned",
            description: `Action recorded for ${confirmActionUser.name}. Note: This is currently a UI-only change.`
          })
          break
          
        case 'delete':
          // Step 1: Get the user_id from the profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', confirmActionUser.id)
            .single();
            
          if (profileError) {
            throw new Error(`Failed to find user profile: ${profileError.message}`);
          }
          
          // Step 2: Attempt to delete from auth.users table using admin client
          // Only proceed if user_id was found in the profile
          if (profileData?.user_id) {
            const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
              profileData.user_id
            );
            
            // If the error is "User not found", log it but don't throw, allow profile deletion.
            // Supabase error for user not found might have a specific code or message pattern.
            // For now, checking message content. This might need refinement if Supabase has a specific error code.
            if (deleteAuthError && !deleteAuthError.message.includes("User not found")) {
              throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
            } else if (deleteAuthError && deleteAuthError.message.includes("User not found")) {
              console.warn(`Auth user with ID ${profileData.user_id} not found in auth.users. Proceeding to delete profile.`);
              setActionMessage({
                title: "Auth User Not Found",
                description: `User ${confirmActionUser.name} was not found in the authentication system, but their profile will be removed.`, 
                isError: false // This is more of a notice in this context
              });
            }
          } else {
            // If there's no user_id in the profile, we can't delete from auth.users.
            // This indicates an orphaned profile from the start.
            console.warn(`No user_id found in profile for ${confirmActionUser.email}. Only deleting from profiles table.`);
            setActionMessage({
              title: "Orphaned Profile",
              description: `User ${confirmActionUser.name} has no linked authentication record. Removing profile only.`, 
              isError: false
            });
          }
          
          // Step 3: Delete from profiles table (always attempt this)
          const { error: deleteProfileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', confirmActionUser.id);
            
          if (deleteProfileError) {
            throw new Error(`Failed to delete profile: ${deleteProfileError.message}`);
          }
          
          // Update success message based on whether auth user was deleted or just profile
          if (profileData?.user_id && (!actionMessage || actionMessage.title !== "Auth User Not Found")) {
            setActionMessage({
              title: "User Deleted",
              description: `${confirmActionUser.name} and all associated data have been permanently deleted.`
            });
          } else if (!profileData?.user_id) {
             // Message for orphaned profile already set
          } else {
            // Message for auth user not found already set, but profile was deleted
            setActionMessage({
              title: "Profile Deleted",
              description: `Profile for ${confirmActionUser.name} removed. Auth user was not found.`
            });
          }
          
          await fetchAdminData(); // Refresh data from server
          break
      }
    } catch (error) {
      console.error(`Error executing ${actionType} action:`, error)
      setActionMessage({
        title: "Action Failed",
        description: `Failed to ${actionType} user. Please try again. Details: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      })
    } finally {
      setIsProcessing(false)
      setIsConfirmDialogOpen(false)
      setConfirmActionUser(null)
      setActionType(null)
      // Do not clear actionMessage here if it was set to "Auth User Not Found" or "Orphaned Profile" 
      // as it provides context on the partial success.
      // It will be cleared by the user dismissing it or by a new action.
    }
  }

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id))
    }
  }

  const executeBulkAction = async () => {
    if (!selectedBulkAction || selectedUsers.length === 0) return
    
    setIsProcessing(true)
    
    try {
      if (selectedBulkAction === 'delete') {
        let successCount = 0
        let failCount = 0
        
        // Process in batches of 5 to avoid overloading the server
        for (let i = 0; i < selectedUsers.length; i += 5) {
          const batch = selectedUsers.slice(i, i + 5)
          
          // Process each user in the batch concurrently
          const results = await Promise.allSettled(
            batch.map(async (userId) => {
              try {
                // Step 1: Get the user_id from the profile
                const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('user_id')
                  .eq('id', userId)
                  .single();
                  
                if (profileError) {
                  throw new Error(`Failed to find profile: ${profileError.message}`);
                }
                
                if (!profileData?.user_id) {
                  throw new Error('User ID not found in profile');
                }
                
                // Step 2: Delete from profiles table
                const { error: deleteProfileError } = await supabase
                  .from('profiles')
                  .delete()
                  .eq('id', userId);
                  
                if (deleteProfileError) {
                  throw new Error(`Failed to delete profile: ${deleteProfileError.message}`);
                }
                
                // Step 3: Delete from auth.users table using admin client
                const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
                  profileData.user_id
                );
                
                if (deleteAuthError) {
                  throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
                }
                
                return 'success';
              } catch (error) {
                console.error('Error deleting user:', error);
                throw error;
              }
            })
          );
          
          // Count successes and failures
          results.forEach(result => {
            if (result.status === 'fulfilled') {
              successCount++;
            } else {
              failCount++;
            }
          });
        }

        if (successCount > 0) {
          setActionMessage({
            title: "Bulk Delete Completed",
            description: `Successfully deleted ${successCount} users${failCount > 0 ? `, failed to delete ${failCount} users` : ''}.`,
            isError: failCount > 0
          });
        } else {
          setActionMessage({
            title: "Bulk Delete Failed",
            description: "Failed to delete selected users.",
            isError: true
          });
        }
        
        // Refresh the user list to reflect changes
        await fetchAdminData();
      } else if (selectedBulkAction === 'suspend' || selectedBulkAction === 'ban') {
        // Update local state for suspension/ban (since we don't have actual DB columns for these)
        const updatedUsers = allUsers.map(u => {
          if (selectedUsers.includes(u.id)) {
            u.status = selectedBulkAction === 'suspend' ? 'Suspended' : 'Banned';
          }
          return u;
        });
        
        setAllUsers(updatedUsers);
        setFilteredUsers(
          updatedUsers.filter(u => {
            const matchesSearch = 
              u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              u.email.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesFilter = 
              userStatusFilter === 'all' || 
              (userStatusFilter === 'active' && u.status === 'Active') ||
              (userStatusFilter === 'suspended' && u.status === 'Suspended') ||
              (userStatusFilter === 'banned' && u.status === 'Banned');
            
            return matchesSearch && matchesFilter;
          })
        );
        
        setActionMessage({
          title: `Users ${selectedBulkAction === 'suspend' ? 'Suspended' : 'Banned'}`,
          description: `${selectedUsers.length} users have been ${selectedBulkAction === 'suspend' ? 'suspended' : 'banned'}.`,
          isError: false
        });
      }
    } catch (error) {
      console.error(`Error executing bulk ${selectedBulkAction}:`, error);
      setActionMessage({
        title: "Bulk Action Failed",
        description: `Failed to ${selectedBulkAction} selected users.`,
        isError: true
      });
    } finally {
      setIsProcessing(false);
      setIsConfirmBulkDialogOpen(false);
      setSelectedBulkAction(null);
      setSelectedUsers([]);
    }
  }

  if (loading) {
    return (
      <SidebarDemo>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </SidebarDemo>
    )
  }

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={fetchAdminData}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Data</span>
            </Button>
          <span className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-background border-border text-foreground">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-background border-border p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Total Signups</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{stats.totalSignups}</h3>
                <div className="flex items-center mt-2 text-green-600 dark:text-green-400 text-sm">
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  <span>+{stats.recentSignups} this week</span>
                </div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="bg-background border-border p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Welcome Emails</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{stats.welcomeEmailsSent}</h3>
                <div className="flex items-center mt-2 text-blue-600 dark:text-blue-400 text-sm">
                  <Mail className="h-4 w-4 mr-1" />
                  <span>{((stats.welcomeEmailsSent / stats.totalSignups) * 100).toFixed(1)}% sent</span>
                </div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Mail className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="bg-background border-border p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">API Calls</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{stats.apiCalls}</h3>
                <div className="flex items-center mt-2 text-cyan-500 text-sm">
                  <Activity className="h-4 w-4 mr-1" />
                  <span>Total requests</span>
                </div>
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-lg">
                <Activity className="h-6 w-6 text-cyan-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Users Section */}
        <Card className="bg-background border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Users</h2>
            <div className="p-2 bg-green-500/10 rounded-full">
              <UserPlus className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Company</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border hover:bg-background/50">
                        <td className="py-3 px-4 text-foreground">{user.name || 'Unknown'}</td>
                        <td className="py-3 px-4 text-foreground">{user.email}</td>
                        <td className="py-3 px-4 text-muted-foreground">{user.company || 'N/A'}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6 mt-6">
        <Card className="bg-background border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-foreground">User Management</h2>
                <div className="flex space-x-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search users..." 
                      className="pl-9 bg-background border-border dark:border-border text-foreground"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                  <Select 
                    value={userStatusFilter} 
                    onValueChange={setUserStatusFilter}
                  >
                    <SelectTrigger className="w-[180px] bg-background border-border dark:border-border text-foreground">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="banned">Banned</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 border-0"
                    onClick={fetchAdminData}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              {/* Bulk Actions */}
              {selectedUsers.length > 0 && (
                <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-blue-400 mr-2" />
                    <span className="text-foreground">{selectedUsers.length} users selected</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Select
                      value={selectedBulkAction || ''}
                      onValueChange={(value) => setSelectedBulkAction(value as any || null)}
                    >
                      <SelectTrigger className="w-[180px] bg-background border-border dark:border-border text-foreground">
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border dark:border-border text-foreground">
                        <SelectItem value="suspend">Suspend Users</SelectItem>
                        <SelectItem value="ban">Ban Users</SelectItem>
                        <SelectItem value="delete">Delete Users</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      className="border-red-600 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/20"
                      onClick={() => {
                        if (selectedBulkAction) {
                          setIsConfirmBulkDialogOpen(true);
                        } else {
                          setActionMessage({
                            title: "No Action Selected",
                            description: "Please select an action to perform on the selected users.",
                            isError: true
                          });
                        }
                      }}
                      disabled={!selectedBulkAction}
                    >
                      Execute Action
                    </Button>
                    
                    <Button
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedUsers([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="w-[50px]">
                        <Checkbox 
                          checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                          onCheckedChange={toggleSelectAll}
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </TableHead>
                      <TableHead className="text-left text-sm font-medium text-muted-foreground">Name</TableHead>
                      <TableHead className="text-left text-sm font-medium text-muted-foreground">Email</TableHead>
                      <TableHead className="text-left text-sm font-medium text-muted-foreground">Joined</TableHead>
                      <TableHead className="text-left text-sm font-medium text-muted-foreground">Status</TableHead>
                      <TableHead className="text-left text-sm font-medium text-muted-foreground">Last Active</TableHead>
                      <TableHead className="text-right text-sm font-medium text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-b border-border hover:bg-background/50">
                        <TableCell>
                          <Checkbox 
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={() => toggleSelectUser(user.id)}
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center">
                              <span className="font-medium text-foreground">{user.name}</span>
                              {user.status === 'Suspended' && (
                                <Badge className="ml-2 bg-yellow-600 text-foreground">Suspended</Badge>
                              )}
                              {user.status === 'Banned' && (
                                <Badge className="ml-2 bg-red-600 text-foreground">Banned</Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground text-sm">{user.company || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {user.status === 'Banned' ? (
                            <Badge variant="destructive" className="bg-red-900 hover:bg-red-800 text-foreground">Banned</Badge>
                          ) : user.status === 'Suspended' ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">Suspended</Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.last_active 
                            ? new Date(user.last_active).toLocaleDateString() 
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {user.status === 'Suspended' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-green-600 text-green-600 dark:text-green-400 hover:bg-green-100 dark:bg-green-900/20"
                                onClick={() => confirmAction(user, 'unsuspend')}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Unsuspend
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-yellow-600 text-yellow-500 hover:bg-yellow-100 dark:bg-yellow-900/20"
                                onClick={() => confirmAction(user, 'suspend')}
                              >
                                <Lock className="h-3 w-3 mr-1" />
                                Suspend
                              </Button>
                            )}

                            {user.status === 'Banned' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-green-600 text-green-600 dark:text-green-400 hover:bg-green-100 dark:bg-green-900/20"
                                onClick={() => confirmAction(user, 'unban')}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Unban
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-red-600 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/20"
                                onClick={() => confirmAction(user, 'ban')}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Ban
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-red-600 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/20"
                              onClick={() => confirmAction(user, 'delete')}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
          </div>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              Confirm {actionType} User
            </DialogTitle>
            <DialogDescription>
              {actionType === 'delete' ? (
                <span className="text-red-400">This action will permanently delete all data associated with this user and cannot be undone.</span>
              ) : actionType === 'ban' ? (
                <span className="text-yellow-400">This will prevent the user from accessing the platform entirely.</span>
              ) : actionType === 'suspend' ? (
                <span className="text-yellow-400">This will temporarily disable the user's access to the platform.</span>
              ) : actionType === 'unsuspend' || actionType === 'unban' ? (
                <span className="text-muted-foreground">This will restore the user's access to the platform.</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="mb-2">Are you sure you want to {actionType} this user?</p>
            <div className="bg-background p-3 rounded-md">
              <p><span className="text-muted-foreground">Name:</span> {confirmActionUser?.name}</p>
              <p><span className="text-muted-foreground">Email:</span> {confirmActionUser?.email}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-border dark:border-border text-foreground"
              onClick={() => setIsConfirmDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'delete' ? 'outline' : 'default'}
              className={actionType === 'delete' ? 'border-red-600 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/20' : 'bg-yellow-600 hover:bg-yellow-700 text-foreground'}
              onClick={executeUserAction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === 'delete' ? 'Delete User' : 
                   actionType === 'ban' ? 'Ban User' : 
                   actionType === 'suspend' ? 'Suspend User' : 
                   actionType === 'unsuspend' ? 'Unsuspend User' : 
                   actionType === 'unban' ? 'Unban User' : 'Confirm'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isConfirmBulkDialogOpen} onOpenChange={setIsConfirmBulkDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              Confirm Bulk {selectedBulkAction} Action
            </DialogTitle>
            <DialogDescription>
              {selectedBulkAction === 'delete' ? (
                <span className="text-red-400">This action will permanently delete {selectedUsers.length} users and all their data. This cannot be undone.</span>
              ) : selectedBulkAction === 'ban' ? (
                <span className="text-yellow-400">This will prevent {selectedUsers.length} users from accessing the platform entirely.</span>
              ) : selectedBulkAction === 'suspend' ? (
                <span className="text-yellow-400">This will temporarily disable access for {selectedUsers.length} users to the platform.</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="mb-2">You are about to {selectedBulkAction} the following users:</p>
            <div className="bg-background p-3 rounded-md max-h-40 overflow-y-auto">
              {filteredUsers
                .filter(user => selectedUsers.includes(user.id))
                .map(user => (
                  <div key={user.id} className="py-1 border-b border-border dark:border-border last:border-0">
                    <p><span className="text-muted-foreground">Name:</span> {user.name}</p>
                    <p><span className="text-muted-foreground">Email:</span> {user.email}</p>
                  </div>
                ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-border dark:border-border text-foreground"
              onClick={() => setIsConfirmBulkDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={selectedBulkAction === 'delete' ? 'outline' : 'default'}
              className={selectedBulkAction === 'delete' ? 'border-red-600 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/20' : 'bg-yellow-600 hover:bg-yellow-700 text-foreground'}
              onClick={executeBulkAction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {selectedBulkAction === 'delete' ? `Delete ${selectedUsers.length} Users` : 
                   selectedBulkAction === 'ban' ? `Ban ${selectedUsers.length} Users` : 
                   selectedBulkAction === 'suspend' ? `Suspend ${selectedUsers.length} Users` : 'Confirm'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Show action message */}
      {actionMessage && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg ${actionMessage.isError ? 'bg-red-900' : 'bg-green-900'}`}>
          <h3 className="font-medium text-foreground">{actionMessage.title}</h3>
          <p className="text-sm text-foreground/80">{actionMessage.description}</p>
          <button 
            className="absolute top-2 right-2 text-foreground/60 hover:text-foreground"
            onClick={() => setActionMessage(null)}
          >
            &times;
          </button>
        </div>
      )}
    </SidebarDemo>
  )
} 