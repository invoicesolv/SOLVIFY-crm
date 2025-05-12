"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { SidebarDemo } from "@/components/ui/code.demo"
import { supabase } from '@/lib/supabase'
import { BarChart, Users, Mail, ArrowUpRight, ArrowDownRight, Activity, UserPlus } from 'lucide-react'

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
  company: string
  created_at: string
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return

    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      router.push('/')
      return
    }

    fetchAdminData()
  }, [session, status])

  const fetchAdminData = async () => {
    try {
      // Get total signups
      const { count: totalSignups } = await supabase
        .from('user_preferences')
        .select('*', { count: 'exact' })

      // Get recent signups (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { count: recentSignups } = await supabase
        .from('user_preferences')
        .select('*', { count: 'exact' })
        .gte('created_at', sevenDaysAgo.toISOString())

      // Get welcome emails count
      const { count: welcomeEmailsSent } = await supabase
        .from('user_preferences')
        .select('*', { count: 'exact' })
        .eq('has_seen_welcome', true)

      // Get API calls (from a new tracking table we'll create)
      const { count: apiCalls } = await supabase
        .from('api_tracking')
        .select('*', { count: 'exact' })

      // Get registration button clicks
      const { count: registrationClicks } = await supabase
        .from('event_tracking')
        .select('*', { count: 'exact' })
        .eq('event_type', 'registration_click')

      // Calculate conversion rate
      const conversionRate = (registrationClicks ?? 0) > 0 
        ? ((totalSignups ?? 0) / (registrationClicks ?? 0)) * 100 
        : 0

      setStats({
        totalSignups: totalSignups ?? 0,
        recentSignups: recentSignups ?? 0,
        welcomeEmailsSent: welcomeEmailsSent ?? 0,
        apiCalls: apiCalls ?? 0,
        registrationClicks: registrationClicks ?? 0,
        signupConversionRate: Math.round(conversionRate * 100) / 100
      })

      // Get recent events
      const { data: events } = await supabase
        .from('event_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (events) {
        setRecentEvents(events)
      }

      // Get recent users
      const { data: users } = await supabase
        .from('user_preferences')
        .select('user_id, name, email, company, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (users) {
        setRecentUsers(users.map((user: {
          user_id: string;
          name: string;
          email: string;
          company?: string;
          created_at: string;
        }) => ({
          id: user.user_id,
          name: user.name,
          email: user.email,
          company: user.company,
          created_at: user.created_at
        })))
      }

      setLoading(false)
    } catch (error) {
      console.error('Error fetching admin data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SidebarDemo>
        <div className="flex items-center justify-center h-screen bg-neutral-950">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </SidebarDemo>
    )
  }

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <span className="text-sm text-neutral-400">Last updated: {new Date().toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-neutral-900 border-neutral-800 p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-neutral-400">Total Signups</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stats.totalSignups}</h3>
                <div className="flex items-center mt-2 text-green-500 text-sm">
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  <span>+{stats.recentSignups} this week</span>
                </div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="bg-neutral-900 border-neutral-800 p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-neutral-400">Welcome Emails</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stats.welcomeEmailsSent}</h3>
                <div className="flex items-center mt-2 text-blue-500 text-sm">
                  <Mail className="h-4 w-4 mr-1" />
                  <span>{((stats.welcomeEmailsSent / stats.totalSignups) * 100).toFixed(1)}% sent</span>
                </div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Mail className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="bg-neutral-900 border-neutral-800 p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-neutral-400">API Calls</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stats.apiCalls}</h3>
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

          <Card className="bg-neutral-900 border-neutral-800 p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-neutral-400">Registration Clicks</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stats.registrationClicks}</h3>
                <div className="flex items-center mt-2 text-emerald-500 text-sm">
                  <BarChart className="h-4 w-4 mr-1" />
                  <span>{stats.signupConversionRate}% conversion</span>
                </div>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <BarChart className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Users Section */}
        <Card className="bg-neutral-900 border-neutral-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Users</h2>
            <div className="p-2 bg-green-500/10 rounded-full">
              <UserPlus className="h-5 w-5 text-green-500" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Company</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                    <td className="py-3 px-4 text-sm text-white">{user.name}</td>
                    <td className="py-3 px-4 text-sm text-white">{user.email}</td>
                    <td className="py-3 px-4 text-sm text-white">{user.company || '-'}</td>
                    <td className="py-3 px-4 text-sm text-neutral-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {recentUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-neutral-400">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="bg-neutral-900 border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Events</h2>
          <div className="space-y-4">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-start space-x-4 p-3 rounded-lg bg-neutral-800/50">
                <div className="p-2 bg-blue-500/10 rounded-full">
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{event.event_type}</p>
                  <p className="text-xs text-neutral-400">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.details && (
                    <pre className="mt-2 text-xs text-neutral-400 overflow-x-auto">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </SidebarDemo>
  )
} 