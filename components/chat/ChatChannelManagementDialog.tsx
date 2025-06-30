'use client';

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Hash, Lock, Globe, Plus, Trash2, Edit, Check } from "lucide-react";

interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  channel_type: 'public' | 'private';
  created_by: string;
  created_at: string;
}

interface ChatChannelManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onChannelsChanged: () => void;
}

export function ChatChannelManagementDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onChannelsChanged,
}: ChatChannelManagementDialogProps) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [newChannelType, setNewChannelType] = useState<'public' | 'private'>('public');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingChannel, setEditingChannel] = useState<{ id: string, name: string, description?: string } | null>(null);

  const fetchChannels = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Use our new API endpoint instead of direct Supabase call
      const response = await fetch(`/api/chat-channels?workspace_id=${workspaceId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch chat channels');
      }
      
      const data = await response.json();
      setChannels(data.channels || []);
    } catch (error) {
      console.error("Error fetching chat channels:", error);
      toast.error("Failed to load chat channels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchChannels();
    }
  }, [open, workspaceId]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Channel name cannot be empty");
      return;
    }

    try {
      setCreating(true);
      
      const response = await fetch('/api/chat-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newChannelName,
          description: newChannelDescription || null,
          workspace_id: workspaceId,
          channel_type: newChannelType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create channel');
      }

      toast.success("Chat channel created successfully");
      setNewChannelName("");
      setNewChannelDescription("");
      setNewChannelType('public');
      fetchChannels();
      onChannelsChanged();
    } catch (error) {
      console.error("Error creating chat channel:", error);
      toast.error("Failed to create chat channel");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateChannel = async () => {
    if (!editingChannel || !editingChannel.name.trim()) {
      toast.error("Channel name cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from("chat_channels")
        .update({ 
          name: editingChannel.name,
          description: editingChannel.description || null
        })
        .eq("id", editingChannel.id);

      if (error) throw error;

      toast.success("Chat channel updated successfully");
      setEditingChannel(null);
      fetchChannels();
      onChannelsChanged();
    } catch (error) {
      console.error("Error updating chat channel:", error);
      toast.error("Failed to update chat channel");
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      // First, delete all channel members
      const { error: membersError } = await supabase
        .from("chat_channel_members")
        .delete()
        .eq("channel_id", channelId);

      if (membersError) throw membersError;

      // Then delete all messages in the channel
      const { error: messagesError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("channel_id", channelId);

      if (messagesError) throw messagesError;

      // Finally delete the channel itself
      const { error } = await supabase
        .from("chat_channels")
        .delete()
        .eq("id", channelId);

      if (error) throw error;

      toast.success("Chat channel deleted successfully");
      fetchChannels();
      onChannelsChanged();
    } catch (error) {
      console.error("Error deleting chat channel:", error);
      toast.error("Failed to delete chat channel");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Manage Chat Channels</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create and manage channels for team communication.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Create new channel form */}
          <div className="space-y-3 p-4 border border-border rounded-lg">
            <h4 className="text-sm font-medium text-foreground">Create New Channel</h4>
            
            <div className="space-y-2">
              <Label>Channel Name</Label>
              <Input
                placeholder="general, random, announcements..."
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="What's this channel about?"
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Channel Type</Label>
              <Select value={newChannelType} onValueChange={(value: 'public' | 'private') => setNewChannelType(value)}>
                <SelectTrigger className="bg-background border-border dark:border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Public - Anyone can join
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Private - Invitation only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreateChannel} 
              disabled={creating || !newChannelName.trim()}
              className="w-full flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Channel
            </Button>
          </div>

          {/* Existing channels list */}
          <div className="border rounded-md border-border overflow-hidden">
            <div className="p-3 bg-background text-foreground font-medium border-b border-border dark:border-border">
              Your Chat Channels
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto mb-2" />
                  Loading channels...
                </div>
              ) : channels.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No chat channels yet. Create your first channel above.
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-border">
                  {channels.map((channel) => (
                    <div key={channel.id} className="p-3 flex items-center justify-between hover:bg-background/50">
                      <div className="flex items-center space-x-2">
                        {channel.channel_type === 'private' ? (
                          <Lock className="h-4 w-4 text-yellow-400" />
                        ) : (
                          <Hash className="h-4 w-4 text-green-400" />
                        )}
                        {editingChannel?.id === channel.id ? (
                          <div className="space-y-1">
                            <Input
                              value={editingChannel.name}
                              onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                              className="h-8 text-sm bg-background border-border dark:border-border text-foreground"
                              autoFocus
                            />
                            <Textarea
                              value={editingChannel.description || ''}
                              onChange={(e) => setEditingChannel({ ...editingChannel, description: e.target.value })}
                              className="h-16 text-xs bg-background border-border dark:border-border text-foreground"
                              placeholder="Channel description..."
                              rows={2}
                            />
                          </div>
                        ) : (
                          <div>
                            <span className="text-foreground font-medium">{channel.name}</span>
                            {channel.description && (
                              <p className="text-xs text-muted-foreground">{channel.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {editingChannel?.id === channel.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleUpdateChannel}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingChannel(null)}
                              className="h-8 w-8 p-0"
                            >
                              ×
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingChannel({ 
                                id: channel.id, 
                                name: channel.name, 
                                description: channel.description 
                              })}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteChannel(channel.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
