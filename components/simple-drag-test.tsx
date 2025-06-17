"use client";

import { useState } from 'react';

export function SimpleDragTest() {
  const [dragCount, setDragCount] = useState(0);
  const [dropCount, setDropCount] = useState(0);

  return (
    <div className="p-4 space-y-4 bg-white border rounded-lg">
      <h3 className="font-bold">🧪 Simple Drag Test</h3>
      
      {/* Draggable Item */}
      <div
        className="p-4 bg-blue-100 border-2 border-blue-300 rounded cursor-grab select-none"
        draggable={true}
        onDragStart={(e) => {
          console.log('Simple drag started!');
          setDragCount(prev => prev + 1);
          e.dataTransfer.setData('text/plain', 'test-data');
          e.currentTarget.style.opacity = '0.5';
        }}
        onDragEnd={(e) => {
          console.log('Simple drag ended!');
          e.currentTarget.style.opacity = '1';
        }}
      >
        📦 DRAG ME (Count: {dragCount})
      </div>

      {/* Drop Zone */}
      <div
        className="p-4 bg-green-100 border-2 border-dashed border-green-300 rounded min-h-20 text-center"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = '#dcfce7';
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f0fdf4';
        }}
        onDrop={(e) => {
          e.preventDefault();
          console.log('Simple drop success!');
          setDropCount(prev => prev + 1);
          e.currentTarget.style.backgroundColor = '#f0fdf4';
        }}
      >
        🎯 DROP HERE (Count: {dropCount})
      </div>

      <div className="text-sm text-gray-600">
        Drags: {dragCount} | Drops: {dropCount}
      </div>
    </div>
  );
} 