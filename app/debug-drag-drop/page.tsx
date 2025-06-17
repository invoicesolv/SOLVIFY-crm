import { DebugDragDrop } from '@/components/debug-drag-drop';

export default function DebugDragDropPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Drag & Drop Debug Test</h1>
        <DebugDragDrop />
      </div>
    </div>
  );
} 