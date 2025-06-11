"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, CheckCircle, X, Clock, ChevronRight, Pencil, User, UserPlus, AlertCircle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/project";
import { Input } from "@/components/ui/input";
import { useProjectAssignments } from "@/hooks/useProjectAssignments";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TimeTracker } from "@/components/ui/TimeTracker";
import { SubtaskCalendarScheduler } from "@/components/ui/SubtaskCalendarScheduler";

interface TaskCardProps {
    task: Task;
    onUpdate?: (taskId: string, updates: Partial<Task>) => void;
    onDelete?: (taskId: string) => void;
    onMoveTask?: (task: Task) => void;
    onMoveSubtask?: (task: Task, subtask: any) => void;
    projectName?: string;
}

export function TaskCard({ task, onUpdate, onDelete, onMoveTask, onMoveSubtask, projectName }: TaskCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [newSubtask, setNewSubtask] = useState("");
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [editingTaskTitle, setEditingTaskTitle] = useState(false);
    const [editedTaskTitle, setEditedTaskTitle] = useState(task.title);
    const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
    const [editedSubtaskText, setEditedSubtaskText] = useState("");
    
    const { members } = useWorkspaceMembers();
    const { 
        getMemberByUserId,
        getAssignedMemberForChecklistItem
    } = useProjectAssignments();
    
    // Keep reference to assigned member for display purposes only
    const assignedMember = task.assigned_to ? getMemberByUserId(task.assigned_to) : undefined;

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

        // Check if this toggle completes the task
        const wasCompleted = task.checklist.filter(item => item.done).length === task.checklist.length;
        const isNowCompleted = completedItems === totalItems;

        // If task is newly completed (wasn't complete before but is now), send notification
        if (!wasCompleted && isNowCompleted && task.assigned_to) {
            // Send completion notification
            fetch('/api/task-notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'completion',
                    taskId: task.id,
                    assignedToId: task.assigned_to
                }),
            }).catch(err => {
                console.error('Error sending completion notification:', err);
                // Don't block the UI for notification errors
            });
        }

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
            className="w-full bg-background border border-border rounded-lg overflow-hidden relative"
        >
            <div className="p-4 relative z-10">
            <div 
                className="p-4 cursor-pointer flex items-center justify-between group relative z-10"
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
                            task.progress === 100 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                        )} />
                    </motion.div>
                    {editingTaskTitle ? (
                        <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                            <Input
                                value={editedTaskTitle}
                                onChange={(e) => setEditedTaskTitle(e.target.value)}
                                className="bg-background border-border dark:border-border text-foreground"
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
                                className="text-muted-foreground hover:text-foreground dark:text-neutral-300"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleEditTaskTitle}
                                className="text-green-600 dark:text-green-400 hover:text-green-400"
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
                                        ? "text-green-600 dark:text-green-400 line-through opacity-70" 
                                        : "text-foreground"
                                )}
                            >
                                {task.title}
                            </motion.span>
                                
                                {/* Add assignment dropdown */}
                                <div 
                                    className="ml-2 relative" 
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button 
                                                className="flex items-center gap-1.5 p-1.5 text-muted-foreground hover:text-blue-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                                            >
                                                {assignedMember ? (
                                                    <div className="flex items-center gap-1 bg-blue-500/10 rounded-full px-2 py-0.5">
                                                        <User className="h-3.5 w-3.5 text-blue-400" />
                                                        <span className="text-xs text-blue-400">{assignedMember.name.split(' ')[0]}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <UserPlus className="h-4 w-4" />
                                                        <span className="text-xs">Assign</span>
                                                    </>
                                                )}
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent 
                                            className="bg-background border-border dark:border-border w-56" 
                                            align="start"
                                        >
                                            {members.length === 0 ? (
                                                <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                                                    No team members found
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="py-1 px-2 text-xs text-foreground0 border-b border-border dark:border-border">
                                                        Assign to user
                                                    </div>
                                                    {members.map(member => (
                                                        <DropdownMenuItem 
                                                            key={member.id}
                                                            className={cn(
                                                                "text-sm text-foreground flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted",
                                                                task.assigned_to === member.user_id && "bg-blue-100 dark:bg-blue-900/20"
                                                            )}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onUpdate && onUpdate(task.id, { ...task, assigned_to: member.user_id });
                                                            }}
                                                        >
                                                            <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                                            {member.name}
                                                            {task.assigned_to === member.user_id && (
                                                                <span className="ml-auto text-xs bg-blue-200 dark:bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </DropdownMenuItem>
                                                    ))}
                                                    
                                                    {task.assigned_to && (
                                                        <>
                                                            <div className="h-px bg-gray-200 dark:bg-muted my-1 mx-2" />
                                                            <DropdownMenuItem 
                                                                className="text-sm text-red-400 flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onUpdate && onUpdate(task.id, { ...task, assigned_to: undefined });
                                                                }}
                                                            >
                                                                <AlertCircle className="h-4 w-4 mr-2" />
                                                                Unassign
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                
                                {/* Keep existing member label if present */}
                            {assignedMember && (
                                <div className="flex items-center gap-1 ml-4 bg-blue-500/10 rounded-full px-2 py-0.5">
                                    <span className="text-xs text-blue-400">{assignedMember.name}</span>
                                </div>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTaskTitle(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground dark:text-neutral-300 transition-opacity duration-200"
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    {task.deadline && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
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
                                task.progress === 100 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                            )}
                        >
                            {task.checklist.filter(item => item.done).length} / {task.checklist.length}
                        </motion.span>
                        <motion.span 
                            layout="position"
                            className="text-sm text-foreground0"
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
                            className="text-muted-foreground hover:text-red-400"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                    
                    {onMoveTask && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveTask(task);
                            }}
                            className="text-muted-foreground hover:text-purple-400"
                            title="Move task to another project"
                        >
                            <ArrowRightLeft className="h-4 w-4" />
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
                        className="border-t border-border"
                    >
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                {task.checklist
                                    .slice()
                                    .sort((a, b) => {
                                        // Sort by completion (incomplete first)
                                        if (a.done && !b.done) return 1;
                                        if (!a.done && b.done) return -1;
                                        return 0;
                                    })
                                    .map((item) => {
                                        const itemAssignedMember = getAssignedMemberForChecklistItem(task.id, item.id);
                                        
                                        return (
                                            <div 
                                                key={item.id} 
                                                className={cn(
                                                    "flex items-start group",
                                                    item.done && "opacity-70"
                                                )}
                                            >
                                                <button
                                                    onClick={() => handleToggleSubtask(item.id)}
                                                    className={cn(
                                                        "flex-shrink-0 w-5 h-5 rounded-full border transition-colors duration-200 flex items-center justify-center mt-0.5",
                                                        item.done ? "bg-green-600 border-green-500" : "border-gray-400 dark:border-border hover:border-white"
                                                    )}
                                                >
                                                    {item.done && <CheckCircle className="h-4 w-4 text-foreground" />}
                                                </button>
                                                
                                                <div className="ml-3 flex-1">
                                                    {editingSubtaskId === item.id ? (
                                                        <div className="flex items-center gap-2 pr-2">
                                                            <Input
                                                                value={editedSubtaskText}
                                                                onChange={(e) => setEditedSubtaskText(e.target.value)}
                                                                className="bg-background border-border dark:border-border text-foreground"
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
                                                                className="text-muted-foreground hover:text-foreground dark:text-neutral-300"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleEditSubtask(item.id)}
                                                                className="text-green-600 dark:text-green-400 hover:text-green-400"
                                                            >
                                                                <CheckCircle className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start justify-between pr-2">
                                                            <div className="flex flex-col">
                                                                <span className={cn(
                                                                    "text-sm transition-all duration-200",
                                                                    item.done ? "line-through text-foreground0" : "text-foreground"
                                                                )}>
                                                                    {item.text}
                                                                </span>
                                                                
                                                                {itemAssignedMember && (
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        <span className="text-xs text-blue-400">{itemAssignedMember.name}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                                {/* Time Tracker */}
                                                                <div 
                                                                    className="flex items-center rounded-md px-2 py-1 border border-border dark:border-border hover:border-blue-500 hover:bg-gray-200 dark:bg-muted cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                    }}
                                                                >
                                                                    <TimeTracker 
                                                                        projectId={task.project_id || ''} 
                                                                        taskId={task.id} 
                                                                        subtaskId={item.id} 
                                                                        subtaskLabel={item.text}
                                                                        className="!text-blue-400"
                                                                    />
                                                                </div>
                                                                
                                                                {/* Calendar Scheduler */}
                                                                <SubtaskCalendarScheduler
                                                                    subtaskText={item.text}
                                                                    taskTitle={task.title}
                                                                    projectName={projectName}
                                                                    projectId={task.project_id}
                                                                    taskId={task.id}
                                                                    subtaskId={item.id}
                                                                />
                                                                
                                                                {/* Add subtask assignment dropdown */}
                                                                <div onClick={(e) => e.stopPropagation()}>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <button 
                                                                                className="flex items-center gap-1 p-1 text-muted-foreground hover:text-blue-400 transition-colors rounded hover:bg-gray-200 dark:bg-muted/50"
                                                                            >
                                                                                {itemAssignedMember ? (
                                                                                    <User className="h-3.5 w-3.5 text-blue-400" />
                                                                                ) : (
                                                                                    <UserPlus className="h-3.5 w-3.5" />
                                                                                )}
                                                                            </button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent 
                                                                            className="bg-background border-border dark:border-border w-48" 
                                                                            align="end"
                                                                        >
                                                                            {members.length === 0 ? (
                                                                                <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                                                                                    No team members found
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <div className="py-1 px-2 text-xs text-foreground0 border-b border-border dark:border-border">
                                                                                        Assign to user
                                                                                    </div>
                                                                                    {members.map(member => (
                                                                                        <DropdownMenuItem 
                                                                                            key={member.id}
                                                                                            className={cn(
                                                                                                "text-xs text-foreground flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted",
                                                                                                (itemAssignedMember?.user_id === member.user_id) && "bg-blue-100 dark:bg-blue-900/20"
                                                                                            )}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                if (onUpdate) {
                                                                                                    onUpdate(task.id, {
                                                                                                        ...task,
                                                                                                        // Update just this subtask assignment in the checklist
                                                                                                        checklist: task.checklist.map(checkItem => 
                                                                                                            checkItem.id === item.id 
                                                                                                                ? { ...checkItem, assigned_to: member.user_id } 
                                                                                                                : checkItem
                                                                                                        )
                                                                                                    });
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            <User className="h-3 w-3 text-muted-foreground" />
                                                                                            {member.name}
                                                                                            {itemAssignedMember?.user_id === member.user_id && (
                                                                                                <span className="ml-auto text-xs bg-blue-200 dark:bg-blue-900/30 text-blue-400 px-1 py-0.5 rounded text-[10px]">
                                                                                                    Current
                                                                                                </span>
                                                                                            )}
                                                                                        </DropdownMenuItem>
                                                                                    ))}
                                                                                    
                                                                                    {itemAssignedMember && (
                                                                                        <>
                                                                                            <div className="h-px bg-gray-200 dark:bg-muted my-1 mx-2" />
                                                                                                <DropdownMenuItem 
                                                                                                    className="text-xs text-red-400 flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        if (onUpdate) {
                                                                                                            onUpdate(task.id, {
                                                                                                                ...task,
                                                                                                                // Remove assignment for this subtask
                                                                                                                checklist: task.checklist.map(checkItem => 
                                                                                                                    checkItem.id === item.id 
                                                                                                                        ? { ...checkItem, assigned_to: undefined } 
                                                                                                                        : checkItem
                                                                                                                )
                                                                                                            });
                                                                                                        }
                                                                                                    }}
                                                                                                >
                                                                                                    <AlertCircle className="h-3 w-3" />
                                                                                                    Unassign
                                                                                                </DropdownMenuItem>
                                                                                        </>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                                
                                                                {onUpdate && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setEditingSubtaskId(item.id);
                                                                            setEditedSubtaskText(item.text);
                                                                        }}
                                                                        className="text-muted-foreground hover:text-foreground dark:text-neutral-300 h-6 w-6 p-1"
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                                
                                                                {onUpdate && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleDeleteSubtask(item.id)}
                                                                        className="text-muted-foreground hover:text-red-400 h-6 w-6 p-1"
                                                                    >
                                                                        <Minus className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                                
                                                                {onMoveSubtask && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => onMoveSubtask(task, item)}
                                                                        className="text-muted-foreground hover:text-purple-400 h-6 w-6 p-1"
                                                                        title="Move subtask to another project"
                                                                    >
                                                                        <ArrowRightLeft className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            {isAddingSubtask ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newSubtask}
                                        onChange={(e) => setNewSubtask(e.target.value)}
                                        placeholder="Enter subtask..."
                                        className="flex-1 bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
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
                                        className="text-muted-foreground hover:text-foreground dark:text-neutral-300"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleAddSubtask}
                                        className="text-green-600 dark:text-green-400 hover:text-green-400"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsAddingSubtask(true)}
                                    className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground dark:text-neutral-300"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Subtask
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        </motion.div>
    );
} 