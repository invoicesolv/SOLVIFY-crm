# 📧 Email Marketing System Testing Guide

## 🚀 Quick Setup & Testing

### 1. Environment Variables Setup

Add these to your `.env.local`:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password

# Or use SendGrid (recommended for production)
SENDGRID_API_KEY=your-sendgrid-api-key

# Or use Mailgun
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain

# For custom SMTP
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

### 2. Test Database Connection

First, verify your Supabase connection:

```bash
# Check if tables were created successfully
npm run dev
# Navigate to your Supabase dashboard > SQL Editor
# Run: SELECT * FROM email_campaigns LIMIT 5;
```

## 🧪 Testing Scenarios

### Scenario 1: Create & Send Your First Campaign

1. **Navigate to Email Marketing**
   ```
   http://localhost:3000/email-marketing
   ```

2. **Create New Campaign**
   - Click "Create Campaign"
   - Fill in campaign details:
     ```
     Name: Test Welcome Email
     Subject: Welcome to Our Amazing Platform! 🎉
     From Name: Your Company
     From Email: noreply@yourcompany.com
     ```

3. **Select Recipients**
   - Create a test contact list with 2-3 email addresses
   - **Use your own email addresses for testing!**

4. **Choose Template**
   - Select "Apple Inspired" template
   - Customize the content

5. **Send Test Campaign**
   - Choose "Send Now"
   - Watch the real-time progress bar! ✨

### Scenario 2: Test Email Tracking

1. **Send Campaign to Your Email**
   - Use your personal email as recipient

2. **Check Your Inbox**
   - Open the email (this triggers open tracking)
   - Click any links in the email (this triggers click tracking)

3. **View Analytics**
   - Go back to campaign details page
   - Refresh to see updated stats
   - You should see 1 open and 1 click!

### Scenario 3: Test Automation Builder

1. **Create New Automation**
   ```
   http://localhost:3000/email-marketing/automation
   ```

2. **Build Welcome Series**
   - Click "Create Automation"
   - Name: "Welcome Series Test"
   - Drag "Contact Added to List" trigger
   - Drag "Send Email" action
   - Connect them visually

3. **Test the Flow**
   - Add a contact to your list
   - Automation should trigger automatically

## 🔧 Advanced Testing

### Test Email Delivery Providers

Create this test script: `test-email-delivery.js`

```javascript
// Test different email providers
const testProviders = async () => {
  const testEmail = {
    to: 'your-test@email.com',
    subject: 'Provider Test',
    html: '<h1>Testing Email Provider</h1>'
  };

  // Test Gmail
  const gmailResult = await fetch('/api/email-marketing/send-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'gmail',
      ...testEmail
    })
  });

  // Test SendGrid
  const sendgridResult = await fetch('/api/email-marketing/send-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'sendgrid',
      ...testEmail
    })
  });

  console.log('Gmail:', gmailResult.status);
  console.log('SendGrid:', sendgridResult.status);
};
```

### Test Tracking Pixels

1. **Manual Tracking Test**
   ```
   # Open tracking
   http://localhost:3000/api/email-marketing/track/open/CAMPAIGN_ID/CONTACT_ID
   
   # Click tracking
   http://localhost:3000/api/email-marketing/track/click/CAMPAIGN_ID/CONTACT_ID?url=https://google.com
   ```

2. **Check Database**
   ```sql
   -- Check opens
   SELECT * FROM email_campaign_opens ORDER BY opened_at DESC LIMIT 10;
   
   -- Check clicks
   SELECT * FROM email_campaign_clicks ORDER BY clicked_at DESC LIMIT 10;
   ```

## 🎯 Performance Testing

### Load Test Campaign Sending

```javascript
// Test sending to multiple recipients
const loadTest = async () => {
  const recipients = Array.from({length: 100}, (_, i) => ({
    email: `test${i}@example.com`,
    name: `Test User ${i}`
  }));

  const campaign = await fetch('/api/email-marketing/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Load Test Campaign',
      recipients: recipients,
      html_content: '<h1>Load Test Email</h1>',
      schedule_type: 'now'
    })
  });

  // Monitor sending progress
  const campaignData = await campaign.json();
  
  const checkProgress = setInterval(async () => {
    const progress = await fetch(`/api/email-marketing/send-campaign?campaignId=${campaignData.id}`);
    const data = await progress.json();
    
    console.log(`Progress: ${data.sent}/${data.total} sent`);
    
    if (data.status === 'completed') {
      clearInterval(checkProgress);
      console.log('Load test completed!');
    }
  }, 2000);
};
```

## 🐛 Debugging & Troubleshooting

### Common Issues & Solutions

1. **Emails Not Sending**
   ```bash
   # Check console logs
   npm run dev
   # Look for SMTP/API errors in terminal
   ```

2. **Tracking Not Working**
   ```javascript
   // Test tracking URLs manually
   fetch('/api/email-marketing/track/open/test-campaign/test-contact')
     .then(res => console.log('Open tracking:', res.status));
   ```

3. **Database Connection Issues**
   ```sql
   -- Verify tables exist
   \dt email_*
   
   -- Check permissions
   SELECT * FROM information_schema.table_privileges 
   WHERE table_name LIKE 'email_%';
   ```

### Enable Debug Mode

Add to your component:

```javascript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Campaign data:', campaignData);
  console.log('Email config:', emailConfig);
  console.log('Recipients:', recipients);
}
```

## ✅ Testing Checklist

### Basic Functionality
- [ ] Create email campaign
- [ ] Send test email
- [ ] Receive email in inbox
- [ ] Open tracking works
- [ ] Click tracking works
- [ ] Real-time progress updates
- [ ] Campaign analytics display

### Advanced Features
- [ ] Multiple email providers work
- [ ] Rate limiting prevents spam
- [ ] Bounce handling works
- [ ] Automation triggers correctly
- [ ] Visual workflow builder functional
- [ ] Contact segmentation works

### Performance
- [ ] Handles 100+ recipients
- [ ] No memory leaks during sending
- [ ] Database queries optimized
- [ ] UI remains responsive

### Security
- [ ] Email content properly sanitized
- [ ] Tracking URLs secured
- [ ] User permissions enforced
- [ ] No email injection vulnerabilities

## 🎉 Success Metrics

Your email marketing system is working perfectly when you see:

1. **📈 Real-time Analytics**
   - Open rates updating live
   - Click tracking functional
   - Device breakdown showing

2. **⚡ Fast Delivery**
   - Emails arrive within 1-2 minutes
   - Progress bar updates smoothly
   - No failed sends

3. **🎨 Beautiful UI**
   - Animations smooth and responsive
   - Real-time updates working
   - Professional appearance

4. **🔧 Reliable Automation**
   - Workflows trigger correctly
   - Visual builder functional
   - Connections working

## 🚀 Next Steps

Once basic testing is complete:

1. **Set up production email provider** (SendGrid recommended)
2. **Configure domain authentication** (DKIM, SPF, DMARC)
3. **Add more email templates**
4. **Implement A/B testing**
5. **Add advanced segmentation**
6. **Set up monitoring alerts**

---

**🎯 Pro Tip:** Always test with your own email addresses first, then gradually add real recipients. Your email marketing system is now enterprise-ready! 

Need help with any specific testing scenario? Let me know! 🚀 