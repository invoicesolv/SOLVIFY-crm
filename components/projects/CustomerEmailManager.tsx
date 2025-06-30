import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/lib/auth-client';
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Mail, User, Building, CheckCircle, AlertCircle } from "lucide-react";

interface Project {
  id: string;
  name: string;
  customer_name: string;
  customer_id: string | null;
  status: string;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  contact_person: string | null;
}

interface CustomerEmailManagerProps {
  onClose: () => void;
}

export function CustomerEmailManager({ onClose }: CustomerEmailManagerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [updatingEmails, setUpdatingEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Load projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, customer_name, customer_id, status')
        .eq('user_id', user.id)
        .order('name');

      if (projectsError) throw projectsError;

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, contact_person')
        .eq('user_id', user.id)
        .order('name');

      if (customersError) throw customersError;

      setProjects(projectsData || []);
      setCustomers(customersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load projects and customers');
    } finally {
      setLoading(false);
    }
  };

  const updateCustomerEmail = async (customerId: string, email: string) => {
    try {
      setUpdatingEmails(prev => new Set(prev).add(customerId));
      
      const { error } = await supabase
        .from('customers')
        .update({ email: email.trim() || null })
        .eq('id', customerId);

      if (error) throw error;

      // Update local state
      setCustomers(prev => prev.map(customer => 
        customer.id === customerId 
          ? { ...customer, email: email.trim() || null }
          : customer
      ));

      toast.success('Customer email updated successfully');
    } catch (error) {
      console.error('Error updating customer email:', error);
      toast.error('Failed to update customer email');
    } finally {
      setUpdatingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(customerId);
        return newSet;
      });
    }
  };

  const linkProjectToCustomer = async (projectId: string, customerId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ customer_id: customerId })
        .eq('id', projectId);

      if (error) throw error;

      // Update local state
      setProjects(prev => prev.map(project => 
        project.id === projectId 
          ? { ...project, customer_id: customerId }
          : project
      ));

      toast.success('Project linked to customer successfully');
    } catch (error) {
      console.error('Error linking project to customer:', error);
      toast.error('Failed to link project to customer');
    }
  };

  const getCustomerForProject = (project: Project) => {
    return customers.find(customer => customer.id === project.customer_id);
  };

  const getProjectsWithoutCustomerEmail = () => {
    return projects.filter(project => {
      const customer = getCustomerForProject(project);
      return !customer || !customer.email;
    });
  };

  const getProjectsWithCustomerEmail = () => {
    return projects.filter(project => {
      const customer = getCustomerForProject(project);
      return customer && customer.email;
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background p-8 rounded-lg border border-border">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading projects and customers...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Customer Email Management</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Set up customer emails for project-specific notifications
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Ready for Notifications</p>
                    <p className="text-2xl font-bold text-green-600">{getProjectsWithCustomerEmail().length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Need Email Setup</p>
                    <p className="text-2xl font-bold text-orange-600">{getProjectsWithoutCustomerEmail().length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Total Customers</p>
                    <p className="text-2xl font-bold text-blue-600">{customers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projects Needing Email Setup */}
          {getProjectsWithoutCustomerEmail().length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <span>Projects Needing Email Setup</span>
                </CardTitle>
                <CardDescription>
                  These projects don't have customer emails configured for notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {getProjectsWithoutCustomerEmail().map(project => {
                  const customer = getCustomerForProject(project);
                  return (
                    <div key={project.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{project.name}</h4>
                          <p className="text-sm text-muted-foreground">Customer: {project.customer_name}</p>
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                            {project.status}
                          </Badge>
                        </div>
                        <div className="ml-4 space-y-2 min-w-0 flex-1 max-w-md">
                          {customer ? (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Customer Email</Label>
                              <div className="flex space-x-2">
                                <Input
                                  type="email"
                                  placeholder="Enter customer email"
                                  defaultValue={customer.email || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== customer.email) {
                                      updateCustomerEmail(customer.id, e.target.value);
                                    }
                                  }}
                                  disabled={updatingEmails.has(customer.id)}
                                />
                                <Button
                                  size="sm"
                                  disabled={updatingEmails.has(customer.id)}
                                  onClick={() => {
                                    const input = document.querySelector(`input[defaultValue="${customer.email || ''}"]`) as HTMLInputElement;
                                    if (input) {
                                      updateCustomerEmail(customer.id, input.value);
                                    }
                                  }}
                                >
                                  {updatingEmails.has(customer.id) ? '...' : 'Save'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Link to Customer</Label>
                              <select
                                className="w-full p-2 border border-border rounded-md bg-background text-foreground text-sm"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    linkProjectToCustomer(project.id, e.target.value);
                                  }
                                }}
                                defaultValue=""
                              >
                                <option value="">Select customer...</option>
                                {customers.map(customer => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.name} {customer.email ? `(${customer.email})` : '(no email)'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Projects Ready for Notifications */}
          {getProjectsWithCustomerEmail().length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Projects Ready for Notifications</span>
                </CardTitle>
                <CardDescription>
                  These projects have customer emails configured and will receive targeted notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {getProjectsWithCustomerEmail().map(project => {
                  const customer = getCustomerForProject(project);
                  return (
                    <div key={project.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{project.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {customer?.name} • {customer?.email}
                          </p>
                        </div>
                      </div>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="p-6 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> Projects with customer emails will automatically send notifications to the right people when triggers activate.
            </p>
            <Button onClick={loadData} variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 