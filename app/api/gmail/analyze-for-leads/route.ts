import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Simple AI-like scoring based on email content analysis
function calculateLeadScore(email: any): number {
  let score = 0;
  const subject = (email.subject || '').toLowerCase();
  const snippet = (email.snippet || '').toLowerCase();
  const from = (email.from || '').toLowerCase();
  
  // Business indicators
  const businessKeywords = [
    'business', 'company', 'website', 'seo', 'marketing', 'service', 
    'inquiry', 'quote', 'proposal', 'project', 'looking for', 'need help',
    'consultation', 'partnership', 'collaboration', 'interested in'
  ];
  
  // High-value indicators
  const highValueKeywords = [
    'budget', 'investment', 'enterprise', 'urgent', 'asap', 'deadline',
    'ceo', 'cto', 'director', 'manager', 'founder'
  ];
  
  // Spam/low-value indicators (negative scoring)
  const spamKeywords = [
    'unsubscribe', 'newsletter', 'promotion', 'sale', 'discount',
    'free', 'congratulations', 'winner', 'claim', 'offer expires'
  ];
  
  // Check business keywords in subject and snippet
  businessKeywords.forEach(keyword => {
    if (subject.includes(keyword)) score += 15;
    if (snippet.includes(keyword)) score += 10;
  });
  
  // Check high-value indicators
  highValueKeywords.forEach(keyword => {
    if (subject.includes(keyword)) score += 20;
    if (snippet.includes(keyword)) score += 15;
    if (from.includes(keyword)) score += 10;
  });
  
  // Penalize spam indicators
  spamKeywords.forEach(keyword => {
    if (subject.includes(keyword)) score -= 25;
    if (snippet.includes(keyword)) score -= 15;
  });
  
  // Email structure scoring
  if (email.from_email && !email.from_email.includes('noreply')) score += 10;
  if (email.subject && email.subject.length > 10) score += 5;
  if (email.snippet && email.snippet.length > 50) score += 5;
  
  // Domain scoring (business domains get higher scores)
  if (email.from_email) {
    const domain = email.from_email.split('@')[1]?.toLowerCase();
    const businessDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    if (domain && !businessDomains.includes(domain)) {
      score += 15; // Custom domain suggests business
    }
  }
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

// Extract structured data from email content
function extractLeadData(email: any) {
  const subject = email.subject || '';
  const snippet = email.snippet || '';
  const fullText = `${subject} ${snippet}`.toLowerCase();
  
  const extractedData: any = {};
  
  // Try to extract company name
  const companyPatterns = [
    /(?:from|at|with|for)\s+([A-Z][a-zA-Z\s&.,]{2,30}(?:LLC|Inc|Corp|Ltd|Co))/i,
    /([A-Z][a-zA-Z\s&.,]{2,30}(?:LLC|Inc|Corp|Ltd|Co))/i
  ];
  
  for (const pattern of companyPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      extractedData.company = match[1].trim();
      break;
    }
  }
  
  // Try to extract phone number
  const phonePattern = /(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/;
  const phoneMatch = fullText.match(phonePattern);
  if (phoneMatch) {
    extractedData.phone = phoneMatch[1];
  }
  
  // Try to extract website
  const websitePattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/;
  const websiteMatch = fullText.match(websitePattern);
  if (websiteMatch) {
    extractedData.website = websiteMatch[1];
  }
  
  // Determine service interest
  const serviceKeywords = {
    'SEO': ['seo', 'search engine', 'ranking', 'google ranking'],
    'Web Development': ['website', 'web design', 'development', 'site'],
    'Marketing': ['marketing', 'advertising', 'promotion', 'campaign'],
    'Consulting': ['consultation', 'advice', 'strategy', 'consulting']
  };
  
  for (const [service, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(keyword => fullText.includes(keyword))) {
      extractedData.serviceInterest = service;
      break;
    }
  }
  
  return extractedData;
}

// Suggest initial stage based on email content
function suggestLeadStage(score: number, email: any): string {
  const snippet = (email.snippet || '').toLowerCase();
  
  if (snippet.includes('reply') || snippet.includes('response')) {
    return 'engaged';
  } else if (score >= 80) {
    return 'new_lead_hot';
  } else if (score >= 60) {
    return 'new_lead_warm';
  } else {
    return 'new_lead_cold';
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await request.json();

    // Get OAuth tokens
    const accessToken = (user as any).access_token;
    const refreshToken = (user as any).refresh_token;

    if (!accessToken) {
      return NextResponse.json({ 
        error: 'No Gmail integration found', 
        code: 'NO_INTEGRATION' 
      }, { status: 400 });
    }

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/api/oauth/google/callback'
        : 'https://crm.solvify.se/api/oauth/google/callback'
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch recent emails (last 30 days) that might be leads
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const query = `after:${Math.floor(thirtyDaysAgo.getTime() / 1000)} -in:sent -in:drafts -in:spam -in:trash`;
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50, // Analyze up to 50 recent emails
    });

    if (!response.data.messages) {
      return NextResponse.json({ potentialLeads: [] });
    }

    // Get detailed information for each email
    const potentialLeads: any[] = [];
    
    for (const message of response.data.messages.slice(0, 20)) { // Limit to 20 for performance
      try {
        const emailDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = emailDetails.data.payload?.headers || [];
        const fromHeader = headers.find(h => h.name === 'From');
        const subjectHeader = headers.find(h => h.name === 'Subject');
        const dateHeader = headers.find(h => h.name === 'Date');

        if (!fromHeader?.value) continue;

        // Parse email address from "Name <email>" format
        const fromMatch = fromHeader.value.match(/(.+?)\s*<(.+?)>/) || [null, fromHeader.value, fromHeader.value];
        const fromName = fromMatch[1]?.trim() || fromHeader.value;
        const fromEmail = fromMatch[2]?.trim() || fromHeader.value;

        const emailData = {
          id: message.id!,
          from: fromName,
          from_email: fromEmail,
          subject: subjectHeader?.value || '',
          snippet: emailDetails.data.snippet || '',
          date: dateHeader?.value || new Date().toISOString(),
        };

        // Calculate AI score
        const aiScore = calculateLeadScore(emailData);
        
        // Only include emails with a minimum score (potential leads)
        if (aiScore >= 30) {
          const extractedData = extractLeadData(emailData);
          const suggestedStage = suggestLeadStage(aiScore, emailData);
          
          potentialLeads.push({
            ...emailData,
            aiScore,
            suggestedStage,
            suggestedCategory: extractedData.serviceInterest || 'General Inquiry',
            extractedData
          });
        }
      } catch (error) {
        console.error('Error processing email:', error);
        // Continue with next email
      }
    }

    // Sort by AI score (highest first)
    potentialLeads.sort((a, b) => b.aiScore - a.aiScore);

    return NextResponse.json({ 
      potentialLeads,
      analyzed: response.data.messages.length,
      found: potentialLeads.length
    });

  } catch (error) {
    console.error('Error analyzing emails for leads:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze emails for leads' 
    }, { status: 500 });
  }
} 