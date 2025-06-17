"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export function DebugDragDrop() {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [droppedItems, setDroppedItems] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const items = ['Item 1', 'Item 2', 'Item 3'];

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: string) => {
    console.log('Drag started:', item);
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', item);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    console.log('Drag ended');
    setDraggedItem(null);
    e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const item = e.dataTransfer.getData('text/plain');
    console.log('Dropped:', item);
    
    if (item) {
      setDroppedItems(prev => [...prev, item]);
      toast.success(`Dropped ${item}!`);
    }
  };

  const clearDropped = () => {
    setDroppedItems([]);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🐛 Drag & Drop Debug Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Draggable Items */}
            <div>
              <h3 className="font-semibold mb-3">Draggable Items</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item}
                    className="p-3 border rounded-lg cursor-grab hover:border-primary/50 transition-colors active:scale-95 bg-blue-50 dark:bg-blue-900/20"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                  >
                    {item} {draggedItem === item && '(dragging...)'}
                  </div>
                ))}
              </div>
            </div>

            {/* Drop Zone */}
            <div>
              <h3 className="font-semibold mb-3">Drop Zone</h3>
              <div
                className={`min-h-40 border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
                  isDragOver 
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/50' 
                    : 'border-gray-300 bg-gray-50 dark:bg-gray-900/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragOver ? (
                  <div className="text-center text-blue-600">
                    <div className="text-xl mb-2">📦</div>
                    <div>Drop here!</div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <div className="text-xl mb-2">🎯</div>
                    <div>Drag items here</div>
                  </div>
                )}
                
                {droppedItems.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Dropped Items:</h4>
                    <div className="space-y-1">
                      {droppedItems.map((item, index) => (
                        <div key={index} className="text-sm bg-green-100 dark:bg-green-900/20 p-2 rounded">
                          ✅ {item}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={clearDropped} className="mt-2">
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debug Info */}
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium mb-2">Debug Info:</h4>
            <div className="text-sm space-y-1">
              <div>Dragged Item: {draggedItem || 'None'}</div>
              <div>Is Drag Over: {isDragOver ? 'Yes' : 'No'}</div>
              <div>Dropped Count: {droppedItems.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 