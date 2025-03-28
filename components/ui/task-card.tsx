"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, CheckCircle, X, Clock, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/project";
import { Input } from "@/components/ui/input";

interface TaskCardProps {
    task: Task;
    onUpdate?: (taskId: string, updates: Partial<Task>) => void;
    onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [newSubtask, setNewSubtask] = useState("");
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [editingTaskTitle, setEditingTaskTitle] = useState(false);
    const [editedTaskTitle, setEditedTaskTitle] = useState(task.title);
    const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
    const [editedSubtaskText, setEditedSubtaskText] = useState("");

    const handleEditTaskTitle = () => {
        if (!onUpdate || editedTaskTitle.trim() === "") return;
        
        onUpdate(task.id, {
            ...task,
            title: editedTaskTitle.trim()
        });
        
        setEditingTaskTitle(false);
    };

    const handleEditSubtask = (itemId: number) => {
        if (!onUpdate || editedSubtaskText.trim() === "") return;

        const newChecklist = task.checklist.map(item =>
            item.id === itemId ? { ...item, text: editedSubtaskText.trim() } : item
        );

        onUpdate(task.id, {
            ...task,
            checklist: newChecklist
        });

        setEditingSubtaskId(null);
        setEditedSubtaskText("");
    };

    const handleAddSubtask = () => {
        if (!newSubtask.trim() || !onUpdate) return;

        const newChecklist = [
            ...(task.checklist || []),
            {
                id: Math.max(0, ...(task.checklist || []).map(item => item.id)) + 1,
                text: newSubtask.trim(),
                done: false
            }
        ];

        onUpdate(task.id, {
            ...task,
            checklist: newChecklist
        });

        setNewSubtask("");
        setIsAddingSubtask(false);
    };

    const handleToggleSubtask = (itemId: number) => {
        if (!onUpdate) return;

        const newChecklist = task.checklist.map(item =>
            item.id === itemId ? { ...item, done: !item.done } : item
        );

        // Calculate progress as percentage
        const completedItems = newChecklist.filter(item => item.done).length;
        const totalItems = newChecklist.length;
        const progress = Math.round((completedItems / totalItems) * 100);

        onUpdate(task.id, {
            ...task,
            checklist: newChecklist,
            progress: progress
        });

        // If all items are done, collapse the task after a short delay
        if (completedItems === totalItems) {
            setTimeout(() => {
                setIsExpanded(false);
            }, 500);
        }
    };

    const handleDeleteSubtask = (itemId: number) => {
        if (!onUpdate) return;

        const newChecklist = task.checklist.filter(item => item.id !== itemId);

        onUpdate(task.id, {
            ...task,
            checklist: newChecklist
        });
    };

