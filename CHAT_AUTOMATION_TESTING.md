# 🤖 Live Chat Automation Testing Guide

## Overview
This guide shows you how to test the live chat automation integration with real-time visual feedback in the workflow builder.

## 🚀 How to Test Your Chat Automation

### Step 1: Set Up Your Workflow
1. Go to **Settings** → **Automation** (Cron Settings)
2. Click **"+ Create New Workflow"**
3. From the **Event Triggers** panel, drag **"Chat Message Received"** to the canvas
4. From the **AI & Automation** panel, drag **"Chatbot Integration"** to the canvas
5. Connect the two nodes by clicking and dragging between them

### Step 2: Configure Your Trigger
1. **Double-click** the "Chat Message Received" node
2. Configure:
   - **Event Type**: Chat Message Received
   - **Chat Platform**: Select your platform (or leave empty for all)
   - **Keywords**: Add keywords to trigger on (optional)
   - **Channel/Room**: Specify channel (optional)

### Step 3: Configure Your Chatbot
1. **Double-click** the "Chatbot Integration" node  
2. Configure:
   - **Chatbot Type**: Existing ChatWindow (recommended)
   - **AI Model**: Choose from GPT-4o, Claude, Gemini
   - **System Instructions**: Set personality/behavior
   - **Integrations**: Enable Projects, Calendar, AI Reasoning

### Step 4: Live Testing
1. **Save** your workflow first
2. Click **"💬 Test Chat Integration Live"** button
3. Watch the **real-time visual feedback**:
   - 🟡 **Yellow pulse**: Testing in progress
   - 🟢 **Green dot**: Test successful  
   - 🔴 **Red X**: Test failed with error details

### Step 5: Open Live Chat
1. Click **"🚀 Open Live Chat"** button (opens in new tab)
2. The chat will now use your automation workflow
3. Test with messages that match your trigger keywords

## 🎯 Visual Feedback System

### Node Status Indicators
- **🟡 Pulsing Yellow**: Node is currently being tested
- **🟢 Green Dot**: Node test passed successfully
- **🔴 Red X**: Node test failed (hover for error details)

### Workflow Header Status
- **"Testing..."**: Live test in progress
- **"Test Passed"**: All nodes tested successfully
- **"Test Failed"**: One or more nodes failed

### Node Details
Each node shows detailed status information:
- ✅ **Success**: Shows what worked
- ❌ **Error**: Shows specific error message
- 🧪 **Testing**: Shows progress indicator

## 🔧 Troubleshooting Common Issues

### ❌ "Workflow not found"
- Make sure you **saved** the workflow first
- Refresh the page and try again

### ❌ "No chat trigger node found"
- Drag a "Chat Message Received" trigger to your workflow
- Make sure it's properly connected

### ❌ "Chatbot API call failed"
- Check your AI model configuration
- Verify your API keys are set up correctly
- Try a different AI model

### ❌ "Platform mismatch"
- Your trigger is set to a specific platform
- Either change the platform setting or test with the correct platform

### ❌ "Keyword mismatch"
- Your message doesn't contain the required keywords
- Either remove keyword filters or use matching keywords

## 📊 Test Results Interpretation

### Successful Test Response
```json
{
  "success": true,
  "summary": {
    "trigger_activated": true,
    "chatbot_responded": true,
    "total_steps": 2,
    "successful_steps": 2
  }
}
```

### Failed Test Response
```json
{
  "success": false,
  "results": [
    {
      "step": "chat_trigger",
      "result": {
        "success": false,
        "error": "Keyword mismatch: message doesn't contain required keywords"
      }
    }
  ]
}
```

## 🎮 Advanced Testing Scenarios

### Test with Keywords
1. Set trigger keywords: `"help, support, question"`
2. Test messages:
   - ✅ "I need help with my project" → Should trigger
   - ❌ "Hello there" → Should NOT trigger

### Test with Platform Filter  
1. Set platform to "slack"
2. Test will simulate platform "automation_test"
3. Should fail with platform mismatch (expected behavior)

### Test Full Integration Chain
1. Create workflow: **Chat Trigger** → **Chatbot** → **AI Reasoning** → **Smart Calendar**
2. Run live test to see each step execute
3. Watch real-time visual feedback for each node

## 🚨 Live Testing Safety

- Tests run in **sandbox mode** - no real data is affected
- Test messages are clearly marked with `test: true`
- All test activity is logged to `automation_logs` table
- Tests timeout after 30 seconds to prevent hanging

## 📈 Next Steps After Testing

1. **Activate** your workflow (toggle status to "Active")
2. **Monitor** the automation logs for real triggers
3. **Refine** your configuration based on real usage
4. **Scale** by adding more complex workflow nodes

## 🔗 API Endpoints Used

- `/api/automation/chat-trigger` - Main chat automation endpoint
- `/api/test-chat-trigger-live` - Live testing endpoint  
- Database: `cron_jobs`, `automation_logs` tables

---

**💡 Pro Tip**: Keep the workflow builder open while testing to see real-time visual feedback as each node executes! 