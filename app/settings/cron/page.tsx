"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import {
  Plus, 
  Play, 
  Pause, 
  Save, 
  Eye, 
  Settings,
  Zap,
  Mail,
  Clock,
  Users,
  Filter,
  MousePointer,
  GitBranch,
  Target,
  Timer,
  Bell,
  Share,
  BarChart3,
  Edit3,
  Trash2,
  Copy,
  ArrowRight,
  Workflow,
  CheckCircle,
  Calendar,
  ArrowLeft,
  Search,
  FolderOpen,
  FileText,
  MessageSquare,
  Share2,
  RefreshCw,
  Upload,
  X,
  Check,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Database,
  Mic,
  Video,
  Code,
  Webhook,
  FolderPlus,
  Folder,
  Merge,
  Music,
  Calculator,
  List,
  Archive,
  FileSearch,
  Shuffle,
  Package,
  Send,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedBorderCard } from '@/components/ui/animated-border-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { SidebarDemo } from "@/components/ui/code.demo";
import { cn } from '@/lib/utils';
import { CustomerEmailManager } from '@/components/projects/CustomerEmailManager';

// Analytics Property Selector Component
function AnalyticsPropertySelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [properties, setProperties] = useState<Array<{ id: string; displayName: string; accountName?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/ga4/properties');
        if (!response.ok) {
          throw new Error('Failed to fetch Analytics properties');
        }
        const data = await response.json();
        setProperties(data.properties || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load properties');
        console.error('Error fetching Analytics properties:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-2 border rounded-md">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading properties...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 border rounded-md bg-red-50 text-red-600 text-sm">
        Error: {error}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select Analytics Property" />
      </SelectTrigger>
      <SelectContent>
        {properties.length === 0 ? (
          <SelectItem value="no_properties" disabled>No properties found</SelectItem>
        ) : (
          properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              {property.displayName} ({property.id})
              {property.accountName && (
                <span className="text-xs text-muted-foreground ml-2">
                  - {property.accountName}
                </span>
              )}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// Search Console Site Selector Component
function SearchConsoleSiteSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [sites, setSites] = useState<Array<{ url: string; permissionLevel: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSites = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/search-console/sites');
        if (!response.ok) {
          throw new Error('Failed to fetch Search Console sites');
        }
        const data = await response.json();
        setSites(data.sites || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sites');
        console.error('Error fetching Search Console sites:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-2 border rounded-md">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading sites...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 border rounded-md bg-red-50 text-red-600 text-sm">
        Error: {error}
      </div>
    );
  }

  return (
    <Select value={value || "none"} onValueChange={(val) => onChange(val === "none" ? "" : val)}>
      <SelectTrigger>
        <SelectValue placeholder="Select Search Console Site (Optional)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None (Analytics only)</SelectItem>
        {sites.length === 0 ? (
          <SelectItem value="no_sites" disabled>No sites found</SelectItem>
        ) : (
          sites.map((site) => (
            <SelectItem key={site.url} value={site.url}>
              {site.url}
              <span className="text-xs text-muted-foreground ml-2">
                ({site.permissionLevel})
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  trigger_type: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  created_at: string;
  cron_job?: CronJob;
  stats: {
    triggered: number;
    completed: number;
    active_contacts: number;
  };
}

interface CronJob {
  id: string;
  user_id: string;
  job_type: string;
  status: 'active' | 'disabled' | 'pending';
  execution_status: 'success' | 'error' | 'pending';
  next_run: string;
  last_run?: string;
  property_id?: string;
  site_url?: string;
  settings: {
    frequency: string;
    send_day: string;
    send_time: string;
    recipients: string[];
    automation_config?: any;
    workflow_data?: AutomationWorkflow;
  };
  error_message?: string;
  updated_at: string;
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay' | 'code' | 'split' | 'aggregate' | 'script_generator' | 'voice_generation' | 'video_renderer';
  subtype: string;
  position: { x: number; y: number };
  data: any;
  title: string;
  description: string;
}

interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
  condition?: string;
}

const AUTOMATION_TYPES = [
  { 
    value: 'analytics_report', 
    label: 'Analytics Report', 
    icon: BarChart3, 
    description: 'Automated Google Analytics reports',
    color: 'from-blue-500 to-cyan-500',
    category: 'Reports'
  },
  { 
    value: 'search_console_report', 
    label: 'Search Console Report', 
    icon: Search, 
    description: 'Google Search Console performance reports',
    color: 'from-green-500 to-emerald-500',
    category: 'Reports'
  },
  { 
    value: 'project_report', 
    label: 'Project Report', 
    icon: FolderOpen, 
    description: 'Project progress and task reports',
    color: 'from-purple-500 to-violet-500',
    category: 'Reports'
  },
  { 
    value: 'email_campaign', 
    label: 'Email Campaign', 
    icon: Mail, 
    description: 'Automated email marketing campaigns',
    color: 'from-pink-500 to-rose-500',
    category: 'Marketing'
  },
  { 
    value: 'invoice_creation', 
    label: 'Invoice Creation', 
    icon: FileText, 
    description: 'Automated invoice generation',
    color: 'from-orange-500 to-amber-500',
    category: 'Finance'
  },
  { 
    value: 'calendar_event', 
    label: 'Calendar Event', 
    icon: Calendar, 
    description: 'Scheduled calendar events and reminders',
    color: 'from-indigo-500 to-blue-500',
    category: 'Productivity'
  },
  { 
    value: 'chat_message', 
    label: 'Chat Message', 
    icon: MessageSquare, 
    description: 'Automated chat notifications',
    color: 'from-teal-500 to-cyan-500',
    category: 'Communication'
  },
  { 
    value: 'social_media_post', 
    label: 'Social Media Post', 
    icon: Share2, 
    description: 'Scheduled social media content',
    color: 'from-violet-500 to-purple-500',
    category: 'Marketing'
  },
  { 
    value: 'project_creation', 
    label: 'Project Creation', 
    icon: Plus, 
    description: 'Automated project setup',
    color: 'from-emerald-500 to-green-500',
    category: 'Productivity'
  },
  { 
    value: 'data_sync', 
    label: 'Data Sync', 
    icon: RefreshCw, 
    description: 'Automated data synchronization',
    color: 'from-slate-500 to-gray-500',
    category: 'Integration'
  },
  { 
    value: 'memory_storage', 
    label: 'Memory Storage', 
    icon: Database, 
    description: 'Store and retrieve automation memory',
    color: 'from-amber-500 to-orange-500',
    category: 'Storage'
  },
  { 
    value: 'google_drive', 
    label: 'Google Drive', 
    icon: FolderOpen, 
    description: 'Create folders, share files, and manage Google Drive storage',
    color: 'from-blue-500 to-indigo-500',
    category: 'Storage'
  },
  { 
    value: 'webhook_action', 
    label: 'Send Webhook', 
    icon: Zap, 
    description: 'Send HTTP webhook to external services',
    color: 'from-purple-500 to-pink-500',
    category: 'Integration'
  },

  { 
    value: 'ai_task', 
    label: 'AI Task', 
    icon: Zap, 
    description: 'AI-powered automated tasks',
    color: 'from-purple-500 to-pink-500',
    category: 'AI'
  },
  { 
    value: 'ai_reasoning', 
    label: 'AI Reasoning', 
    icon: Target, 
    description: 'AI analysis and decision making',
    color: 'from-indigo-500 to-purple-500',
    category: 'AI'
  },
  { 
    value: 'chatbot_integration', 
    label: 'Chatbot Integration', 
    icon: MessageSquare, 
    description: 'Connect AI chatbot to automation workflows',
    color: 'from-blue-500 to-cyan-500',
    category: 'AI'
  },
  { 
    value: 'smart_calendar', 
    label: 'Smart Calendar', 
    icon: Calendar, 
    description: 'AI-powered calendar event creation and management',
    color: 'from-green-500 to-emerald-500',
    category: 'AI'
  },
  { 
    value: 'project_ai_assistant', 
    label: 'Project AI Assistant', 
    icon: FolderOpen, 
    description: 'AI assistant for project management and analysis',
    color: 'from-orange-500 to-amber-500',
    category: 'AI'
  },
  { 
    value: 'blog_post', 
    label: 'Blog Post', 
    icon: Edit3, 
    description: 'Automated blog post creation and publishing',
    color: 'from-emerald-500 to-teal-500',
    category: 'Marketing'
  },
  { 
    value: 'code', 
    label: 'Code', 
    icon: Code, 
    description: 'Execute custom JavaScript code to transform data',
    color: 'from-pink-500 to-rose-500',
    category: 'Integration'
  },
  { 
    value: 'split_out', 
    label: 'Split Out', 
    icon: GitBranch, 
    description: 'Split workflow into multiple parallel paths',
    color: 'from-orange-500 to-red-500',
    category: 'Flow Control'
  },
  { 
    value: 'aggregate', 
    label: 'Aggregate', 
    icon: Target, 
    description: 'Merge multiple paths back together',
    color: 'from-teal-500 to-cyan-500',
    category: 'Flow Control'
  },
  { 
    value: 'script_generator', 
    label: 'Script Generator', 
    icon: FileText, 
    description: 'Generate scripts for video content',
    color: 'from-yellow-500 to-orange-500',
    category: 'Content'
  },
  { 
    value: 'voice_generation', 
    label: 'Voice Generation', 
    icon: Mic, 
    description: 'Generate AI voice narration',
    color: 'from-purple-500 to-pink-500',
    category: 'Content'
  },
  { 
    value: 'video_renderer', 
    label: 'Video Renderer', 
    icon: Video, 
    description: 'Render final video content',
    color: 'from-red-500 to-pink-500',
    category: 'Content'
  },
  // Additional workflow nodes from the image
  { 
    value: 'webhook', 
    label: 'Webhook', 
    icon: Webhook, 
    description: 'Send HTTP requests to external services',
    color: 'from-gray-500 to-slate-500',
    category: 'Integration'
  },
  { 
    value: 'create_render_folder', 
    label: 'Create Render Folder', 
    icon: FolderPlus, 
    description: 'Create folder for render output',
    color: 'from-yellow-500 to-orange-500',
    category: 'Storage'
  },
  { 
    value: 'render_folder', 
    label: 'Render Folder', 
    icon: Folder, 
    description: 'Manage render output folder',
    color: 'from-amber-500 to-yellow-500',
    category: 'Storage'
  },
  { 
    value: 'switch', 
    label: 'Switch', 
    icon: GitBranch, 
    description: 'Route workflow based on conditions',
    color: 'from-indigo-500 to-purple-500',
    category: 'Flow Control'
  },
  { 
    value: 'merge', 
    label: 'Merge', 
    icon: Merge, 
    description: 'Merge multiple workflow paths',
    color: 'from-teal-500 to-green-500',
    category: 'Flow Control'
  },
  { 
    value: 'list_audio_files', 
    label: 'List Audio Files', 
    icon: Music, 
    description: 'List audio files from directory',
    color: 'from-purple-500 to-pink-500',
    category: 'Storage'
  },
  { 
    value: 'get_file_size', 
    label: 'Get File Size', 
    icon: FileText, 
    description: 'Get size information of files',
    color: 'from-blue-500 to-cyan-500',
    category: 'Storage'
  },
  { 
    value: 'aggregate_duration', 
    label: 'Aggregate Duration', 
    icon: Clock, 
    description: 'Calculate total duration of media files',
    color: 'from-orange-500 to-red-500',
    category: 'Content'
  },
  { 
    value: 'compute_duration', 
    label: 'Compute Duration', 
    icon: Calculator, 
    description: 'Compute total duration',
    color: 'from-green-500 to-teal-500',
    category: 'Content'
  },
  { 
    value: 'get_clips_folder', 
    label: 'Get Clips Folder', 
    icon: FolderOpen, 
    description: 'Access clips folder location',
    color: 'from-violet-500 to-purple-500',
    category: 'Storage'
  },
  { 
    value: 'list_clips_file', 
    label: 'List Clips File', 
    icon: List, 
    description: 'List all clips files',
    color: 'from-cyan-500 to-blue-500',
    category: 'Storage'
  },
  { 
    value: 'get_assets_folder', 
    label: 'Get Assets Folder', 
    icon: Archive, 
    description: 'Access assets folder location',
    color: 'from-emerald-500 to-green-500',
    category: 'Storage'
  },
  { 
    value: 'get_assets_file_data', 
    label: 'Get Assets File Data', 
    icon: FileSearch, 
    description: 'Retrieve assets file data',
    color: 'from-rose-500 to-pink-500',
    category: 'Storage'
  },
  { 
    value: 'select_random_object', 
    label: 'Select Random Object', 
    icon: Shuffle, 
    description: 'Select random object from collection',
    color: 'from-lime-500 to-green-500',
    category: 'Flow Control'
  },
  { 
    value: 'create_render_object', 
    label: 'Create Render Object', 
    icon: Package, 
    description: 'Create render object configuration',
    color: 'from-sky-500 to-blue-500',
    category: 'Content'
  },
  { 
    value: 'send_render_request', 
    label: 'Send Render Request', 
    icon: Send, 
    description: 'Send request to render service',
    color: 'from-fuchsia-500 to-pink-500',
    category: 'Content'
  },
  { 
    value: 'check_status', 
    label: 'Check Status', 
    icon: CheckCircle, 
    description: 'Check processing status',
    color: 'from-green-500 to-emerald-500',
    category: 'Flow Control'
  },
  { 
    value: 'download_video', 
    label: 'Download Video', 
    icon: Download, 
    description: 'Download rendered video file',
    color: 'from-blue-500 to-indigo-500',
    category: 'Storage'
  },
  { 
    value: 'upload_video', 
    label: 'Upload Video', 
    icon: Upload, 
    description: 'Upload video to storage',
    color: 'from-purple-500 to-violet-500',
    category: 'Storage'
  },
  { 
    value: 'clean_up_audio_clips', 
    label: 'Clean Up Audio Clips', 
    icon: Trash2, 
    description: 'Clean up temporary audio files',
    color: 'from-red-500 to-rose-500',
    category: 'Storage'
  },
  { 
    value: 'trigger_render', 
    label: 'Trigger Render', 
    icon: Play, 
    description: 'Trigger rendering process',
    color: 'from-orange-500 to-amber-500',
    category: 'Content'
  },
  { 
    value: 'ai_agent', 
    label: 'AI Agent', 
    icon: Target, 
    description: 'AI-powered intelligent agent for complex tasks',
    color: 'from-purple-500 to-indigo-500',
    category: 'AI'
  }
];

const TRIGGER_TYPES = [
  { value: 'schedule', label: 'Schedule', icon: Clock, description: 'Time-based triggers' },
  { value: 'event', label: 'Event', icon: Zap, description: 'Event-based triggers' },
  { value: 'condition', label: 'Condition', icon: Filter, description: 'Condition-based triggers' },
  { value: 'chat_message', label: 'Chat Message', icon: MessageSquare, description: 'Triggered by incoming chat messages' }
];

const EVENT_TRIGGER_OPTIONS = [
  { value: 'social_media_mention', label: 'Social Media Mention', icon: Share2, description: 'When mentioned on social media' },
  { value: 'calendar_event', label: 'Calendar Event', icon: Calendar, description: 'Before/after calendar events' },
  { value: 'email_received', label: 'Email Received', icon: Mail, description: 'When specific email is received' },
  { value: 'chat_message_received', label: 'Chat Message Received', icon: MessageSquare, description: 'When chat message is received' },
  { value: 'form_submission', label: 'Form Submission', icon: FileText, description: 'When form is submitted' },
  { value: 'api_webhook', label: 'API Webhook', icon: Zap, description: 'External API trigger' },
  { value: 'file_upload', label: 'File Upload', icon: Upload, description: 'When file is uploaded' },
  { value: 'database_change', label: 'Database Change', icon: RefreshCw, description: 'When database records change' },
  { value: 'time_condition', label: 'Time Condition', icon: Clock, description: 'When specific time conditions are met' },
  { value: 'project_completion', label: 'Project Completed', icon: CheckCircle, description: 'When a project reaches 100% completion' },
  { value: 'project_milestone', label: 'Project Milestone', icon: Target, description: 'When project reaches 25%, 50%, 75% progress' },
  { value: 'project_status_change', label: 'Project Status Change', icon: GitBranch, description: 'When project status changes (active, completed, on-hold)' },
  { value: 'project_trigger_automation', label: 'Project Trigger Automation', icon: Target, description: 'Automated customer notifications for project events' }
];

const SOCIAL_MEDIA_PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'twitter', label: 'Twitter/X', icon: Twitter },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'threads', label: 'Threads', icon: Share2 },
  { value: 'tiktok', label: 'TikTok', icon: Share2 }
];

const AI_REASONING_MODELS = [
  // Anthropic Claude Models (Latest 2025) - Prioritized for Reasoning
      { value: 'claude-opus-4-20250514', label: '🚀 Claude Opus 4 (Anthropic)', description: 'Next-generation reasoning and analysis' },
    { value: 'claude-sonnet-4-20250514', label: '🚀 Claude Sonnet 4 (Anthropic)', description: 'Next-generation reasoning and analysis' },
          { value: 'claude-3-7-sonnet-20250219', label: '🧠 Claude 3.7 Sonnet (Anthropic)', description: 'Advanced reasoning with enhanced capabilities' },
  { value: 'claude-3-5-sonnet-20241022', label: '💎 Claude 3.5 Sonnet (Anthropic)', description: 'Superior reasoning & analysis capabilities' },
  { value: 'claude-3-5-haiku-20241022', label: '⚡ Claude 3.5 Haiku (Anthropic)', description: 'Fast reasoning with excellent quality' },
  { value: 'claude-3-opus-20240229', label: '🎯 Claude 3 Opus (Anthropic)', description: 'Most capable Claude 3 model for complex reasoning' },
  { value: 'claude-3-sonnet-20240229', label: '⚖️ Claude 3 Sonnet (Anthropic)', description: 'Balanced reasoning model' },
  { value: 'claude-3-haiku-20240307', label: '🚀 Claude 3 Haiku (Anthropic)', description: 'Fastest Claude model' },
  
  // OpenAI Models (Latest 2024-2025)
  { value: 'o1', label: 'GPT-o1 (OpenAI)', description: 'Latest reasoning model with chain-of-thought' },
  { value: 'o1-mini', label: 'GPT-o1-mini (OpenAI)', description: 'Faster reasoning model' },
  { value: 'o3-mini', label: 'GPT-o3-mini (OpenAI)', description: 'Next-gen reasoning model' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'Advanced multimodal reasoning' },
  { value: 'gpt-4o-mini', label: 'GPT-4o-mini (OpenAI)', description: 'Efficient reasoning model' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (OpenAI)', description: 'Enhanced GPT-4 with reasoning' },
  
  // xAI Grok Models (Latest 2024-2025)
  { value: 'grok-3', label: 'Grok 3 (xAI)', description: 'Latest reasoning model with Think mode' },
  { value: 'grok-3-mini', label: 'Grok 3 Mini (xAI)', description: 'Efficient Grok model' },
  { value: 'grok-3-reasoning', label: 'Grok 3 Reasoning (xAI)', description: 'Specialized reasoning variant' },
  { value: 'grok-2', label: 'Grok 2 (xAI)', description: 'Previous generation Grok' },
  
  // Google Gemini Models (Latest 2024-2025)
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Google)', description: 'Latest Gemini reasoning model' },
  { value: 'gemini-pro', label: 'Gemini Pro (Google)', description: 'Google\'s reasoning model' },
  { value: 'gemini-flash', label: 'Gemini Flash (Google)', description: 'Fast Gemini model' },
  
  // Ollama Models (Local Reasoning Models)
  { value: 'deepseek-r1:671b', label: 'DeepSeek-R1 671B (Ollama)', description: 'Full DeepSeek reasoning model' },
  { value: 'deepseek-r1:70b', label: 'DeepSeek-R1 70B (Ollama)', description: 'Large DeepSeek reasoning model' },
  { value: 'deepseek-r1:32b', label: 'DeepSeek-R1 32B (Ollama)', description: 'Medium DeepSeek reasoning model' },
  { value: 'deepseek-r1:14b', label: 'DeepSeek-R1 14B (Ollama)', description: 'Compact DeepSeek reasoning model' },
  { value: 'deepseek-r1:8b', label: 'DeepSeek-R1 8B (Ollama)', description: 'Efficient DeepSeek reasoning model' },
  { value: 'deepseek-r1:7b', label: 'DeepSeek-R1 7B (Ollama)', description: 'Small DeepSeek reasoning model' },
  { value: 'deepseek-r1:1.5b', label: 'DeepSeek-R1 1.5B (Ollama)', description: 'Tiny DeepSeek reasoning model' },
  { value: 'qwq:32b', label: 'QwQ 32B (Ollama)', description: 'Qwen reasoning model' },
  { value: 'llama3.3:70b', label: 'Llama 3.3 70B (Ollama)', description: 'Meta\'s latest reasoning model' },
  { value: 'llama3.2:90b', label: 'Llama 3.2 90B Vision (Ollama)', description: 'Multimodal reasoning model' },
  { value: 'phi4:14b', label: 'Phi-4 14B (Ollama)', description: 'Microsoft\'s reasoning model' },
  { value: 'phi4-mini:3.8b', label: 'Phi-4 Mini 3.8B (Ollama)', description: 'Compact Microsoft reasoning model' },
  { value: 'gemma3:27b', label: 'Gemma 3 27B (Ollama)', description: 'Google\'s open reasoning model' },
  { value: 'qwen3:32b', label: 'Qwen 3 32B (Ollama)', description: 'Alibaba\'s latest reasoning model' },
  { value: 'mistral:7b', label: 'Mistral 7B (Ollama)', description: 'Mistral AI reasoning model' },
  { value: 'codellama:70b', label: 'Code Llama 70B (Ollama)', description: 'Code-focused reasoning model' }
];

const AI_CODING_MODELS = [
  // Specialized Coding Models
  { value: 'deepseek-coder-v2:236b', label: 'DeepSeek Coder V2 236B (Ollama)', description: 'Best coding model, GPT-4 level' },
  { value: 'deepseek-coder:33b', label: 'DeepSeek Coder 33B (Ollama)', description: 'Large coding model' },
  { value: 'codellama:70b', label: 'Code Llama 70B (Ollama)', description: 'Meta\'s largest coding model' },
  { value: 'codellama:34b', label: 'Code Llama 34B (Ollama)', description: 'Balanced coding model' },
  { value: 'codellama:13b', label: 'Code Llama 13B (Ollama)', description: 'Efficient coding model' },
  { value: 'codegemma:7b', label: 'CodeGemma 7B (Ollama)', description: 'Google\'s coding model' },
  { value: 'starcoder2:15b', label: 'StarCoder2 15B (Ollama)', description: 'Advanced code generation' },
  { value: 'starcoder2:7b', label: 'StarCoder2 7B (Ollama)', description: 'Efficient code generation' },
  { value: 'wizardcoder:33b', label: 'WizardCoder 33B (Ollama)', description: 'Instruction-tuned coding model' },
  { value: 'phind-codellama:34b', label: 'Phind CodeLlama 34B (Ollama)', description: 'Fine-tuned for coding tasks' }
];

const AI_VISION_MODELS = [
  // Vision-Language Models
  { value: 'llama3.2-vision:90b', label: 'Llama 3.2 Vision 90B (Ollama)', description: 'Large multimodal model' },
  { value: 'llama3.2-vision:11b', label: 'Llama 3.2 Vision 11B (Ollama)', description: 'Efficient multimodal model' },
  { value: 'llava:34b', label: 'LLaVA 34B (Ollama)', description: 'Large vision-language model' },
  { value: 'llava:13b', label: 'LLaVA 13B (Ollama)', description: 'Balanced vision-language model' },
  { value: 'llava:7b', label: 'LLaVA 7B (Ollama)', description: 'Efficient vision-language model' },
  { value: 'bakllava:7b', label: 'BakLLaVA 7B (Ollama)', description: 'Mistral-based vision model' },
  { value: 'moondream:1.8b', label: 'Moondream 1.8B (Ollama)', description: 'Tiny vision model for edge devices' },
  { value: 'minicpm-v:8b', label: 'MiniCPM-V 8B (Ollama)', description: 'Efficient multimodal model' }
];

const AI_PERMISSIONS = [
  { value: 'read_data', label: 'Read Data', description: 'Access customer and analytics data' },
  { value: 'send_emails', label: 'Send Emails', description: 'Send automated emails' },
  { value: 'create_content', label: 'Create Content', description: 'Generate social media posts and content' },
  { value: 'schedule_events', label: 'Schedule Events', description: 'Create calendar events and meetings' },
  { value: 'manage_projects', label: 'Manage Projects', description: 'Create and update projects' },
  { value: 'access_apis', label: 'Access APIs', description: 'Make external API calls' },
  { value: 'modify_settings', label: 'Modify Settings', description: 'Change automation settings' },
  { value: 'analyze_images', label: 'Analyze Images', description: 'Process and understand visual content' },
  { value: 'generate_code', label: 'Generate Code', description: 'Write and debug code automatically' },
  { value: 'reasoning_tasks', label: 'Advanced Reasoning', description: 'Perform complex logical reasoning' }
];

const CALENDAR_EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'deadline', label: 'Deadline', icon: Clock },
  { value: 'reminder', label: 'Reminder', icon: Bell },
  { value: 'appointment', label: 'Appointment', icon: Calendar },
  { value: 'task', label: 'Task', icon: CheckCircle }
];

export default function CronJobsPage() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AutomationWorkflow | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'builder'>('list');
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
  const [calendarAccounts, setCalendarAccounts] = useState<any[]>([]);
  const [invoiceData, setInvoiceData] = useState<any>({
    customers: [],
    projects: [],
    recent_invoices: [],
    recurring_invoices: [],
    stats: {}
  });

  // Drag & Drop State
  const [draggedNode, setDraggedNode] = useState<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connections, setConnections] = useState<WorkflowConnection[]>([]);
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configNode, setConfigNode] = useState<WorkflowNode | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [customerEmailManagerOpen, setCustomerEmailManagerOpen] = useState(false);
  const [editingWorkflowName, setEditingWorkflowName] = useState<string | null>(null);
  const [tempWorkflowName, setTempWorkflowName] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadCronJobs();
      loadSocialAccounts();
      loadCalendarAccounts();
      fetchProjects();
      loadInvoiceData();
    }
  }, [user?.id]);

  const loadSocialAccounts = async () => {
    try {
      console.log('🔍 Loading social accounts...');
      const response = await fetch('/api/social/accounts');
      console.log('🔍 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 API Response:', data);
        
        if (data.success) {
          console.log('🔍 Setting accounts:', data.accounts);
          setSocialAccounts(data.accounts);
        } else {
          console.log('🔍 API returned success: false');
        }
      } else {
        console.log('🔍 Response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error fetching social media accounts:', error);
    }
  };

  const loadCalendarAccounts = async () => {
    try {
      console.log('📅 Loading calendar integrations...');
      
      // Get user's workspace first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('user_id', session?.user?.id)
        .single();

      if (profileError || !profile?.workspace_id) {
        console.error('📅 Error getting workspace:', profileError);
        return;
      }

      // Get calendar integrations for the workspace
      const { data: integrations, error: integrationsError } = await supabase
        .from('integrations')
        .select('*')
        .eq('workspace_id', profile.workspace_id)
        .in('service_name', ['google-calendar', 'outlook-calendar', 'apple-calendar'])
        .order('created_at', { ascending: false });

      if (integrationsError) {
        console.error('📅 Error fetching calendar integrations:', integrationsError);
        return;
      }

      // Format calendar accounts for the dropdown
      const calendarAccounts = integrations.map(integration => {
        let accountName = integration.account_name || integration.account_email || 'Unknown Account';
        let provider = 'Unknown';
        
        switch (integration.service_name) {
          case 'google-calendar':
            provider = 'Google Calendar';
            break;
          case 'outlook-calendar':
            provider = 'Outlook Calendar';
            break;
          case 'apple-calendar':
            provider = 'Apple Calendar';
            break;
        }

        return {
          id: integration.id,
          value: integration.account_email || integration.account_name || integration.id,
          label: `${accountName} (${provider})`,
          provider: provider,
          service_name: integration.service_name,
          account_email: integration.account_email,
          account_name: integration.account_name,
          is_active: integration.is_active
        };
      });

      console.log('📅 Setting calendar accounts:', calendarAccounts);
      setCalendarAccounts(calendarAccounts);
      
    } catch (error) {
      console.error('Error fetching calendar accounts:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      console.log('🔄 Loading projects...');
      const response = await fetch('/api/projects');
      console.log('📊 Projects response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Projects data received:', data);
        
        if (data.success) {
          console.log('📊 Projects found:', data.projects?.length || 0);
          setInvoiceData(prev => ({
            ...prev,
            projects: data.projects || []
          }));
        } else {
          console.error('📊 Projects API returned success: false');
        }
      } else {
        console.error('📊 Projects API response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const loadInvoiceData = async () => {
    try {
      console.log('🔄 Loading invoice data...');
      const response = await fetch('/api/invoices/data');
      console.log('📊 Invoice data response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Invoice data received:', data);
        
        if (data.success) {
          console.log('📊 Customers found:', data.data.customers?.length || 0);
          setInvoiceData(prev => ({
            ...prev,
            customers: data.data.customers || [],
            recent_invoices: data.data.recent_invoices || [],
            recurring_invoices: data.data.recurring_invoices || [],
            stats: data.data.stats || {}
          }));
        } else {
          console.error('📊 Invoice data API returned success: false');
        }
      } else {
        console.error('📊 Invoice data API response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error fetching invoice data:', error);
    }
  };

  const loadCronJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cron_jobs')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedJobs = (data || []).map(job => ({
        ...job,
        status: job.status || 'pending',
        execution_status: job.execution_status || (job.last_run ? 'success' : 'pending')
      }));
      
      setCronJobs(formattedJobs);
      convertCronJobsToWorkflows(formattedJobs);
    } catch (error) {
      console.error('Error loading cron jobs:', error);
      toast.error('Failed to load scheduled tasks');
    } finally {
      setLoading(false);
    }
  };

  const convertCronJobsToWorkflows = (jobs: CronJob[]) => {
    console.log('🔄 Converting cron jobs to workflows:', jobs.length, 'jobs');
    
    const workflows: AutomationWorkflow[] = jobs.map((job, index) => {
      const automationType = AUTOMATION_TYPES.find(type => type.value === job.job_type);
      
      console.log(`📊 Job ${job.id}: status="${job.status}", type="${job.job_type}"`);
      
      // Check if this is a saved workflow with full data
      if (job.settings.workflow_data) {
        // Use the saved workflow data with preserved positions
        const workflowStatus = job.status === 'active' ? 'active' : job.status === 'disabled' ? 'paused' : 'draft';
        console.log(`✅ Workflow ${job.id}: cron_status="${job.status}" → workflow_status="${workflowStatus}"`);
        
        return {
          ...job.settings.workflow_data,
          status: workflowStatus, // Override with current cron job status
          cron_job: job,
          stats: {
            triggered: Math.floor(Math.random() * 100),
            completed: Math.floor(Math.random() * 90),
            active_contacts: Math.floor(Math.random() * 50)
          }
        };
      }
      
      // Fallback: Create basic workflow for legacy cron jobs
      const triggerNode: WorkflowNode = {
        id: `trigger-${job.id}`,
        type: 'trigger',
        subtype: 'schedule',
        position: { x: 100, y: 100 + (index * 150) },
        data: {
          frequency: job.settings.frequency,
          send_day: job.settings.send_day,
          send_time: job.settings.send_time
        },
        title: 'Schedule Trigger',
        description: `${job.settings.frequency} on ${job.settings.send_day} at ${job.settings.send_time}`
      };

      const actionNode: WorkflowNode = {
        id: `action-${job.id}`,
        type: 'action',
        subtype: job.job_type,
        position: { x: 400, y: 100 + (index * 150) },
        data: job.settings.automation_config || {},
        title: automationType?.label || job.job_type,
        description: automationType?.description || 'Automated action'
      };

      const connection: WorkflowConnection = {
        id: `connection-${job.id}`,
        from: triggerNode.id,
        to: actionNode.id
      };

      return {
        id: job.id,
        name: `${automationType?.label || job.job_type} Automation`,
        description: automationType?.description || 'Automated workflow',
        status: job.status === 'active' ? 'active' : job.status === 'disabled' ? 'paused' : 'draft',
        trigger_type: 'schedule',
        nodes: [triggerNode, actionNode],
        connections: [connection],
        created_at: job.updated_at,
        cron_job: job,
        stats: {
          triggered: Math.floor(Math.random() * 100),
          completed: Math.floor(Math.random() * 90),
          active_contacts: Math.floor(Math.random() * 50)
        }
      };
    });

    setWorkflows(workflows);
    console.log('✅ Workflows updated:', workflows.map(w => ({ id: w.id, name: w.name, status: w.status })));
  };

  // Test project triggers function
  const testProjectTriggers = async () => {
    try {
      console.log('[🧪 TRIGGER TEST] Starting project trigger test...');
      
      const response = await fetch('/api/test-project-triggers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType: 'all' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('[✅ TRIGGER TEST] Test completed:', result);
      
      toast.success(
        `🎉 Project Trigger Test Completed!\n\n` +
        `✅ Test Results: ${result.results?.length || 0} triggers tested\n` +
        `📊 Project: ${result.project?.name || 'Test Project'}\n` +
        `🚀 Status: ${result.project?.status || 'Unknown'}\n\n` +
        `Check your server console for detailed logs with emojis!`,
        { duration: 8000 }
      );
      
      // Show detailed results in console for debugging
      if (result.results && result.results.length > 0) {
        console.table(result.results.map((r: any) => ({
          'Trigger Type': r.type,
          'Triggered': r.result.triggered ? '✅ Yes' : '❌ No',
          'Reason': r.result.triggerReason || r.result.reason || 'N/A'
        })));
      }
      
    } catch (error) {
      console.error('[❌ TRIGGER TEST] Test failed:', error);
      toast.error(
        `❌ Project Trigger Test Failed\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Please check your server console for details.`,
        { duration: 6000 }
      );
    }
  };

  // Test chat trigger live function
  const testChatTriggerLive = async () => {
    try {
      console.log('💬 Testing chat integration live...');
      
      if (!selectedWorkflow) {
        toast.error('❌ Please select a workflow first');
        return;
      }

      // Update workflow nodes to show testing state
      const updatedWorkflow = { ...selectedWorkflow };
      const chatTriggerNode = updatedWorkflow.nodes.find(n => n.subtype === 'chat_message_received');
      const chatbotNode = updatedWorkflow.nodes.find(n => n.subtype === 'chatbot_integration');
      
      if (chatTriggerNode) {
        chatTriggerNode.data = { ...chatTriggerNode.data, testing: true, status: 'testing' };
      }
      if (chatbotNode) {
        chatbotNode.data = { ...chatbotNode.data, testing: true, status: 'testing' };
      }
      
      setSelectedWorkflow(updatedWorkflow);
      toast.info('🧪 Starting live chat test...');

      // Test the chat trigger with a sample message
      const testMessage = "Test automation: Show me my projects and calendar";
      
      const response = await fetch('/api/automation/chat-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testMessage,
          workflowId: selectedWorkflow.id,
          userId: session?.user?.id,
          context: { 
            test: true,
            platform: 'automation_test',
            trigger_type: 'live_test'
          }
        }),
      });

      const result = await response.json();
      
      // Update workflow nodes with results
      if (response.ok && result.success) {
        // Mark nodes as successful
        if (chatTriggerNode) {
          chatTriggerNode.data = { 
            ...chatTriggerNode.data, 
            testing: false, 
            status: 'success',
            lastTest: new Date().toISOString(),
            testResult: 'Chat trigger activated successfully'
          };
        }
        if (chatbotNode) {
          chatbotNode.data = { 
            ...chatbotNode.data, 
            testing: false, 
            status: 'success',
            lastTest: new Date().toISOString(),
            testResult: `AI response generated: ${result.response?.substring(0, 100)}...`
          };
        }
        
        setSelectedWorkflow(updatedWorkflow);
        toast.success(`✅ Chat integration test successful!`);
        console.log('✅ Chat test results:', result);
        
        // Show the AI response in a toast for immediate feedback
        toast.info(`🤖 AI Response: ${result.response?.substring(0, 150)}...`);
        
      } else {
        // Mark nodes as failed
        const errorMessage = result.error || 'Unknown error';
        
        if (chatTriggerNode) {
          chatTriggerNode.data = { 
            ...chatTriggerNode.data, 
            testing: false, 
            status: 'error',
            lastTest: new Date().toISOString(),
            testError: errorMessage
          };
        }
        if (chatbotNode) {
          chatbotNode.data = { 
            ...chatbotNode.data, 
            testing: false, 
            status: 'error',
            lastTest: new Date().toISOString(),
            testError: errorMessage
          };
        }
        
        setSelectedWorkflow(updatedWorkflow);
        toast.error(`❌ Chat test failed: ${errorMessage}`);
        console.error('❌ Chat test error:', result);
      }
      
    } catch (error) {
      console.error('Error testing chat integration:', error);
      
      // Mark nodes as failed due to network/system error
      if (selectedWorkflow) {
        const updatedWorkflow = { ...selectedWorkflow };
        const chatTriggerNode = updatedWorkflow.nodes.find(n => n.subtype === 'chat_message_received');
        const chatbotNode = updatedWorkflow.nodes.find(n => n.subtype === 'chatbot_integration');
        
        [chatTriggerNode, chatbotNode].forEach(node => {
          if (node) {
            node.data = { 
              ...node.data, 
              testing: false, 
              status: 'error',
              lastTest: new Date().toISOString(),
              testError: error instanceof Error ? error.message : 'Network error'
            };
          }
        });
        
        setSelectedWorkflow(updatedWorkflow);
      }
      
      toast.error('❌ Failed to test chat integration');
    }
  };

  const createNewWorkflow = () => {
    const newWorkflow: AutomationWorkflow = {
      id: crypto.randomUUID(),
      name: 'New Automation Workflow',
      description: 'Describe your automation workflow',
      status: 'draft',
      trigger_type: 'schedule',
      nodes: [],
      connections: [],
      created_at: new Date().toISOString(),
      stats: {
        triggered: 0,
        completed: 0,
        active_contacts: 0
      }
    };
    setSelectedWorkflow(newWorkflow);
    setViewMode('builder');
  };

  const editWorkflow = (workflow: AutomationWorkflow) => {
    setSelectedWorkflow(workflow);
    setConnections(workflow.connections);
    setViewMode('builder');
  };

  const toggleWorkflowStatus = async (workflowId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const cronStatus = newStatus === 'active' ? 'active' : 'disabled';
    
    console.log(`🔄 Toggling workflow ${workflowId}: ${currentStatus} → ${newStatus} (cron: ${cronStatus})`);
    
    try {
      // Update optimistically first
      setWorkflows(prev => 
        prev.map(w => 
          w.id === workflowId 
            ? { 
                ...w, 
                status: newStatus as 'active' | 'paused' | 'draft',
                cron_job: w.cron_job ? { ...w.cron_job, status: cronStatus as 'active' | 'disabled' | 'pending' } : w.cron_job
              }
            : w
        )
      );

      const { data, error } = await supabase
        .from('cron_jobs')
        .update({ status: cronStatus })
        .eq('id', workflowId)
        .select();

      if (error) throw error;

      console.log(`✅ Database updated successfully:`, data);
      toast.success(`🎉 Automation ${newStatus === 'active' ? 'activated' : 'paused'} successfully!`);
      
      // Refresh data after a short delay to ensure database consistency
      setTimeout(() => {
        loadCronJobs();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error updating workflow status:', error);
      toast.error('Failed to update automation status');
      
      // Revert optimistic update on error
      setWorkflows(prev => 
        prev.map(w => 
          w.id === workflowId 
            ? { ...w, status: currentStatus as 'active' | 'paused' | 'draft' }
            : w
        )
      );
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    try {
      const { error } = await supabase
        .from('cron_jobs')
        .delete()
        .eq('id', workflowId);

      if (error) throw error;

      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      toast.success('Automation deleted successfully');
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error('Failed to delete automation');
    }
  };

  const startRenameWorkflow = (workflow: AutomationWorkflow) => {
    setEditingWorkflowName(workflow.id);
    setTempWorkflowName(workflow.name);
  };

  const cancelRenameWorkflow = () => {
    setEditingWorkflowName(null);
    setTempWorkflowName('');
  };

  const saveWorkflowName = async (workflowId: string) => {
    if (!tempWorkflowName.trim()) {
      toast.error('Workflow name cannot be empty');
      return;
    }

    try {
      // Update the workflow data in the cron job settings
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow || !workflow.cron_job) {
        toast.error('Workflow not found');
        return;
      }

      const updatedWorkflowData = {
        ...workflow.cron_job.settings.workflow_data,
        name: tempWorkflowName.trim(),
        description: workflow.description // Keep existing description
      };

      const { error } = await supabase
        .from('cron_jobs')
        .update({ 
          settings: {
            ...workflow.cron_job.settings,
            workflow_data: updatedWorkflowData
          }
        })
        .eq('id', workflowId);

      if (error) throw error;

      // Update local state
      setWorkflows(prev => 
        prev.map(w => 
          w.id === workflowId 
            ? { ...w, name: tempWorkflowName.trim() }
            : w
        )
      );

      setEditingWorkflowName(null);
      setTempWorkflowName('');
      toast.success('Workflow renamed successfully');
    } catch (error) {
      console.error('Error renaming workflow:', error);
      toast.error('Failed to rename workflow');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'draft':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getAutomationTypeInfo = (type: string) => {
    return AUTOMATION_TYPES.find(t => t.value === type) || AUTOMATION_TYPES[0];
  };

  // Drag & Drop Functions
  const handleDragStart = (e: React.DragEvent, nodeType: any) => {
    console.log('🚀 DRAG STARTED:', nodeType.label);
    setDraggedNode(nodeType);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', JSON.stringify(nodeType));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (!draggedNode || !selectedWorkflow) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode: WorkflowNode = {
      id: `${draggedNode.value}-${Date.now()}`,
      type: draggedNode.category === 'trigger' ? 'trigger' : 'action',
      subtype: draggedNode.value,
      position: { x: Math.max(0, x - 75), y: Math.max(0, y - 40) },
      data: {},
      title: draggedNode.label,
      description: draggedNode.description
    };

    setSelectedWorkflow(prev => prev ? {
      ...prev,
      nodes: [...prev.nodes, newNode]
    } : null);

    // Auto-connect to previous node if exists
    if (selectedWorkflow.nodes.length > 0) {
      const lastNode = selectedWorkflow.nodes[selectedWorkflow.nodes.length - 1];
      const newConnection: WorkflowConnection = {
        id: `connection-${Date.now()}`,
        from: lastNode.id,
        to: newNode.id
      };
      setConnections(prev => [...prev, newConnection]);
    }

    setDraggedNode(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
  };

  const removeNode = (nodeId: string) => {
    if (!selectedWorkflow) return;
    
    setSelectedWorkflow(prev => prev ? {
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId)
    } : null);
    
    setConnections(prev => prev.filter(conn => conn.from !== nodeId && conn.to !== nodeId));
  };

  const removeConnection = (connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    if (selectedWorkflow) {
      setSelectedWorkflow(prev => prev ? {
        ...prev,
        connections: prev.connections.filter(conn => conn.id !== connectionId)
      } : null);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    
    if (connectionStart === null) {
      // Start connection from this node
      setConnectionStart(nodeId);
      setSelectedNode(nodeId);
    } else if (connectionStart === nodeId) {
      // Cancel connection if clicking same node
      setConnectionStart(null);
    } else {
      // Complete connection to this node
      const newConnection: WorkflowConnection = {
        id: `conn_${Date.now()}`,
        from: connectionStart,
        to: nodeId
      };
      
      setConnections(prev => [...prev, newConnection]);
      if (selectedWorkflow) {
        setSelectedWorkflow(prev => prev ? {
          ...prev,
          connections: [...prev.connections, newConnection]
        } : null);
      }
      
      setConnectionStart(null);
      setSelectedNode(nodeId);
    }
  };

  const renderConnections = () => {
    if (!selectedWorkflow) return null;

    return connections.map(connection => {
      const fromNode = selectedWorkflow.nodes.find(n => n.id === connection.from);
      const toNode = selectedWorkflow.nodes.find(n => n.id === connection.to);
      
      if (!fromNode || !toNode) return null;

      const fromX = fromNode.position.x + 75;
      const fromY = fromNode.position.y + 40;
      const toX = toNode.position.x + 75;
      const toY = toNode.position.y + 40;

      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;

      const path = `M ${fromX} ${fromY} Q ${midX} ${fromY} ${midX} ${midY} Q ${midX} ${toY} ${toX} ${toY}`;

      return (
        <g key={connection.id}>
          <path
            d={path}
            stroke="rgb(99 102 241)"
            strokeWidth="2"
            fill="none"
            className="drop-shadow-sm cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              removeConnection(connection.id);
            }}
          />
          <polygon
            points={`${toX-8},${toY-4} ${toX},${toY} ${toX-8},${toY+4}`}
            fill="rgb(99 102 241)"
          />
        </g>
      );
    });
  };

  const getNodeIcon = (type: string, subtype: string) => {
    if (type === 'trigger') {
      if (subtype === 'chat_message') {
        return <MessageSquare className="h-4 w-4" />;
      }
      return <Clock className="h-4 w-4" />;
    }
    
    const automationType = AUTOMATION_TYPES.find(t => t.value === subtype);
    if (automationType) {
      const IconComponent = automationType.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    
    return <Zap className="h-4 w-4" />;
  };

  const getNodeColor = (type: string, subtype: string) => {
    if (type === 'trigger') {
      if (subtype === 'chat_message') {
        return 'from-pink-500 to-rose-500';
      }
      return 'from-indigo-500 to-purple-500';
    }
    
    const automationType = AUTOMATION_TYPES.find(t => t.value === subtype);
    return automationType?.color || 'from-gray-500 to-slate-500';
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return; // Only handle left mouse button
    
    const node = selectedWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const canvasRect = (e.target as HTMLElement).closest('.workflow-canvas')?.getBoundingClientRect();
    
    if (canvasRect) {
      setDragOffset({
        x: e.clientX - canvasRect.left - node.position.x,
        y: e.clientY - canvasRect.top - node.position.y
      });
    }
    
    setDraggingNode(nodeId);
    setSelectedNode(nodeId);
    
    e.preventDefault();
    e.stopPropagation();
  };

  const handleNodeMouseMove = (e: React.MouseEvent) => {
    if (!draggingNode || !selectedWorkflow) return;

    const canvasRect = (e.target as HTMLElement).closest('.workflow-canvas')?.getBoundingClientRect();
    if (!canvasRect) return;

    const newX = e.clientX - canvasRect.left - dragOffset.x;
    const newY = e.clientY - canvasRect.top - dragOffset.y;

    setSelectedWorkflow(prev => prev ? {
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === draggingNode 
          ? { ...node, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
          : node
      )
    } : null);
  };

  const handleNodeMouseUp = () => {
    setDraggingNode(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const saveWorkflow = async () => {
    if (!selectedWorkflow || !session?.user?.id) return;

    try {
      // Debug: Log current workflow state
      console.log('Saving workflow:', selectedWorkflow);
      console.log('Total nodes:', selectedWorkflow.nodes.length);
      console.log('Total connections:', connections.length);
      console.log('Nodes:', selectedWorkflow.nodes);
      
      // Save the complete workflow with all nodes and connections
      const triggerNode = selectedWorkflow.nodes.find(n => n.type === 'trigger');
      const actionNodes = selectedWorkflow.nodes.filter(n => n.type === 'action');

      console.log('Trigger nodes found:', triggerNode ? 1 : 0);
      console.log('Action nodes found:', actionNodes.length);

      if (!triggerNode) {
        toast.error('Workflow must have at least one trigger');
        return;
      }

      if (actionNodes.length === 0) {
        toast.error('Workflow must have at least one action');
        return;
      }

      // Update the workflow with current connections
      const updatedWorkflow = {
        ...selectedWorkflow,
        connections: connections,
        updated_at: new Date().toISOString()
      };

      // Create a cron job entry for the workflow
      const cronJobData = {
        id: selectedWorkflow.cron_job?.id || selectedWorkflow.id, // Use existing ID or workflow ID
        user_id: session.user.id,
        job_type: 'workflow', // Mark as workflow type
        status: selectedWorkflow.status === 'active' ? 'active' : 'disabled',
        execution_status: 'pending',
        property_id: null,
        site_url: null,
        settings: {
          frequency: triggerNode.data.frequency || 'weekly',
          send_day: triggerNode.data.send_day || 'monday',
          send_time: triggerNode.data.send_time || '09:00',
          recipients: ['user@example.com'],
          workflow_data: updatedWorkflow, // Save complete workflow
          automation_config: {
            workflow_id: selectedWorkflow.id,
            nodes: selectedWorkflow.nodes,
            connections: connections
          }
        },
        next_run: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Saving cron job data:', cronJobData);

      const { data, error } = await supabase
        .from('cron_jobs')
        .upsert(cronJobData, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('Workflow saved successfully:', data);
      toast.success(`Workflow saved successfully with ${selectedWorkflow.nodes.length} nodes and ${connections.length} connections`);
      setViewMode('list');
      loadCronJobs();
    } catch (error) {
      console.error('Error saving workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to save workflow: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <SidebarDemo>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="space-y-6 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Visual Automation Builder</h1>
              <p className="text-muted-foreground">Create and manage automated workflows with drag & drop</p>
            </div>
          </div>
          
          <div className="flex gap-3">
          <Button 
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
            >
              <Eye className="h-4 w-4 mr-2" />
              View All
            </Button>
            <Button 
              onClick={createNewWorkflow}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:to-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
              Create Workflow
          </Button>
          </div>
        </div>

        {viewMode === 'list' ? (
          /* List View */
          <div className="space-y-4">
            {workflows.length === 0 ? (
              <Card className="bg-background border-border p-8">
            <div className="text-center py-8">
                  <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No automation workflows found</h3>
              <p className="text-muted-foreground mb-4">
                    Create your first visual automation workflow
              </p>
              <Button 
                    onClick={createNewWorkflow}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:to-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                    Create Your First Workflow
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
                {workflows.map((workflow) => {
                  const automationType = getAutomationTypeInfo(workflow.cron_job?.job_type || '');
                  const IconComponent = automationType.icon;
                  
                  return (
                    <AnimatedBorderCard key={workflow.id} className="p-6 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-lg bg-gradient-to-r",
                            automationType.color
                          )}>
                            <IconComponent className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            {editingWorkflowName === workflow.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={tempWorkflowName}
                                  onChange={(e) => setTempWorkflowName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveWorkflowName(workflow.id);
                                    } else if (e.key === 'Escape') {
                                      cancelRenameWorkflow();
                                    }
                                  }}
                                  className="h-8 text-sm font-semibold"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => saveWorkflowName(workflow.id)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelRenameWorkflow}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{workflow.name}</h3>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startRenameWorkflow(workflow)}
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Rename workflow"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">{workflow.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <Badge className={getStatusColor(workflow.status)}>
                                {workflow.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {workflow.cron_job?.settings.frequency} • {workflow.cron_job?.settings.send_day} • {workflow.cron_job?.settings.send_time}
                        </span>
                    </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                          <div className="text-right text-sm text-muted-foreground mr-4">
                            <div>Triggered: {workflow.stats.triggered}</div>
                            <div>Completed: {workflow.stats.completed}</div>
                          </div>
                          
                    <Button
                      variant="outline"
                      size="sm"
                            onClick={() => editWorkflow(workflow)}
                    >
                            <Edit3 className="h-4 w-4" />
                    </Button>
                          
                    <Button
                      variant="outline"
                      size="sm"
                            onClick={() => toggleWorkflowStatus(workflow.id, workflow.status)}
                          >
                            {workflow.status === 'active' ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                    </Button>
                          
                    <Button
                      variant="outline"
                      size="sm"
                            onClick={() => deleteWorkflow(workflow.id)}
                            className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                    </AnimatedBorderCard>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Builder View */
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
            {/* Node Palette */}
            <div className="col-span-3 space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Automation Blocks
                </h3>
                
                <div className="space-y-3">
                  {/* Triggers */}
                      <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Triggers</h4>
                    <div className="space-y-2">
                      <div 
                        draggable
                        onDragStart={(e) => handleDragStart(e, { value: 'schedule', label: 'Schedule Trigger', description: 'Time-based trigger', category: 'trigger' })}
                        className="p-3 border border-border rounded-lg cursor-move hover:bg-accent transition-colors bg-gradient-to-r from-indigo-500/10 to-purple-500/10"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-indigo-500" />
                          <div>
                            <div className="font-medium text-sm">Schedule</div>
                            <div className="text-xs text-muted-foreground">Time-based trigger</div>
                      </div>
                        </div>
                      </div>
                      
                      <div 
                        draggable
                        onDragStart={(e) => handleDragStart(e, { value: 'event', label: 'Event Trigger', description: 'Event-based trigger', category: 'trigger' })}
                        className="p-3 border border-border rounded-lg cursor-move hover:bg-accent transition-colors bg-gradient-to-r from-orange-500/10 to-red-500/10"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-orange-500" />
                      <div>
                            <div className="font-medium text-sm">Event</div>
                            <div className="text-xs text-muted-foreground">Event-based trigger</div>
                      </div>
                    </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions by Category */}
                  {['Reports', 'Marketing', 'Finance', 'Productivity', 'Communication', 'Integration', 'Storage', 'AI', 'Flow Control', 'Content'].map(category => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">{category}</h4>
                      <div className="space-y-2">
                        {AUTOMATION_TYPES.filter(type => type.category === category).map(type => {
                          const IconComponent = type.icon;
                          return (
                            <div
                              key={type.value}
                              draggable
                              onDragStart={(e) => handleDragStart(e, type)}
                              className={cn(
                                "p-3 border border-border rounded-lg cursor-move hover:bg-accent transition-colors",
                                `bg-gradient-to-r ${type.color}/10`
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                    <div>
                                  <div className="font-medium text-sm">{type.label}</div>
                                  <div className="text-xs text-muted-foreground">{type.description}</div>
                                </div>
                              </div>

      {/* Customer Email Manager Modal */}
      {customerEmailManagerOpen && (
        <CustomerEmailManager 
          onClose={() => setCustomerEmailManagerOpen(false)} 
        />
      )}
                            </div>
                          );
                        })}
                    </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Canvas */}
            <div className="col-span-9">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Workflow className="h-5 w-5" />
                      {editingWorkflowName === selectedWorkflow?.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={tempWorkflowName}
                            onChange={(e) => setTempWorkflowName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveWorkflowName(selectedWorkflow?.id || '');
                              } else if (e.key === 'Escape') {
                                cancelRenameWorkflow();
                              }
                            }}
                            className="h-8 text-lg font-bold"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveWorkflowName(selectedWorkflow?.id || '')}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelRenameWorkflow}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{selectedWorkflow?.name || 'New Workflow'}</span>
                          
                          {/* Real-time test status */}
                          {selectedWorkflow && (
                            <>
                              {selectedWorkflow.nodes.some(n => n.data?.status === 'testing') && (
                                <div className="inline-flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full text-xs">
                                  <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
                                  Testing...
                                </div>
                              )}
                              {selectedWorkflow.nodes.some(n => n.data?.status === 'success') && !selectedWorkflow.nodes.some(n => n.data?.status === 'testing') && (
                                <div className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">
                                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                                  Test Passed
                                </div>
                              )}
                              {selectedWorkflow.nodes.some(n => n.data?.status === 'error') && !selectedWorkflow.nodes.some(n => n.data?.status === 'testing') && (
                                <div className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs">
                                  <div className="h-2 w-2 bg-red-500 rounded-full" />
                                  Test Failed
                                </div>
                              )}
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startRenameWorkflow(selectedWorkflow)}
                                className="h-6 w-6 p-0"
                                title="Rename workflow"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Drag automation blocks from the left panel to build your workflow
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setViewMode('list')}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    <Button onClick={saveWorkflow}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Workflow
                      </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0 h-[calc(100%-80px)]">
                  <div
                    className={cn(
                      "workflow-canvas relative w-full h-full bg-dot-pattern overflow-auto",
                      isDragOver && "bg-blue-50 dark:bg-blue-950/20"
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onMouseMove={handleNodeMouseMove}
                    onMouseUp={handleNodeMouseUp}
                    onMouseLeave={handleNodeMouseUp}
                  >
                    {/* SVG for connections */}
                    <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1, pointerEvents: 'auto' }}>
                      {renderConnections()}
                    </svg>

                    {/* Nodes */}
                    {selectedWorkflow?.nodes.map((node) => (
                      <div
                        key={node.id}
                        className={cn(
                          "absolute bg-background border-2 border-border rounded-lg p-4 cursor-move shadow-lg hover:shadow-xl transition-all",
                          selectedNode === node.id && "border-blue-500 shadow-blue-500/20",
                          connectionStart === node.id && "border-green-500 shadow-green-500/20 ring-2 ring-green-500/30",
                          draggingNode === node.id && "opacity-75 scale-105",
                          "min-w-[150px] max-w-[200px]"
                        )}
                        style={{ 
                          left: node.position.x, 
                          top: node.position.y,
                          zIndex: draggingNode === node.id ? 10 : 2
                        }}
                        onClick={(e) => handleNodeClick(e, node.id)}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        onDoubleClick={() => {
                          setConfigNode(node);
                          setConfigDialogOpen(true);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={cn(
                            "p-2 rounded-md bg-gradient-to-r text-white relative",
                            getNodeColor(node.type, node.subtype)
                          )}>
                            {getNodeIcon(node.type, node.subtype)}
                            
                            {/* Status indicator overlay */}
                            {node.data?.status && (
                              <div className="absolute -top-1 -right-1">
                                {node.data.status === 'testing' && (
                                  <div className="h-3 w-3 bg-yellow-500 rounded-full animate-pulse flex items-center justify-center">
                                    <div className="h-1.5 w-1.5 bg-white rounded-full animate-ping" />
                                  </div>
                                )}
                                {node.data.status === 'success' && (
                                  <div className="h-3 w-3 bg-green-500 rounded-full flex items-center justify-center">
                                    <div className="h-1.5 w-1.5 bg-white rounded-full" />
                                  </div>
                                )}
                                {node.data.status === 'error' && (
                                  <div className="h-3 w-3 bg-red-500 rounded-full flex items-center justify-center">
                                    <X className="h-2 w-2 text-white" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNode(node.id);
                            }}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-foreground">{node.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{node.description}</p>
                          
                          {/* Status information */}
                          {node.data?.status && (
                            <div className="mt-2 text-xs">
                              {node.data.status === 'testing' && (
                                <div className="text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                                  🧪 Testing in progress...
                                </div>
                              )}
                              {node.data.status === 'success' && node.data.testResult && (
                                <div className="text-green-600 bg-green-50 px-2 py-1 rounded">
                                  ✅ {node.data.testResult}
                                </div>
                              )}
                              {node.data.status === 'error' && node.data.testError && (
                                <div className="text-red-600 bg-red-50 px-2 py-1 rounded">
                                  ❌ {node.data.testError}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Drop zone hint */}
                    {selectedWorkflow?.nodes.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">Start Building Your Workflow</p>
                          <p className="text-sm">Drag automation blocks from the left panel to get started</p>
                    </div>
                  </div>
                )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Node Configuration Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Configure {configNode?.title}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">

              
              {((configNode?.type === 'trigger' && configNode?.subtype === 'event') || (configNode?.type === 'action' && configNode?.subtype === 'event')) && (
                <div className="space-y-4">
              <div className="space-y-2">
                    <Label>Event Type</Label>
                <Select
                      value={configNode.data.event_type || ''}
                      onValueChange={(value) => {
                        if (selectedWorkflow && configNode) {
                          const updatedNode = { ...configNode, data: { ...configNode.data, event_type: value } };
                          setConfigNode(updatedNode);
                          setSelectedWorkflow(prev => prev ? {
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                          } : null);
                        }
                      }}
                >
                  <SelectTrigger>
                        <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                        {EVENT_TRIGGER_OPTIONS.map(option => {
                          const IconComponent = option.icon;
                          return (
                            <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{option.label}</div>
                                  <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                      </div>
                    </SelectItem>
                          );
                        })}
                  </SelectContent>
                </Select>
              </div>

                  {configNode.data.event_type === 'social_media_mention' && (
                    <div className="space-y-4">
                <div className="space-y-2">
                        <Label>Social Media Platform</Label>
                  <Select
                          value={configNode.data.platform || ''}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, platform: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                  >
                    <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                            {SOCIAL_MEDIA_PLATFORMS.map(platform => {
                              const IconComponent = platform.icon;
                              return (
                                <SelectItem key={platform.value} value={platform.value}>
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="h-4 w-4" />
                                    {platform.label}
                                  </div>
                        </SelectItem>
                              );
                            })}
                    </SelectContent>
                  </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Keywords to Monitor</Label>
                        <Input
                          placeholder="Enter keywords separated by commas"
                          value={configNode.data.keywords || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, keywords: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                </div>
              )}

                  {configNode.data.event_type === 'calendar_event' && (
                    <div className="space-y-4">
                <div className="space-y-2">
                        <Label>Calendar Event Type</Label>
                  <Select
                          value={configNode.data.calendar_event_type || ''}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, calendar_event_type: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                  >
                    <SelectTrigger>
                            <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                            {CALENDAR_EVENT_TYPES.map(type => {
                              const IconComponent = type.icon;
                              return (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="h-4 w-4" />
                                    {type.label}
                                  </div>
                        </SelectItem>
                              );
                            })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                        <Label>Trigger Timing</Label>
                  <Select
                          value={configNode.data.trigger_timing || 'before'}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, trigger_timing: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                  >
                    <SelectTrigger>
                            <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                            <SelectItem value="before">Before Event</SelectItem>
                            <SelectItem value="after">After Event</SelectItem>
                            <SelectItem value="during">During Event</SelectItem>
                    </SelectContent>
                  </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Time Offset (minutes)</Label>
                        <Input
                          type="number"
                          placeholder="15"
                          value={configNode.data.time_offset || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, time_offset: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                </div>
              )}

                  {configNode.data.event_type === 'email_received' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>From Email Address</Label>
                        <Input
                          placeholder="sender@example.com"
                          value={configNode.data.from_email || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, from_email: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subject Contains</Label>
                        <Input
                          placeholder="Keywords in subject line"
                          value={configNode.data.subject_contains || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, subject_contains: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {configNode.data.event_type === 'chat_message_received' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Chat Platform</Label>
                        <Select
                          value={configNode.data.chat_platform || ''}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, chat_platform: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select chat platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slack">Slack</SelectItem>
                            <SelectItem value="discord">Discord</SelectItem>
                            <SelectItem value="teams">Microsoft Teams</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
                            <SelectItem value="messenger">Facebook Messenger</SelectItem>
                            <SelectItem value="webchat">Website Chat</SelectItem>
                            <SelectItem value="internal_chat">Internal Workspace Chat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* AI Chatbot Integration */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="use-chatbot"
                            checked={configNode.data.use_ai_chatbot || false}
                            onCheckedChange={(checked) => {
                              if (selectedWorkflow && configNode) {
                                const updatedNode = { ...configNode, data: { ...configNode.data, use_ai_chatbot: checked } };
                                setConfigNode(updatedNode);
                                setSelectedWorkflow(prev => prev ? {
                                  ...prev,
                                  nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                } : null);
                              }
                            }}
                          />
                          <Label htmlFor="use-chatbot">Use AI Chatbot Response</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          When enabled, the AI chatbot will automatically respond to incoming messages
                        </p>
                      </div>

                      {configNode.data.use_ai_chatbot && (
                        <div className="space-y-2">
                          <Label>Chatbot Personality/Instructions</Label>
                          <Textarea
                            placeholder="You are a helpful customer service assistant. Be friendly and professional..."
                            value={configNode.data.chatbot_instructions || ''}
                            onChange={(e) => {
                              if (selectedWorkflow && configNode) {
                                const updatedNode = { ...configNode, data: { ...configNode.data, chatbot_instructions: e.target.value } };
                                setConfigNode(updatedNode);
                                setSelectedWorkflow(prev => prev ? {
                                  ...prev,
                                  nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                } : null);
                              }
                            }}
                            rows={3}
                          />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>Channel/Room (optional)</Label>
                        <Input
                          placeholder="#general, @username, or leave empty for all"
                          value={configNode.data.chat_channel || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, chat_channel: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Message Contains (optional)</Label>
                        <Input
                          placeholder="Keywords to trigger on, or leave empty for all messages"
                          value={configNode.data.message_keywords || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, message_keywords: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>From User (optional)</Label>
                        <Input
                          placeholder="Specific username or leave empty for all users"
                          value={configNode.data.from_user || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, from_user: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-sm text-green-600 dark:text-green-400">
                          💬 <strong>Chat Integration:</strong> This trigger will activate when messages are received on the selected platform. {configNode.data.use_ai_chatbot ? 'The AI chatbot will automatically respond to messages.' : 'Configure webhooks in your chat platform settings.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {configNode.data.event_type === 'api_webhook' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Webhook URL</Label>
                        <Input
                          placeholder="https://your-app.com/webhook"
                          value={configNode.data.webhook_url || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, webhook_url: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Secret Key (optional)</Label>
                        <Input
                          type="password"
                          placeholder="Webhook secret for verification"
                          value={configNode.data.webhook_secret || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, webhook_secret: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <p className="text-sm text-green-600 dark:text-green-400">
                          📥 <strong>Webhook Receiver URL:</strong> Use this URL to receive webhooks from external services.
                        </p>
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all">
                          {`${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks?workflow_id=${selectedWorkflow?.id || 'your-workflow-id'}${configNode.data.webhook_secret ? '&secret=your-secret' : ''}`}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const webhookUrl = `${window.location.origin}/api/webhooks?workflow_id=${selectedWorkflow?.id || 'your-workflow-id'}${configNode.data.webhook_secret ? '&secret=' + configNode.data.webhook_secret : ''}`;
                              navigator.clipboard.writeText(webhookUrl);
                              alert('Webhook URL copied to clipboard!');
                            }}
                          >
                            Copy URL
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/webhooks?workflow_id=${selectedWorkflow?.id}&limit=5`);
                                const result = await response.json();
                                console.log('Recent webhooks:', result);
                                alert(`Recent webhooks: ${result.count} received. Check console for details.`);
                              } catch (error) {
                                console.error('Error fetching webhook logs:', error);
                                alert('Error fetching webhook logs');
                              }
                            }}
                          >
                            View Logs
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {configNode.data.event_type === 'form_submission' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Form Name/ID</Label>
                        <Input
                          placeholder="Contact form, signup form, etc."
                          value={configNode.data.form_name || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, form_name: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Form URL</Label>
                        <Input
                          placeholder="https://your-site.com/contact"
                          value={configNode.data.form_url || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, form_url: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          💡 <strong>Alternative:</strong> Use a scheduled trigger to check for new form submissions every 15 minutes instead of real-time events.
                        </p>
                      </div>
                </div>
              )}

                  {configNode.data.event_type === 'file_upload' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Upload Directory</Label>
                        <Input
                          placeholder="/uploads, /documents, etc."
                          value={configNode.data.upload_directory || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, upload_directory: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>File Types</Label>
                        <Input
                          placeholder="pdf, jpg, png, doc (comma separated)"
                          value={configNode.data.file_types || ''}
                          onChange={(e) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, file_types: e.target.value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        />
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          💡 <strong>Alternative:</strong> Use a scheduled trigger to scan for new files every 5 minutes instead of real-time file monitoring.
                        </p>
                      </div>
                    </div>
                  )}

                  {configNode.data.event_type === 'database_change' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Table to Monitor</Label>
                        <Select
                          value={configNode.data.table_name || ''}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, table_name: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select table" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customers">Customers</SelectItem>
                            <SelectItem value="invoices">Invoices</SelectItem>
                            <SelectItem value="projects">Projects</SelectItem>
                            <SelectItem value="leads">Leads</SelectItem>
                            <SelectItem value="tasks">Tasks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Change Type</Label>
                        <Select
                          value={configNode.data.change_type || 'INSERT'}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, change_type: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INSERT">New Record Added</SelectItem>
                            <SelectItem value="UPDATE">Record Updated</SelectItem>
                            <SelectItem value="DELETE">Record Deleted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-sm text-green-600 dark:text-green-400">
                          ✅ <strong>Reliable Alternative:</strong> This uses polling every 2 minutes to detect database changes - much more reliable than real-time triggers.
                        </p>
                      </div>
                    </div>
                  )}

                  {configNode.data.event_type === 'time_condition' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Time Condition</Label>
                        <Select
                          value={configNode.data.time_condition || ''}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, time_condition: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select time condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="business_hours">During Business Hours (9-17)</SelectItem>
                            <SelectItem value="after_hours">After Business Hours</SelectItem>
                            <SelectItem value="weekends">Weekends Only</SelectItem>
                            <SelectItem value="month_end">End of Month</SelectItem>
                            <SelectItem value="quarter_end">End of Quarter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Check Frequency</Label>
                        <Select
                          value={configNode.data.check_frequency || 'hourly'}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, check_frequency: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="every_15_min">Every 15 Minutes</SelectItem>
                            <SelectItem value="hourly">Every Hour</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <p className="text-sm text-purple-600 dark:text-purple-400">
                          ⏰ <strong>Smart Alternative:</strong> This combines time-based triggers with condition checking - perfect for business rules!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Project Trigger Automation Configuration */}
                  {configNode.data.event_type === 'project_trigger_automation' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Trigger Types</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={configNode.data.trigger_completion !== false}
                              onCheckedChange={(checked) => {
                                if (selectedWorkflow && configNode) {
                                  const updatedNode = { ...configNode, data: { ...configNode.data, trigger_completion: checked } };
                                  setConfigNode(updatedNode);
                                  setSelectedWorkflow(prev => prev ? {
                                    ...prev,
                                    nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                  } : null);
                                }
                              }}
                            />
                            <Label>🎉 Project Completion</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={configNode.data.trigger_progress_25 !== false}
                              onCheckedChange={(checked) => {
                                if (selectedWorkflow && configNode) {
                                  const updatedNode = { ...configNode, data: { ...configNode.data, trigger_progress_25: checked } };
                                  setConfigNode(updatedNode);
                                  setSelectedWorkflow(prev => prev ? {
                                    ...prev,
                                    nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                  } : null);
                                }
                              }}
                            />
                            <Label>📈 25% Progress Milestone</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={configNode.data.trigger_progress_50 !== false}
                              onCheckedChange={(checked) => {
                                if (selectedWorkflow && configNode) {
                                  const updatedNode = { ...configNode, data: { ...configNode.data, trigger_progress_50: checked } };
                                  setConfigNode(updatedNode);
                                  setSelectedWorkflow(prev => prev ? {
                                    ...prev,
                                    nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                  } : null);
                                }
                              }}
                            />
                            <Label>📈 50% Progress Milestone</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={configNode.data.trigger_progress_75 !== false}
                              onCheckedChange={(checked) => {
                                if (selectedWorkflow && configNode) {
                                  const updatedNode = { ...configNode, data: { ...configNode.data, trigger_progress_75: checked } };
                                  setConfigNode(updatedNode);
                                  setSelectedWorkflow(prev => prev ? {
                                    ...prev,
                                    nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                  } : null);
                                }
                              }}
                            />
                            <Label>📈 75% Progress Milestone</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={configNode.data.trigger_status_change !== false}
                              onCheckedChange={(checked) => {
                                if (selectedWorkflow && configNode) {
                                  const updatedNode = { ...configNode, data: { ...configNode.data, trigger_status_change: checked } };
                                  setConfigNode(updatedNode);
                                  setSelectedWorkflow(prev => prev ? {
                                    ...prev,
                                    nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                  } : null);
                                }
                              }}
                            />
                            <Label>🔄 Status Changes</Label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Projects to Monitor</Label>
                        <Select
                          value={configNode.data.projects_filter || 'all'}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, projects_filter: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            <SelectItem value="active">Active Projects Only</SelectItem>
                            <SelectItem value="specific">Specific Projects</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {configNode.data.projects_filter === 'specific' && (
                        <div className="space-y-2">
                                                     <Label>Select Projects ({invoiceData.projects?.length || 0} available)</Label>
                           <Select
                             value={configNode.data.specific_projects || ''}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const selectedProject = invoiceData.projects?.find((p: any) => p.id === value);
                                 const updatedNode = { 
                                   ...configNode, 
                                   data: { 
                                     ...configNode.data, 
                                     specific_projects: value,
                                     project_name: selectedProject?.name || '',
                                     customer_name: selectedProject?.customer_name || '',
                                     customer_id: selectedProject?.customer_id || null
                                   } 
                                 };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Select a project to monitor" />
                             </SelectTrigger>
                             <SelectContent>
                               {invoiceData.projects?.length > 0 ? (
                                 invoiceData.projects.map((project: any) => (
                                   <SelectItem key={project.id} value={project.id}>
                                     {project.name} - {project.customer_name}
                                   </SelectItem>
                                 ))
                               ) : (
                                 <SelectItem value="loading" disabled>
                                   {invoiceData.projects === undefined ? 'Loading projects...' : 'No projects found'}
                                 </SelectItem>
                               )}
                             </SelectContent>
                           </Select>
                           
                           {configNode.data.specific_projects && configNode.data.customer_name && (
                             <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                               <p className="text-sm text-green-700 dark:text-green-300">
                                 <strong>Selected:</strong> {configNode.data.project_name}<br/>
                                 <strong>Customer:</strong> {configNode.data.customer_name}<br/>
                                 {configNode.data.customer_id ? (
                                   <span className="text-green-600">✅ Customer email will be automatically fetched</span>
                                 ) : (
                                   <span className="text-orange-600">⚠️ No customer ID - will use fallback recipients</span>
                                 )}
                               </p>
                             </div>
                           )}
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>Email Notification Strategy</Label>
                        <Select
                          value={configNode.data.email_strategy || 'customer_only'}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, email_strategy: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer_only">Customer Only (Project-Specific)</SelectItem>
                            <SelectItem value="customer_and_team">Customer + Project Team</SelectItem>
                            <SelectItem value="custom_recipients">Custom Recipients</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {configNode.data.email_strategy === 'custom_recipients' && (
                        <div className="space-y-2">
                          <Label>Additional Recipients (one per line)</Label>
                          <Textarea
                            placeholder="Enter email addresses for additional notifications..."
                            value={configNode.data.additional_recipients || ''}
                            onChange={(e) => {
                              if (selectedWorkflow && configNode) {
                                const updatedNode = { ...configNode, data: { ...configNode.data, additional_recipients: e.target.value } };
                                setConfigNode(updatedNode);
                                setSelectedWorkflow(prev => prev ? {
                                  ...prev,
                                  nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                } : null);
                              }
                            }}
                            rows={3}
                          />
                        </div>
                      )}
                      
                                             <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                         <p className="text-sm text-blue-600 dark:text-blue-400">
                           🎯 <strong>Smart Customer Notifications:</strong> Each project's customer will receive targeted email notifications only for their specific projects. No more mass emails!
                         </p>
                       </div>
                       
                       <div className="border-t pt-4">
                         <Button
                           onClick={() => setCustomerEmailManagerOpen(true)}
                           variant="outline"
                           className="w-full mb-2"
                         >
                           📧 Manage Customer Emails
                         </Button>
                         <p className="text-xs text-muted-foreground text-center">
                           Set up customer emails for each project to enable targeted notifications
                         </p>
                       </div>
                      
                                             <div className="space-y-2">
                         <Button
                           onClick={testProjectTriggers}
                           className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                         >
                           🧪 Test Project Triggers
                         </Button>
                         
                         <Button
                           onClick={fetchProjects}
                           variant="outline"
                           className="w-full"
                         >
                           🔄 Reload Projects ({invoiceData.projects?.length || 0} loaded)
                         </Button>
                         
                         {invoiceData.projects?.length === 0 && (
                           <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                             <p className="text-sm text-orange-700 dark:text-orange-300">
                               ⚠️ <strong>No projects loaded!</strong> Click "Reload Projects" or check the console for API errors.
                             </p>
                           </div>
                         )}
                      </div>
                    </div>
                  )}

                  {/* No Event Type Selected or Event Triggers Not Working */}
                  {!configNode.data.event_type && (
                    <div className="space-y-4">
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <h4 className="font-medium text-orange-700 dark:text-orange-300 mb-2">
                          ⚠️ Event Triggers Empty?
                        </h4>
                        <p className="text-sm text-orange-600 dark:text-orange-400 mb-3">
                          If event triggers aren't working, here are reliable alternatives:
                        </p>
                        <div className="space-y-2 text-sm text-orange-600 dark:text-orange-400">
                          <div>• <strong>Database Change:</strong> Monitor table changes every 2 minutes</div>
                          <div>• <strong>Time Condition:</strong> Run during business hours or specific times</div>
                          <div>• <strong>Schedule-based:</strong> Check every 15 minutes instead of real-time events</div>
                          <div>• <strong>Manual triggers:</strong> Add buttons to trigger actions manually</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {((configNode?.type === 'trigger' && configNode?.subtype === 'schedule') || (configNode?.type === 'action' && configNode?.subtype === 'schedule')) && (
                <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                      <Label>Frequency</Label>
                  <Select
                        value={configNode.data.frequency || 'weekly'}
                        onValueChange={(value) => {
                          if (selectedWorkflow && configNode) {
                            const updatedNode = { ...configNode, data: { ...configNode.data, frequency: value } };
                            setConfigNode(updatedNode);
                            setSelectedWorkflow(prev => prev ? {
                              ...prev,
                              nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                            } : null);
                          }
                        }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                    {configNode.data.frequency === 'weekly' && (
                  <div className="space-y-2">
                        <Label>Day of Week</Label>
                    <Select
                          value={configNode.data.send_day || 'monday'}
                          onValueChange={(value) => {
                            if (selectedWorkflow && configNode) {
                              const updatedNode = { ...configNode, data: { ...configNode.data, send_day: value } };
                              setConfigNode(updatedNode);
                              setSelectedWorkflow(prev => prev ? {
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                              } : null);
                            }
                          }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                    <Label>Time</Label>
                <Input
                  type="time"
                      value={configNode.data.send_time || '09:00'}
                      onChange={(e) => {
                        if (selectedWorkflow && configNode) {
                          const updatedNode = { ...configNode, data: { ...configNode.data, send_time: e.target.value } };
                          setConfigNode(updatedNode);
                          setSelectedWorkflow(prev => prev ? {
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                          } : null);
                        }
                      }}
                />
              </div>
                </div>
              )}

                             {configNode?.type === 'action' && (
                 <div className="space-y-4">
                   {/* Email Campaign Configuration */}
                   {configNode.subtype === 'email_campaign' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Email Source</Label>
                         <Select
                           value={configNode.data.email_source || 'gmail_hub'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, email_source: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="gmail_hub">Gmail Hub Contacts</SelectItem>
                             <SelectItem value="saved_contacts">Saved Email Contacts</SelectItem>
                             <SelectItem value="manual">Manual Entry</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       {configNode.data.email_source === 'gmail_hub' && (
                         <div className="space-y-4">
                           <div className="space-y-2">
                             <Label>Gmail Contact Filter</Label>
                             <Select
                               value={configNode.data.gmail_filter || 'all'}
                               onValueChange={(value) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, gmail_filter: value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             >
                               <SelectTrigger>
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="all">All Gmail Contacts</SelectItem>
                                 <SelectItem value="frequent">Frequently Contacted</SelectItem>
                                 <SelectItem value="recent">Recent Conversations</SelectItem>
                                 <SelectItem value="labeled">Specific Label/Category</SelectItem>
                                 <SelectItem value="custom">Custom Search</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>

                           {configNode.data.gmail_filter === 'labeled' && (
                             <div className="space-y-2">
                               <Label>Gmail Label/Category</Label>
                               <Input
                                 placeholder="e.g., clients, prospects, newsletter"
                                 value={configNode.data.gmail_label || ''}
                                 onChange={(e) => {
                                   if (selectedWorkflow && configNode) {
                                     const updatedNode = { ...configNode, data: { ...configNode.data, gmail_label: e.target.value } };
                                     setConfigNode(updatedNode);
                                     setSelectedWorkflow(prev => prev ? {
                                       ...prev,
                                       nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                     } : null);
                                   }
                                 }}
                               />
                             </div>
                           )}

                           {configNode.data.gmail_filter === 'custom' && (
                             <div className="space-y-2">
                               <Label>Search Query</Label>
                               <Input
                                 placeholder="e.g., from:domain.com OR subject:newsletter"
                                 value={configNode.data.gmail_search || ''}
                                 onChange={(e) => {
                                   if (selectedWorkflow && configNode) {
                                     const updatedNode = { ...configNode, data: { ...configNode.data, gmail_search: e.target.value } };
                                     setConfigNode(updatedNode);
                                     setSelectedWorkflow(prev => prev ? {
                                       ...prev,
                                       nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                     } : null);
                                   }
                                 }}
                               />
                             </div>
                           )}

                           <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                             <p className="text-sm text-green-600 dark:text-green-400">
                               ✅ <strong>Gmail Hub Integration:</strong> This will automatically pull recipient emails from your Gmail Hub based on the selected criteria.
                             </p>
                           </div>
                         </div>
                       )}

                       {configNode.data.email_source === 'saved_contacts' && (
                         <div className="space-y-2">
                           <Label>Contact List</Label>
                           <Select
                             value={configNode.data.contact_list || ''}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, contact_list: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Select contact list" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="customers">Customer List</SelectItem>
                               <SelectItem value="prospects">Prospect List</SelectItem>
                               <SelectItem value="newsletter">Newsletter Subscribers</SelectItem>
                               <SelectItem value="team">Team Members</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       )}

                       {configNode.data.email_source === 'manual' && (
              <div className="space-y-2">
                         <Label>Recipients (one per line)</Label>
                <Textarea
                  placeholder="Enter email addresses, one per line"
                             value={configNode.data.manual_recipients || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, manual_recipients: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       )}
                       <div className="space-y-2">
                         <Label>Email Template</Label>
                         <Textarea
                           placeholder="Enter your email template content..."
                           value={configNode.data.email_template || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, email_template: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                  rows={4}
                />
              </div>
                     </div>
                   )}

                   {/* Social Media Post Configuration */}
                   {configNode.subtype === 'social_media_post' && (
                     <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label>Social Media Platform</Label>
                           <Select
                             value={configNode.data.platform || ''}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, platform: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Select platform" />
                             </SelectTrigger>
                             <SelectContent>
                               {SOCIAL_MEDIA_PLATFORMS.map(platform => {
                                 const IconComponent = platform.icon;
                                 return (
                                   <SelectItem key={platform.value} value={platform.value}>
                                     <div className="flex items-center gap-2">
                                       <IconComponent className="h-4 w-4" />
                                       {platform.label}
                                     </div>
                                   </SelectItem>
                                 );
                               })}
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2">
                           <Label>Account</Label>
                           <Select
                             value={configNode.data.account || ''}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, account: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Select account" />
                             </SelectTrigger>
                             <SelectContent>
                               {(() => {
                                 // Filter accounts by selected platform and remove duplicates
                                 const selectedPlatform = configNode.data.platform?.toLowerCase();
                                 
                                 // Map platform names to match database values
                                 const platformMapping: Record<string, string[]> = {
                                   'twitter': ['twitter', 'x'],
                                   'x': ['twitter', 'x'],
                                   'facebook': ['facebook'],
                                   'instagram': ['instagram'],
                                   'linkedin': ['linkedin'],
                                   'youtube': ['youtube'],
                                   'tiktok': ['tiktok'],
                                   'threads': ['threads']
                                 };
                                 
                                 const platformVariants = platformMapping[selectedPlatform] || [selectedPlatform];
                                 
                                 const filteredAccounts = socialAccounts
                                   .filter(account => platformVariants.includes(account.platform?.toLowerCase()))
                                   .filter((account, index, arr) => 
                                     arr.findIndex(a => a.account_id === account.account_id) === index
                                   );
                                 
                                 console.log('🔍 Selected platform:', selectedPlatform);
                                 console.log('🔍 Platform variants:', platformVariants);
                                 console.log('🔍 All accounts:', socialAccounts.map(a => ({ platform: a.platform, name: a.account_name })));
                                 console.log('🔍 Filtered accounts:', filteredAccounts);
                                 
                                 if (filteredAccounts.length > 0) {
                                   return filteredAccounts.map((account) => (
                                     <SelectItem key={account.id} value={account.account_id}>
                                       {account.account_name}
                                     </SelectItem>
                                   ));
                                 } else {
                                   return (
                                     <SelectItem value="no_accounts" disabled>
                                       No {selectedPlatform || 'social media'} accounts connected
                                     </SelectItem>
                                   );
                                 }
                               })()}
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label>Post Content</Label>
                         <Textarea
                           placeholder="Enter your social media post content..."
                           value={configNode.data.message_content || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, message_content: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={4}
                         />
                       </div>
              <div className="flex items-center space-x-2">
                <Switch
                           checked={configNode.data.ai_generate || false}
                           onCheckedChange={(checked) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, ai_generate: checked } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                         <Label>Use AI to generate content</Label>
              </div>
                       {configNode.data.ai_generate && (
                         <div className="space-y-2">
                           <Label>AI Content Prompt</Label>
                           <Textarea
                             placeholder="Describe what kind of content you want AI to generate..."
                             value={configNode.data.ai_prompt || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, ai_prompt: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                             rows={3}
                           />
            </div>
                       )}
                       <div className="space-y-2">
                         <Label>Posting Schedule</Label>
                         <div className="grid grid-cols-2 gap-2">
                           <Input
                             type="date"
                             value={configNode.data.post_date || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, post_date: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                           <Input
                             type="time"
                             value={configNode.data.post_time || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, post_time: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Analytics Report Configuration */}
                   {configNode.subtype === 'analytics_report' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Recipients (one per line)</Label>
                         <Textarea
                           placeholder="Enter email addresses, one per line"
                           value={configNode.data.recipients || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, recipients: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Analytics Property</Label>
                         <AnalyticsPropertySelector
                           value={configNode.data.property_id || ''}
                           onChange={(propertyId) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, property_id: propertyId } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Search Console Site (Optional)</Label>
                         <SearchConsoleSiteSelector
                           value={configNode.data.site_url || ''}
                           onChange={(siteUrl) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, site_url: siteUrl } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                     </div>
                   )}

                   {/* Search Console Report Configuration */}
                   {configNode.subtype === 'search_console_report' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Recipients (one per line)</Label>
                         <Textarea
                           placeholder="Enter email addresses, one per line"
                           value={configNode.data.recipients || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, recipients: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Search Console Site</Label>
                         <SearchConsoleSiteSelector
                           value={configNode.data.site_url || ''}
                           onChange={(siteUrl) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, site_url: siteUrl } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Analytics Property (Optional)</Label>
                         <AnalyticsPropertySelector
                           value={configNode.data.property_id || ''}
                           onChange={(propertyId) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, property_id: propertyId } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Report Period</Label>
                         <Select
                           value={configNode.data.date_range || '30days'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, date_range: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select report period" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="7days">Last 7 days</SelectItem>
                             <SelectItem value="14days">Last 14 days</SelectItem>
                             <SelectItem value="30days">Last 30 days</SelectItem>
                             <SelectItem value="90days">Last 90 days</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Include Metrics</Label>
                         <div className="space-y-2">
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_queries !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_queries: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Top Search Queries</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_pages !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_pages: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Top Pages</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_countries !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_countries: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Country Breakdown</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_devices !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_devices: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Device Breakdown</Label>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Invoice Creation Configuration */}
                   {configNode.subtype === 'invoice_creation' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Customer ({invoiceData.customers.length} available)</Label>
                         <Select
                           value={configNode.data.customer_id || ''}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const selectedCustomer = invoiceData.customers.find((c: any) => c.id === value);
                               const updatedNode = { 
                                 ...configNode, 
                                 data: { 
                                   ...configNode.data, 
                                   customer_id: value,
                                   customer_name: selectedCustomer?.name || '',
                                   customer_number: selectedCustomer?.customer_number || ''
                                 } 
                               };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select customer" />
                           </SelectTrigger>
                           <SelectContent>
                             {invoiceData.customers.length > 0 ? (
                               invoiceData.customers.map((customer: any) => (
                                 <SelectItem key={customer.id} value={customer.id}>
                                   {customer.name} {customer.customer_number ? `(#${customer.customer_number})` : ''}
                                 </SelectItem>
                               ))
                             ) : (
                               <SelectItem value="no_customers" disabled>
                                 No customers found
                               </SelectItem>
                             )}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Project (Optional - {invoiceData.projects.length} available)</Label>
                         <Select
                           value={configNode.data.project_id || ''}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const selectedProject = invoiceData.projects.find((p: any) => p.id === value);
                               const updatedNode = { 
                                 ...configNode, 
                                 data: { 
                                   ...configNode.data, 
                                   project_id: value === 'none' ? '' : value,
                                   project_name: selectedProject?.name || ''
                                 } 
                               };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select project (optional)" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="none">No project (standard invoice)</SelectItem>
                             {invoiceData.projects.length > 0 ? (
                               invoiceData.projects.map((project: any) => (
                                 <SelectItem key={project.id} value={project.id}>
                                   {project.name} - {project.customer_name}
                                 </SelectItem>
                               ))
                             ) : (
                               <SelectItem value="no_projects" disabled>
                                 No projects found
                               </SelectItem>
                             )}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Invoice Description</Label>
                         <Textarea
                           placeholder="Enter invoice description..."
                           value={configNode.data.invoice_template || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, invoice_template: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="space-y-4">
                         <div className="flex items-center space-x-2">
                           <Switch
                             checked={configNode.data.is_recurring || false}
                             onCheckedChange={(checked) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, is_recurring: checked } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                           <Label>Recurring Invoice</Label>
                         </div>
                         
                         {configNode.data.is_recurring && (
                           <div className="space-y-2">
                             <Label>Recurring Frequency</Label>
                             <Select
                               value={configNode.data.recurring_frequency || 'monthly'}
                               onValueChange={(value) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, recurring_frequency: value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             >
                               <SelectTrigger>
                                 <SelectValue placeholder="Select frequency" />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="monthly">Monthly</SelectItem>
                                 <SelectItem value="quarterly">Quarterly</SelectItem>
                                 <SelectItem value="yearly">Yearly</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                         )}
                         
                       <div className="flex items-center space-x-2">
                         <Switch
                           checked={configNode.data.auto_send || false}
                           onCheckedChange={(checked) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, auto_send: checked } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                         <Label>Auto-send invoice to customer</Label>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Calendar Event Configuration */}
                   {configNode.subtype === 'calendar_event' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Event Title</Label>
                         <Input
                           placeholder="Enter event title"
                           value={configNode.data.event_title || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, event_title: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label>Calendar Account</Label>
                           <Select
                             value={configNode.data.calendar_account || ''}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, calendar_account: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Select calendar account" />
                             </SelectTrigger>
                             <SelectContent>
                               {calendarAccounts.length > 0 ? (
                                 calendarAccounts.map(account => (
                                   <SelectItem key={account.id} value={account.value}>
                                     <div className="flex items-center space-x-2">
                                       <div>
                                         <div className="font-medium">{account.label}</div>
                                         {account.account_email && (
                                           <div className="text-xs text-muted-foreground">{account.account_email}</div>
                                         )}
                                       </div>
                                       {!account.is_active && (
                                         <span className="text-xs text-orange-500">(Inactive)</span>
                                       )}
                                     </div>
                                   </SelectItem>
                                 ))
                               ) : (
                                 <SelectItem value="no-accounts" disabled>
                                   <div className="text-muted-foreground">
                                     No calendar accounts connected
                                   </div>
                                 </SelectItem>
                               )}
                               <SelectItem value="setup-calendar">
                                 <div className="flex items-center space-x-2 text-blue-600">
                                   <span>+ Connect Calendar Account</span>
                                 </div>
                               </SelectItem>
                             </SelectContent>
                           </Select>
                           {configNode.data.calendar_account === 'setup-calendar' && (
                             <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                               <p className="text-sm text-blue-700 dark:text-blue-300">
                                 Go to <strong>Settings → Integrations</strong> to connect your calendar accounts.
                               </p>
                             </div>
                           )}
                           {calendarAccounts.length === 0 && (
                             <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                               <p className="text-sm text-orange-700 dark:text-orange-300">
                                 ⚠️ No calendar accounts found. Connect Google Calendar, Outlook, or Apple Calendar in Settings → Integrations to use calendar events.
                               </p>
                             </div>
                           )}
                         </div>
                         <div className="space-y-2">
                           <Label>Event Type</Label>
                           <Select
                             value={configNode.data.event_type || 'meeting'}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, event_type: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="meeting">Meeting</SelectItem>
                               <SelectItem value="deadline">Deadline</SelectItem>
                               <SelectItem value="reminder">Reminder</SelectItem>
                               <SelectItem value="appointment">Appointment</SelectItem>
                               <SelectItem value="task">Task</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label>Event Schedule</Label>
                         <div className="grid grid-cols-3 gap-2">
                           <Input
                             type="date"
                             value={configNode.data.event_date || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, event_date: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                           <Input
                             type="time"
                             value={configNode.data.event_time || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, event_time: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                           <Input
                             type="number"
                             placeholder="Duration (min)"
                             value={configNode.data.event_duration || 60}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, event_duration: parseInt(e.target.value) } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label>Event Description</Label>
                         <Textarea
                           placeholder="Enter event description..."
                           value={configNode.data.event_description || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, event_description: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Attendees (one per line)</Label>
                         <Textarea
                           placeholder="Enter email addresses, one per line"
                           value={configNode.data.attendees || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, attendees: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                     </div>
                   )}

                   {/* Chat Message Configuration */}
                   {configNode.subtype === 'chat_message' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Message Content</Label>
                         <Textarea
                           placeholder="Enter your chat message..."
                           value={configNode.data.message_content || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, message_content: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Chat Channel/Recipient</Label>
                         <Input
                           placeholder="Enter channel name or recipient email"
                           value={configNode.data.chat_channel || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, chat_channel: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                     </div>
                   )}

                   {/* Project Report Configuration */}
                   {configNode.subtype === 'project_report' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Report Type</Label>
                         <Select
                           value={configNode.data.report_type || 'summary'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, report_type: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="summary">Project Summary</SelectItem>
                             <SelectItem value="detailed">Detailed Report</SelectItem>
                             <SelectItem value="tasks">Task Progress</SelectItem>
                             <SelectItem value="time_tracking">Time Tracking</SelectItem>
                             <SelectItem value="budget">Budget Analysis</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Projects to Include</Label>
                         <Select
                           value={configNode.data.projects_filter || 'all'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, projects_filter: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="all">All Projects</SelectItem>
                             <SelectItem value="active">Active Projects Only</SelectItem>
                             <SelectItem value="completed">Completed Projects</SelectItem>
                             <SelectItem value="overdue">Overdue Projects</SelectItem>
                             <SelectItem value="specific">Specific Projects</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       {configNode.data.projects_filter === 'specific' && (
                         <div className="space-y-2">
                           <Label>Specific Projects</Label>
                           <Select
                             value={configNode.data.specific_projects || ''}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, specific_projects: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Select projects" />
                             </SelectTrigger>
                             <SelectContent>
                               {invoiceData.projects?.map(project => (
                                 <SelectItem key={project.id} value={project.id}>
                                   {project.name}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                       )}
                       
                       <div className="space-y-2">
                         <Label>Task Selection</Label>
                         <Select
                           value={configNode.data.task_filter || 'all'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, task_filter: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="all">All Tasks</SelectItem>
                             <SelectItem value="completed">Completed Tasks Only</SelectItem>
                             <SelectItem value="pending">Pending Tasks Only</SelectItem>
                             <SelectItem value="overdue">Overdue Tasks Only</SelectItem>
                             <SelectItem value="specific">Specific Tasks</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       
                       {configNode.data.task_filter === 'specific' && (
                         <div className="space-y-2">
                           <Label>Specific Tasks</Label>
                           <Textarea
                             placeholder="Enter task IDs or names (one per line)&#10;e.g., task-123, Setup Database, Configure API"
                             value={configNode.data.specific_tasks || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, specific_tasks: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                             rows={3}
                           />
                           <p className="text-xs text-muted-foreground">
                             Enter task IDs, names, or keywords to match specific tasks
                           </p>
                         </div>
                       )}
                       
                       <div className="space-y-2">
                         <Label>Subtask Inclusion</Label>
                         <Select
                           value={configNode.data.subtask_filter || 'include'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, subtask_filter: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="include">Include All Subtasks</SelectItem>
                             <SelectItem value="completed_only">Completed Subtasks Only</SelectItem>
                             <SelectItem value="pending_only">Pending Subtasks Only</SelectItem>
                             <SelectItem value="exclude">Exclude Subtasks</SelectItem>
                             <SelectItem value="specific">Specific Subtasks</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       
                       {configNode.data.subtask_filter === 'specific' && (
                         <div className="space-y-2">
                           <Label>Specific Subtasks</Label>
                           <Textarea
                             placeholder="Enter subtask keywords or patterns (one per line)&#10;e.g., Design, Testing, Review, Documentation"
                             value={configNode.data.specific_subtasks || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, specific_subtasks: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                             rows={3}
                           />
                           <p className="text-xs text-muted-foreground">
                             Enter keywords to match specific subtasks across all selected tasks
                           </p>
                         </div>
                       )}
                       
                       <div className="space-y-2">
                         <Label>Task Details to Include</Label>
                         <div className="space-y-2">
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_task_progress !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_task_progress: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Task Progress Percentages</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_task_assignments !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_task_assignments: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Task Assignments</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_due_dates !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_due_dates: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Due Dates & Deadlines</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.include_time_tracking !== false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, include_time_tracking: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Time Tracking Data</Label>
                           </div>
                                                       <div className="flex items-center space-x-2">
                              <Switch
                                checked={configNode.data.include_comments !== false}
                                onCheckedChange={(checked) => {
                                  if (selectedWorkflow && configNode) {
                                    const updatedNode = { ...configNode, data: { ...configNode.data, include_comments: checked } };
                                    setConfigNode(updatedNode);
                                    setSelectedWorkflow(prev => prev ? {
                                      ...prev,
                                      nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                    } : null);
                                  }
                                }}
                              />
                              <Label>Task Comments & Notes</Label>
                            </div>
                          </div>
                        </div>
                       <div className="space-y-2">
                         <Label>Recipients (one per line)</Label>
                         <Textarea
                           placeholder="Enter email addresses for report recipients..."
                           value={configNode.data.report_recipients || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, report_recipients: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="flex items-center space-x-2">
                         <Switch
                           checked={configNode.data.include_charts || false}
                           onCheckedChange={(checked) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, include_charts: checked } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                         <Label>Include charts and graphs</Label>
                       </div>
                     </div>
                   )}

                   {/* Memory Storage Configuration */}
                   {configNode.subtype === 'memory_storage' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Storage Operation</Label>
                         <Select
                           value={configNode.data.operation || 'store'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, operation: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="store">Store Data</SelectItem>
                             <SelectItem value="retrieve">Retrieve Data</SelectItem>
                             <SelectItem value="update">Update Data</SelectItem>
                             <SelectItem value="delete">Delete Data</SelectItem>
                             <SelectItem value="append">Append to List</SelectItem>
                             <SelectItem value="clear">Clear Storage</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Memory Key</Label>
                         <Input
                           placeholder="e.g., customer_preferences, last_interaction, workflow_state"
                           value={configNode.data.memory_key || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, memory_key: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                       {(configNode.data.operation === 'store' || configNode.data.operation === 'update' || configNode.data.operation === 'append') && (
                         <div className="space-y-2">
                           <Label>Data to Store</Label>
                           <Textarea
                             placeholder="Enter data to store (can use variables like {{customer.name}}, {{trigger.data}})"
                             value={configNode.data.memory_value || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, memory_value: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                             rows={3}
                           />
                         </div>
                       )}
                       <div className="space-y-2">
                         <Label>Storage Scope</Label>
                         <Select
                           value={configNode.data.scope || 'workflow'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, scope: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="workflow">This Workflow Only</SelectItem>
                             <SelectItem value="user">User-wide (All Workflows)</SelectItem>
                             <SelectItem value="workspace">Workspace-wide</SelectItem>
                             <SelectItem value="global">Global (All Users)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Expiration (optional)</Label>
                         <div className="grid grid-cols-2 gap-2">
                           <Input
                             type="number"
                             placeholder="Duration"
                             value={configNode.data.expiration_value || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, expiration_value: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                           <Select
                             value={configNode.data.expiration_unit || 'hours'}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, expiration_unit: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="minutes">Minutes</SelectItem>
                               <SelectItem value="hours">Hours</SelectItem>
                               <SelectItem value="days">Days</SelectItem>
                               <SelectItem value="weeks">Weeks</SelectItem>
                               <SelectItem value="months">Months</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                         <p className="text-sm text-purple-600 dark:text-purple-400">
                           🧠 <strong>Memory Storage:</strong> Store and retrieve data between workflow runs. Use variables like {`{{memory.customer_preferences}}`} in other actions to access stored data.
                         </p>
                         
                         <div className="space-y-2">
                           <Label>Test Memory Storage</Label>
                           <div className="flex gap-2">
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   const response = await fetch('/api/automation/memory', {
                                     method: 'POST',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({
                                       workspace_id: '7ab1e32d-a48b-4437-a2cf-6c1bb9f3d2f7',
                                       workflow_id: selectedWorkflow?.id || 'test-workflow',
                                       memory_key: 'test_key',
                                       memory_value: { message: 'Hello from memory!', timestamp: new Date().toISOString() }
                                     })
                                   });
                                   const result = await response.json();
                                   console.log('Memory store result:', result);
                                   alert(result.success ? `✅ Memory stored! Status: ${result.status}` : 'Error storing memory');
                                 } catch (error) {
                                   console.error('Error testing memory:', error);
                                   alert('Error testing memory storage');
                                 }
                               }}
                             >
                               Test Store
                             </Button>
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   const response = await fetch(`/api/automation/memory?workspace_id=7ab1e32d-a48b-4437-a2cf-6c1bb9f3d2f7&workflow_id=${selectedWorkflow?.id || 'test-workflow'}&memory_key=test_key`);
                                   const result = await response.json();
                                   console.log('Memory retrieve result:', result);
                                   alert(result.success ? `✅ Retrieved (Status ${result.status}): ${JSON.stringify(result.data)}` : 'No memory found');
                                 } catch (error) {
                                   console.error('Error retrieving memory:', error);
                                   alert('Error retrieving memory');
                                 }
                               }}
                             >
                               Test Retrieve
                             </Button>
                             <Button
                               type="button"
                               variant="default"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   const response = await fetch('/api/automation/memory?test=true');
                                   const result = await response.json();
                                   console.log('🗄️ Database access test result:', result);
                                   
                                   // Show detailed results in alert
                                   const dataInfo = Object.entries(result.available_data)
                                     .map(([key, data]: [string, any]) => `${key}: ${data.count} records`)
                                     .join('\n');
                                   
                                   alert(`✅ Database Access Test - Status ${result.status}\n\n${result.message}\n\nAvailable Data:\n${dataInfo}\n\nCheck console for full schema details!`);
                                 } catch (error) {
                                   console.error('Error testing database access:', error);
                                   alert('Error testing database access');
                                 }
                               }}
                             >
                               🗄️ Test Database Access
                             </Button>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Google Drive Configuration */}
                   {configNode.subtype === 'google_drive' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Drive Operation</Label>
                         <Select
                           value={configNode.data.operation || 'create_folder'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, operation: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select operation" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="create_folder">Create Folder</SelectItem>
                             <SelectItem value="share_folder">Share Folder</SelectItem>
                             <SelectItem value="upload_file">Upload File</SelectItem>
                             <SelectItem value="list_files">List Files</SelectItem>
                             <SelectItem value="get_storage_info">Get Storage Info</SelectItem>
                             <SelectItem value="delete_file">Delete File</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       {configNode.data.operation === 'create_folder' && (
                         <>
                           <div className="space-y-2">
                             <Label>Folder Name</Label>
                             <Input
                               placeholder="Enter folder name"
                               value={configNode.data.folder_name || ''}
                               onChange={(e) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, folder_name: e.target.value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                           </div>
                           <div className="space-y-2">
                             <Label>Parent Folder ID (Optional)</Label>
                             <Input
                               placeholder="Leave empty for root folder"
                               value={configNode.data.parent_id || ''}
                               onChange={(e) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, parent_id: e.target.value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                           </div>
                         </>
                       )}

                       {configNode.data.operation === 'share_folder' && (
                         <>
                           <div className="space-y-2">
                             <Label>Folder ID</Label>
                             <Input
                               placeholder="Enter folder ID to share"
                               value={configNode.data.folder_id || ''}
                               onChange={(e) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, folder_id: e.target.value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                           </div>
                           <div className="space-y-2">
                             <Label>Share with Email</Label>
                             <Input
                               placeholder="Enter email address"
                               value={configNode.data.share_email || ''}
                               onChange={(e) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, share_email: e.target.value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                           </div>
                           <div className="space-y-2">
                             <Label>Permission Level</Label>
                             <Select
                               value={configNode.data.permission_role || 'reader'}
                               onValueChange={(value) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, permission_role: value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             >
                               <SelectTrigger>
                                 <SelectValue placeholder="Select permission" />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="reader">Reader (View only)</SelectItem>
                                 <SelectItem value="commenter">Commenter (View + Comment)</SelectItem>
                                 <SelectItem value="writer">Writer (View + Edit)</SelectItem>
                                 <SelectItem value="fileOrganizer">File Organizer (Organize files)</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                         </>
                       )}

                       {configNode.data.operation === 'upload_file' && (
                         <>
                           <div className="space-y-2">
                             <Label>File Name</Label>
                             <Input
                               placeholder="Enter file name"
                               value={configNode.data.file_name || ''}
                               onChange={(e) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, file_name: e.target.value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                           </div>
                           <div className="space-y-2">
                             <Label>File Content</Label>
                             <Textarea
                               placeholder="Enter file content or use variables like {{memory.data}}"
                               value={configNode.data.file_content || ''}
                               onChange={(e) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, file_content: e.target.value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                           </div>
                         </>
                       )}

                       <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                         <p className="text-sm text-blue-600 dark:text-blue-400">
                           📁 <strong>Google Drive:</strong> Manage files and folders in your Google Drive. Create organized folder structures, share with team members, and automate file operations.
                         </p>
                         
                         <div className="space-y-2 mt-3">
                           <Label>Test Google Drive</Label>
                           <div className="flex gap-2">
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   const response = await fetch('/api/google-drive', {
                                     method: 'POST',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({
                                       action: 'create_folder',
                                       userId: session?.user?.id,
                                       name: 'Test Automation Folder',
                                       description: 'Created by CRM automation'
                                     })
                                   });
                                   const result = await response.json();
                                   console.log('Drive test result:', result);
                                   alert(result.success ? `Folder created: ${result.folder?.name}` : `Error: ${result.error}`);
                                 } catch (error) {
                                   console.error('Error testing Drive:', error);
                                   alert('Error testing Google Drive');
                                 }
                               }}
                             >
                               Test Create Folder
                             </Button>
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   const response = await fetch('/api/google-drive', {
                                     method: 'POST',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({
                                       action: 'get_storage_info',
                                       userId: session?.user?.id
                                     })
                                   });
                                   const result = await response.json();
                                   console.log('Storage info:', result);
                                   if (result.success) {
                                     const storage = result.storage;
                                     const usedGB = (storage.usage / (1024 * 1024 * 1024)).toFixed(2);
                                     const limitGB = storage.limit ? (storage.limit / (1024 * 1024 * 1024)).toFixed(2) : 'Unlimited';
                                     alert(`Storage: ${usedGB} GB used of ${limitGB} GB`);
                                   } else {
                                     alert(`Error: ${result.error}`);
                                   }
                                 } catch (error) {
                                   console.error('Error getting storage info:', error);
                                   alert('Error getting storage info');
                                 }
                               }}
                             >
                               Check Storage
                             </Button>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Webhook Action Configuration */}
                   {configNode.subtype === 'webhook_action' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Webhook URL</Label>
                         <Input
                           placeholder="https://api.example.com/webhook"
                           value={configNode.data.webhook_url || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, webhook_url: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>HTTP Method</Label>
                         <Select
                           value={configNode.data.method || 'POST'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, method: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select method" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="POST">POST</SelectItem>
                             <SelectItem value="PUT">PUT</SelectItem>
                             <SelectItem value="PATCH">PATCH</SelectItem>
                             <SelectItem value="GET">GET</SelectItem>
                             <SelectItem value="DELETE">DELETE</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>Request Body (JSON)</Label>
                         <Textarea
                           placeholder='{"message": "Hello from automation!", "data": "{memory.customer_data}"}'
                           value={configNode.data.body || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, body: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={4}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Headers (Optional)</Label>
                         <Textarea
                           placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                           value={configNode.data.headers || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, headers: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>

                       <div className="flex items-center space-x-2">
                         <Switch
                           checked={configNode.data.retry_on_failure || false}
                           onCheckedChange={(checked) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, retry_on_failure: checked } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                         <Label>Retry on failure</Label>
                       </div>

                       <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                         <p className="text-sm text-purple-600 dark:text-purple-400">
                           🔗 <strong>Send Webhook:</strong> Send HTTP requests to external services. Use variables like {`{{memory.data}}`} or {`{{trigger.payload}}`} in the request body.
                         </p>
                         
                         <div className="space-y-2 mt-3">
                           <Label>Test Webhook</Label>
                           <div className="flex gap-2">
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   const testUrl = configNode.data.webhook_url || 'https://httpbin.org/post';
                                   const testBody = configNode.data.body || '{"test": "message", "timestamp": "' + new Date().toISOString() + '"}';
                                   
                                   const response = await fetch(testUrl, {
                                     method: configNode.data.method || 'POST',
                                     headers: {
                                       'Content-Type': 'application/json',
                                       ...(configNode.data.headers ? JSON.parse(configNode.data.headers) : {})
                                     },
                                     body: testBody
                                   });
                                   
                                   const result = await response.text();
                                   console.log('Webhook test result:', result);
                                   alert(response.ok ? `Webhook sent successfully! Status: ${response.status}` : `Webhook failed! Status: ${response.status}`);
                                 } catch (error) {
                                   console.error('Error testing webhook:', error);
                                   alert('Error testing webhook: ' + error);
                                 }
                               }}
                             >
                               Test Send
                             </Button>
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               onClick={() => {
                                 const webhookUrl = `${window.location.origin}/api/webhooks?workflow_id=${selectedWorkflow?.id || 'your-workflow-id'}&secret=your-secret`;
                                 navigator.clipboard.writeText(webhookUrl);
                                 alert('Webhook receiver URL copied to clipboard!');
                               }}
                             >
                               Copy Receiver URL
                             </Button>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Split Out Configuration */}
                   {configNode.subtype === 'split_out' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Split Type</Label>
                         <Select
                           value={configNode.data.split_type || 'parallel'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, split_type: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select split type" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="parallel">Parallel Execution</SelectItem>
                             <SelectItem value="conditional">Conditional Split</SelectItem>
                             <SelectItem value="data_split">Data Array Split</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>Number of Outputs</Label>
                         <Input
                           type="number"
                           min="2"
                           max="10"
                           placeholder="3"
                           value={configNode.data.output_count || '2'}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, output_count: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                         <p className="text-sm text-orange-600 dark:text-orange-400">
                           🔀 <strong>Split Out:</strong> Divides the workflow into multiple parallel paths. Use this to process data simultaneously or create conditional branches.
                         </p>
                       </div>
                     </div>
                   )}

                   {/* Aggregate Configuration */}
                   {configNode.subtype === 'aggregate' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Aggregation Method</Label>
                         <Select
                           value={configNode.data.aggregation_method || 'merge'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, aggregation_method: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select aggregation method" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="merge">Merge Objects</SelectItem>
                             <SelectItem value="concat">Concatenate Arrays</SelectItem>
                             <SelectItem value="wait_all">Wait for All</SelectItem>
                             <SelectItem value="first_complete">First to Complete</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>Timeout (seconds)</Label>
                         <Input
                           type="number"
                           min="1"
                           max="3600"
                           placeholder="300"
                           value={configNode.data.timeout || '300'}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, timeout: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg">
                         <p className="text-sm text-teal-600 dark:text-teal-400">
                           🎯 <strong>Aggregate:</strong> Combines multiple workflow paths back into one. Waits for all inputs or uses the first completed result.
                         </p>
                       </div>
                     </div>
                   )}

                   {/* Script Generator Configuration */}
                   {configNode.subtype === 'script_generator' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Character 1 Name</Label>
                         <Input
                           placeholder="Stewie Griffin"
                           value={configNode.data.character1_name || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, character1_name: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Character 1 Personality</Label>
                         <Textarea
                           placeholder="Stewie is a sophisticated, British-accented baby with an evil genius personality. He's sarcastic, witty, and often condescending."
                           value={configNode.data.character1_personality || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, character1_personality: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Character 2 Name</Label>
                         <Input
                           placeholder="Peter Griffin"
                           value={configNode.data.character2_name || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, character2_name: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Character 2 Personality</Label>
                         <Textarea
                           placeholder="Peter is a bumbling, childish, and often clueless father. He's enthusiastic about simple things and often misunderstands complex topics."
                           value={configNode.data.character2_personality || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, character2_personality: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Topic/Theme</Label>
                         <Input
                           placeholder="Minecraft gameplay, building tips, funny moments"
                           value={configNode.data.topic || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, topic: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Script Length</Label>
                         <Select
                           value={configNode.data.script_length || 'medium'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, script_length: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select length" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="short">Short (30-60 seconds)</SelectItem>
                             <SelectItem value="medium">Medium (1-3 minutes)</SelectItem>
                             <SelectItem value="long">Long (3-5 minutes)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                         <p className="text-sm text-green-600 dark:text-green-400">
                           🎭 <strong>Script Generator:</strong> Creates engaging conversations between characters about your chosen topic. Perfect for faceless YouTube channels!
                         </p>
                       </div>
                     </div>
                   )}

                   {/* Voice Generation Configuration */}
                   {configNode.subtype === 'voice_generation' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Voice Service</Label>
                         <Select
                           value={configNode.data.voice_service || 'elevenlabs'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, voice_service: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select voice service" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                             <SelectItem value="openai">OpenAI TTS</SelectItem>
                             <SelectItem value="azure">Azure Speech</SelectItem>
                             <SelectItem value="google">Google Cloud TTS</SelectItem>
                             <SelectItem value="replicate">Replicate (Bark TTS)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>Character 1 Voice ID</Label>
                         <Input
                           placeholder="Voice ID for Character 1 (e.g., ElevenLabs voice ID)"
                           value={configNode.data.character1_voice_id || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, character1_voice_id: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Character 2 Voice ID</Label>
                         <Input
                           placeholder="Voice ID for Character 2 (e.g., ElevenLabs voice ID)"
                           value={configNode.data.character2_voice_id || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, character2_voice_id: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>API Key</Label>
                         <Input
                           type="password"
                           placeholder="Your voice service API key"
                           value={configNode.data.voice_api_key || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, voice_api_key: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                         <p className="text-sm text-blue-600 dark:text-blue-400">
                           🎤 <strong>Voice Generation:</strong> Converts your script text into realistic character voices. Supports multiple TTS services for high-quality audio.
                         </p>
                       </div>
                     </div>
                   )}

                   {/* Code Node Configuration */}
                   {configNode.subtype === 'code' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>JavaScript Code</Label>
                         <Textarea
                           placeholder={`// Transform data for JSON2Video
const audioFiles = input.audio_files || [];
const template = input.template || 'minecraft_chat';

// Use built-in utility to transform data
output = utils.toJSON2Video(audioFiles, template);

// Add custom modifications
if (input.background_video) {
  output.background = {
    type: 'video',
    src: input.background_video,
    loop: true
  };
}`}
                           value={configNode.data.code || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, code: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={12}
                           className="font-mono text-sm"
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Code Description</Label>
                         <Input
                           placeholder="Describe what this code does..."
                           value={configNode.data.description || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, description: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg">
                         <p className="text-sm text-pink-600 dark:text-pink-400">
                           💻 <strong>Code Node:</strong> Execute custom JavaScript to transform data between nodes. Perfect for JSON2Video formatting!
                         </p>
                         <div className="mt-2 text-xs text-pink-500 dark:text-pink-300">
                           <strong>Available:</strong> input (data from previous node), output (set your result), utils.toJSON2Video(), utils.mergeData(), console.log()
                         </div>
                       </div>

                       <div className="space-y-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={async () => {
                             try {
                               const response = await fetch('/api/automation/code-execution?test=json2video');
                               const data = await response.json();
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, code: data.sample_code.trim() } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                               toast.success('Sample code loaded!');
                             } catch (error) {
                               toast.error('Failed to load sample code');
                             }
                           }}
                         >
                           Load JSON2Video Sample
                         </Button>
                       </div>
                     </div>
                   )}

                   {/* Video Renderer Configuration */}
                   {configNode.subtype === 'video_render' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Video Template</Label>
                         <Select
                           value={configNode.data.video_template || 'minecraft_chat'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, video_template: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select template" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="minecraft_chat">Minecraft Chat Style</SelectItem>
                             <SelectItem value="family_guy_style">Family Guy Style</SelectItem>
                             <SelectItem value="simple_waveform">Simple Waveform</SelectItem>
                             <SelectItem value="custom">Custom Template</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>Background Video/Image</Label>
                         <Input
                           placeholder="URL to background video or image"
                           value={configNode.data.background_media || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, background_media: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Video Resolution</Label>
                         <Select
                           value={configNode.data.resolution || '1920x1080'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, resolution: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select resolution" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="1920x1080">1080p (1920x1080)</SelectItem>
                             <SelectItem value="1280x720">720p (1280x720)</SelectItem>
                             <SelectItem value="1080x1920">Vertical (1080x1920)</SelectItem>
                             <SelectItem value="1920x1080">Square (1080x1080)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>Render Service</Label>
                         <Select
                           value={configNode.data.render_service || 'json2video'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, render_service: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select render service" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="json2video">JSON2Video</SelectItem>
                             <SelectItem value="remotion">Remotion</SelectItem>
                             <SelectItem value="ffmpeg">FFmpeg</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                         <p className="text-sm text-red-600 dark:text-red-400">
                           🎬 <strong>Video Renderer:</strong> Creates the final video by combining audio, background media, and visual elements. Perfect for YouTube content!
                         </p>
                       </div>
                     </div>
                   )}

                   {/* Project Creation Configuration */}
                   {configNode.subtype === 'project_creation' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Project Template</Label>
                         <Textarea
                           placeholder="Enter project template or description..."
                           value={configNode.data.project_template || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, project_template: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="flex items-center space-x-2">
                         <Switch
                           checked={configNode.data.auto_assign || false}
                           onCheckedChange={(checked) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, auto_assign: checked } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                         <Label>Auto-assign to current user</Label>
                       </div>
                     </div>
                   )}

                   {/* Blog Post Configuration */}
                   {configNode.subtype === 'blog_post' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Blog Post Title</Label>
                         <Input
                           placeholder="Enter blog post title"
                           value={configNode.data.blog_title || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, blog_title: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Blog Content</Label>
                         <Textarea
                           placeholder="Enter your blog post content..."
                           value={configNode.data.blog_content || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, blog_content: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={8}
                         />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label>Category</Label>
                           <Select
                             value={configNode.data.blog_category || ''}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, blog_category: value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Select category" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="technology">Technology</SelectItem>
                               <SelectItem value="business">Business</SelectItem>
                               <SelectItem value="marketing">Marketing</SelectItem>
                               <SelectItem value="tutorials">Tutorials</SelectItem>
                               <SelectItem value="news">News</SelectItem>
                               <SelectItem value="insights">Insights</SelectItem>
                               <SelectItem value="case-studies">Case Studies</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2">
                           <Label>Author</Label>
                           <Input
                             placeholder="Author name"
                             value={configNode.data.blog_author || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, blog_author: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label>Tags (comma-separated)</Label>
                         <Input
                           placeholder="tag1, tag2, tag3"
                           value={configNode.data.blog_tags || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, blog_tags: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                       <div className="flex items-center space-x-2">
                         <Switch
                           checked={configNode.data.ai_generate_blog || false}
                           onCheckedChange={(checked) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, ai_generate_blog: checked } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                         <Label>Use AI to generate blog post</Label>
                       </div>
                       {configNode.data.ai_generate_blog && (
                         <div className="space-y-4">
                           <div className="space-y-2">
                             <Label>AI Blog Prompt</Label>
                             <Textarea
                               placeholder="Describe the blog post you want AI to write..."
                               value={configNode.data.ai_blog_prompt || ''}
                               onChange={(e) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, ai_blog_prompt: e.target.value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                               rows={4}
                             />
                           </div>
                           <div className="space-y-2">
                             <Label>AI Model for Blog Writing</Label>
                             <Select
                               value={configNode.data.ai_blog_model || 'gpt-4o'}
                               onValueChange={(value) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, ai_blog_model: value } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             >
                               <SelectTrigger>
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 {AI_REASONING_MODELS.map(model => (
                                   <SelectItem key={model.value} value={model.value}>
                                     <div>
                                       <div className="font-medium">{model.label}</div>
                                       <div className="text-xs text-muted-foreground">{model.description}</div>
                                     </div>
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <Label>Target Word Count</Label>
                               <Input
                                 type="number"
                                 placeholder="1500"
                                 value={configNode.data.target_word_count || 1500}
                                 onChange={(e) => {
                                   if (selectedWorkflow && configNode) {
                                     const updatedNode = { ...configNode, data: { ...configNode.data, target_word_count: parseInt(e.target.value) } };
                                     setConfigNode(updatedNode);
                                     setSelectedWorkflow(prev => prev ? {
                                       ...prev,
                                       nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                     } : null);
                                   }
                                 }}
                               />
                             </div>
                             <div className="space-y-2">
                               <Label>Writing Tone</Label>
                               <Select
                                 value={configNode.data.writing_tone || 'professional'}
                                 onValueChange={(value) => {
                                   if (selectedWorkflow && configNode) {
                                     const updatedNode = { ...configNode, data: { ...configNode.data, writing_tone: value } };
                                     setConfigNode(updatedNode);
                                     setSelectedWorkflow(prev => prev ? {
                                       ...prev,
                                       nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                     } : null);
                                   }
                                 }}
                               >
                                 <SelectTrigger>
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="professional">Professional</SelectItem>
                                   <SelectItem value="casual">Casual</SelectItem>
                                   <SelectItem value="technical">Technical</SelectItem>
                                   <SelectItem value="friendly">Friendly</SelectItem>
                                   <SelectItem value="authoritative">Authoritative</SelectItem>
                                   <SelectItem value="conversational">Conversational</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                           </div>
                         </div>
                       )}
                       <div className="space-y-2">
                         <Label>Publishing Options</Label>
                         <div className="grid grid-cols-2 gap-4">
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.auto_publish || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, auto_publish: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Auto-publish</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.send_notification || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, send_notification: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Send notification</Label>
                           </div>
                         </div>
                       </div>
                       {configNode.data.send_notification && (
                         <div className="space-y-2">
                           <Label>Notification Recipients</Label>
                           <Textarea
                             placeholder="Enter email addresses, one per line"
                             value={configNode.data.notification_recipients || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, notification_recipients: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                             rows={3}
                           />
                         </div>
                       )}
                       <div className="space-y-2">
                         <Label>Publish Date & Time</Label>
                         <div className="grid grid-cols-2 gap-2">
                           <Input
                             type="date"
                             value={configNode.data.publish_date || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, publish_date: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                           <Input
                             type="time"
                             value={configNode.data.publish_time || ''}
                             onChange={(e) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, publish_time: e.target.value } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           />
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Code Node Configuration */}
                   {configNode.subtype === 'code' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>JavaScript Code</Label>
                         <Textarea
                           placeholder={`// Transform data for JSON2Video
const audioFiles = input.audio_files || [];
const template = input.template || 'minecraft_chat';

// Use built-in utility to transform data
output = utils.toJSON2Video(audioFiles, template);

// Add custom modifications
if (input.background_video) {
  output.background = {
    type: 'video',
    src: input.background_video,
    loop: true
  };
}`}
                           value={configNode.data.code || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, code: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={12}
                           className="font-mono text-sm"
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Code Description</Label>
                         <Input
                           placeholder="Describe what this code does..."
                           value={configNode.data.description || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, description: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>

                       <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg">
                         <p className="text-sm text-pink-600 dark:text-pink-400">
                           💻 <strong>Code Node:</strong> Execute custom JavaScript to transform data between nodes. Perfect for JSON2Video formatting!
                         </p>
                         <div className="mt-2 text-xs text-pink-500 dark:text-pink-300">
                           <strong>Available:</strong> input (data from previous node), output (set your result), utils.toJSON2Video(), utils.mergeData(), console.log()
                         </div>
                       </div>

                       <div className="space-y-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={async () => {
                             try {
                               const response = await fetch('/api/automation/code-execution?test=json2video');
                               const data = await response.json();
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, code: data.sample_code.trim() } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                               toast.success('Sample code loaded!');
                             } catch (error) {
                               toast.error('Failed to load sample code');
                             }
                           }}
                         >
                           Load JSON2Video Sample
                         </Button>
                       </div>
                     </div>
                   )}

                   {/* Data Sync Configuration */}
                   {configNode.subtype === 'data_sync' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Data Source</Label>
                         <Select
                           value={configNode.data.sync_source || 'google_analytics'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, sync_source: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="google_analytics">Google Analytics</SelectItem>
                             <SelectItem value="search_console">Search Console</SelectItem>
                             <SelectItem value="social_media">Social Media</SelectItem>
                             <SelectItem value="calendar">Calendar</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Sync Target</Label>
                         <Input
                           placeholder="Enter target database table or destination"
                           value={configNode.data.sync_target || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, sync_target: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         />
                       </div>
                     </div>
                   )}

                   {/* AI Task Configuration */}
                   {configNode.subtype === 'ai_task' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Task Description</Label>
                         <Textarea
                           placeholder="Describe what you want the AI to do..."
                           value={configNode.data.task_description || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, task_description: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={4}
                         />
                       </div>
                                                <div className="space-y-2">
                           <Label>AI Model Category</Label>
                           <Select
                             value={configNode.data.ai_model_category || 'reasoning'}
                             onValueChange={(value) => {
                               if (selectedWorkflow && configNode) {
                                 const updatedNode = { ...configNode, data: { ...configNode.data, ai_model_category: value, ai_model: '' } };
                                 setConfigNode(updatedNode);
                                 setSelectedWorkflow(prev => prev ? {
                                   ...prev,
                                   nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                 } : null);
                               }
                             }}
                           >
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="reasoning">🧠 Reasoning Models</SelectItem>
                               <SelectItem value="coding">💻 Coding Models</SelectItem>
                               <SelectItem value="vision">👁️ Vision Models</SelectItem>
                             </SelectContent>
                           </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>AI Model</Label>
                         <Select
                             value={configNode.data.ai_model || ''}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, ai_model: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                               <SelectValue placeholder="Select an AI model" />
                           </SelectTrigger>
                           <SelectContent>
                               {(configNode.data.ai_model_category === 'coding' ? AI_CODING_MODELS :
                                 configNode.data.ai_model_category === 'vision' ? AI_VISION_MODELS :
                                 AI_REASONING_MODELS).map(model => (
                               <SelectItem key={model.value} value={model.value}>
                                 <div>
                                   <div className="font-medium">{model.label}</div>
                                   <div className="text-xs text-muted-foreground">{model.description}</div>
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>AI Permissions</Label>
                         <div className="grid grid-cols-2 gap-2">
                           {AI_PERMISSIONS.map(permission => (
                             <div key={permission.value} className="flex items-center space-x-2">
                               <Switch
                                 checked={configNode.data.permissions?.includes(permission.value) || false}
                                 onCheckedChange={(checked) => {
                                   if (selectedWorkflow && configNode) {
                                     const currentPermissions = configNode.data.permissions || [];
                                     const updatedPermissions = checked 
                                       ? [...currentPermissions, permission.value]
                                       : currentPermissions.filter(p => p !== permission.value);
                                     const updatedNode = { ...configNode, data: { ...configNode.data, permissions: updatedPermissions } };
                                     setConfigNode(updatedNode);
                                     setSelectedWorkflow(prev => prev ? {
                                       ...prev,
                                       nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                     } : null);
                                   }
                                 }}
                               />
                               <div>
                                 <Label className="text-sm">{permission.label}</Label>
                                 <p className="text-xs text-muted-foreground">{permission.description}</p>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label>Context Data</Label>
                         <Textarea
                           placeholder="Provide any context or data the AI should consider..."
                           value={configNode.data.context_data || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, context_data: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                     </div>
                   )}

                   {/* AI Reasoning Configuration */}
                   {configNode.subtype === 'ai_reasoning' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Analysis Question</Label>
                         <Textarea
                           placeholder="What should the AI analyze or reason about?"
                           value={configNode.data.analysis_question || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, analysis_question: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={4}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Model Category</Label>
                         <Select
                           value={configNode.data.reasoning_model_category || 'reasoning'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, reasoning_model_category: value, reasoning_model: '' } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="reasoning">🧠 Reasoning Models</SelectItem>
                             <SelectItem value="coding">💻 Coding Models</SelectItem>
                             <SelectItem value="vision">👁️ Vision Models</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>AI Model</Label>
                         <Select
                           value={configNode.data.reasoning_model || ''}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, reasoning_model: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select an AI model" />
                           </SelectTrigger>
                           <SelectContent>
                             {(configNode.data.reasoning_model_category === 'coding' ? AI_CODING_MODELS :
                               configNode.data.reasoning_model_category === 'vision' ? AI_VISION_MODELS :
                               AI_REASONING_MODELS).map(model => (
                               <SelectItem key={model.value} value={model.value}>
                                 <div>
                                   <div className="font-medium">{model.label}</div>
                                   <div className="text-xs text-muted-foreground">{model.description}</div>
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Data Sources</Label>
                         <div className="grid grid-cols-2 gap-2">
                           {['Analytics Data', 'Customer Data', 'Sales Data', 'Marketing Data', 'Financial Data', 'Project Data'].map(source => (
                             <div key={source} className="flex items-center space-x-2">
                               <Switch
                                 checked={configNode.data.data_sources?.includes(source) || false}
                                 onCheckedChange={(checked) => {
                                   if (selectedWorkflow && configNode) {
                                     const currentSources = configNode.data.data_sources || [];
                                     const updatedSources = checked 
                                       ? [...currentSources, source]
                                       : currentSources.filter(s => s !== source);
                                     const updatedNode = { ...configNode, data: { ...configNode.data, data_sources: updatedSources } };
                                     setConfigNode(updatedNode);
                                     setSelectedWorkflow(prev => prev ? {
                                       ...prev,
                                       nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                     } : null);
                                   }
                                 }}
                               />
                               <Label className="text-sm">{source}</Label>
                             </div>
                           ))}
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label>Decision Criteria</Label>
                         <Textarea
                           placeholder="What criteria should the AI use for decision making?"
                           value={configNode.data.decision_criteria || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, decision_criteria: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>Output Format</Label>
                         <Select
                           value={configNode.data.output_format || 'detailed_report'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, output_format: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="detailed_report">Detailed Report</SelectItem>
                             <SelectItem value="summary">Executive Summary</SelectItem>
                             <SelectItem value="action_items">Action Items</SelectItem>
                             <SelectItem value="recommendations">Recommendations</SelectItem>
                             <SelectItem value="json_data">JSON Data</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label>Recipients (for results)</Label>
                         <Textarea
                           placeholder="Enter email addresses, one per line"
                           value={configNode.data.recipients || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, recipients: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={3}
                         />
                       </div>
                     </div>
                   )}

                   {/* Chatbot Integration Configuration */}
                   {configNode.subtype === 'chatbot_integration' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Chatbot Type</Label>
                         <Select
                           value={configNode.data.chatbot_type || 'existing'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, chatbot_type: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="existing">🤖 Use Existing ChatWindow</SelectItem>
                             <SelectItem value="team_chat">💬 Team Chat Integration</SelectItem>
                             <SelectItem value="custom">⚙️ Custom Chatbot Instance</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>AI Model</Label>
                         <Select
                           value={configNode.data.chatbot_model || 'gpt-4o'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, chatbot_model: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {AI_REASONING_MODELS.slice(0, 20).map(model => (
                               <SelectItem key={model.value} value={model.value}>
                                 <div>
                                   <div className="font-medium">{model.label}</div>
                                   <div className="text-xs text-muted-foreground">{model.description}</div>
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>System Instructions</Label>
                         <Textarea
                           placeholder="You are a helpful AI assistant. Respond professionally and provide helpful information about projects, calendar events, and CRM data..."
                           value={configNode.data.system_instructions || ''}
                           onChange={(e) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, system_instructions: e.target.value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                           rows={4}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label>Integration Features</Label>
                         <div className="grid grid-cols-1 gap-2">
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.connect_to_projects || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, connect_to_projects: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Connect to Projects</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.connect_to_calendar || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, connect_to_calendar: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Connect to Calendar</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.connect_to_reasoning || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, connect_to_reasoning: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Connect to AI Reasoning</Label>
                           </div>
                         </div>
                       </div>
                 </div>
               )}

                   {/* Smart Calendar Configuration */}
                   {configNode.subtype === 'smart_calendar' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Calendar Action</Label>
                         <Select
                           value={configNode.data.calendar_action || 'create_event'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, calendar_action: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="create_event">📅 Create Calendar Event</SelectItem>
                             <SelectItem value="analyze_schedule">🔍 Analyze Schedule</SelectItem>
                             <SelectItem value="suggest_times">⏰ Suggest Meeting Times</SelectItem>
                             <SelectItem value="reschedule">🔄 Smart Rescheduling</SelectItem>
                           </SelectContent>
                         </Select>
            </div>

                       <div className="space-y-2">
                         <Label>AI Model for Calendar Intelligence</Label>
                         <Select
                           value={configNode.data.calendar_ai_model || 'gpt-4o'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, calendar_ai_model: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {AI_REASONING_MODELS.slice(0, 20).map(model => (
                               <SelectItem key={model.value} value={model.value}>
                                 <div>
                                   <div className="font-medium">{model.label}</div>
                                   <div className="text-xs text-muted-foreground">{model.description}</div>
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>Smart Features</Label>
                         <div className="grid grid-cols-1 gap-2">
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.auto_timezone_detection || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, auto_timezone_detection: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Auto Timezone Detection</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.conflict_detection || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, conflict_detection: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Conflict Detection</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.smart_reminders || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, smart_reminders: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Smart Reminders</Label>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Project AI Assistant Configuration */}
                   {configNode.subtype === 'project_ai_assistant' && (
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label>Assistant Role</Label>
                         <Select
                           value={configNode.data.assistant_role || 'project_manager'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, assistant_role: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="project_manager">👔 Project Manager</SelectItem>
                             <SelectItem value="analyst">📊 Data Analyst</SelectItem>
                             <SelectItem value="coordinator">🤝 Team Coordinator</SelectItem>
                             <SelectItem value="reporter">📋 Progress Reporter</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>AI Model for Project Analysis</Label>
                         <Select
                           value={configNode.data.project_ai_model || 'gpt-4o'}
                           onValueChange={(value) => {
                             if (selectedWorkflow && configNode) {
                               const updatedNode = { ...configNode, data: { ...configNode.data, project_ai_model: value } };
                               setConfigNode(updatedNode);
                               setSelectedWorkflow(prev => prev ? {
                                 ...prev,
                                 nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                               } : null);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {AI_REASONING_MODELS.slice(0, 20).map(model => (
                               <SelectItem key={model.value} value={model.value}>
                                 <div>
                                   <div className="font-medium">{model.label}</div>
                                   <div className="text-xs text-muted-foreground">{model.description}</div>
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label>AI Capabilities</Label>
                         <div className="grid grid-cols-1 gap-2">
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.analyze_progress || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, analyze_progress: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Progress Analysis</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.task_suggestions || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, task_suggestions: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Task Suggestions</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Switch
                               checked={configNode.data.deadline_optimization || false}
                               onCheckedChange={(checked) => {
                                 if (selectedWorkflow && configNode) {
                                   const updatedNode = { ...configNode, data: { ...configNode.data, deadline_optimization: checked } };
                                   setConfigNode(updatedNode);
                                   setSelectedWorkflow(prev => prev ? {
                                     ...prev,
                                     nodes: prev.nodes.map(n => n.id === configNode.id ? updatedNode : n)
                                   } : null);
                                 }
                               }}
                             />
                             <Label>Deadline Optimization</Label>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
               )}
            </div>

                          <div className="flex justify-between items-center mt-6">
                                 <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={testProjectTriggers}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 hover:from-blue-600 hover:to-purple-700"
                      >
                        🧪 Test Project Triggers
                      </Button>
                     <Button 
                       variant="outline" 
                       onClick={testChatTriggerLive}
                       className="bg-gradient-to-r from-green-500 to-teal-600 text-white border-0 hover:from-green-600 hover:to-teal-700"
                       disabled={!selectedWorkflow}
                     >
                       💬 Test Chat Integration Live
                     </Button>
                     <Button 
                       variant="outline" 
                       onClick={() => window.open('/chat', '_blank')}
                       className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0 hover:from-purple-600 hover:to-pink-700"
                     >
                       🚀 Open Live Chat
                     </Button>
                   </div>
              <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setConfigDialogOpen(false)}>
                Save Configuration
              </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarDemo>
  );
}