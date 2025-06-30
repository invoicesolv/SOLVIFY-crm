"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/lib/auth-client';
import { Loader2, Link, Plus, FileCheck, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Define types for the data
interface Project {
  ProjectNumber: string;
  Description: string;
  Status: string;
  CustomerNumber: string;
  CustomerName: string;
}

interface Invoice {
  DocumentNumber: string;
  CustomerName: string;
  InvoiceDate: string;
  Total: number;
  TaskDetails?: string;
  Status?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  progress: number;
  deadline?: string;
  subtasks?: any[];
}

export default function ProjectInvoiceLinker() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  
  // State variables
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projectInvoices, setProjectInvoices] = useState<Invoice[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [taskDetails, setTaskDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoicePrice, setInvoicePrice] = useState<number>(1000);
  const [invoiceDescription, setInvoiceDescription] = useState<string>("");
  const [invoiceType, setInvoiceType] = useState<string>("INVOICE");
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [customerNumber, setCustomerNumber] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  
  // Fetch Fortnox projects on component mount
  useEffect(() => {
    fetchProjects();
  }, []);
  
  // Fetch Fortnox invoices on component mount
  useEffect(() => {
    fetchInvoices();
  }, []);
  
  // Fetch project invoices and tasks when a project is selected
  useEffect(() => {
    if (selectedProject) {
      fetchProjectInvoices();
      fetchProjectTasks();
      // Set default invoice description based on project
      const project = projects.find(p => p.ProjectNumber === selectedProject);
      if (project) {
        setInvoiceDescription(`Services for project ${project.Description || selectedProject}`);
      } else {
        setInvoiceDescription(`Services for project ${selectedProject}`);
      }
    } else {
      setProjectInvoices([]);
      setProjectTasks([]);
      setInvoiceDescription("");
    }
  }, [selectedProject, projects]);

  // Fetch the customer details for this project
  useEffect(() => {
    if (selectedProject && user && session?.access_token) {
      // First fetch the project details to get the customer number
      const getProjectDetails = async () => {
        try {
          const projectResponse = await fetch(`/api/fortnox/projects/get?projectNumber=${selectedProject}`, {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`
            }
          });
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            if (projectData.Project && projectData.Project.CustomerNumber) {
              setCustomerNumber(projectData.Project.CustomerNumber);
              
              // Now fetch the customer details
              const customerResponse = await fetch(`/api/fortnox/customers/${projectData.Project.CustomerNumber}`, {
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${session.access_token}`
                }
              });
              if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                if (customerData.Customer) {
                  setCustomerName(customerData.Customer.Name || "");
                  setCustomerEmail(customerData.Customer.Email || "");
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching project or customer details:", error);
        }
      };
      
      getProjectDetails();
    }
  }, [selectedProject, user, session]);

  // Fetch Fortnox projects
  const fetchProjects = async () => {
    if (!user || !session?.access_token) return;
    
    try {
      setLoading(true);
      const response = await fetch("/api/fortnox/projects", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data.Projects || []);
      } else {
        const error = await response.json();
        toast({
          title: "Error fetching projects",
          description: error.error || "Failed to load projects",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch Fortnox invoices
  const fetchInvoices = async () => {
    if (!user || !session?.access_token) return;
    
    try {
      setLoading(true);
      const response = await fetch("/api/fortnox/invoices", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.Invoices || []);
      } else {
        const error = await response.json();
        toast({
          title: "Error fetching invoices",
          description: error.error || "Failed to load invoices",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load invoices. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch invoices for a specific project
  const fetchProjectInvoices = async () => {
    if (!selectedProject || !user || !session?.access_token) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/fortnox/projects/${selectedProject}/invoices`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Ensure all invoice fields are properly formatted
        const formattedInvoices = (data.Invoices || []).map((invoice: any) => ({
          DocumentNumber: invoice.DocumentNumber || `Invoice-${Math.floor(Math.random() * 1000)}`,
          CustomerName: invoice.CustomerName || "Customer",
          InvoiceDate: invoice.InvoiceDate || new Date().toISOString().split('T')[0],
          Total: typeof invoice.Total === 'number' ? invoice.Total : 0,
          TaskDetails: invoice.TaskDetails || "",
          Status: invoice.Status || "ongoing"
        }));
        setProjectInvoices(formattedInvoices);
      } else {
        const error = await response.json();
        toast({
          title: "Error fetching project invoices",
          description: error.error || "Failed to load invoices for this project",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching project invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load project invoices. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch tasks for a specific project
  const fetchProjectTasks = async () => {
    if (!selectedProject || !user || !session?.access_token) return;
    
    try {
      // First get internal project ID from Fortnox project number
      const projectResponse = await fetch(`/api/projects/fortnox/${selectedProject}`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        
        if (projectData.project && projectData.project.id) {
          // Now fetch tasks using internal project ID
          const tasksResponse = await fetch(`/api/projects/${projectData.project.id}/tasks`, {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`
            }
          });
          
          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();
            setProjectTasks(tasksData.tasks || []);
            // Clear selected tasks when loading new tasks
            setSelectedTasks([]);
          } else {
            console.log("Could not fetch tasks for project");
            setProjectTasks([]);
          }
        } else {
          console.log("No internal project ID found for Fortnox project");
          setProjectTasks([]);
        }
      } else {
        console.log("Could not find internal project for Fortnox project number");
        setProjectTasks([]);
      }
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      setProjectTasks([]);
    }
  };
  
  // Link an invoice to a project
  const linkInvoiceToProject = async () => {
    if (!selectedProject || !selectedInvoice) {
      toast({
        title: "Validation Error",
        description: "Please select both a project and an invoice",
        variant: "destructive"
      });
      return;
    }
    
    if (!user || !session?.access_token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to link invoices",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch("/api/fortnox/invoices/link-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          documentNumber: selectedInvoice,
          projectNumber: selectedProject,
          taskDetails: taskDetails || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: "Invoice successfully linked to project",
          variant: "default"
        });
        
        // Refresh the project invoices list
        fetchProjectInvoices();
        
        // Reset selections
        setSelectedInvoice("");
        setTaskDetails("");
      } else {
        const error = await response.json();
        toast({
          title: "Error linking invoice",
          description: error.error || "Failed to link invoice to project",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error linking invoice to project:", error);
      toast({
        title: "Error",
        description: "Failed to link invoice to project. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Create new invoice linked to project
  const createLinkedInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject) {
      toast({
        title: "Validation Error",
        description: "Please select a project",
        variant: "destructive"
      });
      return;
    }
    
    if (!user || !session?.access_token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create invoices",
        variant: "destructive"
      });
      return;
    }
    
    // Generate description from selected tasks
    let finalInvoiceDescription = invoiceDescription || `Services for project ${selectedProject}`;
    let taskDetailsText = "";
    
    if (selectedTasks.length > 0) {
      // Find selected task titles
      const selectedTaskTitles = projectTasks
        .filter(task => selectedTasks.includes(task.id))
        .map(task => task.title);
      
      if (selectedTaskTitles.length > 0) {
        taskDetailsText = selectedTaskTitles.join(", ");
        // Only append task details if not already in the description
        if (!finalInvoiceDescription.includes(taskDetailsText)) {
          finalInvoiceDescription += ` - ${taskDetailsText}`;
        }
      }
    } else if (taskDetails) {
      taskDetailsText = taskDetails;
      // Only append task details if not already in the description
      if (!finalInvoiceDescription.includes(taskDetailsText)) {
        finalInvoiceDescription += ` - ${taskDetailsText}`;
      }
    }
    
    // Form data for creating invoice
    const formData = {
      customerNumber: customerNumber,
      customerName: customerName,
      customerEmail: customerEmail,
      projectNumber: selectedProject,
      taskDetails: taskDetailsText || undefined,
      // Pass the list of task IDs if any are selected
      taskIds: selectedTasks.length > 0 ? selectedTasks : undefined,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: "SEK", // Required for Swedish invoices
      invoiceType: invoiceType, // Add the selected invoice type
      invoiceRows: [
        {
          description: finalInvoiceDescription,
          quantity: 1,
          price: invoicePrice || 1000, // Use custom price or default
          unit: "h",
          vat: 25
        }
      ]
    };
    
    try {
      setLoading(true);
      console.log("Attempting to create invoice with data:", JSON.stringify(formData, null, 2));
      
      const response = await fetch("/api/fortnox/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Invoice ${data.Invoice?.DocumentNumber} created successfully!`,
          variant: "default"
        });
        // Reset form and fetch current state
        setInvoiceDescription('');
        setSelectedTasks([]);
        setIsCreatingInvoice(false);
        // Refresh invoices on success
        fetchInvoices();
        fetchProjectInvoices();
      } else {
        console.error('Error creating invoice:', data);
        
        // Improved error handling with specific messages
        if (data.code === 2000357 || (data.details && data.details.includes('email'))) {
          toast({
            title: "Invoice Created as Draft",
            description: "Invoice created as a draft due to email validation issues.",
            variant: "default"
          });
          // Refresh invoices to show the newly created draft
          fetchInvoices();
          setInvoiceDescription('');
          setSelectedTasks([]);
        } else {
          toast({
            title: "Error",
            description: `Failed to create invoice: ${data.error || 'Unknown error'}. ${data.details || ''}`,
            variant: "destructive"
          });
        }
        setIsCreatingInvoice(false);
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      let errorMessage = "Failed to create invoice. Please try again later.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error creating invoice",
        description: errorMessage,
        variant: "destructive"
      });
      setIsCreatingInvoice(false);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle selection of a single task
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId) 
        : [...prev, taskId]
    );
  };
  
  // Handle "Select All" tasks functionality
  const toggleSelectAllTasks = () => {
    if (selectedTasks.length === projectTasks.length) {
      // If all are selected, deselect all
      setSelectedTasks([]);
    } else {
      // Otherwise, select all
      setSelectedTasks(projectTasks.map(task => task.id));
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} SEK`;
  };

  // Helper function to get status display
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { text: string, className: string }> = {
      // Basic statuses
      "ongoing": { text: "Pågående", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "draft": { text: "Utkast", className: "bg-background text-muted-foreground" },
      "completed": { text: "Färdig", className: "bg-green-100 dark:bg-green-900/20 text-green-400" },
      "paid": { text: "Betald", className: "bg-green-100 dark:bg-green-900/20 text-green-400" },
      "pending": { text: "Pågående", className: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400" },
      "unpaid": { text: "Obetald", className: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400" },
      "overdue": { text: "Försenad", className: "bg-red-100 dark:bg-red-900/20 text-red-400" },
      
      // Fortnox specific statuses
      "not invoiced": { text: "Ej fakturerad", className: "bg-background text-muted-foreground" },
      "invoiced": { text: "Fakturerad", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "cancelled": { text: "Avbruten", className: "bg-red-100 dark:bg-red-900/20 text-red-400" },
      "partially paid": { text: "Delvis betald", className: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400" },
      "reminder": { text: "Påminnelse", className: "bg-red-100 dark:bg-red-900/20 text-red-400" },
      "authorised": { text: "Godkänd", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "expired": { text: "Utgången", className: "bg-red-100 dark:bg-red-900/20 text-red-400" },
      "full credit": { text: "Krediterad", className: "bg-purple-900/20 text-purple-400" },
      "partial credit": { text: "Delvis krediterad", className: "bg-purple-900/20 text-purple-400" },
      "customer has paid": { text: "Kunden har betalat", className: "bg-green-100 dark:bg-green-900/20 text-green-400" },
      
      // Mapping English status to Swedish
      "created": { text: "Skapad", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "approved": { text: "Godkänd", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "sent": { text: "Skickad", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "open": { text: "Öppen", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "written off": { text: "Avskriven", className: "bg-red-100 dark:bg-red-900/20 text-red-400" },
      "finished": { text: "Avslutad", className: "bg-green-100 dark:bg-green-900/20 text-green-400" }
    };

    // Make case-insensitive lookup
    const normalizedStatus = status?.toLowerCase() || 'ongoing';
    const defaultStatus = { text: "Pågående", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" };
    return statusMap[normalizedStatus] || defaultStatus;
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Fortnox Project-Invoice Integration</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project">Select Project</Label>
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                  disabled={loading || projects.length === 0}
                >
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.ProjectNumber} value={project.ProjectNumber}>
                        {project.ProjectNumber} - {project.Description} ({project.CustomerName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {projectTasks.length > 0 && (
                <div className="border rounded-md p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="font-medium">Project Tasks</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={toggleSelectAllTasks}
                      className="text-xs h-7 px-2"
                    >
                      {selectedTasks.length === projectTasks.length ? (
                        <div className="flex items-center">
                          <CheckSquare className="h-3.5 w-3.5 mr-1" />
                          Deselect All
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Square className="h-3.5 w-3.5 mr-1" />
                          Select All
                        </div>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {projectTasks.map((task) => (
                      <div key={task.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`task-${task.id}`} 
                          checked={selectedTasks.includes(task.id)}
                          onCheckedChange={() => toggleTaskSelection(task.id)}
                        />
                        <Label 
                          htmlFor={`task-${task.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {task.title} {task.progress ? `(${task.progress}%)` : ''}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="taskDetails">Custom Task Details (Optional)</Label>
                <Input
                  id="taskDetails"
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  placeholder="Enter custom task details"
                  disabled={loading}
                />
                <p className="text-xs text-foreground0">
                  Use this for custom task details if no tasks are selected above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="link">
              <TabsList className="mb-4">
                <TabsTrigger value="link" className="flex items-center gap-1">
                  <Link className="h-4 w-4" /> Link Existing Invoice
                </TabsTrigger>
                <TabsTrigger value="create" className="flex items-center gap-1">
                  <Plus className="h-4 w-4" /> Create New Invoice
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="link" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice">Select Invoice to Link</Label>
                  <Select
                    value={selectedInvoice}
                    onValueChange={setSelectedInvoice}
                    disabled={loading || invoices.length === 0 || !selectedProject}
                  >
                    <SelectTrigger id="invoice">
                      <SelectValue placeholder="Select an invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices
                        .filter(invoice => !projectInvoices.some(pi => pi.DocumentNumber === invoice.DocumentNumber))
                        .map((invoice) => (
                          <SelectItem key={invoice.DocumentNumber} value={invoice.DocumentNumber}>
                            {invoice.DocumentNumber} - {invoice.CustomerName} ({formatCurrency(invoice.Total)})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={linkInvoiceToProject}
                  disabled={loading || !selectedProject || !selectedInvoice}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Link className="mr-2 h-4 w-4" />
                      Link Invoice to Project
                    </>
                  )}
                </Button>
              </TabsContent>
              
              <TabsContent value="create" className="space-y-4">
                <form onSubmit={createLinkedInvoice} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceDescription">Invoice Description</Label>
                    <Input
                      id="invoiceDescription"
                      value={invoiceDescription}
                      onChange={(e) => setInvoiceDescription(e.target.value)}
                      placeholder="Services for project..."
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="invoiceType">Invoice Type</Label>
                    <Select
                      value={invoiceType}
                      onValueChange={setInvoiceType}
                      disabled={loading}
                    >
                      <SelectTrigger id="invoiceType">
                        <SelectValue placeholder="Select invoice type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INVOICE">Send Invoice</SelectItem>
                        <SelectItem value="OFFER">Create Draft (Offer)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-foreground0">
                      {invoiceType === "OFFER" ? 
                        "Creates a draft invoice (offer) - won't be sent to customer" : 
                        "Creates a normal invoice that will be processed"
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrice">Price (SEK)</Label>
                    <Input
                      id="invoicePrice"
                      type="number"
                      value={invoicePrice}
                      onChange={(e) => setInvoicePrice(Number(e.target.value))}
                      placeholder="1000"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
                    <div className="flex gap-2">
                      <FileCheck className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Preview:</p>
                        <p className="text-sm text-amber-700">
                          {selectedProject ? (
                            <>
                              Project: {selectedProject}
                              <br />
                              Description: {invoiceDescription || "Default description"}
                              <br />
                              Price: {formatCurrency(invoicePrice || 1000)}
                              <br />
                              Type: {invoiceType === "OFFER" ? "Draft (Offer)" : "Invoice"}
                              <br />
                              Tasks: {selectedTasks.length > 0 
                                ? projectTasks
                                    .filter(task => selectedTasks.includes(task.id))
                                    .map(task => task.title)
                                    .join(", ")
                                : taskDetails || "None specified"}
                            </>
                          ) : (
                            "Select a project first"
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit"
                    disabled={loading || !selectedProject}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create & Link Invoice
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Project Invoices List */}
      {selectedProject && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invoices for {selectedProject}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : projectInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 px-4 text-left">Invoice #</th>
                      <th className="py-2 px-4 text-left">Date</th>
                      <th className="py-2 px-4 text-left">Customer</th>
                      <th className="py-2 px-4 text-right">Amount</th>
                      <th className="py-2 px-4 text-left">Status</th>
                      <th className="py-2 px-4 text-left">Task Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectInvoices.map((invoice) => {
                      const status = getStatusDisplay(invoice.Status || "ongoing");
                      return (
                        <tr key={invoice.DocumentNumber} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4">
                            <div className="flex items-center">
                              <Link className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                              {invoice.DocumentNumber}
                            </div>
                          </td>
                          <td className="py-2 px-4">{new Date(invoice.InvoiceDate).toLocaleDateString()}</td>
                          <td className="py-2 px-4">{invoice.CustomerName}</td>
                          <td className="py-2 px-4 text-right">{formatCurrency(invoice.Total)}</td>
                          <td className="py-2 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                              {status.text}
                            </span>
                          </td>
                          <td className="py-2 px-4">{invoice.TaskDetails || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-6 text-foreground0">No invoices linked to this project yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 