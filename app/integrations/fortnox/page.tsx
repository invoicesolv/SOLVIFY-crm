import ProjectInvoiceLinker from "@/components/fortnox/ProjectInvoiceLinker";
import { Separator } from "@/components/ui/separator";
import { Link2 } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fortnox Integration | Invoices and Projects",
  description: "Connect invoices to projects and tasks in Fortnox",
};

export default function FortnoxIntegrationPage() {
  return (
    <main className="container mx-auto p-6">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center space-x-2">
          <Link2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold tracking-tight">Fortnox Integration</h1>
        </div>
        
        <div className="text-muted-foreground">
          <p>Connect your CRM projects with Fortnox invoices. You can link existing invoices to projects or create new invoices directly from your projects.</p>
        </div>
        
        <Separator />
        
        <ProjectInvoiceLinker />
      </div>
    </main>
  );
} 