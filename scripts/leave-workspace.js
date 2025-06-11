// Helper script to leave a workspace
// Usage: node scripts/leave-workspace.js [workspace_id]

const https = require('https');

const BASE_URL = 'https://crm.solvify.se';

async function listWorkspaces() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'crm.solvify.se',
      path: '/api/workspace/leave',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function leaveWorkspace(workspaceId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ workspace_id: workspaceId });
    
    const options = {
      hostname: 'crm.solvify.se',
      path: '/api/workspace/leave',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const workspaceId = process.argv[2];

  if (!workspaceId) {
    console.log('📋 Listing your workspaces...\n');
    
    try {
      const result = await listWorkspaces();
      
      if (result.success && result.workspaces) {
        console.log('Your workspaces:');
        result.workspaces.forEach((w, i) => {
          console.log(`${i + 1}. ${w.name} (${w.id}) - Role: ${w.role}`);
        });
        console.log('\n🔧 To leave a workspace, run:');
        console.log('node scripts/leave-workspace.js [workspace_id]');
      } else {
        console.log('❌ Error:', result.error || 'Unknown error');
      }
    } catch (error) {
      console.log('❌ Error fetching workspaces:', error.message);
    }

    return;
  }

  console.log(`🚪 Attempting to leave workspace: ${workspaceId}\n`);

  try {
    const result = await leaveWorkspace(workspaceId);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
    } else {
      console.log('❌ Error:', result.error);
      if (result.isLastAdmin) {
        console.log('⚠️  You are the last admin. Other members:', result.otherMembers);
      }
    }
  } catch (error) {
    console.log('❌ Error leaving workspace:', error.message);
  }
}

main().catch(console.error); 