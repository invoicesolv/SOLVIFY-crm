import { useState, useEffect } from 'react';
import { X, Send, Save, Loader2, MessageSquare, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-client';
import { toast } from 'sonner';
import React from 'react';
import styles from '@/styles/email-content.module.css';

interface Email {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  from_email?: string;
  subject: string;
  date: string;
  body?: string;
  htmlBody?: string;
}

interface ResponseTemplate {
  id: string;
  name: string;
  prompt: string;
  language: string;
  type: string;
  content: string | null;
}

interface EmailPopupProps {
  email: Email | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
}

export function EmailPopup({ email, open, onOpenChange, workspaceId, userId }: EmailPopupProps) {
  const { session } = useAuth();
  const [responseText, setResponseText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedResponseType, setSelectedResponseType] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [responseTemplates, setResponseTemplates] = useState<ResponseTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ResponseTemplate | null>(null);
  const [emailBody, setEmailBody] = useState('');
  const [emailHtmlBody, setEmailHtmlBody] = useState('');
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [displayFormat, setDisplayFormat] = useState<'plain' | 'html'>('html');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailBodyFetched, setEmailBodyFetched] = useState(false);
  const [signature, setSignature] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [grammarStyle, setGrammarStyle] = useState<'formal' | 'casual'>('formal');
  const [grammarDialogOpen, setGrammarDialogOpen] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [improvedText, setImprovedText] = useState('');

  useEffect(() => {
    // Get user signature from profile or use a default one
    const fetchSignature = async () => {
      if (!userId) return; // Wait for userId
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('signature, full_name, email, title, company') // Fetch all needed fields
          .eq('id', userId)
          .single();
          
        if (error) throw error;
        
        if (profile?.signature) {
          setSignature(profile.signature);
        } else {
          // Set default signature using user info from profile
          const defaultSignature = `
          
--
${profile?.full_name || 'Your Name'}
${profile?.title || ''}
${profile?.company || ''}
${profile?.email || ''}
`;
          setSignature(defaultSignature);
          
          // Save default signature to profile
          await supabase
            .from('profiles')
            .update({ signature: defaultSignature })
            .eq('id', userId);
        }
      } catch (error) {
        console.error("Error fetching signature:", error);
        // Use a minimal fallback signature in case of an error
        setSignature(`
        
--
`);
      }
    };
    
    fetchSignature();
  }, [userId]);

  useEffect(() => {
    if (open && email) {
      // Reset state when opening popup
      setResponseText('');
      setSelectedResponseType('');
      setSelectedLanguage('English');
      setSelectedTemplate(null);
      setDisplayFormat('html');
      setIsEditing(false);
      setErrorMessage(null);
      setEmailBodyFetched(false);
      
      // Fetch email body if not already available
      if (!email.body) {
        fetchEmailBody(email.id);
      } else {
        setEmailBody(email.body);
        setEmailBodyFetched(true);
        if (email.htmlBody) {
          setEmailHtmlBody(email.htmlBody);
        }
      }
    }
  }, [open, email]);

  useEffect(() => {
    if (email && email.id && !emailBodyFetched && !isLoadingBody) {
      fetchEmailBody(email.id);
    }
  }, [email?.id, emailBodyFetched, isLoadingBody]); // Only depend on email.id, not the entire email object

  // Add debug logging for email body content
  useEffect(() => {
    if (displayFormat === 'html' && emailHtmlBody) {
      console.log('HTML Email Body available for parsing');
      // Setup a mutation observer to watch for image loading issues
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const images = document.querySelectorAll('.emailContent img');
            images.forEach((img) => {
              img.addEventListener('error', (e) => {
                console.error('Image failed to load:', (e.target as HTMLImageElement).src);
                // Mark broken images with a red border for easy identification
                (e.target as HTMLImageElement).style.border = '2px solid red';
              });
              
              img.addEventListener('load', () => {
                console.log('Image loaded successfully:', (img as HTMLImageElement).src);
              });
            });
          }
        });
      });
      
      // Wait for the email content to be rendered
      setTimeout(() => {
        const emailContentDiv = document.querySelector('.emailContent');
        if (emailContentDiv) {
          observer.observe(emailContentDiv, { childList: true, subtree: true });
          console.log('Observing email content for image issues');
        }
      }, 1000);
      
      return () => {
        observer.disconnect();
      };
    }
  }, [displayFormat, emailHtmlBody]);

  const fetchEmailBody = async (emailId: string) => {
    setIsLoadingBody(true);
    try {
      const response = await fetch(`/api/gmail/message?id=${emailId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gmail API error:', response.status, errorData);
        
        // Handle insufficient Gmail scopes
        if (response.status === 403 && errorData.code === 'INSUFFICIENT_GMAIL_SCOPES') {
          setErrorMessage('Gmail permissions are insufficient. Please reconnect your Gmail account with full permissions.');
          
          return; // Don't throw, just return to avoid further error handling
        }
        
        throw new Error(`Failed to fetch email body: ${response.status} ${errorData.error || 'Unknown error'}`);
      }
      const data = await response.json();
      setEmailBody(data.body || email?.snippet || '');
      setEmailHtmlBody(data.htmlBody || '');
      setEmailBodyFetched(true);
    } catch (error) {
      console.error('Error fetching email body:', error);
      toast.error('Failed to load email content');
      setEmailBody(email?.snippet || '');
      setEmailBodyFetched(true); // Mark as fetched even on error to prevent infinite retries
    } finally {
      setIsLoadingBody(false);
    }
  };




  const generateAIResponse = async () => {
    if (!email) {
      toast.error('No email loaded');
      return;
    }
    
    if (!selectedResponseType) {
      toast.error('Please select a tone');
      return;
    }
    
    if (!selectedLanguage) {
      toast.error('Please select a language');
      return;
    }
    
    setIsGenerating(true);
    setErrorMessage(null);
    
    try {
      // Get workspace API key
      const { data: settings, error: settingsError } = await supabase
        .from('workspace_settings')
        .select('openai_api_key')
        .eq('workspace_id', workspaceId)
        .single();
      
      if (settingsError) {
        console.error('Settings error:', settingsError);
        throw new Error(`Could not fetch API key: ${settingsError.message}`);
      }
      
      const apiKey = settings?.openai_api_key;
      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please add one in workspace settings.');
      }
      
      // Define tone-based prompts
      const tonePrompts = {
        professional: {
          English: 'Write a professional, formal response. Be concise, respectful, and clear.',
          Spanish: 'Escribe una respuesta profesional y formal. Sé conciso, respetuoso y claro.',
          Swedish: 'Skriv ett professionellt, formellt svar. Var koncis, respektfull och tydlig.'
        },
        casual: {
          English: 'Write a relaxed, conversational response. Be friendly and approachable.',
          Spanish: 'Escribe una respuesta relajada y conversacional. Sé amigable y accesible.',
          Swedish: 'Skriv ett avslappnat, konversationellt svar. Var vänlig och tillgänglig.'
        },
        friendly: {
          English: 'Write a warm, personal response. Be enthusiastic and positive.',
          Spanish: 'Escribe una respuesta cálida y personal. Sé entusiasta y positivo.',
          Swedish: 'Skriv ett varmt, personligt svar. Var entusiastisk och positiv.'
        }
      };

      // Map display language to actual language for AI
      const languageMap: Record<string, string> = {
        'English': 'English',
        'Spanish': 'Spanish',
        'Svenska': 'Swedish'
      };
      
      const aiLanguage = languageMap[selectedLanguage] || selectedLanguage;
      const tonePrompt = tonePrompts[selectedResponseType as keyof typeof tonePrompts]?.[aiLanguage as keyof typeof tonePrompts.professional];
      
      if (!tonePrompt) {
        throw new Error(`Unsupported tone/language combination: ${selectedResponseType}/${selectedLanguage}`);
      }
      
      // Special handling for Swedish to ensure it generates proper Swedish text
      let languageInstruction = `Write the response in ${aiLanguage}. `;
      if (aiLanguage === 'Swedish') {
        languageInstruction = `Write the response in Swedish (Svenska). The entire response must be in Swedish language. `;
      }
      
      // Add instruction to include signature
      const signatureInstruction = `End your email with this signature: "${signature}". Do not modify the signature.`;
      
      // Truncate email body if it's too long to prevent token limit issues
      const truncatedBody = truncateEmailBody(emailBody);
      
      // Create prompt
      const prompt = `${languageInstruction}${tonePrompt}

IMPORTANT: Write the email in a completely natural human voice. Avoid any AI-sounding language, formulaic phrases, or overly formal structures. Write as a real person would write an email to a colleague or business partner. Be concise and direct. Use natural transitions and conversational language.

Original Email:
Subject: ${email.subject}
From: ${email.from}

${truncatedBody}

${signatureInstruction}`;
      
      try {
        // Call OpenAI API
        const response = await fetch('/api/openai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            prompt,
            apiKey,
            model: 'gpt-3.5-turbo',
            max_tokens: 800
          }),
        });
        
        console.log('API response status:', response.status);
        
        const responseData = await response.json();
        
        if (!response.ok) {
          console.error('API error response:', responseData);
          throw new Error(responseData.error || `API error: ${response.status}`);
        }
        
        if (!responseData.text) {
          throw new Error('No response text received from API');
        }
        
        setResponseText(responseData.text);
        setIsEditing(true); // Enable editing after generation
        
        toast.success('Response generated successfully');
      } catch (apiError: any) {
        console.error('API call error:', apiError);
        throw new Error(`API error: ${apiError.message}`);
      }
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      toast.error(error.message || 'Failed to generate AI response');
      setErrorMessage(error.message || 'Failed to generate AI response');
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to rewrite user's response with selected tone
  const rewriteUserResponse = async () => {
    if (!responseText.trim()) {
      toast.error('Please write a response first');
      return;
    }
    
    if (!selectedResponseType) {
      toast.error('Please select a tone');
      return;
    }
    
    if (!selectedLanguage) {
      toast.error('Please select a language');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    
    try {
      // Get workspace API key
      const { data: settings, error: settingsError } = await supabase
        .from('workspace_settings')
        .select('openai_api_key')
        .eq('workspace_id', workspaceId)
        .single();
      
      if (settingsError) {
        console.error('Settings error:', settingsError);
        throw new Error(`Could not fetch API key: ${settingsError.message}`);
      }
      
      const apiKey = settings?.openai_api_key;
      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please add one in workspace settings.');
      }

      // Map display language to actual language for AI
      const languageMap: Record<string, string> = {
        'English': 'English',
        'Spanish': 'Spanish',
        'Svenska': 'Swedish'
      };
      
      const aiLanguage = languageMap[selectedLanguage] || selectedLanguage;
      
      // Create language instruction
      let languageInstruction = `Rewrite this email response in ${aiLanguage}. `;
      if (aiLanguage === 'Swedish') {
        languageInstruction = `Rewrite this email response in Swedish (Svenska). The entire response must be in Swedish language. `;
      }
      
      // Create tone-specific instructions
      let toneInstruction = '';
      switch (selectedResponseType.toLowerCase()) {
        case 'professional':
          toneInstruction = aiLanguage === 'Swedish' ? 
            'Använd en professionell, formell och respektfull ton. Var tydlig och koncis.' : 
            aiLanguage === 'Spanish' ? 
            'Usa un tono profesional, formal y respetuoso. Sé claro y conciso.' :
            'Use a professional, formal, and respectful tone. Be clear and concise.';
          break;
        case 'casual':
          toneInstruction = aiLanguage === 'Swedish' ? 
            'Använd en avslappnad, konversationsartad och vänlig ton. Var naturlig och lättillgänglig.' : 
            aiLanguage === 'Spanish' ? 
            'Usa un tono relajado, conversacional y amigable. Sé natural y accesible.' :
            'Use a relaxed, conversational, and friendly tone. Be natural and approachable.';
          break;
        case 'friendly':
          toneInstruction = aiLanguage === 'Swedish' ? 
            'Använd en varm, vänlig och personlig ton. Var entusiastisk och positiv.' : 
            aiLanguage === 'Spanish' ? 
            'Usa un tono cálido, amigable y personal. Sé entusiasta y positivo.' :
            'Use a warm, friendly, and personal tone. Be enthusiastic and positive.';
          break;
        default:
          toneInstruction = aiLanguage === 'Swedish' ? 
            'Förbättra tonen och gör den mer naturlig.' : 
            aiLanguage === 'Spanish' ? 
            'Mejora el tono y hazlo más natural.' :
            'Improve the tone and make it more natural.';
      }
      
      // Create simple prompt to rewrite the text with the selected tone
      const prompt = `${languageInstruction}${toneInstruction}

INSTRUCTIONS:
1. Keep the exact same meaning and core message
2. Rewrite it with the specified tone while preserving all important details
3. Fix any grammar, spelling, or punctuation errors
4. Make it sound natural and human
5. Don't add new information or change the intent
6. Keep it concise and appropriate for email communication

Original email response:
"${responseText.trim()}"

Please rewrite this email response with the specified tone and language.

End with this signature: "${signature}"`;

      console.log('Rewriting user response with prompt:', prompt);
      
      // Call OpenAI API
      const response = await fetch('/api/openai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          prompt,
          apiKey,
          model: 'gpt-3.5-turbo',
          max_tokens: 800
        }),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('API error response:', responseData);
        throw new Error(responseData.error || `API error: ${response.status}`);
      }
      
      if (!responseData.text) {
        throw new Error('No response text received from API');
      }
      
      // Store original text for potential undo
      setOriginalText(responseText);
      
      // Update response text with rewritten version
      setResponseText(responseData.text);
      setIsEditing(true);
      
      toast.success(`Response rewritten in ${selectedResponseType.toLowerCase()} tone`);
      
    } catch (error: any) {
      console.error('Error rewriting response:', error);
      toast.error(error.message || 'Failed to rewrite response');
      setErrorMessage(error.message || 'Failed to rewrite response');
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to truncate email body to avoid token limit issues
  const truncateEmailBody = (body: string): string => {
    // If body is less than 1000 characters, return as is
    if (body.length <= 1000) return body;
    
    // Extract first 500 and last 300 characters
    const firstPart = body.substring(0, 500);
    const lastPart = body.substring(body.length - 300);
    
    // Combine with a note about truncation
    return `${firstPart}\n\n[...Email truncated due to length...]\n\n${lastPart}`;
  };

  const sendResponse = async () => {
    if (!email || !responseText.trim()) {
      toast.error('Please enter a response');
      return;
    }
    
    if (!session?.access_token) {
      toast.error('Please sign in to send emails');
      return;
    }
    
    setIsSending(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          threadId: email.threadId,
          to: email.from_email || email.from,
          subject: `Re: ${email.subject}`,
          body: responseText,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Special handling for permission errors
        if (errorData.code === 'INSUFFICIENT_PERMISSION' || 
            errorData.message?.includes('insufficient permission') ||
            errorData.error?.includes('insufficient permission')) {
          setErrorMessage('Insufficient Gmail permissions. Please reconnect your account with full access.');
          
          const confirmReconnect = window.confirm(
            'Gmail API permissions are insufficient. Would you like to reconnect your Gmail account with full permissions now? This will open a new tab.'
          );
          
          if (confirmReconnect) {
            // Use the Supabase OAuth flow for Gmail authentication
            try {
              // Create state parameter with user ID and services
              const stateData = {
                userId: userId,
                services: ['google-gmail'],
                returnTo: '/gmail-hub'
              };
              const state = btoa(JSON.stringify(stateData));
              
              // Define Gmail-specific scopes - ONLY the broad scope to avoid metadata conflicts
              const gmailScopes = [
                'https://mail.google.com/' // ONLY this scope - it includes everything we need without metadata restrictions
                // REMOVED: All other Gmail scopes because they trigger Google to add gmail.metadata automatically
              ];
              
              // Redirect to OAuth with Google for Gmail scopes
              const scopeParam = encodeURIComponent(gmailScopes.join(' '));
              const authUrl = `/api/oauth/google?scopes=${scopeParam}&state=${state}&prompt=consent`;
              
              window.open(authUrl, '_blank');
            } catch (error) {
              console.error("Gmail reconnection error:", error);
              // Fallback to current page redirect if popup fails
              window.location.href = '/settings';
            }
          }
          
          throw new Error('Insufficient Permission: Please reconnect your Gmail account');
        }
        
        throw new Error(errorData.error || 'Failed to send email');
      }
      
      toast.success('Email sent successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
      setErrorMessage(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleResponseTypeChange = (type: string) => {
    setSelectedResponseType(type);
    updateSelectedTemplate(type, selectedLanguage);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    updateSelectedTemplate(selectedResponseType, language);
  };

  const updateSelectedTemplate = (type: string, language: string) => {
    // Convert display language name to database language name
    const databaseLanguageMap: Record<string, string> = {
      'English': 'English',
      'Spanish': 'Spanish',
      'Svenska': 'Swedish'
    };
    
    const dbLanguage = databaseLanguageMap[language] || language;
    console.log(`Looking for template with type=${type} and language=${dbLanguage}`);
    console.log("Available templates:", responseTemplates.map(t => ({ id: t.id, type: t.type, language: t.language })));
    
    // Perform case-insensitive matching
    const template = responseTemplates.find(t => 
      t.type.toLowerCase() === type.toLowerCase() && 
      t.language.toLowerCase() === dbLanguage.toLowerCase()
    );
    
    console.log("Selected template:", template);
    
    setSelectedTemplate(template || null);
    
    // Don't load any saved content - user writes their own response
    // setResponseText('');
    // setIsEditing(false);
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };

  // Add this new function to handle signature editing
  const handleSignatureEdit = async (newSignature: string) => {
    try {
      setSignature(newSignature);
      await supabase
        .from('profiles')
        .update({ signature: newSignature })
        .eq('id', userId);
      toast.success('Signature updated');
    } catch (error) {
      console.error('Error updating signature:', error);
      toast.error('Failed to update signature');
    }
  };

  // Add this function before the return statement to process HTML emails
  const processHtmlEmail = (html: string | undefined): string => {
    if (!html) return '<p>No HTML content available</p>';
    
    try {
      // Create a new DOMParser to parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Apply dark background to the body and main container
      const body = doc.body;
      if (body) {
        body.style.backgroundColor = '#121212';
        body.style.color = '#e0e0e0';
        body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
        body.style.padding = '1rem';
        body.style.margin = '0';
        body.style.minHeight = '100%';
      }
      
      // Force all text elements to have light color
      const textElements = doc.querySelectorAll('p, span, div, td, th, li, strong, b, em, i, a, h1, h2, h3, h4, h5, h6');
      textElements.forEach(el => {
        (el as HTMLElement).style.color = '#e0e0e0';
      });
      
      // Fix relative URLs for images
      const images = doc.querySelectorAll('img');
      images.forEach(img => {
        if (!img.src) return;
        
        // Special handling for Google Ads images
        if (img.alt === 'Google Ads' || img.src.includes('google') || img.src.includes('googleads')) {
          img.style.backgroundColor = 'transparent';
          img.style.display = 'block';
          img.style.margin = '8px auto';
        }
        
        // Handle content-id (cid:) images
        if (img.src.startsWith('cid:')) {
          const cidName = img.src.replace('cid:', '');
          // Extract contentId or attachment ID from the email - this will need to match with the Gmail API
          // We'll need to pass the message ID too for the Gmail API to fetch the attachment
          img.src = `/api/gmail/proxy-image?url=${encodeURIComponent(img.src)}&messageId=${email?.id || ''}&attachmentId=${encodeURIComponent(cidName)}`;
        }
        // Only modify other relative URLs, leave absolute URLs as is
        else if (!img.src.startsWith('http') && !img.src.startsWith('data:')) {
          img.src = `/api/gmail/proxy-image?url=${encodeURIComponent(img.src)}`;
        }
        
        // Add loading="lazy" to all images for better performance
        img.setAttribute('loading', 'lazy');
        
        // Add a max-width to prevent oversized images
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      });
      
      // Make all links open in a new tab
      const links = doc.querySelectorAll('a');
      links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.style.color = '#77b7ff';
      });
      
      // Fix inline styles for dark mode compatibility - more aggressive replacement
      const elements = doc.querySelectorAll('[style]');
      elements.forEach(el => {
        const currentStyle = el.getAttribute('style') || '';
        
        // Only process elements with style attributes
        if (currentStyle) {
          let newStyle = currentStyle;
          
          // Replace any kind of dark text colors with light colors for dark mode
          newStyle = newStyle.replace(/color:\s*(#000000|#000|black|rgb\(0,\s*0,\s*0\)|#111|#222|#333|#444|#555)/gi, 'color: #e0e0e0');
          
          // Replace white backgrounds with darker background for dark mode
          newStyle = newStyle.replace(/background-color:\s*(#ffffff|#fff|white|rgb\(255,\s*255,\s*255\))/gi, 'background-color: #1a1a1a');
          newStyle = newStyle.replace(/background:\s*(#ffffff|#fff|white|rgb\(255,\s*255,\s*255\))/gi, 'background: #1a1a1a');
          
          // Update the style attribute
          el.setAttribute('style', newStyle);
        }
      });
      
      // Apply dark mode to tables
      const tables = doc.querySelectorAll('table');
      tables.forEach(table => {
        (table as HTMLTableElement).style.backgroundColor = '#1a1a1a';
        (table as HTMLTableElement).style.border = '1px solid #333';
        (table as HTMLTableElement).style.borderCollapse = 'collapse';
        (table as HTMLTableElement).style.width = '100%';
        (table as HTMLTableElement).style.margin = '0.5rem 0';
        
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          (cell as HTMLTableCellElement).style.border = '1px solid #444';
          (cell as HTMLTableCellElement).style.padding = '0.5rem';
          (cell as HTMLTableCellElement).style.color = '#e0e0e0';
          (cell as HTMLTableCellElement).style.backgroundColor = '#1a1a1a';
        });
      });
      
      // Add an overall wrapper with important color rules
      const wrapper = doc.createElement('div');
      wrapper.setAttribute('style', 'color: #e0e0e0 !important; background-color: #121212 !important;');
      
      // Move all body children to this wrapper
      while (body.firstChild) {
        wrapper.appendChild(body.firstChild);
      }
      
      // Append wrapper back to body
      body.appendChild(wrapper);
      
      return doc.documentElement.outerHTML;
    } catch (error) {
      console.error('Error processing HTML email:', error);
      return html; // Return original HTML if processing fails
    }
  };

  // Function to open grammar check dialog
  const openGrammarCheck = () => {
    if (!responseText.trim()) {
      toast.error('Please enter text to check');
      return;
    }
    
    setOriginalText(responseText);
    setImprovedText('');
    setGrammarDialogOpen(true);
    // Automatically start checking
    performGrammarCheck(responseText, grammarStyle);
  };

  // Add a function to check grammar and clean up text
  const performGrammarCheck = async (text: string, style: 'formal' | 'casual') => {
    if (!text.trim()) {
      toast.error('Please enter text to check');
      return;
    }

    setIsCheckingGrammar(true);
    setErrorMessage(null);
    try {
      // First check if we need to fetch the workspace OpenAI API key
      const { data: settings, error: settingsError } = await supabase
        .from('workspace_settings')
        .select('openai_api_key')
        .eq('workspace_id', workspaceId)
        .single();
      
      if (settingsError) {
        console.error('Settings error:', settingsError);
        throw new Error(`Could not fetch API key: ${settingsError.message}`);
      }
      
      const apiKey = settings?.openai_api_key;
      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please add one in workspace settings.');
      }

      // Create grammar check prompt
      const detectedLanguage = detectLanguage(text);
      console.log('Detected language:', detectedLanguage);
      
      // Create language-specific instructions with style
      let languageInstruction = `Proofread and correct this text, making it ${style === 'formal' ? 'more formal and professional' : 'more casual and conversational'}:`;
      if (detectedLanguage === 'Swedish') {
        languageInstruction = `Korrekturläs och förbättra denna text på svenska. Gör texten ${style === 'formal' ? 'mer formell och professionell' : 'mer vardaglig och konversationsartad'}. Bevara meningen men förbättra grammatiken:`;
      } else if (detectedLanguage === 'Spanish') {
        languageInstruction = `Revisa y corrige este texto en español. Haz que el texto sea ${style === 'formal' ? 'más formal y profesional' : 'más casual y conversacional'}. Preserva el significado pero mejora la gramática:`;
      }
      
      const prompt = `${languageInstruction}\n\n${text}\n\nProvide only the corrected version without explanations.`;
      
      // Call OpenAI API
      const response = await fetch('/api/openai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          prompt,
          apiKey,
          model: 'gpt-3.5-turbo',
          max_tokens: 800
        }),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('API error response:', responseData);
        throw new Error(responseData.error || `API error: ${response.status}`);
      }
      
      if (!responseData.text) {
        throw new Error('No response text received from API');
      }
      
      // Update the improved text
      setImprovedText(responseData.text);
      
    } catch (error: any) {
      console.error('Error checking grammar:', error);
      toast.error(error.message || 'Failed to check grammar');
      setErrorMessage(error.message || 'Failed to check grammar');
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  // Apply improved text to response
  const applyImprovedText = () => {
    if (improvedText) {
      setResponseText(improvedText);
      setGrammarDialogOpen(false);
      toast.success('Corrected text applied');
    }
  };

  // Function to detect language from text (improved with more patterns)
  const detectLanguage = (text: string): 'English' | 'Swedish' | 'Spanish' => {
    // Swedish specific characters and common words
    const swedishPattern = /[åäöÅÄÖ]|och|att|det|är|jag|du|vi|hej|tack/g;
    // Spanish specific characters and common words
    const spanishPattern = /[áéíóúüñ¿¡]|que|es|el|la|por|con|hola|gracias/gi;
    
    // Count matches
    const swedishMatches = (text.match(swedishPattern) || []).length;
    const spanishMatches = (text.match(spanishPattern) || []).length;
    
    if (swedishMatches > spanishMatches && swedishMatches > 0) {
      return 'Swedish';
    } else if (spanishMatches > swedishMatches && spanishMatches > 0) {
      return 'Spanish';
    } else {
      return 'English'; // Default
    }
  };

  useEffect(() => {
    // Add CSS for the expanded response section
    const style = document.createElement('style');
    style.textContent = `
      .response-section.expanded {
        height: 60vh !important;
      }
      .response-section.expanded + .email-content,
      .email-content.shrunk {
        height: 15vh !important;
      }
      .responseTextarea {
        min-height: 150px !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add function to handle expanding the response section
  const expandResponseSection = () => {
    const responseSection = document.querySelector('.response-section');
    const emailContent = document.querySelector('.email-content');
    if (responseSection) {
      responseSection.classList.add('expanded');
    }
    if (emailContent) {
      emailContent.classList.add('shrunk');
    }
  };

  // Add function to handle collapsing the response section
  const collapseResponseSection = () => {
    const responseSection = document.querySelector('.response-section');
    const emailContent = document.querySelector('.email-content');
    if (responseSection) {
      responseSection.classList.remove('expanded');
    }
    if (emailContent) {
      emailContent.classList.remove('shrunk');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] w-[98vw] h-[90vh] flex flex-col bg-background border-border rounded-lg p-0 overflow-visible"
      onInteractOutside={(e) => {
        // Prevent clicks on popover content from closing dialog
        e.preventDefault();
      }}>
        <div className="sticky top-0 z-10 bg-background p-3 border-b border-border flex items-center justify-between">
          <div className="flex-1 mr-4 overflow-hidden">
            <h2 className="text-base text-foreground font-sans font-medium truncate">{email?.subject}</h2>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="font-medium truncate">{email?.from}</span>
              <span className="mx-2">•</span>
              <span>{email?.date ? new Date(email.date).toLocaleString() : ''}</span>
            </div>
          </div>
          
          <div className="flex gap-2 shrink-0">
            <div className="flex bg-background rounded-lg p-1">
              <button 
                className={`px-2 py-1 text-xs rounded-md transition-all ${displayFormat === 'plain' ? 'bg-gray-200 dark:bg-muted text-foreground' : 'text-muted-foreground hover:text-gray-800 dark:text-foreground'}`}
                onClick={() => setDisplayFormat('plain')}
              >
                Plain Text
              </button>
              <button 
                className={`px-2 py-1 text-xs rounded-md transition-all ${displayFormat === 'html' ? 'bg-gray-200 dark:bg-muted text-foreground' : 'text-muted-foreground hover:text-gray-800 dark:text-foreground'}`}
                onClick={() => setDisplayFormat('html')}
                disabled={!emailHtmlBody}
              >
                HTML
              </button>
            </div>
            
            <Button 
              onClick={sendResponse}
              disabled={isSending || !responseText.trim()}
              className="h-8 bg-background hover:bg-gray-200 dark:bg-muted text-foreground text-xs"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3 mr-1" />
                  Reply
                </>
              )}
            </Button>
            
            <Button
              variant="ghost" 
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-background"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Main email content - full height */}
          <div className="flex-1 overflow-auto p-4 h-[calc(100%-80px)]">
            {isLoadingBody ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              </div>
            ) : displayFormat === 'plain' ? (
              <div className="text-sm text-foreground dark:text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
                {emailBody || email?.snippet || 'No content available'}
              </div>
            ) : (
              <div 
                className="text-sm w-full h-full overflow-y-auto email-content"
                style={{ backgroundColor: '#121212' }}
              >
                <div 
                  className="h-full"
                  dangerouslySetInnerHTML={{ 
                    __html: processHtmlEmail(emailHtmlBody) || '<p>No HTML content available</p>' 
                  }}
                />
              </div>
            )}
          </div>
          
          {/* Collapsed reply area - initially hidden or minimal */}
          <div className="email-reply-area border-t border-border transition-all duration-300 ease-in-out flex flex-col bg-background overflow-hidden" style={{ height: '80px' }}>
            <div className="flex items-center p-2 justify-between">
              <Tabs defaultValue="manual" className="w-full">
                <div className="flex justify-between items-center">
                  <TabsList className="bg-transparent h-8">
                    <TabsTrigger 
                      value="manual" 
                      className="text-xs data-[state=active]:bg-gray-200 dark:bg-muted data-[state=active]:text-foreground"
                    >
                      Manual
                    </TabsTrigger>
                    <TabsTrigger 
                      value="ai" 
                      className="text-xs data-[state=active]:bg-gray-200 dark:bg-muted data-[state=active]:text-foreground"
                    >
                      AI-Assisted
                    </TabsTrigger>
                  </TabsList>
                  
                  <Button
                                          onClick={() => {
                       const replyArea = document.querySelector('.email-reply-area');
                       const isExpanded = replyArea?.getAttribute('data-expanded') === 'true';
                       
                       if (replyArea) {
                         if (isExpanded) {
                           (replyArea as HTMLElement).style.height = '80px';
                           replyArea.setAttribute('data-expanded', 'false');
                         } else {
                           (replyArea as HTMLElement).style.height = '300px';
                           replyArea.setAttribute('data-expanded', 'true');
                         }
                       }
                    }}
                    className="h-6 px-2 text-xs bg-transparent text-muted-foreground hover:text-foreground"
                    title="Expand/collapse reply area"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                  </Button>
                </div>
                
                <TabsContent value="manual" className="mt-1">
                  <div className="space-y-3">
                    {/* Step 1: Write your response */}
                    <div className="relative">
                      <Textarea 
                        placeholder="Write your email response here in your own words..."
                        className="w-full bg-transparent border-border/50 text-foreground focus:border-border dark:border-border focus:ring-neutral-800 font-sans resize-none h-[180px]"
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        onFocus={() => {
                          const replyArea = document.querySelector('.email-reply-area');
                          if (replyArea) {
                            (replyArea as HTMLElement).style.height = '300px';
                            replyArea.setAttribute('data-expanded', 'true');
                          }
                        }}
                      />
                    </div>
                    
                    {/* Step 2 & 3: Choose tone and rewrite */}
                    {responseText.trim() && (
                      <div className="border-t border-border/30 pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground font-medium">Polish your response:</span>
                          
                          <Select onValueChange={handleResponseTypeChange} value={selectedResponseType}>
                            <SelectTrigger className="h-8 w-32 text-xs bg-transparent border-border/50 text-foreground focus:border-border dark:border-border focus:ring-neutral-800">
                              <SelectValue placeholder="Tone" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border text-foreground z-[11000]" position="popper">
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Select onValueChange={handleLanguageChange} value={selectedLanguage}>
                            <SelectTrigger className="h-8 w-28 text-xs bg-transparent border-border/50 text-foreground focus:border-border dark:border-border focus:ring-neutral-800">
                              <SelectValue placeholder="Language" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border text-foreground z-[11000]" position="popper">
                              <SelectItem value="English">English</SelectItem>
                              <SelectItem value="Spanish">Spanish</SelectItem>
                              <SelectItem value="Swedish">Svenska</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button 
                            onClick={rewriteUserResponse}
                            disabled={isGenerating || !selectedResponseType || !selectedLanguage || !responseText.trim()}
                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Rewriting...
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-3 w-3 mr-1" />
                                Rewrite
                              </>
                            )}
                          </Button>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          I'll rewrite your response using a {selectedResponseType || 'selected'} tone while keeping your original intent.
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="ai" className="mt-1">
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Generate a fresh response from scratch based on the original email:
                    </div>
                    
                    <div className="flex gap-2 mb-2">
                      <Select onValueChange={handleResponseTypeChange} value={selectedResponseType}>
                        <SelectTrigger className="h-8 text-xs bg-transparent border-border/50 text-foreground focus:border-border dark:border-border focus:ring-neutral-800">
                          <SelectValue placeholder="Response Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground z-[11000]" position="popper">
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select onValueChange={handleLanguageChange} value={selectedLanguage}>
                        <SelectTrigger className="h-8 text-xs bg-transparent border-border/50 text-foreground focus:border-border dark:border-border focus:ring-neutral-800">
                          <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground z-[11000]" position="popper">
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Spanish">Spanish</SelectItem>
                          <SelectItem value="Swedish">Svenska</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button 
                        onClick={generateAIResponse}
                        disabled={isGenerating || !selectedResponseType || !selectedLanguage}
                        className="h-8 bg-background hover:bg-gray-200 dark:bg-muted text-foreground text-xs"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Generate
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <Textarea 
                      placeholder="Generated response will appear here..."
                      className="w-full bg-transparent border-border/50 text-foreground focus:border-border dark:border-border focus:ring-neutral-800 font-sans resize-none h-[140px]"
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      readOnly={false}
                    />
                    
                    {responseText && (
                      <div className="flex justify-end mt-2">
                        <Button 
                          onClick={toggleEditMode}
                          className="h-6 px-2 text-xs bg-background/80 hover:bg-gray-200 dark:bg-muted"
                          title={isEditing ? "Lock editing" : "Edit response"}
                        >
                          {isEditing ? "Lock" : "Edit"}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2 bg-red-900/50 border border-red-700 text-red-200 rounded text-sm">
            {errorMessage}
          </div>
        )}

        {/* Grammar check dialog - keep this unchanged */}
        <Dialog open={grammarDialogOpen} onOpenChange={setGrammarDialogOpen}>
          <DialogContent className="bg-background border-border text-foreground">
            <DialogHeader>
              <DialogTitle>Text Improvement</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                We'll clean up your text and fix any grammar issues.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">Style:</span>
                <div className="flex bg-background rounded-lg p-1">
                  <button
                    className={`px-2 py-1 text-xs rounded-md transition-all ${grammarStyle === 'formal' ? 'bg-gray-200 dark:bg-muted text-foreground' : 'text-muted-foreground hover:text-gray-800 dark:text-foreground'}`}
                    onClick={() => {
                      setGrammarStyle('formal');
                      if (originalText) performGrammarCheck(originalText, 'formal');
                    }}
                    disabled={isCheckingGrammar}
                  >
                    Formal
                  </button>
                  <button
                    className={`px-2 py-1 text-xs rounded-md transition-all ${grammarStyle === 'casual' ? 'bg-gray-200 dark:bg-muted text-foreground' : 'text-muted-foreground hover:text-gray-800 dark:text-foreground'}`}
                    onClick={() => {
                      setGrammarStyle('casual');
                      if (originalText) performGrammarCheck(originalText, 'casual');
                    }}
                    disabled={isCheckingGrammar}
                  >
                    Casual
                  </button>
                </div>
              </div>
              
              <Button
                onClick={() => {
                  if (originalText) performGrammarCheck(originalText, grammarStyle);
                }}
                disabled={isCheckingGrammar || !originalText}
                className="h-7 px-2 text-xs bg-background hover:bg-gray-200 dark:bg-muted text-foreground"
              >
                {isCheckingGrammar ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Checking...
                  </>
                ) : (
                  'Recheck'
                )}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 my-2">
              <div className="flex flex-col">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Original Text</h4>
                <div className="bg-background rounded-md p-2 text-foreground dark:text-neutral-300 text-sm overflow-y-auto h-[200px] whitespace-pre-wrap">
                  {originalText}
                </div>
              </div>
              <div className="flex flex-col">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Improved Text</h4>
                <div className="bg-background rounded-md p-2 text-foreground text-sm overflow-y-auto h-[200px] whitespace-pre-wrap">
                  {isCheckingGrammar ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Improving text...</span>
                    </div>
                  ) : improvedText ? (
                    improvedText
                  ) : (
                    <span className="text-foreground0">Improved text will appear here</span>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setGrammarDialogOpen(false)}
                className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-background"
              >
                Cancel
              </Button>
              <Button
                onClick={applyImprovedText}
                disabled={isCheckingGrammar || !improvedText}
                className="h-8 bg-background hover:bg-gray-200 dark:bg-muted text-foreground text-xs"
              >
                Apply Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
} 