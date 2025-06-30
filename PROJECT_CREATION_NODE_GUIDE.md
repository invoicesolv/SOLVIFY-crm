# 📋 Project Creation Node - Automation Guide

## Overview
The Project Creation Node allows you to automatically create projects in your workspace through automation workflows. This node can be triggered by various events and can extract project information from user messages or use predefined templates.

## 🚀 How to Set Up Project Creation Automation

### Step 1: Create a Workflow
1. Go to **Settings** → **Automation** (Cron Settings)
2. Click **"+ Create New Workflow"**
3. Give your workflow a descriptive name like "Auto Project Creator"

### Step 2: Add Trigger Node
From the **Event Triggers** panel, drag one of these triggers:
- **Chat Message Received** - For chat-based project creation
- **Form Submission** - For form-based project requests
- **API Webhook** - For external system integration
- **Email Received** - For email-based project requests

### Step 3: Add Project Creation Node
1. From the **Productivity** panel, drag **"Project Creation"** to the canvas
2. Connect your trigger node to the Project Creation node
3. **Double-click** the Project Creation node to configure it

### Step 4: Configure Project Creation Node
**Available Settings:**

#### Project Template
- **Description**: Template or default description for created projects
- **Example**: "New client project - requires initial consultation and proposal"
- **Variables**: Can include dynamic content based on trigger data

#### Auto-assign to Current User
- **Enabled**: Projects will be automatically assigned to the user who triggered the workflow
- **Disabled**: Projects will be created without assignment (can be assigned manually later)

## 🎯 Usage Scenarios

### Scenario 1: Chat-Based Project Creation
**Setup:**
- Trigger: Chat Message Received
- Keywords: "create project", "new project", "start project"
- Project Creation Node: Extract project name from message

**Example Messages:**
- "Create a new project called Website Redesign"
- "Start project for Mobile App Development"
- "Make a project named Client Onboarding"

**Result:** Project automatically created with extracted name and predefined template

### Scenario 2: Form-Based Project Requests
**Setup:**
- Trigger: Form Submission
- Form fields: project_name, project_description, client_name
- Project Creation Node: Use form data for project details

**Workflow:**
1. Client submits project request form
2. Form submission triggers workflow
3. Project created with form data
4. Notification sent to project manager

### Scenario 3: Email-Based Project Creation
**Setup:**
- Trigger: Email Received (with specific subject pattern)
- Email parsing: Extract project details from email content
- Project Creation Node: Create project with extracted information

**Example Email Subject:** "New Project Request: E-commerce Platform"

## 🔧 API Integration

### Direct API Call
```javascript
POST /api/automation/project-creation

{
  "workflowId": "workflow-uuid",
  "nodeId": "node-uuid", 
  "projectName": "My New Project",
  "projectDescription": "Project description",
  "projectTemplate": "Template from node config",
  "autoAssign": true,
  "context": {
    "trigger_type": "chat_automation",
    "user_id": "user-uuid"
  }
}
```

### Response Format
```javascript
{
  "success": true,
  "project": {
    "id": "project-uuid",
    "name": "My New Project", 
    "description": "Project description",
    "status": "active",
    "workspace_id": "workspace-uuid",
    "user_id": "user-uuid",
    "created_at": "2024-01-01T12:00:00Z"
  },
  "message": "Project 'My New Project' created successfully",
  "automation": {
    "workflow_id": "workflow-uuid",
    "node_id": "node-uuid",
    "auto_assigned": true
  }
}
```

## 🎨 Advanced Configuration

### Dynamic Project Names
The node can extract project names from various sources:

1. **Chat Messages**: Uses regex to find project names
   - Pattern: `create project called "Project Name"`
   - Pattern: `new project named Project Name`

2. **Form Data**: Uses form field values
   - Field: `project_name`
   - Field: `title`

3. **Default Fallback**: `Automated Project - [Current Date]`

### Template Variables
Project templates support dynamic variables:

```
**Project Template Example:**
New {{CLIENT_NAME}} project - {{PROJECT_TYPE}}
Requires initial consultation and proposal by {{DUE_DATE}}

**Auto-populated as:**
New Acme Corp project - Website Redesign  
Requires initial consultation and proposal by 2024-02-01
```

### Conditional Logic
Combine with other nodes for advanced workflows:

```
Chat Trigger → Condition Node → Project Creation Node
                      ↓
              Alternative Action Node
```

**Example Condition**: Only create project if message contains budget information

## 🔍 Testing Your Setup

### Method 1: Live Chat Test
1. Save your workflow with Project Creation node
2. Click **"💬 Test Chat Integration Live"** 
3. Send message: "Create a new project called Test Project"
4. Check if project appears in your Projects list

### Method 2: Manual API Test
Use the provided test script:
```bash
node test-project-creation-node.js
```

### Method 3: Workflow Builder Test
1. Select your workflow in the automation builder
2. Click **"🧪 Test Workflow"**
3. Verify Project Creation node executes successfully

## 📊 Monitoring & Logs

### Automation Logs
View project creation events in:
- **Settings** → **Automation** → **Logs**
- Filter by: `event_type: 'project_creation'`

### Project List
Check created projects in:
- **Projects** page
- Look for projects with automation-generated descriptions

### Debug Information
Enable debug mode to see:
- Node execution details
- Project creation API calls
- Error messages and stack traces

## 🚨 Troubleshooting

### Common Issues

#### ❌ "Workflow not found"
**Solution**: Ensure workflow is saved and has valid ID

#### ❌ "No workspace found" 
**Solution**: Verify user belongs to a workspace

#### ❌ "Project creation failed"
**Solutions**:
- Check database permissions
- Verify workspace_id is valid
- Ensure project name is not empty

#### ❌ "Node not executed"
**Solutions**:
- Verify node is connected to trigger
- Check trigger conditions are met
- Ensure workflow is active (not draft)

### Debug Steps
1. Check workflow status (active vs draft)
2. Verify node connections in workflow builder
3. Test trigger conditions manually
4. Review automation logs for errors
5. Check project creation API logs

## 🎯 Best Practices

### 1. Clear Naming Convention
Use descriptive project names that include:
- Client/customer name
- Project type
- Timeline indicator

### 2. Comprehensive Templates
Include in project templates:
- Project scope overview
- Key deliverables
- Timeline expectations
- Contact information

### 3. Proper Error Handling
- Set up fallback workflows for failed creation
- Include notification nodes for error cases
- Monitor automation logs regularly

### 4. Security Considerations
- Validate input data before project creation
- Implement proper access controls
- Log all automation activities

## 📈 Advanced Use Cases

### Multi-Step Project Setup
```
Chat Trigger → Project Creation → Task Creation → Calendar Event → Email Notification
```

### Client Onboarding Workflow
```
Form Submission → Project Creation → Customer Creation → Welcome Email → Calendar Scheduling
```

### Automated Project Templates
```
Project Type Detection → Template Selection → Project Creation → Team Assignment
```

## 🔗 Related Features

- **Task Creation Nodes**: Automatically add tasks to created projects
- **Calendar Integration**: Schedule project kickoff meetings
- **Email Automation**: Send project confirmation emails
- **Customer Management**: Link projects to customer records
- **Team Assignment**: Auto-assign team members based on project type

---

## 📞 Support

If you encounter issues with Project Creation Nodes:

1. Check this guide for troubleshooting steps
2. Review automation logs for error details
3. Test with simple scenarios first
4. Verify all prerequisites are met

**Happy Automating! 🚀** 