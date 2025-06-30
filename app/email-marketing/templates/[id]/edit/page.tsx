"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft,
  Save,
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  Type,
  Palette,
  Bold,
  Italic,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { SidebarDemo } from "@/components/ui/code.demo";
import { LogoManager } from '@/components/ui/logo-manager';

interface TemplateData {
  id?: string;
  name: string;
  subject: string;
  html_content: string;
  plain_content: string;
  template_type: 'email' | 'newsletter' | 'promotional' | 'transactional';
  category: string;
  is_active: boolean;
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
  { value: 'email', label: 'Email Campaign', description: 'Standard marketing email' },
  { value: 'newsletter', label: 'Newsletter', description: 'Regular newsletter content' },
  { value: 'promotional', label: 'Promotional', description: 'Sales and promotion emails' },
  { value: 'transactional', label: 'Transactional', description: 'Order confirmations, receipts' }
];

export default function EditTemplatePage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  
  const [templateData, setTemplateData] = useState<TemplateData>({
    name: '',
    subject: '',
    html_content: '',
    plain_content: '',
    template_type: 'email',
    category: 'Other',
    is_active: true
  });
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('visual');
  const [editableContent, setEditableContent] = useState('');
  const [selectedLogo, setSelectedLogo] = useState<string>('');
  const [analyticsVariables, setAnalyticsVariables] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
      loadAnalyticsData();
    }
  }, [templateId]);

  const loadAnalyticsData = async () => {
    try {
      const response = await fetch('/api/email-marketing/analytics-data');
      if (response.ok) {
        const data = await response.json();
        setAnalyticsVariables(data.templateVariables);
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  };

  useEffect(() => {
    // Extract editable content from HTML
    if (templateData.html_content) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(templateData.html_content, 'text/html');
      
      // Try to find main content area
      const contentArea = doc.querySelector('[data-editable="true"]') || 
                         doc.querySelector('.email-content') || 
                         doc.querySelector('td') || 
                         doc.body;
      
      if (contentArea) {
        setEditableContent(contentArea.innerHTML);
      } else {
        setEditableContent(templateData.html_content);
      }
    }
  }, [templateData.html_content]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/email-marketing/templates/${templateId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch template');
      }

      setTemplateData(result.template);
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load template');
      router.push('/email-marketing/templates');
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setEditableContent(newContent);
    
    // Update the HTML content by replacing the editable section
    let updatedHtml = templateData.html_content;
    
    if (updatedHtml.includes('[EDITABLE_CONTENT]')) {
      updatedHtml = updatedHtml.replace('[EDITABLE_CONTENT]', newContent);
    } else {
      // Create a simple email template wrapper if none exists
      updatedHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${templateData.subject}</title>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background-color: #f8f9fa; 
    }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff; 
      padding: 40px; 
    }
    .content { 
      line-height: 1.6; 
      color: #333333; 
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="content" data-editable="true">
      ${newContent}
    </div>
  </div>
</body>
</html>`;
    }
    
    setTemplateData(prev => ({
      ...prev,
      html_content: updatedHtml
    }));
  };

  const generatePlainText = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editableContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    setTemplateData(prev => ({
      ...prev,
      plain_content: plainText.replace(/\s+/g, ' ').trim()
    }));
    toast.success('Plain text version generated');
  };

  const saveTemplate = async () => {
    if (!templateData.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (!templateData.subject.trim()) {
      toast.error('Subject line is required');
      return;
    }

    if (!editableContent.trim()) {
      toast.error('Email content is required');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/email-marketing/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update template');
      }

      toast.success('Template updated successfully');
      router.push('/email-marketing/templates');
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const insertText = (tag: string, placeholder: string = 'Your text here') => {
    const newContent = editableContent + `<${tag}>${placeholder}</${tag}>`;
    handleContentChange(newContent);
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    const text = prompt('Enter link text:') || 'Click here';
    if (url) {
      const newContent = editableContent + `<a href="${url}" style="color: #007bff; text-decoration: none;">${text}</a>`;
      handleContentChange(newContent);
    }
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      const newContent = editableContent + `<img src="${url}" alt="Image" style="max-width: 100%; height: auto; margin: 20px 0;">`;
      handleContentChange(newContent);
    }
  };

  const insertSelectedLogo = () => {
    if (selectedLogo) {
      const logoHtml = `
        <div style="text-align: center; margin: 30px 0;">
          <img src="${selectedLogo}" alt="Company Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;">
        </div>
      `;
      const newContent = editableContent + logoHtml;
      handleContentChange(newContent);
      toast.success('Logo inserted successfully');
    } else {
      toast.error('Please select a logo first');
    }
  };

  const insertLogoFromUrl = () => {
    // Create a more professional logo with better styling
    const logoUrl = prompt('Enter your company logo URL:');
    if (logoUrl) {
      const logoHtml = `
        <div style="text-align: center; margin: 30px 0;">
          <img src="${logoUrl}" alt="Company Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;">
        </div>
      `;
      const newContent = editableContent + logoHtml;
      handleContentChange(newContent);
    }
  };

  const insertCompanyHeader = () => {
    const logoUrl = prompt('Enter your company logo URL:') || '';
    const companyName = prompt('Enter your company name:') || 'Your Company';
    const tagline = prompt('Enter tagline (optional):') || '';
    
    const headerHtml = `
      <table role="presentation" style="width: 100%; margin: 0 0 40px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 30px;">
        <tr>
          <td style="text-align: center;">
            ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" style="max-width: 180px; height: auto; margin-bottom: 15px;">` : ''}
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1f2937;">${companyName}</h1>
            ${tagline ? `<p style="margin: 8px 0 0 0; font-size: 16px; color: #6b7280;">${tagline}</p>` : ''}
          </td>
        </tr>
      </table>
    `;
    const newContent = editableContent + headerHtml;
    handleContentChange(newContent);
  };

  const insertButton = () => {
    const url = prompt('Enter button URL:');
    const text = prompt('Enter button text:') || 'Click Here';
    if (url) {
      const buttonHtml = `
        <table role="presentation" style="margin: 20px 0;">
          <tr>
            <td style="background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); border-radius: 8px; padding: 0;">
              <a href="${url}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${text}</a>
            </td>
          </tr>
        </table>
      `;
      const newContent = editableContent + buttonHtml;
      handleContentChange(newContent);
    }
  };

  const deleteTemplate = async () => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/email-marketing/templates/${templateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete template');
      }

      toast.success('Template deleted successfully');
      router.push('/email-marketing/templates');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const getPreviewWidth = () => {
    switch (previewMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  };

  if (loading) {
    return (
      <SidebarDemo>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Link href="/email-marketing/templates">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Templates
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-lg font-semibold">Edit Template</h1>
                <p className="text-sm text-muted-foreground">Modify your email template visually</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setCurrentTab('preview')}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline" onClick={deleteTemplate} disabled={deleting} className="text-red-600 hover:bg-red-50 border-red-300">
                {deleting ? 'Deleting...' : 'Delete Template'}
              </Button>
              <Button onClick={saveTemplate} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Update Template'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100vh-73px)]">
          {/* Settings Sidebar */}
          <div className="w-80 border-r border-border bg-background p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Template Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Template Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={templateData.name}
                      onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Welcome Email"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={templateData.subject}
                      onChange={(e) => setTemplateData(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Welcome to our platform!"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="type">Template Type</Label>
                    <Select 
                      value={templateData.template_type} 
                      onValueChange={(value: any) => setTemplateData(prev => ({ ...prev, template_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-sm text-muted-foreground">{type.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={templateData.category} 
                      onValueChange={(value) => setTemplateData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Active Template</Label>
                    <Switch
                      id="active"
                      checked={templateData.is_active}
                      onCheckedChange={(checked) => setTemplateData(prev => ({ ...prev, is_active: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Visual Editing Tools */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Insert</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => insertText('h1', 'Your Heading')}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Heading
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => insertText('p', 'Your paragraph text here.')}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Paragraph
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={insertLink}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={insertImage}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Image
                  </Button>
                                      <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={insertSelectedLogo}
                      disabled={!selectedLogo}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Insert Selected Logo
                    </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={insertCompanyHeader}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Company Header
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={insertButton}
                  >
                    <Palette className="h-4 w-4 mr-2" />
                    Button
                  </Button>
                </CardContent>
              </Card>

              {/* Logo Manager */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Company Logos</CardTitle>
                </CardHeader>
                <CardContent>
                  <LogoManager 
                    onLogoSelect={setSelectedLogo}
                    selectedLogo={selectedLogo}
                  />
                </CardContent>
              </Card>

              {/* Variables */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Template Variables</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-2 mt-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        Click to insert basic variables:
                      </p>
                      {[
                        '{{first_name}}',
                        '{{last_name}}',
                        '{{email}}',
                        '{{company_name}}',
                        '{{unsubscribe_url}}'
                      ].map((variable) => (
                        <Button
                          key={variable}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs font-mono"
                          onClick={() => {
                            const newContent = editableContent + ` ${variable}`;
                            handleContentChange(newContent);
                          }}
                        >
                          {variable}
                        </Button>
                      ))}
                    </TabsContent>
                    
                    <TabsContent value="analytics" className="space-y-2 mt-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        Click to insert analytics variables:
                      </p>
                      {analyticsVariables ? Object.entries(analyticsVariables).map(([key, value]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs font-mono"
                          onClick={() => {
                            const newContent = editableContent + ` {{${key}}}`;
                            handleContentChange(newContent);
                          }}
                          title={`Current value: ${value}`}
                        >
                          <div className="flex flex-col items-start">
                            <span>{`{{${key}}}`}</span>
                            <span className="text-[10px] text-muted-foreground truncate w-full">
                              {String(value).substring(0, 20)}...
                            </span>
                          </div>
                        </Button>
                      )) : (
                        <div className="text-xs text-muted-foreground">
                          Loading analytics data...
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col">
              <div className="border-b border-border px-6 py-3">
                <TabsList>
                  <TabsTrigger value="visual">Visual Editor</TabsTrigger>
                  <TabsTrigger value="html">HTML Code</TabsTrigger>
                  <TabsTrigger value="plain">Plain Text</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="visual" className="flex-1 p-6">
                <div className="h-full">
                  <div className="mb-4">
                    <Label htmlFor="visual-content">Email Content (Visual Editor)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Edit your email content visually. Use the sidebar tools to add elements.
                    </p>
                  </div>
                  <div 
                    className="h-[calc(100%-120px)] border rounded-lg p-4 bg-white overflow-auto"
                    style={{ minHeight: '400px' }}
                  >
                                         <div
                       contentEditable
                       className="outline-none min-h-full"
                       dangerouslySetInnerHTML={{ __html: editableContent }}
                       onBlur={(e) => {
                         if (e.currentTarget && e.currentTarget.innerHTML !== undefined) {
                           handleContentChange(e.currentTarget.innerHTML);
                         }
                       }}
                       style={{
                         fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                         lineHeight: '1.6',
                         color: '#333333'
                       }}
                     />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="html" className="flex-1 p-6">
                <div className="h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label htmlFor="html-editor">HTML Code</Label>
                      <p className="text-sm text-muted-foreground">
                        Edit the raw HTML code for your email template.
                      </p>
                    </div>
                  </div>
                  <Textarea
                    id="html-editor"
                    value={templateData.html_content}
                    onChange={(e) => setTemplateData(prev => ({ ...prev, html_content: e.target.value }))}
                    className="h-[calc(100%-80px)] resize-none font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="plain" className="flex-1 p-6">
                <div className="h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label htmlFor="plain-content">Plain Text Version</Label>
                      <p className="text-sm text-muted-foreground">
                        Fallback version for email clients that don't support HTML.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={generatePlainText}>
                      Generate from Content
                    </Button>
                  </div>
                  <Textarea
                    id="plain-content"
                    value={templateData.plain_content}
                    onChange={(e) => setTemplateData(prev => ({ ...prev, plain_content: e.target.value }))}
                    placeholder="Plain text version of your email..."
                    className="h-[calc(100%-80px)] resize-none"
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview" className="flex-1 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <div>
                    <h3 className="font-semibold">Live Preview</h3>
                    <p className="text-sm text-muted-foreground">
                      Subject: {templateData.subject || 'No subject set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={previewMode === 'desktop' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('desktop')}
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={previewMode === 'tablet' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('tablet')}
                    >
                      <Tablet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={previewMode === 'mobile' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('mobile')}
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 p-6 bg-muted/30">
                  <div 
                    className="mx-auto bg-white border rounded-lg shadow-sm overflow-hidden"
                    style={{ 
                      width: getPreviewWidth(),
                      minHeight: '600px'
                    }}
                  >
                    <div className="bg-gray-100 px-4 py-2 border-b text-sm text-gray-600">
                      From: Your Company &lt;no-reply@company.com&gt;
                    </div>
                    <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium">
                      {templateData.subject || 'Subject Line'}
                    </div>
                    <div 
                      className="p-4"
                      dangerouslySetInnerHTML={{ 
                        __html: templateData.html_content || '<p className="text-gray-500">No content yet...</p>'
                      }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </SidebarDemo>
  );
} 