const fs = require('fs');
const path = require('path');

interface Dirent {
  isDirectory(): boolean;
  name: string;
}

interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  deadline?: string;
}

interface Task {
  id: number;
  title: string;
  deadline?: string;
  progress: number;
  checklist: ChecklistItem[];
}

interface Project {
  name: string;
  description?: string;
  status: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  tasks: Task[];
}

const OLD_CRM_PATH = '/Users/solvifyab/Desktop/Mofi-next-all 3/mofi-next-placeholder';

async function extractProjectData(projectDir: string): Promise<Project> {
  const filePath = path.join(projectDir, 'page.tsx');
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract project name from directory
  const name = path.basename(projectDir);

  // Extract tasks array using a more precise regex
  const tasksMatch = content.match(/const\s+\[tasks,\s+setTasks\]\s*=\s*useState<Task\[\]>\(\[([\s\S]*?)\]\);/);
  const tasks: Task[] = [];
  
  if (tasksMatch) {
    const tasksContent = tasksMatch[1];
    // Match individual task objects
    const taskRegex = /{\s*id:\s*(\d+),\s*title:\s*"([^"]+)",\s*deadline:\s*"([^"]+)",\s*progress:\s*(\d+),\s*checklist:\s*\[([\s\S]*?)\]\s*}/g;
    
    let match;
    while ((match = taskRegex.exec(tasksContent)) !== null) {
      const [_, id, title, deadline, progress, checklistContent] = match;
      
      // Extract checklist items
      const checklistItems: ChecklistItem[] = [];
      const checklistRegex = /{\s*id:\s*(\d+),\s*text:\s*"([^"]+)",\s*done:\s*(false|true)(?:,\s*deadline:\s*"([^"]+)")?\s*}/g;
      
      let checklistMatch;
      while ((checklistMatch = checklistRegex.exec(checklistContent)) !== null) {
        const [_, itemId, text, done, itemDeadline] = checklistMatch;
        checklistItems.push({
          id: parseInt(itemId),
          text,
          done: done === 'true',
          ...(itemDeadline && { deadline: itemDeadline })
        });
      }
      
      tasks.push({
        id: parseInt(id),
        title,
        deadline,
        progress: parseInt(progress),
        checklist: checklistItems
      });
    }
  }

  // Extract project status (defaulting to "Active")
  const status = "Active";

  return {
    name,
    status,
    tasks
  };
}

async function migrateProjects() {
  const projectsDir = '/Users/solvifyab/Desktop/Mofi-next-all 3/mofi-next-placeholder/src/app/(MainBody)/projects';
  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isDirectory())
    .map((entry: Dirent) => path.join(projectsDir, entry.name));

  const projects: Project[] = [];

  for (const projectDir of projectDirs) {
    try {
      const projectData = await extractProjectData(projectDir);
      projects.push(projectData);
    } catch (error) {
      console.error(`Error processing project in directory ${projectDir}:`, error);
    }
  }

  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Save projects to JSON file
  const outputPath = path.join(dataDir, 'migrated-projects.json');
  fs.writeFileSync(outputPath, JSON.stringify(projects, null, 2));

  console.log(`Successfully migrated ${projects.length} projects to ${outputPath}`);
  console.log('Migrated projects:');
  projects.forEach(project => {
    console.log(`- ${project.name}`);
    console.log(`  Status: ${project.status}`);
    console.log(`  Tasks: ${project.tasks.length}`);
    project.tasks.forEach(task => {
      console.log(`    - ${task.title} (${task.checklist.length} checklist items)`);
    });
    console.log();
  });
}

migrateProjects().catch(console.error); 