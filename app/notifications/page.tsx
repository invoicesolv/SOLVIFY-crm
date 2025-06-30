"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, User, CheckCircle, AlertCircle, TrendingUp, BarChart3, PieChart, Download, Filter, Activity, Users, Target, Percent } from 'lucide-react';
import { useAuth } from '@/lib/auth-client';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { SidebarDemo } from '@/components/ui/code.demo';
import { supabaseClient as supabase } from '@/lib/supabase-client';

interface ProjectStats {
  project_id: string;
  project_name: string;
  total_notifications: number;
  task_assignments: number;
  completed_tasks: number;
  pending_tasks: number;
  team_members: number;
  completion_rate: number;
  recent_activity: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  user_id: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  assigned_to: string | null;
  workspace_id: string;
}

function NotificationsAnalyticsContent() {
  const { user } = useAuth();
  const { notifications: allNotifications, isLoading: notificationsLoading } = useNotifications();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*');
      if (error) throw error;
      if (data) setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects.');
    }
  }, [user]);

  const fetchTeamMembers = useCallback(async () => {
    if (!user) return;
    try {
      const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('user_id', user.id).single();
      if (profile?.workspace_id) {
        const { data, error } = await supabase
          .from('team_members')
          .select('id, user_id, profiles ( id, full_name, email )')
          .eq('workspace_id', profile.workspace_id);
        
        if (error) throw error;
        
        if (data) {
          const members = data.map((tm: any) => ({
            id: tm.id,
            user_id: tm.user_id,
            name: tm.profiles.full_name,
            email: tm.profiles.email,
          }));
          setTeamMembers(members);
        }
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
      setError('Failed to fetch team members.');
    }
  }, [user]);
  
  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([
        fetchProjects(),
        fetchTeamMembers()
      ]).finally(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    // Filter notifications based on date range and project
    let filtered = allNotifications;
    
    // Apply date filter
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate;
      switch (dateRange) {
        case '1d':
          startDate = subDays(now, 1);
          break;
        case '7d':
          startDate = subDays(now, 7);
          break;
        case '30d':
          startDate = subDays(now, 30);
          break;
        case 'week':
          startDate = startOfWeek(now);
          break;
        case 'month':
          startDate = startOfMonth(now);
          break;
        default:
          startDate = subDays(now, 7);
      }
      
      filtered = filtered.filter((n: Notification) => 
        new Date(n.created_at) >= startDate
      );
    }
    
    // Apply project filter
    if (selectedProject !== 'all') {
      filtered = filtered.filter((n: Notification) => 
        n.project_id === selectedProject
      );
    }
    
    setFilteredNotifications(filtered);
  }, [allNotifications, dateRange, selectedProject]);

  useEffect(() => {
    if (projects.length > 0) {
      calculateProjectStats();
    }
  }, [filteredNotifications, projects, teamMembers]);

  const calculateProjectStats = () => {
    const projectStatsMap = new Map<string, ProjectStats>();
    
    // Initialize stats for each project
    projects.forEach(project => {
      projectStatsMap.set(project.id, {
        project_id: project.id,
        project_name: project.name,
        total_notifications: 0,
        task_assignments: 0,
        completed_tasks: 0,
        pending_tasks: 0,
        team_members: teamMembers.length,
        completion_rate: 0,
        recent_activity: 0
      });
    });

    // Calculate stats from notifications
    filteredNotifications.forEach(notification => {
      if (notification.project_id) {
        const stats = projectStatsMap.get(notification.project_id);
        if (stats) {
          stats.total_notifications++;
          
          if (notification.type === 'task_assignment') {
            stats.task_assignments++;
          }
          
          // Count recent activity (last 7 days)
          if (new Date(notification.created_at) > subDays(new Date(), 7)) {
            stats.recent_activity++;
          }
          
          projectStatsMap.set(notification.project_id, stats);
        }
      }
    });

    // Calculate completion rates (mock data for now)
    projectStatsMap.forEach((stats, projectId) => {
      stats.completed_tasks = Math.floor(stats.task_assignments * 0.7); // 70% completion rate
      stats.pending_tasks = stats.task_assignments - stats.completed_tasks;
      stats.completion_rate = stats.task_assignments > 0 
        ? Math.round((stats.completed_tasks / stats.task_assignments) * 100) 
        : 0;
    });

    setProjectStats(Array.from(projectStatsMap.values()));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <User className="h-4 w-4" />;
      case 'project':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'project':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  // Calculate summary stats
  const totalNotifications = filteredNotifications.length;
  const unreadNotifications = filteredNotifications.filter(n => !n.read_at).length;
  const taskAssignments = filteredNotifications.filter(n => n.type === 'task_assignment').length;
  const projectUpdates = filteredNotifications.filter(n => n.type === 'project_update').length;
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status !== 'completed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => {
              setLoading(true);
              setError(null);
              Promise.all([
                fetchProjects(),
                fetchTeamMembers()
              ]).finally(() => setLoading(false));
            }} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive activity and performance insights across your projects
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Advanced Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNotifications}</div>
            <p className="text-xs text-muted-foreground">
              {unreadNotifications} unread notifications
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Assignments</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskAssignments}</div>
            <p className="text-xs text-muted-foreground">
              Across {totalProjects} projects
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              {totalProjects - activeProjects} completed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
            <p className="text-xs text-muted-foreground">
              Active team members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="team">Team Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>Breakdown of notification types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Task Assignments</span>
                    </div>
                    <span className="text-sm font-medium">{taskAssignments}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Project Updates</span>
                    </div>
                    <span className="text-sm font-medium">{projectUpdates}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Other</span>
                    </div>
                    <span className="text-sm font-medium">{totalNotifications - taskAssignments - projectUpdates}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity Trend</CardTitle>
                <CardDescription>Activity over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Chart visualization would appear here
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Performance</CardTitle>
              <CardDescription>Detailed analytics for each project</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>Task Assignments</TableHead>
                    <TableHead>Completion Rate</TableHead>
                    <TableHead>Recent Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map(project => {
                    const stats = projectStats.find(s => s.project_id === project.id) || {
                      total_notifications: 0,
                      task_assignments: 0,
                      completion_rate: 0,
                      recent_activity: 0
                    };
                    
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(project.status)}>
                            {project.status || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>{stats.total_notifications}</TableCell>
                        <TableCell>{stats.task_assignments}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ width: `${stats.completion_rate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm">{stats.completion_rate}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{stats.recent_activity}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
              <CardDescription>Latest activity across all projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No notifications found for the selected filters</p>
                  </div>
                ) : (
                  filteredNotifications.slice(0, 20).map(notification => (
                    <div key={notification.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                      <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium truncate">{notification.title}</h4>
                          <div className="flex items-center space-x-2">
                            {!notification.read_at && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(notification.created_at), 'MMM d, HH:mm')}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {notification.type}
                          </Badge>
                          {notification.project_id && (
                            <Badge variant="outline" className="text-xs">
                              Project
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Active team members and their activity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Recent Notifications</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map(member => {
                    const memberNotifications = filteredNotifications.filter(n => n.user_id === member.user_id).length;
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{memberNotifications}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NotificationsAnalytics() {
  return (
    <SidebarDemo>
      <NotificationsAnalyticsContent />
    </SidebarDemo>
  );
}