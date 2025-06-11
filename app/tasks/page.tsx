'use client';

import { PageTitle } from '@/components/ui/page-title';

export default function TasksPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle title="Tasks" subtitle="Manage your tasks and projects" />
      
      <div className="mt-8 p-8 bg-background border border-border dark:border-border rounded-lg text-center">
        <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
        <p className="text-muted-foreground">
          The tasks management feature is currently under development. Check back soon for updates.
        </p>
      </div>
    </div>
  );
} 