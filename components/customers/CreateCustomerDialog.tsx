"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: () => void;
}

export function CreateCustomerDialog({ open, onOpenChange, onCustomerCreated }: CreateCustomerDialogProps) {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    customer_number: "",
    email: "",
    phone: "",
    address: "",
    address2: "",
    city: "",
    zip_code: "",
    contact_person: "",
    organization_number: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error messages when the user starts typing again
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      customer_number: "",
      email: "",
      phone: "",
      address: "",
      address2: "",
      city: "",
      zip_code: "",
      contact_person: "",
      organization_number: ""
    });
    setIsSuccess(false);
    setErrorMessage(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Small delay to allow the dialog closing animation
      setTimeout(resetForm, 300);
    }
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.id) {
      toast.error('Please sign in to create a customer');
      setErrorMessage('Authentication required. Please sign in.');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      setErrorMessage('Customer name is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      console.log('Creating customer with data:', formData);
      const response = await fetch('/api/customers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Failed to create customer';
        throw new Error(errorMsg);
      }
      
      setIsSuccess(true);
      toast.success('Customer created successfully');
      
      // Notify the parent component that a customer was created
      if (onCustomerCreated) {
        onCustomerCreated();
      }
      
      // Automatically close after a short delay
      setTimeout(() => {
        handleOpenChange(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error creating customer:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to create customer';
      toast.error(errorMsg);
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-neutral-800 border-neutral-700 text-white">
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Fill in the details to create a new customer
          </DialogDescription>
        </DialogHeader>
        
        {isSuccess ? (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Customer Created Successfully</h3>
            <p className="text-neutral-400 max-w-sm">
              The customer has been added to your workspace. You can now manage their information, projects, and invoices.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-sm text-red-400">
                {errorMessage}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter customer name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="bg-neutral-700 border-neutral-600"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_number">Customer Number</Label>
                  <Input
                    id="customer_number"
                    name="customer_number"
                    placeholder="Enter customer number"
                    value={formData.customer_number}
                    onChange={handleInputChange}
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="Street address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address2">Address Line 2</Label>
                <Input
                  id="address2"
                  name="address2"
                  placeholder="Apartment, suite, etc."
                  value={formData.address2}
                  onChange={handleInputChange}
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">Postal Code</Label>
                  <Input
                    id="zip_code"
                    name="zip_code"
                    placeholder="Postal code"
                    value={formData.zip_code}
                    onChange={handleInputChange}
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization_number">Organization Number</Label>
                  <Input
                    id="organization_number"
                    name="organization_number"
                    placeholder="Organization number"
                    value={formData.organization_number}
                    onChange={handleInputChange}
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  placeholder="Primary contact person"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="bg-neutral-700 border-neutral-600 text-white hover:bg-neutral-600"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="bg-blue-600 text-white hover:bg-blue-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Customer'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
} 