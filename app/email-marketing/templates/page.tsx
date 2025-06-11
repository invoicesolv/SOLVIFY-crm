"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { 
  Mail, 
  Plus, 
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Copy,
  Layout,
  Image as ImageIcon,
  Type,
  Palette,
  MoreHorizontal
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedBorderCard } from '@/components/ui/animated-border-card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getActiveWorkspaceId } from '@/lib/permission';
import { SidebarDemo } from "@/components/ui/code.demo";
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  plain_content?: string;
  template_type: 'email' | 'newsletter' | 'promotional' | 'transactional';
  category: string;
  thumbnail_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TEMPLATE_CATEGORIES = [
  'Newsletter',
  'Promotional',
  'Welcome',
  'Abandoned Cart',
  'Thank You',
  'Announcement',
  'Event',
  'Survey',
  'Follow Up',
  'Other'
];

const TEMPLATE_TYPES = [
  { value: 'email', label: 'Email Campaign', icon: Mail },
  { value: 'newsletter', label: 'Newsletter', icon: Layout },
  { value: 'promotional', label: 'Promotional', icon: Palette },
  { value: 'transactional', label: 'Transactional', icon: Type }
];

export default function TemplatesPage() {
  const { data: session } = useSession();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    const initializeWorkspace = async () => {
      if (session?.user?.id) {
        try {
          console.log('[Templates] Initializing workspace for user:', session.user.id, session.user.email);
          const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
          console.log('[Templates] Got workspace ID:', activeWorkspaceId);
          setWorkspaceId(activeWorkspaceId);
        } catch (error) {
          console.error('[Templates] Error getting workspace ID:', error);
        }
      } else {
        console.log('[Templates] No session user ID available');
      }
    };
    
    initializeWorkspace();
  }, [session?.user?.id]);

  useEffect(() => {
    if (workspaceId) {
      console.log('[Templates] Workspace ID is set, fetching templates for:', workspaceId);
      console.log('[Templates] Session state:', {
        userId: session?.user?.id,
        email: session?.user?.email,
        hasSession: !!session
      });
      fetchTemplates();
    } else {
      console.log('[Templates] No workspace ID available yet');
    }
  }, [workspaceId]);

  const fetchTemplates = async () => {
    if (!workspaceId) {
      console.log('[Templates] fetchTemplates called but no workspaceId');
      return;
    }
    
    try {
      setLoading(true);
      console.log('[Templates] === FETCHING TEMPLATES ===');
      console.log('[Templates] Using workspace ID:', workspaceId);
      console.log('[Templates] Session user:', session?.user);
      
      // Test auth first
      const { data: authTest, error: authError } = await supabase.auth.getUser();
      console.log('[Templates] Auth test result:', { user: authTest?.user?.email, error: authError?.message });
      
      // Check what session looks like
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('[Templates] Session data:', { 
        hasSession: !!sessionData?.session,
        accessToken: sessionData?.session?.access_token ? 'present' : 'missing',
        userId: sessionData?.session?.user?.id,
        email: sessionData?.session?.user?.email,
        sessionError: sessionError?.message
      });
      
      // Test if we can query team_members to verify auth
      const { data: memberTest, error: memberError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session?.user?.id)
        .limit(1);
      console.log('[Templates] Member test result:', { memberTest, memberError });
      
      console.log('[Templates] About to query email_templates with workspace_id:', workspaceId);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      console.log('[Templates] Supabase query result:', { 
        dataLength: data?.length, 
        error: error?.message, 
        errorCode: error?.code,
        errorDetails: error?.details,
        queryWorkspaceId: workspaceId
      });
      
      if (error) {
        console.error('[Templates] Full error object:', error);
        throw error;
      }
      
      setTemplates(data || []);
      console.log('[Templates] Set templates:', data?.length || 0, 'templates loaded');
      console.log('[Templates] Template names:', data?.map(t => t.name) || []);
    } catch (error) {
      console.error('[Templates] Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const duplicateTemplate = async (template: Template) => {
    if (!workspaceId || !session?.user?.id) return;
    
    try {
      const { error } = await supabase
        .from('email_templates')
        .insert({
          workspace_id: workspaceId,
          user_id: session.user.id,
          name: `${template.name} (Copy)`,
          subject: template.subject,
          html_content: template.html_content,
          plain_content: template.plain_content,
          template_type: template.template_type,
          category: template.category,
          is_active: true
        });

      if (error) throw error;
      
      fetchTemplates();
      toast.success('Template duplicated successfully');
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      fetchTemplates();
      toast.success('Template deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const toggleTemplateStatus = async (template: Template) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;
      
      fetchTemplates();
      toast.success(`Template ${template.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      console.error('Error updating template status:', error);
      toast.error('Failed to update template status');
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = TEMPLATE_TYPES.find(t => t.value === type);
    const IconComponent = typeConfig?.icon || Mail;
    return <IconComponent className="h-4 w-4" />;
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesType = selectedType === 'all' || template.template_type === selectedType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  const handlePreviewTemplate = (template: Template) => {
    console.log('[Templates] Opening preview for:', template.name);
    setPreviewTemplate(template);
  };

  const handleClosePreview = () => {
    console.log('[Templates] Closing preview');
    setPreviewTemplate(null);
    // Small delay to ensure proper focus restoration
    setTimeout(() => {
      console.log('[Templates] Preview closed, focus should be restored');
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarDemo>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Email Templates</h1>
            <p className="text-muted-foreground">Create and manage email templates for campaigns</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/email-marketing/templates/new">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </Link>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
              <p className="text-xs text-muted-foreground">
                {templates.filter(t => t.is_active).length} active
              </p>
            </CardContent>
          </AnimatedBorderCard>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Template Types</CardTitle>
              <Layout className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(templates.map(t => t.template_type)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                Different types
              </p>
            </CardContent>
          </AnimatedBorderCard>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Palette className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(templates.map(t => t.category)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                Template categories
              </p>
            </CardContent>
          </AnimatedBorderCard>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent</CardTitle>
              <Type className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.filter(t => 
                  new Date(t.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                ).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Updated this week
              </p>
            </CardContent>
          </AnimatedBorderCard>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        {/* Filters and Search */}
        <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="all">All Categories</option>
                  {TEMPLATE_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="all">All Types</option>
                  {TEMPLATE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </AnimatedBorderCard>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        {/* Templates */}
        {filteredTemplates.length === 0 ? (
          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="relative">
                  <GlowingEffect className="text-primary" />
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4 relative z-10" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || selectedCategory !== 'all' || selectedType !== 'all'
                    ? 'Try adjusting your search or filters.'
                    : 'Create your first email template to get started.'}
                </p>
                {!searchTerm && selectedCategory === 'all' && selectedType === 'all' && (
                  <Link href="/email-marketing/templates/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </AnimatedBorderCard>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTemplates).map(([category, categoryTemplates], index) => (
              <div key={category}>
                {index > 0 && (
                  <div className="h-px bg-border/30 dark:bg-border/10 mb-6"></div>
                )}
                <h2 className="text-xl font-semibold mb-4">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {categoryTemplates.map((template) => (
                    <AnimatedBorderCard key={template.id} className="bg-background/50 backdrop-blur-sm border-0 hover:shadow-lg transition-shadow">
                      <div className="aspect-[4/3] bg-muted rounded-t-lg overflow-hidden relative">
                        {template.thumbnail_url ? (
                          <img 
                            src={template.thumbnail_url} 
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                            {getTypeIcon(template.template_type)}
                            <div className="mt-2 text-xs text-muted-foreground text-center px-4">
                              {template.subject.length > 30 
                                ? `${template.subject.substring(0, 30)}...` 
                                : template.subject}
                            </div>
                          </div>
                        )}
                        
                        <div className="absolute top-2 right-2">
                          <DropdownMenu key={template.id}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" sideOffset={5} className="z-[60]">
                              <DropdownMenuItem onClick={() => handlePreviewTemplate(template)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/email-marketing/templates/${template.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateTemplate(template)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleTemplateStatus(template)}>
                                {template.is_active ? (
                                  <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteTemplate(template.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-sm leading-tight">{template.name}</h3>
                            <Badge className={getStatusColor(template.is_active)}>
                              {template.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.subject}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {getTypeIcon(template.template_type)}
                              <span className="capitalize">{template.template_type}</span>
                            </div>
                            <span>
                              {new Date(template.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </AnimatedBorderCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={handleClosePreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
              <DialogDescription>
                View the email template content and styling
              </DialogDescription>
            </DialogHeader>
            
            {previewTemplate && (
              <div className="space-y-4" key={previewTemplate.id}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Subject:</span> {previewTemplate.subject}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {previewTemplate.template_type}
                  </div>
                  <div>
                    <span className="font-medium">Category:</span> {previewTemplate.category}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <Badge className={`ml-2 ${getStatusColor(previewTemplate.is_active)}`}>
                      {previewTemplate.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4 bg-white">
                  <div className="text-sm text-muted-foreground mb-2">Email Preview:</div>
                  <div 
                    dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SidebarDemo>
  );
} 