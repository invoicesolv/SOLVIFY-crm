import fs from 'fs';
import path from 'path';
import { Project } from '@/types/project';

const OLD_CRM_PATH = '/Users/solvifyab/Desktop/Mofi-next-all 3/mofi-next-placeholder';
const API_URL = 'http://localhost:5001';

async function migrateProjects() {
  try {
    // Read projects from old CRM's local storage
    const projectsData = fs.readdirSync(path.join(OLD_CRM_PATH, 'src', 'data', 'projects'));
    const projects: Project[] = [];

    for (const file of projectsData) {
      if (file.endsWith('.json')) {
        const projectData = JSON.parse(fs.readFileSync(path.join(OLD_CRM_PATH, 'src', 'data', 'projects', file), 'utf-8'));
        projects.push(projectData);
      }
    }

    // Migrate projects to new system
    const response = await fetch(`${API_URL}/projects/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projects }),
    });

    if (!response.ok) {
      throw new Error(`Failed to migrate projects: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Migration successful:', result.message);
    console.log(`Migrated ${projects.length} projects`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateProjects(); 