    return (
        <motion.div
            layout
            layoutId={task.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
                layout: {
                    type: "spring",
                    bounce: 0.2,
                    duration: 0.6
                },
                opacity: { duration: 0.3 }
            }}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden"
        >
            <div 
                className="p-4 cursor-pointer flex items-center justify-between group"
                onClick={() => !editingTaskTitle && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 flex-1">
                    <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{
                            type: "spring",
                            bounce: 0.3,
                            duration: 0.4
                        }}
                    >
                        <ChevronRight className={cn(
                            "h-4 w-4",
                            task.progress === 100 ? "text-green-500" : "text-neutral-400"
                        )} />
                    </motion.div>
                    {editingTaskTitle ? (
                        <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                            <Input
                                value={editedTaskTitle}
                                onChange={(e) => setEditedTaskTitle(e.target.value)}
                                className="bg-neutral-800 border-neutral-700 text-white"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleEditTaskTitle();
                                    }
                                    if (e.key === 'Escape') {
                                        setEditingTaskTitle(false);
                                        setEditedTaskTitle(task.title);
                                    }
                                }}
                                autoFocus
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setEditingTaskTitle(false);
                                    setEditedTaskTitle(task.title);
                                }}
                                className="text-neutral-400 hover:text-neutral-300"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleEditTaskTitle}
                                className="text-green-500 hover:text-green-400"
                            >
                                <CheckCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-1">
                            <motion.span 
                                layout="position"
                                className={cn(
                                    "text-base transition-all duration-200",
                                    task.progress === 100 
                                        ? "text-green-500 line-through opacity-70" 
                                        : "text-white"
                                )}
                            >
                                {task.title}
                            </motion.span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTaskTitle(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-300 transition-opacity duration-200"
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    {task.deadline && (
                        <div className="flex items-center gap-1 text-xs text-neutral-400 ml-4">
                            <Clock className="h-3 w-3" />
                            {new Date(task.deadline).toLocaleDateString()}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4 ml-4">
                    <div className="flex items-center gap-2">
                        <motion.span 
                            layout="position"
                            transition={{
                                layout: {
                                    type: "spring",
                                    bounce: 0.2,
                                    duration: 0.6
                                }
                            }}
                            className={cn(
                                "text-sm",
                                task.progress === 100 ? "text-green-500" : "text-neutral-400"
                            )}
                        >
                            {task.checklist.filter(item => item.done).length} / {task.checklist.length}
                        </motion.span>
                        <motion.span 
                            layout="position"
                            className="text-sm text-neutral-500"
                        >
                            ({task.progress}%)
                        </motion.span>
                    </div>
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(task.id);
                            }}
                            className="text-neutral-400 hover:text-red-400"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            height: {
                                type: "spring",
                                bounce: 0.2,
                                duration: 0.6
                            },
                            opacity: { duration: 0.3 }
                        }}
                        className="border-t border-neutral-800"
                    >
                        <div className="p-4 space-y-4">
                            {/* Checklist */}
                            <div className="space-y-2">
                                {task.checklist
                                    .slice()
                                    .sort((a, b) => {
                                        // Sort by completion (incomplete first)
                                        if (a.done && !b.done) return 1;
                                        if (!a.done && b.done) return -1;
                                        return 0;
                                    })
                                    .map((item) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{
                                                layout: {
                                                    type: "spring",
                                                    bounce: 0.2,
                                                    duration: 0.6
                                                },
                                                opacity: { duration: 0.3 }
                                            }}
                                            className="flex items-center gap-2 group"
                                        >
                                            <button
                                                onClick={() => handleToggleSubtask(item.id)}
                                                className={cn(
                                                    "flex items-center justify-center w-5 h-5 rounded border transition-colors",
                                                    item.done
                                                        ? "bg-green-500 border-green-500 text-white"
                                                        : "border-neutral-700 hover:border-neutral-600"
                                                )}
                                            >
                                                {item.done && <CheckCircle className="h-4 w-4" />}
                                            </button>
                                            {editingSubtaskId === item.id ? (
                                                <div className="flex-1 flex items-center gap-2">
                                                    <Input
                                                        value={editedSubtaskText}
                                                        onChange={(e) => setEditedSubtaskText(e.target.value)}
                                                        className="flex-1 bg-neutral-800 border-neutral-700 text-white"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleEditSubtask(item.id);
                                                            }
                                                            if (e.key === 'Escape') {
                                                                setEditingSubtaskId(null);
                                                                setEditedSubtaskText("");
                                                            }
                                                        }}
                                                        autoFocus
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingSubtaskId(null);
                                                            setEditedSubtaskText("");
                                                        }}
                                                        className="text-neutral-400 hover:text-neutral-300"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditSubtask(item.id)}
                                                        className="text-green-500 hover:text-green-400"
                                                    >
                                                        <CheckCircle className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-center gap-2">
                                                    <span className={cn(
                                                        "flex-1 text-sm transition-colors",
                                                        item.done ? "text-neutral-500 line-through" : "text-neutral-200"
                                                    )}>
                                                        {item.text}
                                                    </span>
                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setEditingSubtaskId(item.id);
                                                                setEditedSubtaskText(item.text);
                                                            }}
                                                            className="text-neutral-400 hover:text-neutral-300"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteSubtask(item.id)}
                                                            className="text-neutral-400 hover:text-red-400"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                            </div>

                            {/* Add Subtask Form */}
                            {isAddingSubtask ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newSubtask}
                                        onChange={(e) => setNewSubtask(e.target.value)}
                                        placeholder="Enter subtask..."
                                        className="flex-1 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddSubtask();
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsAddingSubtask(false)}
                                        className="text-neutral-400 hover:text-neutral-300"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleAddSubtask}
                                        className="text-green-500 hover:text-green-400"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsAddingSubtask(true)}
                                    className="w-full flex items-center gap-2 text-neutral-400 hover:text-neutral-300"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Subtask
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
} 