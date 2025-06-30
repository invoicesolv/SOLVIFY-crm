import { useState } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface SubtaskCalendarSchedulerProps {
  subtaskText: string;
  taskTitle: string;
  projectName?: string;
  projectId?: string;
  taskId: string;
  subtaskId: number;
  onScheduled?: () => void;
}

// Calendar component
function CalendarPicker({ 
  selectedDate, 
  onDateSelect 
}: { 
  selectedDate: Date | null; 
  onDateSelect: (date: Date) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  
  // Generate calendar days
  const calendarDays: (Date | null)[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }
  
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };
  
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };
  
  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };
  
  const isPastDate = (date: Date) => {
    return date < today && !isToday(date);
  };
  
  return (
    <div className="bg-background border border-border rounded-lg p-4 w-full max-w-sm mx-auto">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-muted rounded-md transition-colors text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <h3 className="text-sm font-medium text-foreground">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-muted rounded-md transition-colors text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      
      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-xs text-muted-foreground text-center py-2 font-medium">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => (
          <div key={index} className="aspect-square">
            {date ? (
              <button
                onClick={() => !isPastDate(date) && onDateSelect(date)}
                disabled={isPastDate(date)}
                className={cn(
                  "w-full h-full text-sm rounded-md flex items-center justify-center transition-all duration-200 font-medium",
                  isPastDate(date) 
                    ? "text-muted-foreground/40 cursor-not-allowed" 
                    : "hover:bg-muted cursor-pointer text-foreground hover:scale-105",
                  isToday(date) && "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700",
                  isSelected(date) && "bg-blue-600 text-white hover:bg-blue-700 shadow-md",
                  !isSelected(date) && !isToday(date) && !isPastDate(date) && "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {date.getDate()}
              </button>
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubtaskCalendarScheduler({
  subtaskText,
  taskTitle,
  projectName,
  projectId,
  taskId,
  subtaskId,
  onScheduled
}: SubtaskCalendarSchedulerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(60); // Default 1 hour
  const [isCreating, setIsCreating] = useState(false);
  const { user, session } = useAuth();

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime || !user?.id) {
      toast.error('Please select both date and time');
      return;
    }

    if (!session?.access_token) {
      toast.error('Authentication required to schedule events');
      return;
    }

    setIsCreating(true);

    try {
      // Create start and end times
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(hours, minutes, 0, 0);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      // Create the calendar event
      const eventData = {
        title: `${subtaskText}`,
        description: `Task: ${taskTitle}${projectName ? `\nProject: ${projectName}` : ''}`,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        event_type: 'task',
        project_id: projectId,
        color: '#3b82f6' // Blue color for task events
      };

      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create calendar event');
      }

      toast.success('Subtask scheduled to calendar successfully!');
      setIsOpen(false);
      setSelectedDate(null);
      setSelectedTime('');
      setDuration(60);
      
      if (onScheduled) {
        onScheduled();
      }
    } catch (error) {
      console.error('Error scheduling subtask:', error);
      toast.error('Failed to schedule subtask to calendar');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="flex items-center gap-1 p-1 text-muted-foreground hover:text-blue-400 transition-colors rounded hover:bg-gray-200 dark:hover:bg-muted/50"
        title="Schedule to calendar"
      >
        <Calendar className="h-3.5 w-3.5" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-400" />
              Schedule Subtask
            </DialogTitle>
            <DialogDescription>
              Schedule "{subtaskText}" to your calendar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-foreground font-medium">Select Date</Label>
              <CalendarPicker 
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time" className="text-foreground">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="text-foreground">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  min={15}
                  max={480}
                  step={15}
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm border border-border">
              <div className="font-medium text-foreground mb-2">Event Preview:</div>
              <div className="text-muted-foreground space-y-1">
                <div><span className="font-medium">Title:</span> {subtaskText}</div>
                <div><span className="font-medium">Task:</span> {taskTitle}</div>
                {projectName && <div><span className="font-medium">Project:</span> {projectName}</div>}
                {selectedDate && selectedTime && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-800 dark:text-blue-300 font-medium">
                      {selectedDate.toLocaleDateString()} at {selectedTime} ({duration} min)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isCreating}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!selectedDate || !selectedTime || isCreating}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
            >
              {isCreating ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 