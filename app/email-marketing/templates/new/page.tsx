"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { 
  ArrowLeft,
  Save,
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  Type,
  Image as ImageIcon,
  Link as LinkIcon,
  Palette
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { getActiveWorkspaceId } from '@/lib/permission';
import { SidebarDemo } from "@/components/ui/code.demo";

interface TemplateData {
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

const SAMPLE_TEMPLATES = {
  welcome: {
    name: 'Apple-Inspired Welcome',
    subject: 'Welcome to {{company_name}} — Let\'s get started',
    html_content: `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .dark-mode { background-color: #1a1a1a !important; color: #ffffff !important; }
      .dark-text { color: #ffffff !important; }
      .dark-bg { background-color: #2a2a2a !important; }
      .dark-border { border-color: #3a3a3a !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa;" class="dark-mode">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);" class="dark-bg dark-border">
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 24px; text-align: center; border-bottom: 1px solid #f0f0f0;" class="dark-border">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); border-radius: 12px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                <div style="color: white; font-size: 24px; font-weight: 600;">{{company_initial}}</div>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #1d1d1f; line-height: 1.2;" class="dark-text">Welcome to {{company_name}}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px; text-align: center;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 500; color: #1d1d1f;" class="dark-text">Hi {{first_name}},</h2>
              <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.47; color: #86868b;" class="dark-text">We're delighted to have you join us. Your account is ready, and we've prepared everything you need to get started on your journey.</p>
              
              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); border-radius: 8px; padding: 0;">
                    <a href="{{dashboard_url}}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 500; border-radius: 8px;">Get Started</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 32px 0 0; font-size: 15px; line-height: 1.33; color: #86868b;" class="dark-text">Need help? Our support team is here for you.</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 48px 48px; text-align: center; border-top: 1px solid #f0f0f0;" class="dark-border">
              <p style="margin: 0; font-size: 13px; color: #86868b;" class="dark-text">© {{year}} {{company_name}}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plain_content: `Welcome to {{company_name}} — Let's get started

Hi {{first_name}},

We're delighted to have you join us. Your account is ready, and we've prepared everything you need to get started on your journey.

Get started: {{dashboard_url}}

Need help? Our support team is here for you.

© {{year}} {{company_name}}. All rights reserved.`,
    category: 'Welcome',
    template_type: 'email' as const
  },
  newsletter: {
    name: 'Monday-Inspired Newsletter',
    subject: '🚀 {{newsletter_title}} — {{date}}',
    html_content: `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .dark-mode { background-color: #1a1a1a !important; color: #ffffff !important; }
      .dark-text { color: #ffffff !important; }
      .dark-text-muted { color: #a0a0a0 !important; }
      .dark-bg { background-color: #2a2a2a !important; }
      .dark-bg-card { background-color: #333333 !important; }
      .dark-border { border-color: #404040 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f6f7fb;" class="dark-mode">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 32px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);" class="dark-bg">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 32px; background: linear-gradient(135deg, #5B37B7 0%, #7F56D9 50%, #9A73E6 100%); text-align: center;">
              <h1 style="margin: 0 0 8px; font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">{{newsletter_title}}</h1>
              <p style="margin: 0; font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">{{date}}</p>
            </td>
          </tr>
          
          <!-- Welcome Section -->
          <tr>
            <td style="padding: 40px 40px 32px;">
              <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #1a1a1a;" class="dark-text">What's happening this week? 👋</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4a5568;" class="dark-text-muted">Here are the latest updates and insights from our team. We've got some exciting news to share!</p>
            </td>
          </tr>
          
          <!-- CTA Section -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <div style="background: linear-gradient(135deg, #f6f7fb 0%, #e2e8f0 100%); border-radius: 16px; padding: 32px; margin-bottom: 32px;" class="dark-bg-card">
                <h3 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #1a1a1a;" class="dark-text">Ready to explore?</h3>
                <p style="margin: 0 0 24px; font-size: 14px; color: #4a5568;" class="dark-text-muted">Discover all the new features in your dashboard</p>
                <table role="presentation" style="margin: 0 auto;">
                  <tr>
                    <td style="background: linear-gradient(135deg, #5B37B7 0%, #7F56D9 100%); border-radius: 12px; padding: 0;">
                      <a href="{{dashboard_url}}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 12px;">Explore Dashboard</a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plain_content: `🚀 {{newsletter_title}} — {{date}}

What's happening this week? 👋

Here are the latest updates and insights from our team. We've got some exciting news to share!

Ready to explore?
Discover all the new features in your dashboard: {{dashboard_url}}

You're receiving this because you're part of the {{company_name}} community
Unsubscribe: {{unsubscribe_url}} • Update preferences: {{preferences_url}}`,
    category: 'Newsletter',
    template_type: 'newsletter' as const
  },
  promotional: {
    name: 'Modern Promotional',
    subject: '{{offer_percentage}}% OFF — Limited time offer 🔥',
    html_content: `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Offer</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .dark-mode { background-color: #0d1117 !important; color: #ffffff !important; }
      .dark-text { color: #ffffff !important; }
      .dark-text-muted { color: #8b949e !important; }
      .dark-bg { background-color: #161b22 !important; }
      .dark-bg-card { background-color: #21262d !important; }
      .dark-border { border-color: #30363d !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f8fafc;" class="dark-mode">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);" class="dark-bg">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center; position: relative;">
              <div style="padding: 48px 32px 32px;">
                <div style="background-color: rgba(255,255,255,0.2); border-radius: 12px; padding: 16px 24px; display: inline-block; margin-bottom: 16px;">
                  <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Limited Time</span>
                </div>
                <h1 style="margin: 0 0 12px; font-size: 42px; font-weight: 800; color: #ffffff; line-height: 1.1;">{{offer_percentage}}% OFF</h1>
                <p style="margin: 0; font-size: 18px; color: rgba(255,255,255,0.9); font-weight: 500;">Everything you need, now at an incredible price</p>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1f2937; text-align: center;" class="dark-text">Hey {{first_name}}! 👋</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #6b7280; text-align: center;" class="dark-text-muted">This is your chance to get {{offer_description}} at an unbeatable price. But hurry — this offer expires soon!</p>
              
              <!-- CTA Section -->
              <div style="text-align: center;">
                <table role="presentation" style="margin: 0 auto; width: 100%;">
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 0;">
                      <a href="{{shop_url}}" style="display: block; padding: 18px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Shop Now & Save</a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plain_content: `{{offer_percentage}}% OFF — Limited time offer 🔥

Hey {{first_name}}! 👋

This is your chance to get {{offer_description}} at an unbeatable price. But hurry — this offer expires soon!

Use Code: {{promo_code}}
⏰ Expires: {{expiry_date}}

Shop Now & Save: {{shop_url}}

Free shipping on orders over {{free_shipping_threshold}}

Join {{customer_count}}+ happy customers
★★★★★ 4.9/5 from {{review_count}} reviews

{{company_name}} • {{company_address}}
Unsubscribe: {{unsubscribe_url}} • Preferences: {{preferences_url}}`,
    category: 'Sales',
    template_type: 'promotional' as const
  },
  transactional: {
    name: 'Klarna-Inspired Clean',
    subject: '{{first_name}}, your payment is complete ✓',
    html_content: `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Complete</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .dark-mode { background-color: #0a0a0a !important; color: #ffffff !important; }
      .dark-text { color: #ffffff !important; }
      .dark-text-muted { color: #a0a0a0 !important; }
      .dark-bg { background-color: #1a1a1a !important; }
      .dark-bg-card { background-color: #2a2a2a !important; }
      .dark-border { border-color: #3a3a3a !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #fafafa;" class="dark-mode">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" style="width: 100%; max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden;" class="dark-bg">
          
          <!-- Header with Status -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center;">
              <div style="width: 48px; height: 48px; background-color: #00D672; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <div style="color: white; font-size: 20px;">✓</div>
              </div>
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #0a0a0a;" class="dark-text">Payment complete</h1>
              <p style="margin: 0; font-size: 16px; color: #6b7280;" class="dark-text-muted">Your order has been successfully processed</p>
            </td>
          </tr>
          
          <!-- Actions -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="padding-right: 8px;">
                    <a href="{{order_url}}" style="display: block; width: 100%; padding: 12px 16px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px; text-align: center; box-sizing: border-box;" class="dark-bg">View Order</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plain_content: `{{first_name}}, your payment is complete ✓

Payment complete
Your order has been successfully processed

Order #{{order_number}} - {{order_date}}
Total: {{order_total}}

View Order: {{order_url}}
Download Receipt: {{invoice_url}}

Questions? Contact our support team
{{company_name}} • {{year}}`,
    category: 'Thank You',
    template_type: 'transactional' as const
  },
  minimal: {
    name: 'Minimal Premium',
    subject: 'Important update from {{company_name}}',
    html_content: `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Update</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .dark-mode { background-color: #000000 !important; color: #ffffff !important; }
      .dark-text { color: #ffffff !important; }
      .dark-text-muted { color: #888888 !important; }
      .dark-bg { background-color: #111111 !important; }
      .dark-border { border-color: #222222 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #ffffff;" class="dark-mode">
  <table role="presentation" style="width: 100%; border-collapse: collapse; min-height: 100vh;">
    <tr>
      <td style="padding: 60px 20px; text-align: center; vertical-align: middle;">
        <table role="presentation" style="width: 100%; max-width: 480px; margin: 0 auto;">
          
          <!-- Logo/Brand -->
          <tr>
            <td style="padding-bottom: 48px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #000000; letter-spacing: -0.02em;" class="dark-text">{{company_name}}</div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="text-align: left;">
              <h1 style="margin: 0 0 24px; font-size: 32px; font-weight: 700; color: #000000; line-height: 1.25; letter-spacing: -0.02em;" class="dark-text">{{headline}}</h1>
              
              <p style="margin: 0 0 32px; font-size: 18px; line-height: 1.6; color: #555555;" class="dark-text-muted">{{message}}</p>
              
              <!-- CTA -->
              <table role="presentation">
                <tr>
                  <td style="background-color: #000000; border-radius: 6px; padding: 0;" class="dark-bg">
                    <a href="{{cta_url}}" style="display: inline-block; padding: 16px 24px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 6px;" class="dark-text">{{cta_text}}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plain_content: `Important update from {{company_name}}

{{headline}}

{{message}}

{{details}}

{{cta_text}}: {{cta_url}}

Best regards,
The {{company_name}} Team

{{company_address}}
Unsubscribe: {{unsubscribe_url}}`,
    category: 'Announcement',
    template_type: 'email' as const
  }
};

export default function NewTemplatePage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const [templateData, setTemplateData] = useState<TemplateData>({
    name: '',
    subject: '',
    html_content: '',
    plain_content: '',
    template_type: 'email',
    category: 'Newsletter',
    is_active: true
  });

  useEffect(() => {
    const initializeWorkspace = async () => {
      if (user?.id) {
        try {
          const activeWorkspaceId = await getActiveWorkspaceId(user.id);
          setWorkspaceId(activeWorkspaceId);
        } catch (error) {
          console.error('Error getting workspace ID:', error);
        }
      }
    };
    
    initializeWorkspace();
  }, [user?.id]);

  const loadSampleTemplate = (templateKey: keyof typeof SAMPLE_TEMPLATES) => {
    const sample = SAMPLE_TEMPLATES[templateKey];
    setTemplateData(prev => ({
      ...prev,
      subject: sample.subject,
      html_content: sample.html_content,
      plain_content: sample.plain_content,
      template_type: sample.template_type,
      category: sample.category
    }));
    toast.success('Sample template loaded');
  };

  const generatePlainText = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = templateData.html_content;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    setTemplateData(prev => ({
      ...prev,
      plain_content: plainText.replace(/\s+/g, ' ').trim()
    }));
    toast.success('Plain text version generated');
  };

  const saveTemplate = async () => {
    if (!workspaceId || !session?.user?.id) {
      toast.error('Unable to save template');
      return;
    }

    if (!templateData.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (!templateData.subject.trim()) {
      toast.error('Subject line is required');
      return;
    }

    if (!templateData.html_content.trim()) {
      toast.error('Email content is required');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/email-marketing/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save template');
      }

      toast.success('Template saved successfully');
      router.push('/email-marketing/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  };

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
                <h1 className="text-lg font-semibold">Create New Template</h1>
                <p className="text-sm text-muted-foreground">Design your email template</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => {}}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={saveTemplate} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Template'}
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

              {/* Quick Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Start</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => loadSampleTemplate('welcome')}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Welcome Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => loadSampleTemplate('newsletter')}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Newsletter
                  </Button>
                </CardContent>
              </Card>

              {/* Variables */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Available Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {[
                        '{{first_name}}',
                        '{{last_name}}',
                        '{{email}}',
                        '{{company_name}}',
                        '{{date}}',
                        '{{year}}',
                        '{{unsubscribe_url}}'
                      ].map(variable => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Use these variables in your template content. They will be replaced with actual values when sending emails.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <Tabs value="design" className="flex-1 flex flex-col">
              <div className="border-b border-border px-6 py-3">
                <TabsList>
                  <TabsTrigger value="design">Design</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="plain">Plain Text</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="design" className="flex-1 p-6">
                <div className="h-full">
                  <div className="mb-4">
                    <Label htmlFor="html-content">Email Content (HTML)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Design your email using HTML. You can use variables like {`{{first_name}}`} for personalization.
                    </p>
                  </div>
                  <Textarea
                    id="html-content"
                    value={templateData.html_content}
                    onChange={(e) => setTemplateData(prev => ({ ...prev, html_content: e.target.value }))}
                    placeholder="<div>Your email content here...</div>"
                    className="h-[calc(100%-120px)] resize-none font-mono text-sm"
                  />
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
                      Generate from HTML
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
                    <h3 className="font-semibold">Preview</h3>
                    <p className="text-sm text-muted-foreground">
                      Subject: {templateData.subject || 'No subject set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewDevice('desktop')}
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={previewDevice === 'tablet' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewDevice('tablet')}
                    >
                      <Tablet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewDevice('mobile')}
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900 overflow-auto">
                  <div className="mx-auto transition-all duration-300" style={{ width: getPreviewWidth() }}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-border min-h-96">
                      {templateData.html_content ? (
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: templateData.html_content
                              .replace(/\{\{first_name\}\}/g, 'John')
                              .replace(/\{\{last_name\}\}/g, 'Doe')
                              .replace(/\{\{email\}\}/g, 'john.doe@example.com')
                              .replace(/\{\{company_name\}\}/g, 'Your Company')
                              .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
                              .replace(/\{\{year\}\}/g, new Date().getFullYear().toString())
                          }}
                          className="p-4"
                        />
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <Type className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Start designing your email template</p>
                          <p className="text-sm">Content will appear here as you type</p>
                        </div>
                      )}
                    </div>
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