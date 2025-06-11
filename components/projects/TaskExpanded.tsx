import { CheckSquare, Square, User, UserPlus, AlertCircle, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useProjectAssignments } from "@/hooks/useProjectAssignments";
import { TimeTracker } from "@/components/ui/TimeTracker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  deadline?: string;
  assigned_to?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  checklist: ChecklistItem[];
  progress: number;
  assigned_to?: string;
  deadline?: string;
  project_id?: string;
}

interface TaskExpandedProps {
  task: Task;
  onChecklistItemToggle: (taskId: string, itemId: number, done: boolean) => void;
  onAssignTask?: (taskId: string, userId?: string) => void;
  onAssignSubtask?: (taskId: string, itemId: number, userId?: string) => void;
  onMoveTask?: (task: Task) => void;
  onMoveSubtask?: (task: Task, subtask: ChecklistItem) => void;
  className?: string;
  wrapperClassName?: string;
  borderGradient?: boolean;
}

export function TaskExpanded({ 
  task, 
  onChecklistItemToggle, 
  onAssignTask,
  onAssignSubtask,
  onMoveTask,
  onMoveSubtask,
  className, 
  wrapperClassName,
  borderGradient = false 
}: TaskExpandedProps) {
  const isCompleted = task.checklist.length > 0 && task.checklist.every(item => item.done);
  const { members } = useWorkspaceMembers();
  const { getMemberByUserId } = useProjectAssignments();

  // Get member name by ID
  const getAssignedMemberName = (userId?: string) => {
    if (!userId) return null;
    const member = getMemberByUserId(userId);
    return member ? member.name : null;
  };

  return (
    <div className={cn(wrapperClassName)}>
    <div className={cn(
        "py-4 px-6 rounded-lg transition-colors relative z-10",
        isCompleted ? "bg-green-100 dark:bg-green-900/20" : "bg-gray-200 dark:bg-neutral-850",
        className
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
        <h3 className={cn(
          "text-lg font-medium",
          isCompleted ? "text-green-400" : "text-foreground"
        )}>{task.title}</h3>
          
          {/* Task Assignment Dropdown - Always visible */}
          {onAssignTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center gap-1.5 p-1.5 text-muted-foreground hover:text-blue-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {task.assigned_to ? (
                    <>
                      <User className="h-4 w-4" />
                      <span className="text-xs">{getAssignedMemberName(task.assigned_to)?.split(' ')[0] || 'Assigned'}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span className="text-xs">Assign</span>
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border-border dark:border-border w-56" align="start">
                {members.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                    No team members found
                  </div>
                ) : (
                  <>
                    <div className="py-1 px-2 text-xs text-muted-foreground border-b border-border dark:border-border">
                      Assign to user
                    </div>
                    {members.map(member => (
                      <DropdownMenuItem 
                        key={member.id}
                        className={cn(
                          "text-sm text-foreground flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted",
                          task.assigned_to === member.user_id && "bg-blue-100 dark:bg-blue-900/20"
                        )}
                        onClick={() => onAssignTask(task.id, member.user_id)}
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
                          onClick={() => onAssignTask(task.id)}
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
          )}

          {/* Task Move Button - Always visible */}
          {onMoveTask && (
            <button 
              className="flex items-center gap-1.5 p-1.5 text-muted-foreground hover:text-purple-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
              onClick={(e) => {
                e.stopPropagation();
                onMoveTask(task);
              }}
              title="Move task to another project"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-xs">Move</span>
            </button>
          )}
        </div>
        {task.deadline && (
          <span className="text-sm text-muted-foreground">
            Due: {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {task.checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 group relative"
          >
            <button 
              className={cn(
              "mt-0.5 transition-colors",
              item.done ? "text-green-400" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onChecklistItemToggle(task.id, item.id, !item.done);
              }}
            >
              {item.done ? (
                <CheckSquare className="h-5 w-5" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 flex-wrap">
              <p className={cn(
                  "text-sm transition-colors flex-grow",
                item.done ? "text-green-400 line-through" : "text-foreground"
              )}>
                {item.text}
              </p>

                {/* Time Tracker - Make it stand out clearly */}
                <div 
                  className="flex items-center mr-2 bg-gray-200 dark:bg-muted rounded-md px-3 py-1.5 border border-gray-400 dark:border-border hover:border-blue-500 hover:bg-gray-300 dark:hover:bg-neutral-600 relative z-50 cursor-pointer min-w-24 justify-center"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Find and click the TimeTracker's main button
                    const button = e.currentTarget.querySelector('button');
                    if (button) button.click();
                    else {
                      // If button not found, find the clock icon and click it
                      const clock = e.currentTarget.querySelector('svg');
                      if (clock) clock.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                  }} 
                >
                  <TimeTracker 
                    projectId={task.project_id || ''} 
                    taskId={task.id} 
                    subtaskId={item.id} 
                    subtaskLabel={item.text}
                    className="!opacity-100 text-blue-400 w-full" 
                  />
                </div>
                
                {/* Subtask Assignment Dropdown - Always visible */}
                {onAssignSubtask && (
                      <button 
                    className="flex items-center gap-1.5 p-1.5 text-muted-foreground hover:text-blue-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                        onClick={(e) => e.stopPropagation()}
                      >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-1.5">
                        {item.assigned_to ? (
                          <>
                            <User className="h-3.5 w-3.5" />
                            <span className="text-xs">{getAssignedMemberName(item.assigned_to)?.split(' ')[0] || 'Assigned'}</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" />
                            <span className="text-xs">Assign</span>
                          </>
                        )}
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-background border-border dark:border-border w-56" align="start">
                      {members.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                          No team members found
                        </div>
                      ) : (
                        <>
                            <div className="py-1 px-2 text-xs text-muted-foreground border-b border-border dark:border-border">
                            Assign to user
                          </div>
                          {members.map(member => (
                            <DropdownMenuItem 
                              key={member.id}
                              className={cn(
                                "text-sm text-foreground flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted",
                                item.assigned_to === member.user_id && "bg-blue-100 dark:bg-blue-900/20"
                              )}
                              onClick={() => onAssignSubtask(task.id, item.id, member.user_id)}
                            >
                              <User className="h-4 w-4 mr-2 text-muted-foreground" />
                              {member.name}
                              {item.assigned_to === member.user_id && (
                                <span className="ml-auto text-xs bg-blue-200 dark:bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                  Current
                                </span>
                              )}
                            </DropdownMenuItem>
                          ))}
                          
                          {item.assigned_to && (
                            <>
                              <div className="h-px bg-gray-200 dark:bg-muted my-1 mx-2" />
                              <DropdownMenuItem 
                                className="text-sm text-red-400 flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted"
                                onClick={() => onAssignSubtask(task.id, item.id)}
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
                  </button>
                )}

                {/* Subtask Move Button - Always visible */}
                {onMoveSubtask && (
                  <button 
                    className="flex items-center gap-1.5 p-1.5 text-muted-foreground hover:text-purple-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSubtask(task, item);
                    }}
                    title="Move subtask to another project"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    <span className="text-xs">Move</span>
                  </button>
                )}
              </div>
              {item.deadline && (
                <span className="text-xs text-muted-foreground">
                  Due: {new Date(item.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
} 