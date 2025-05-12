import { CheckSquare, Square, User, UserPlus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useProjectAssignments } from "@/hooks/useProjectAssignments";
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
  deadline?: string;
  progress: number;
  checklist: ChecklistItem[];
  assigned_to?: string;
}

interface TaskExpandedProps {
  task: Task;
  onChecklistItemToggle: (taskId: string, itemId: number, done: boolean) => void;
  onAssignTask?: (taskId: string, userId?: string) => void;
  onAssignSubtask?: (taskId: string, itemId: number, userId?: string) => void;
  className?: string;
  wrapperClassName?: string;
  borderGradient?: boolean;
}

export function TaskExpanded({ 
  task, 
  onChecklistItemToggle, 
  onAssignTask,
  onAssignSubtask,
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
        isCompleted ? "bg-green-900/20" : "bg-neutral-850",
        className
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
        <h3 className={cn(
          "text-lg font-medium",
          isCompleted ? "text-green-400" : "text-white"
        )}>{task.title}</h3>
          
          {/* Task Assignment Dropdown */}
          {onAssignTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center gap-1.5 p-1.5 text-neutral-400 hover:text-blue-400 transition-colors rounded-md hover:bg-neutral-700/50"
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
              <DropdownMenuContent className="bg-neutral-800 border-neutral-700 w-56" align="start">
                {members.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-center text-neutral-400">
                    No team members found
                  </div>
                ) : (
                  <>
                    <div className="py-1 px-2 text-xs text-neutral-500 border-b border-neutral-700">
                      Assign to user
                    </div>
                    {members.map(member => (
                      <DropdownMenuItem 
                        key={member.id}
                        className={cn(
                          "text-sm text-white flex items-center gap-2 cursor-pointer hover:bg-neutral-700",
                          task.assigned_to === member.user_id && "bg-blue-900/20"
                        )}
                        onClick={() => onAssignTask(task.id, member.user_id)}
                      >
                        <User className="h-4 w-4 mr-2 text-neutral-400" />
                        {member.name}
                        {task.assigned_to === member.user_id && (
                          <span className="ml-auto text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    
                    {task.assigned_to && (
                      <>
                        <div className="h-px bg-neutral-700 my-1 mx-2" />
                        <DropdownMenuItem 
                          className="text-sm text-red-400 flex items-center gap-2 cursor-pointer hover:bg-neutral-700"
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
        </div>
        {task.deadline && (
          <span className="text-sm text-neutral-400">
            Due: {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {task.checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 group"
          >
            <button 
              className={cn(
              "mt-0.5 transition-colors",
              item.done ? "text-green-400" : "text-neutral-400 hover:text-white"
              )}
              onClick={() => onChecklistItemToggle(task.id, item.id, !item.done)}
            >
              {item.done ? (
                <CheckSquare className="h-5 w-5" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
              <p className={cn(
                "text-sm transition-colors",
                item.done ? "text-green-400 line-through" : "text-white"
              )}>
                {item.text}
              </p>
                
                {/* Subtask Assignment Dropdown */}
                {onAssignSubtask && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="flex items-center gap-1.5 p-1.5 text-neutral-400 hover:text-blue-400 transition-colors rounded-md hover:bg-neutral-700/50 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-neutral-800 border-neutral-700 w-56" align="start">
                      {members.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-center text-neutral-400">
                          No team members found
                        </div>
                      ) : (
                        <>
                          <div className="py-1 px-2 text-xs text-neutral-500 border-b border-neutral-700">
                            Assign to user
                          </div>
                          {members.map(member => (
                            <DropdownMenuItem 
                              key={member.id}
                              className={cn(
                                "text-sm text-white flex items-center gap-2 cursor-pointer hover:bg-neutral-700",
                                item.assigned_to === member.user_id && "bg-blue-900/20"
                              )}
                              onClick={() => onAssignSubtask(task.id, item.id, member.user_id)}
                            >
                              <User className="h-4 w-4 mr-2 text-neutral-400" />
                              {member.name}
                              {item.assigned_to === member.user_id && (
                                <span className="ml-auto text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                  Current
                                </span>
                              )}
                            </DropdownMenuItem>
                          ))}
                          
                          {item.assigned_to && (
                            <>
                              <div className="h-px bg-neutral-700 my-1 mx-2" />
                              <DropdownMenuItem 
                                className="text-sm text-red-400 flex items-center gap-2 cursor-pointer hover:bg-neutral-700"
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
                )}
              </div>
              {item.deadline && (
                <span className="text-xs text-neutral-500">
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