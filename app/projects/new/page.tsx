"use client";

import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Customer {
  id: string;
  name: string;
}

interface ProjectData {
  name: string;
  customer_name: string;
  status: 'active' | 'on-hold' | 'completed';
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  user_id: string;
  customer_id?: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.id) {
      fetchCustomers();
    }
  }, [session?.user?.id]);

  const fetchCustomers = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to create a project');
      return;
    }

    try {
      console.log('Fetching customers for user ID:', session.user.id);
      
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');

      if (error) {
        console.error('Error fetching customers:', error);
        setError('Failed to fetch customers');
        return;
      }

      console.log(`Fetched ${customers?.length || 0} customers`);
      setCustomers(customers || []);
    } catch (error) {
      console.error('Error in fetchCustomers:', error);
      setError('Failed to fetch customers');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (!session?.user?.id) {
      toast.error('Please sign in to create a project');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData(e.currentTarget);
      const customerId = formData.get('customer_id') as string;
      const selectedCustomer = customers.find(c => c.id === customerId);

      const projectData: ProjectData = {
        name: formData.get('name') as string,
        customer_name: selectedCustomer?.name || '',
        customer_id: customerId,
        status: (formData.get('status') as 'active' | 'on-hold' | 'completed') || 'active',
        start_date: formData.get('start_date') as string || null,
        end_date: formData.get('end_date') as string || null,
        description: formData.get('description') as string || null,
        user_id: session.user.id
      };

      console.log('Creating project:', projectData.name);
      
      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        setError('Failed to create project');
        setLoading(false);
        return;
      }

      console.log('Project created successfully:', data.id);
      toast.success('Project created successfully');
      router.push('/projects');
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast.error(`Failed to create project: ${error.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <h1 className="text-2xl font-semibold text-white mb-6">New Project</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-neutral-400">
                  Project Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="customer_id" className="block text-sm font-medium text-neutral-400">
                  Customer
                </label>
                <select
                  id="customer_id"
                  name="customer_id"
                  required
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="status" className="block text-sm font-medium text-neutral-400">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  required
                  defaultValue="active"
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="start_date" className="block text-sm font-medium text-neutral-400">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="end_date" className="block text-sm font-medium text-neutral-400">
                  End Date
                </label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium text-neutral-400">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:cursor-not-allowed border border-neutral-600 rounded-md text-sm text-white transition-colors"
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </SidebarDemo>
  );
} 