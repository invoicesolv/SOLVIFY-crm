import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { BarChart, Users, DollarSign, ArrowUpRight, ArrowDownRight, Calendar, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from 'next-auth/react'
import { TodaysAgenda } from "@/components/projects/TodaysAgenda";
import { useSearchParams } from "next/navigation";

interface Invoice {
  document_number: string
  invoice_date: string
  total: number
  balance: number
  due_date: string
  customers: {
    name: string
  }
  currencies: {
    code: string
  }
}

interface Task {
  id: string
  title: string
  deadline: string
  project_id: string
  progress: number
}

interface Meeting {
  id: string
  title: string
  start_time: string
  end_time: string
  description: string
}

interface DashboardStats {
  totalRevenue: number
  invoiceCount: number
  averageInvoiceValue: number
  revenueGrowth: number
}

export function Dashboard() {
  const { data: session } = useSession()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    invoiceCount: 0,
    averageInvoiceValue: 0,
    revenueGrowth: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams();
  const view = searchParams.get('view');

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        // Fetch invoices with user_id filter
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            customers (
              name
            ),
            currencies (
              code
            )
          `)
          .eq('user_id', session.user.id);

        if (invoicesError && invoicesError.code !== 'PGRST116') {
          console.error('Failed to fetch invoices:', invoicesError);
          setError('Failed to fetch invoices');
        }
        
        // Transform the data to match our interface
        const transformedInvoices = invoicesData?.map(invoice => ({
          document_number: invoice.document_number,
          invoice_date: invoice.invoice_date,
          total: invoice.total,
          balance: invoice.balance,
          due_date: invoice.due_date,
          customers: {
            name: invoice.customers?.name || 'Unknown Customer'
          },
          currencies: {
            code: invoice.currencies?.code || 'SEK'
          }
        })) || []

        if (transformedInvoices && transformedInvoices.length > 0) {
          setInvoices(transformedInvoices)
          calculateStats(transformedInvoices)
        } else {
          // Set default stats for new users
          setStats({
            totalRevenue: 0,
            invoiceCount: 0,
            averageInvoiceValue: 0,
            revenueGrowth: 0
          })
        }

        // Fetch tasks with user_id filter
        const { data: tasksData, error: tasksError } = await supabase
          .from('project_tasks')
          .select(`
            id,
            title,
            deadline,
            project_id,
            progress,
            projects (
              name
            )
          `)
          .eq('user_id', session.user.id)
          .order('deadline', { ascending: true });

        if (tasksError && tasksError.code !== 'PGRST116') {
          console.error('Error fetching tasks:', tasksError)
        }

        if (tasksData) {
          setTasks(tasksData)
        }

        const today = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(today.getDate() + 30)

        // Fetch calendar events from the calendar API
        try {
          const response = await fetch('/api/calendar');
          if (!response.ok) {
            console.error('Error fetching calendar events:', response.statusText);
          } else {
            const data = await response.json();
            if (data.items) {
              // Transform calendar events to match our Meeting interface
              const transformedMeetings = data.items
                .filter((event: any) => {
                  const eventDate = new Date(event.start?.dateTime || event.start?.date);
                  return eventDate >= today && eventDate <= thirtyDaysFromNow;
                })
                .map((event: any) => ({
                  id: event.id,
                  title: event.summary,
                  start_time: event.start.dateTime || event.start.date,
                  end_time: event.end.dateTime || event.end.date,
                  description: event.description || ''
                }))
                .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .slice(0, 5);

              setMeetings(transformedMeetings);
            }
          }
        } catch (error) {
          console.error('Error fetching calendar events:', error);
        }

      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session?.user?.id])

  const calculateStats = (invoices: Invoice[]) => {
    console.log('Calculating stats from invoices:', invoices)
    
    const total = invoices.reduce((sum, inv) => {
      console.log('Processing invoice:', inv)
      const amount = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total
      return sum + (amount || 0)
    }, 0)
    
    const count = invoices.length
    const average = count > 0 ? total / count : 0

    // Calculate growth by comparing last month to previous month
    const now = new Date()
    const lastMonthInvoices = invoices.filter(inv => {
      const date = new Date(inv.invoice_date)
      return date.getMonth() === now.getMonth() - 1
    })
    const previousMonthInvoices = invoices.filter(inv => {
      const date = new Date(inv.invoice_date)
      return date.getMonth() === now.getMonth() - 2
    })

    const lastMonthTotal = lastMonthInvoices.reduce((sum, inv) => {
      const amount = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total
      return sum + (amount || 0)
    }, 0)
    
    const previousMonthTotal = previousMonthInvoices.reduce((sum, inv) => {
      const amount = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total
      return sum + (amount || 0)
    }, 0)

    const growth = previousMonthTotal > 0 
      ? ((lastMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 
      : 0

    console.log('Calculated stats:', {
      totalRevenue: total,
      invoiceCount: count,
      averageInvoiceValue: average,
      revenueGrowth: growth
    })

    setStats({
      totalRevenue: total,
      invoiceCount: count,
      averageInvoiceValue: average,
      revenueGrowth: growth
    })
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    const name = session?.user?.name || 'there' // Use session user's name or fallback to 'there'
    
    if (hour < 12) return `Good morning, ${name}`
    if (hour < 17) return `Good afternoon, ${name}`
    return `Good evening, ${name}`
  }

  const getUpcomingDeadlines = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return tasks
      .filter(task => {
        const deadline = new Date(task.deadline)
        deadline.setHours(0, 0, 0, 0)
        return deadline >= today && task.progress < 100
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5)
  }

  const getUrgentTasks = () => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    return tasks
      .filter(task => {
        const deadline = new Date(task.deadline)
        return deadline <= today && task.progress < 100
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  }

  if (view === 'agenda') {
    return <TodaysAgenda />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      <Card className="p-6 bg-neutral-800 border-neutral-700 shadow-lg">
        <h2 className="text-2xl font-bold text-white">{getGreeting()}</h2>
        <p className="text-neutral-400 mt-2">Here's what's happening today</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Total Revenue</p>
              <h3 className="text-2xl font-bold mt-2 text-white">
                {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                  .format(stats.totalRevenue)}
              </h3>
              <div className="mt-4 flex items-center gap-2">
                <div className={`flex items-center gap-1 ${stats.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats.revenueGrowth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>{Math.abs(stats.revenueGrowth).toFixed(1)}%</span>
                </div>
                <p className="text-sm text-neutral-400">vs last month</p>
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-full">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Total Invoices</p>
              <h3 className="text-2xl font-bold mt-2 text-white">{stats.invoiceCount}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-full">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Average Invoice</p>
              <h3 className="text-2xl font-bold mt-2 text-white">
                {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                  .format(stats.averageInvoiceValue)}
              </h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-full">
              <BarChart className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
            </div>
            <div className="mt-6">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-sm font-medium text-neutral-400 pb-4">Customer</th>
                    <th className="text-left text-sm font-medium text-neutral-400 pb-4">Date</th>
                    <th className="text-right text-sm font-medium text-neutral-400 pb-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {invoices.slice(0, 5).map((invoice) => (
                    <tr key={invoice.document_number}>
                      <td className="py-4 text-sm text-white">{invoice.customers?.name}</td>
                      <td className="py-4 text-sm text-neutral-400">
                        {new Date(invoice.invoice_date).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="py-4 text-sm text-right font-medium text-white">
                        {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.currencies?.code || 'SEK' })
                          .format(invoice.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white">Invoice Types</h3>
            <div className="mt-6 space-y-4">
              {Object.entries(
                invoices.reduce((acc, inv) => {
                  const type = inv.balance === 0 ? 'Paid' : inv.balance === inv.total ? 'Unpaid' : 'Partial'
                  acc[type] = (acc[type] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">{type}</span>
                  <span className="text-sm font-medium text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Upcoming Events</h3>
              <Calendar className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-4">
              {meetings.map(meeting => (
                <div key={meeting.id} className="flex items-start space-x-4">
                  <div className="p-2 bg-blue-500/10 rounded-full">
                    <Clock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{meeting.title}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(meeting.start_time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {meetings.length === 0 && (
                <p className="text-sm text-neutral-400">No upcoming events</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Upcoming Deadlines</h3>
              <Clock className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-4">
              {getUpcomingDeadlines().map(task => (
                <div key={task.id} className="flex items-start space-x-4">
                  <div className="p-2 bg-yellow-500/10 rounded-full">
                    <Clock className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    <p className="text-xs text-neutral-400">Due {new Date(task.deadline).toLocaleDateString('sv-SE')}</p>
                  </div>
                </div>
              ))}
              {getUpcomingDeadlines().length === 0 && (
                <p className="text-sm text-neutral-400">No upcoming deadlines</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Urgent Tasks</h3>
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="space-y-4">
              {getUrgentTasks().map(task => (
                <div key={task.id} className="flex items-start space-x-4">
                  <div className="p-2 bg-red-500/10 rounded-full">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    <p className="text-xs text-neutral-400">Due today</p>
                  </div>
                </div>
              ))}
              {getUrgentTasks().length === 0 && (
                <p className="text-sm text-neutral-400">No urgent tasks</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
} 