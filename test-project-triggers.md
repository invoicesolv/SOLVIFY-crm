# Project Trigger Testing Guide

## 🚀 How to Test Project Triggers and See Server Logs

This guide will help you test project completion and progress milestone triggers to verify they appear in your server logs.

## Available Test Endpoints

### 1. Test 25% Progress Milestone
```bash
curl -X POST http://localhost:3000/api/test-project-triggers \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"testType": "progress_25"}'
```

### 2. Test Project Completion
```bash
curl -X POST http://localhost:3000/api/test-project-triggers \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"testType": "completion"}'
```

### 3. Test Status Change
```bash
curl -X POST http://localhost:3000/api/test-project-triggers \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"testType": "status_change"}'
```

### 4. Test All Triggers
```bash
curl -X POST http://localhost:3000/api/test-project-triggers \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"testType": "all"}'
```

## Expected Server Log Output

When you run these tests, you should see colorful, detailed logs in your server console:

### 🎯 Project Trigger Logs
```
[🧪 PROJECT TRIGGER TEST] Starting test: { testType: 'completion', userId: 'xxx', timestamp: '2025-06-22T...' }
[🧪 PROJECT TRIGGER TEST] Creating test project...
[✅ PROJECT TRIGGER TEST] Test project created: abc123-def456-...
[🧪 PROJECT TRIGGER TEST] Creating test tasks...
[✅ PROJECT TRIGGER TEST] Test tasks created
[🎯 PROJECT TRIGGER TEST] Testing project completion...
[🎯 PROJECT TRIGGER] Event received: { projectId: 'abc123', triggerType: 'completion', ... }
[📊 PROJECT TRIGGER] Project details: { id: 'abc123', name: 'Test Project for Triggers', status: 'completed' }
[✅ PROJECT TRIGGER] Completion check: { shouldTrigger: true, currentStatus: 'completed' }
[🚀 PROJECT TRIGGER] TRIGGER ACTIVATED! { projectId: 'abc123', projectName: 'Test Project for Triggers', triggerType: 'completion', triggerReason: 'Project marked as completed' }
[💾 PROJECT TRIGGER] Event logged to database successfully
[🎉 PROJECT TRIGGER TEST] Test completed!
```

### 📈 Progress Milestone Logs
```
[📊 PROJECT PROGRESS] Calculating progress for project: abc123-def456-...
[📊 PROJECT PROGRESS] Calculation complete: { projectId: 'abc123', totalTasks: 4, completedTasks: 1, progressPercentage: 25 }
[📈 PROJECT TRIGGER] Progress milestone check: { currentProgress: 25, targetPercentage: 25, shouldTrigger: true, triggerReason: 'Project reached 25% progress' }
[🚀 PROJECT TRIGGER] TRIGGER ACTIVATED! { projectId: 'abc123', triggerType: 'progress_milestone', triggerReason: 'Project reached 25% progress (target: 25%)' }
```

## 🔧 How to Run Tests

### Option 1: Using Your Browser DevTools
1. Open your browser DevTools (F12)
2. Go to the Console tab
3. Run this JavaScript:

```javascript
fetch('/api/test-project-triggers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ testType: 'all' })
})
.then(response => response.json())
.then(data => console.log('Test Results:', data))
.catch(error => console.error('Error:', error));
```

### Option 2: Using a REST Client (Postman, Insomnia, etc.)
- **URL**: `http://localhost:3000/api/test-project-triggers`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**: `{"testType": "all"}`

### Option 3: From Your Frontend Code
Add this button to any page in your app:

```jsx
const testProjectTriggers = async () => {
  try {
    const response = await fetch('/api/test-project-triggers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ testType: 'all' })
    });
    
    const result = await response.json();
    console.log('Project trigger test results:', result);
    alert('Check your server logs! Triggers activated: ' + result.results?.length);
  } catch (error) {
    console.error('Test failed:', error);
  }
};

<button onClick={testProjectTriggers}>
  🧪 Test Project Triggers
</button>
```

## 🎯 What Happens When You Test

1. **Test Project Creation**: A test project named "Test Project for Triggers" is created
2. **Test Tasks Creation**: 4 test tasks are created (1 completed, 1 in progress, 2 todo)
3. **Progress Calculation**: System calculates 25% completion (1/4 tasks done)
4. **Trigger Activation**: Based on the test type, different triggers fire
5. **Database Logging**: All events are logged to the `automation_logs` table
6. **Server Logs**: Detailed, colorful logs appear in your server console

## 🔍 Troubleshooting

If you don't see logs:
- Make sure your Next.js dev server is running (`npm run dev`)
- Check that you're authenticated (logged in to your app)
- Verify the API endpoints are accessible
- Look for any error messages in the server console

## ✅ Success Indicators

You'll know the system is working when you see:
- 🚀 "TRIGGER ACTIVATED!" messages in your logs
- 💾 "Event logged to database successfully" messages
- Detailed trigger data with emojis and timestamps
- No error messages during the test process

This system will help you verify that your automation trigger system is working correctly! 