import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { useState } from "react";
import { Task } from "@/types/project";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface ReportButtonsProps {
  projectName: string;
  tasks: Task[];
}

export function ReportButtons({ projectName, tasks }: ReportButtonsProps) {
  const { data: session } = useSession();
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emails, setEmails] = useState<string>("");

  const sendReport = async (isTest: boolean) => {
    if (!session?.user?.email) {
      toast.error('You must be logged in to send reports');
      return;
    }

    const emailList = isTest ? [session.user.email] : emails.split('\n').filter(email => email.trim());

    if (!isTest && emailList.length === 0) {
      toast.error('Please enter at least one email address');
      return;
    }

    setIsSendingReport(true);
    try {
      const response = await fetch('/api/send-project-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName,
          tasks,
          isTest,
          recipients: emailList
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send report');
      }

      toast.success(isTest 
        ? `Test report sent to ${session.user.email}`
        : `Report sent to ${emailList.length} recipient${emailList.length === 1 ? '' : 's'}`
      );
      setShowEmailInput(false);
      setEmails("");
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error(`Failed to send ${isTest ? 'test ' : ''}report`);
    } finally {
      setIsSendingReport(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => sendReport(true)}
          disabled={isSendingReport}
          className="bg-background text-foreground hover:bg-gray-200 dark:bg-muted"
        >
          <Mail className="h-4 w-4 mr-2" />
          {isSendingReport ? 'Sending test...' : 'Send Test Report'}
        </Button>
        <Button
          onClick={() => setShowEmailInput(true)}
          disabled={isSendingReport}
          className="bg-blue-600 text-foreground hover:bg-blue-500"
        >
          <Mail className="h-4 w-4 mr-2" />
          {isSendingReport ? 'Sending report...' : 'Send Report'}
        </Button>
      </div>

      {showEmailInput && (
        <div className="absolute right-0 top-12 z-50 w-96 p-4 bg-background border border-border rounded-lg shadow-xl">
          <h3 className="text-sm font-medium text-foreground mb-2">Send Report To</h3>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="Enter email addresses (one per line)"
            className="w-full h-32 p-2 mb-4 bg-background border border-border dark:border-border rounded text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailInput(false);
                setEmails("");
              }}
              className="bg-background text-foreground hover:bg-gray-200 dark:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendReport(false)}
              disabled={isSendingReport}
              className="bg-blue-600 text-foreground hover:bg-blue-500"
            >
              {isSendingReport ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function getProjectRecipients(projectName: string): string[] {
  // Special handling for specific projects
  switch (projectName.toLowerCase()) {
    case 'solvify':
      return ['info@solvify.se'];
    case 'teamhub':
      return [
        'vincent@goteamhub.com',
        'kristoffer@goteamhub.com'
      ];
    case 'elkontakten':
      return [
        'alexander@elkontakten.com',
        'elias@elkontakten.com',
        'marcus@elinstallation.nu'
      ];
    default:
      // Default recipients for other projects
      return [
        `alexander@${projectName.toLowerCase()}.com`,
        `elias@${projectName.toLowerCase()}.com`
      ];
  }
} 