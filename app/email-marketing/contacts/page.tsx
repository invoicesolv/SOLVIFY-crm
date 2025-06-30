"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { 
  Users, 
  Plus, 
  Search,
  Filter,
  Download,
  Upload,
  Mail,
  Phone,
  Building,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  List,
  Eye,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getActiveWorkspaceId } from '@/lib/permission';
import { SidebarDemo } from "@/components/ui/code.demo";
import { EmailMarketingNav } from '@/components/email-marketing/EmailMarketingNav';

interface Contact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  status: 'active' | 'unsubscribed' | 'bounced';
  source: string;
  created_at: string;
  custom_fields?: Record<string, any>;
}

interface ContactList {
  id: string;
  name: string;
  description?: string;
  total_contacts: number;
  active_contacts: number;
  created_at: string;
}

interface ListSubscription {
  contact_id: string;
  list_id: string;
  subscribed_at: string;
  status: 'subscribed' | 'unsubscribed';
}

export default function ContactsPage() {
  const { user, session } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedList, setSelectedList] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contacts');
  
  // New list dialog
  const [newListDialog, setNewListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [addAllContacts, setAddAllContacts] = useState(false);
  
  // New contact dialog
  const [newContactDialog, setNewContactDialog] = useState(false);
  const [newContact, setNewContact] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    company: '',
    source: 'manual'
  });

  useEffect(() => {
    const initializeWorkspace = async () => {
      if (user?.id) {
        try {
          const activeWorkspaceId = await getActiveWorkspaceId(user.id);
          setWorkspaceId(activeWorkspaceId);
        } catch (error) {
          console.error('Error getting workspace ID:', error);
        }
      }
    };
    
    initializeWorkspace();
  }, [user?.id]);

  useEffect(() => {
    if (workspaceId) {
      fetchData();
    }
  }, [workspaceId, selectedList]);

  const fetchData = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Fetch contact lists
      const { data: listsData, error: listsError } = await supabase
        .from('email_lists')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;
      setContactLists(listsData || []);

      // Fetch contacts
      let contactsQuery = supabase
        .from('email_contacts')
        .select('*')
        .eq('workspace_id', workspaceId);

      // Filter by list if selected
      if (selectedList !== 'all') {
        const { data: subscriptions } = await supabase
          .from('list_subscriptions')
          .select('contact_id')
          .eq('list_id', selectedList)
          .eq('status', 'subscribed');
        
        if (subscriptions) {
          const contactIds = subscriptions.map(sub => sub.contact_id);
          contactsQuery = contactsQuery.in('id', contactIds);
        }
      }

      const { data: contactsData, error: contactsError } = await contactsQuery
        .order('created_at', { ascending: false });

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);

    } catch (error) {
      console.error('Error fetching contacts data:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const createList = async () => {
    if (!workspaceId || !user?.id || !newListName.trim()) return;
    
    try {
      // Create the list first
      const { data: newList, error: listError } = await supabase
        .from('email_lists')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
          total_contacts: 0,
          active_contacts: 0
        })
        .select()
        .single();

      if (listError) throw listError;

      // If user wants to add all existing contacts
      if (addAllContacts && contacts.length > 0 && newList) {
        const subscriptions = contacts.map(contact => ({
          list_id: newList.id,
          contact_id: contact.id,
          status: 'subscribed' as const,
          subscribed_at: new Date().toISOString()
        }));

        const { error: subscriptionError } = await supabase
          .from('list_subscriptions')
          .insert(subscriptions);

        if (subscriptionError) {
          console.error('Error adding contacts to list:', subscriptionError);
          // Don't fail completely, just warn
          toast.warning('List created but some contacts could not be added');
        } else {
          // Update the list counts
          await supabase
            .from('email_lists')
            .update({
              total_contacts: contacts.length,
              active_contacts: contacts.filter(c => c.status === 'active').length
            })
            .eq('id', newList.id);
        }
      }
      
      setNewListName('');
      setNewListDescription('');
      setAddAllContacts(false);
      setNewListDialog(false);
      fetchData();
      toast.success(`Contact list created successfully${addAllContacts ? ` with ${contacts.length} contacts` : ''}`);
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create contact list');
    }
  };

  const createContact = async () => {
    if (!workspaceId || !newContact.email.trim()) return;
    
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newContact.email.trim())) {
        toast.error('Please enter a valid email address');
        return;
      }

      // Check for duplicate email
      const { data: existingContact } = await supabase
        .from('email_contacts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('email', newContact.email.trim())
        .single();

      if (existingContact) {
        toast.error('A contact with this email already exists');
        return;
      }

      const contactData = {
        workspace_id: workspaceId,
        email: newContact.email.trim().toLowerCase(),
        first_name: newContact.first_name.trim() || null,
        last_name: newContact.last_name.trim() || null,
        phone: newContact.phone.trim() || null,
        company: newContact.company.trim() || null,
        status: 'active' as const,
        source: newContact.source
      };

      console.log('Creating contact with data:', contactData);

      const { data, error } = await supabase
        .from('email_contacts')
        .insert(contactData)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Contact created successfully:', data);
      
      setNewContact({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        company: '',
        source: 'manual'
      });
      setNewContactDialog(false);
      fetchData();
      toast.success('Contact added successfully');
    } catch (error: any) {
      console.error('Error creating contact:', error);
      
      // More specific error messages
      if (error.code === '23505') {
        toast.error('A contact with this email already exists');
      } else if (error.code === '42P01') {
        toast.error('Email contacts table not found. Please check your database setup.');
      } else if (error.message?.includes('workspace_id')) {
        toast.error('Invalid workspace. Please refresh and try again.');
      } else {
        toast.error(`Failed to add contact: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const deleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list? This action cannot be undone.')) return;
    
    try {
      // Delete subscriptions first
      await supabase
        .from('list_subscriptions')
        .delete()
        .eq('list_id', listId);
      
      // Delete the list
      const { error } = await supabase
        .from('email_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;
      
      if (selectedList === listId) {
        setSelectedList('all');
      }
      fetchData();
      toast.success('Contact list deleted');
    } catch (error) {
      console.error('Error deleting list:', error);
      toast.error('Failed to delete contact list');
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      // Delete subscriptions first
      await supabase
        .from('list_subscriptions')
        .delete()
        .eq('contact_id', contactId);
      
      // Delete the contact
      const { error } = await supabase
        .from('email_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      
      fetchData();
      toast.success('Contact deleted');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'unsubscribed':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'bounced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarDemo>
      <EmailMarketingNav />
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contacts</h1>
            <p className="text-muted-foreground">Manage your email contacts and lists</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/email-marketing/contacts/import">
              <Button variant="outline" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </Link>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Dialog open={newContactDialog} onOpenChange={setNewContactDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input
                        id="first-name"
                        value={newContact.first_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, first_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input
                        id="last-name"
                        value={newContact.last_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, last_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={newContact.company}
                      onChange={(e) => setNewContact(prev => ({ ...prev, company: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select value={newContact.source} onValueChange={(value) => setNewContact(prev => ({ ...prev, source: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Entry</SelectItem>
                        <SelectItem value="import">CSV Import</SelectItem>
                        <SelectItem value="form">Web Form</SelectItem>
                        <SelectItem value="api">API</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setNewContactDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createContact} disabled={!newContact.email.trim()}>
                      Add Contact
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contacts.length.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                All contacts in workspace
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {contacts.filter(c => c.status === 'active').length.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Ready to receive emails
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contact Lists</CardTitle>
              <List className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contactLists.length}</div>
              <p className="text-xs text-muted-foreground">
                Organized segments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {contacts.length > 0 ? ((contacts.filter(c => c.status === 'bounced').length / contacts.length) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Email deliverability
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="lists">Lists</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Contacts</CardTitle>
                  <div className="flex items-center gap-4">
                    <Select value={selectedList} onValueChange={setSelectedList}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by list" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Contacts</SelectItem>
                        {contactLists.map(list => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.active_contacts})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-2 text-sm font-semibold">No contacts found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first contact.'}
                      </p>
                      {!searchTerm && (
                        <div className="mt-6 flex justify-center gap-3">
                          <Button onClick={() => setNewContactDialog(true)}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Contact
                          </Button>
                          <Link href="/email-marketing/contacts/import">
                            <Button variant="outline">
                              <Upload className="h-4 w-4 mr-2" />
                              Import Contacts
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {contact.first_name?.charAt(0) || contact.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {contact.first_name || contact.last_name 
                                    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                                    : contact.email}
                                </span>
                                <Badge className={getStatusColor(contact.status)}>
                                  {contact.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </span>
                                {contact.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </span>
                                )}
                                {contact.company && (
                                  <span className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {contact.company}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(contact.created_at).toLocaleDateString()}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => deleteContact(contact.id)} className="text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lists" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Contact Lists</CardTitle>
                  <Dialog open={newListDialog} onOpenChange={setNewListDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create List
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Contact List</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="list-name">List Name *</Label>
                          <Input
                            id="list-name"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="e.g., Newsletter Subscribers"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="list-description">Description</Label>
                          <Textarea
                            id="list-description"
                            value={newListDescription}
                            onChange={(e) => setNewListDescription(e.target.value)}
                            placeholder="Describe this contact list..."
                          />
                        </div>
                        {contacts.length > 0 && (
                          <div className="space-y-2">
                            <Label>Add Existing Contacts (Optional)</Label>
                            <p className="text-sm text-muted-foreground">
                              You can add your existing {contacts.length} contact(s) to this list
                            </p>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="add-all-contacts"
                                checked={addAllContacts}
                                onChange={(e) => setAddAllContacts(e.target.checked)}
                                className="rounded"
                              />
                              <Label htmlFor="add-all-contacts" className="text-sm">
                                Add all {contacts.length} existing contacts to this list
                              </Label>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setNewListDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={createList} disabled={!newListName.trim()}>
                            Create List
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {contactLists.length === 0 ? (
                  <div className="text-center py-12">
                    <List className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">No contact lists</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create lists to organize your contacts for targeted campaigns.
                    </p>
                    <div className="mt-6">
                      <Button onClick={() => setNewListDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First List
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contactLists.map((list) => (
                      <Card key={list.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{list.name}</CardTitle>
                              {list.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {list.description}
                                </p>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Contacts
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit List
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => deleteList(list.id)} className="text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete List
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Active Contacts:</span>
                              <span className="font-medium">{list.active_contacts}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Total Contacts:</span>
                              <span className="font-medium">{list.total_contacts}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Created:</span>
                              <span className="text-muted-foreground">
                                {new Date(list.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarDemo>
  );
} 