"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Mail, 
  ArrowLeft, 
  Save, 
  Send, 
  Eye, 
  Users, 
  Filter,
  Plus,
  Palette,
  Type,
  Image as ImageIcon,
  Layout,
  Calendar,
  Target,
  Settings,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { getActiveWorkspaceId } from '@/lib/permission';
import { SidebarDemo } from "@/components/ui/code.demo";

interface Template {
  id: string;
  name: string;
  html_content: string;
  thumbnail_url?: string;
  category: string;
}

interface ContactList {
  id: string;
  name: string;
  total_contacts: number;
  active_contacts: number;
}

interface CampaignData {
  name: string;
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  html_content: string;
  plain_content: string;
  template_id?: string;
  selected_lists: string[];
  schedule_type: 'now' | 'scheduled';
  scheduled_at?: string;
}

export default function NewCampaignPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    subject: '',
    from_name: session?.user?.name || '',
    from_email: session?.user?.email || '',
    reply_to: session?.user?.email || '',
    html_content: '',
    plain_content: '',
    selected_lists: [],
    schedule_type: 'now'
  });

  useEffect(() => {
    const initializeWorkspace = async () => {
      if (session?.user?.id) {
        try {
          const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
          setWorkspaceId(activeWorkspaceId);
        } catch (error) {
          console.error('Error getting workspace ID:', error);
        }
      }
    };
    
    initializeWorkspace();
  }, [session?.user?.id]);

  useEffect(() => {
    if (workspaceId) {
      fetchTemplates();
      fetchContactLists();
    }
  }, [workspaceId]);

  const fetchTemplates = async () => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    }
  };

  const fetchContactLists = async () => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase
        .from('email_lists')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      setContactLists(data || []);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
      toast.error('Failed to load contact lists');
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setCampaignData(prev => ({
      ...prev,
      template_id: template.id,
      html_content: template.html_content
    }));
    setCurrentStep(2);
  };

  const handleSaveDraft = async () => {
    if (!workspaceId || !session?.user?.id) return;
    
    setSaveLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert({
          workspace_id: workspaceId,
          user_id: session.user.id,
          ...campaignData,
          status: 'draft',
          total_recipients: 0
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Campaign saved as draft');
      router.push(`/email-marketing/campaigns/${data.id}`);
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!workspaceId || !session?.user?.id) return;
    
    // Validation
    if (!campaignData.name || !campaignData.subject || !campaignData.html_content) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (campaignData.selected_lists.length === 0) {
      toast.error('Please select at least one contact list');
      return;
    }

    setLoading(true);
    try {
      // Calculate total recipients
      const { data: listsData } = await supabase
        .from('email_lists')
        .select('active_contacts')
        .in('id', campaignData.selected_lists);

      const totalRecipients = listsData?.reduce((sum, list) => sum + list.active_contacts, 0) || 0;

      const campaignStatus = campaignData.schedule_type === 'now' ? 'sending' : 'scheduled';
      
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert({
          workspace_id: workspaceId,
          user_id: session.user.id,
          ...campaignData,
          status: campaignStatus,
          total_recipients: totalRecipients,
          scheduled_at: campaignData.schedule_type === 'scheduled' ? campaignData.scheduled_at : null
        })
        .select()
        .single();

      if (error) throw error;

      // Here you would typically trigger the actual email sending process
      // This could be done via an API route or edge function
      
      const message = campaignData.schedule_type === 'now' 
        ? 'Campaign is being sent!' 
        : 'Campaign scheduled successfully!';
      
      toast.success(message);
      router.push(`/email-marketing/campaigns/${data.id}`);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const getTotalRecipients = () => {
    return contactLists
      .filter(list => campaignData.selected_lists.includes(list.id))
      .reduce((sum, list) => sum + list.active_contacts, 0);
  };

  const toggleListSelection = (listId: string) => {
    setCampaignData(prev => ({
      ...prev,
      selected_lists: prev.selected_lists.includes(listId)
        ? prev.selected_lists.filter(id => id !== listId)
        : [...prev.selected_lists, listId]
    }));
  };

  // Step indicator
  const steps = [
    { number: 1, title: 'Template', description: 'Choose or create' },
    { number: 2, title: 'Content', description: 'Design your email' },
    { number: 3, title: 'Recipients', description: 'Select your audience' },
    { number: 4, title: 'Send', description: 'Review and send' }
  ];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className={`flex flex-col items-center ${index < steps.length - 1 ? 'mr-8' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
              currentStep >= step.number 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-background text-muted-foreground border-muted-foreground'
            }`}>
              {step.number}
            </div>
            <div className="mt-2 text-center">
              <div className="text-sm font-medium">{step.title}</div>
              <div className="text-xs text-muted-foreground">{step.description}</div>
            </div>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-16 h-0.5 mb-6 transition-colors ${
              currentStep > step.number ? 'bg-primary' : 'bg-muted'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <SidebarDemo>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <Link href="/email-marketing">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Campaigns
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Create Email Campaign</h1>
                <p className="text-muted-foreground">Design and send professional email campaigns</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleSaveDraft} disabled={saveLoading}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button onClick={handleSendCampaign} disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {campaignData.schedule_type === 'now' ? 'Send Now' : 'Schedule'}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {renderStepIndicator()}

          {/* Step 1: Template Selection */}
          {currentStep === 1 && (
            <div className="max-w-6xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Choose a Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="templates" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="templates">Pre-made Templates</TabsTrigger>
                      <TabsTrigger value="blank">Start from Scratch</TabsTrigger>
                      <TabsTrigger value="previous">Use Previous Campaign</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="templates" className="mt-6">
                      {templates.length === 0 ? (
                        <div className="text-center py-12">
                          <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
                          <p className="text-muted-foreground mb-6">Create your first email template to get started</p>
                          <Link href="/email-marketing/templates/new">
                            <Button>
                              <Plus className="h-4 w-4 mr-2" />
                              Create Template
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {templates.map((template) => (
                            <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleTemplateSelect(template)}>
                              <div className="aspect-[4/3] bg-muted rounded-t-lg overflow-hidden">
                                {template.thumbnail_url ? (
                                  <img 
                                    src={template.thumbnail_url} 
                                    alt={template.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Layout className="h-12 w-12 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <CardContent className="p-4">
                                <h3 className="font-semibold mb-1">{template.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {template.category}
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="blank" className="mt-6">
                      <div className="text-center py-12">
                        <Type className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Start with a blank canvas</h3>
                        <p className="text-muted-foreground mb-6">Create your email from scratch using our drag-and-drop editor</p>
                        <Button onClick={() => {
                          setCampaignData(prev => ({ ...prev, html_content: '<p>Start writing your email content here...</p>' }));
                          setCurrentStep(2);
                        }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Start from Scratch
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="previous" className="mt-6">
                      <div className="text-center py-12">
                        <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Use a previous campaign</h3>
                        <p className="text-muted-foreground mb-6">Duplicate a successful campaign as your starting point</p>
                        <Button variant="outline">
                          Browse Campaigns
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Content Editor */}
          {currentStep === 2 && (
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Editor */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Type className="h-5 w-5" />
                        Email Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="campaign-name">Campaign Name *</Label>
                        <Input
                          id="campaign-name"
                          value={campaignData.name}
                          onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Weekly Newsletter #42"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject Line *</Label>
                        <Input
                          id="subject"
                          value={campaignData.subject}
                          onChange={(e) => setCampaignData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="e.g., Amazing deals just for you!"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="html-content">Email Content *</Label>
                        <Textarea
                          id="html-content"
                          value={campaignData.html_content}
                          onChange={(e) => setCampaignData(prev => ({ ...prev, html_content: e.target.value }))}
                          placeholder="Enter your email content here..."
                          className="min-h-[400px] font-mono text-sm"
                        />
                      </div>
                      
                      <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setCurrentStep(1)}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to Templates
                        </Button>
                        <Button onClick={() => setCurrentStep(3)}>
                          Next: Select Recipients
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Settings Sidebar */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Email Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="from-name">From Name</Label>
                        <Input
                          id="from-name"
                          value={campaignData.from_name}
                          onChange={(e) => setCampaignData(prev => ({ ...prev, from_name: e.target.value }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="from-email">From Email</Label>
                        <Input
                          id="from-email"
                          type="email"
                          value={campaignData.from_email}
                          onChange={(e) => setCampaignData(prev => ({ ...prev, from_email: e.target.value }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reply-to">Reply To</Label>
                        <Input
                          id="reply-to"
                          type="email"
                          value={campaignData.reply_to}
                          onChange={(e) => setCampaignData(prev => ({ ...prev, reply_to: e.target.value }))}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        Preview Email
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Recipients */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Select Recipients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <h3 className="font-semibold">Total Recipients</h3>
                        <p className="text-sm text-muted-foreground">
                          {getTotalRecipients().toLocaleString()} contacts selected
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="font-semibold">Contact Lists</h3>
                      {contactLists.length === 0 ? (
                        <Card>
                          <CardContent className="py-12">
                            <div className="text-center">
                              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-semibold mb-2">No contact lists found</h3>
                              <p className="text-muted-foreground mb-6">
                                Create contact lists and add contacts to send campaigns.
                              </p>
                              <div className="flex justify-center gap-3">
                                <Link href="/email-marketing/contacts">
                                  <Button>
                                    <Users className="h-4 w-4 mr-2" />
                                    Manage Contacts
                                  </Button>
                                </Link>
                                <Link href="/email-marketing/contacts/import">
                                  <Button variant="outline">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import Contacts
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {contactLists.map((list) => (
                            <div key={list.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={campaignData.selected_lists.includes(list.id)}
                                  onCheckedChange={() => toggleListSelection(list.id)}
                                />
                                <div>
                                  <h4 className="font-medium">{list.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {list.active_contacts} active contacts
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline">
                                {list.total_contacts} total
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setCurrentStep(2)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Content
                      </Button>
                      <Button 
                        onClick={() => setCurrentStep(4)}
                        disabled={campaignData.selected_lists.length === 0}
                      >
                        Next: Review & Send
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Review & Send */}
          {currentStep === 4 && (
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Review & Send
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Campaign Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-semibold">Campaign Details</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name:</span>
                            <span>{campaignData.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subject:</span>
                            <span>{campaignData.subject}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">From:</span>
                            <span>{campaignData.from_name} &lt;{campaignData.from_email}&gt;</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="font-semibold">Recipients</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Lists Selected:</span>
                            <span>{campaignData.selected_lists.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Recipients:</span>
                            <span className="font-semibold">{getTotalRecipients().toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Scheduling Options */}
                    <div className="space-y-4">
                      <h3 className="font-semibold">Scheduling</h3>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={campaignData.schedule_type === 'now'}
                            onCheckedChange={(checked) => 
                              setCampaignData(prev => ({ 
                                ...prev, 
                                schedule_type: checked ? 'now' : 'scheduled' 
                              }))
                            }
                          />
                          <Label>Send immediately</Label>
                        </div>
                        
                        {campaignData.schedule_type === 'scheduled' && (
                          <div className="space-y-2">
                            <Label htmlFor="scheduled-time">Schedule for later</Label>
                            <Input
                              id="scheduled-time"
                              type="datetime-local"
                              value={campaignData.scheduled_at || ''}
                              onChange={(e) => setCampaignData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setCurrentStep(3)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Recipients
                      </Button>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={handleSaveDraft} disabled={saveLoading}>
                          <Save className="h-4 w-4 mr-2" />
                          Save Draft
                        </Button>
                        <Button onClick={handleSendCampaign} disabled={loading}>
                          <Send className="h-4 w-4 mr-2" />
                          {campaignData.schedule_type === 'now' ? 'Send Campaign' : 'Schedule Campaign'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </SidebarDemo>
  );
} 