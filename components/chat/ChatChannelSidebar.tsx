'use client';

import { useState, useEffect } from "react";
import { Hash, Users, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  channel_type: 'public' | 'private';
  created_by: string;
  member_count?: number;
  unread_count?: number;
  last_message_at?: string;
  created_at: string;
}

interface ChatChannelSidebarProps {
  workspaceId: string;
  selectedChannelId: string | null;
  onChannelSelect: (channelId: string | null) => void;
  onManageChannels: () => void;
  refreshTrigger?: number;
  currentUserId: string;
}

export function ChatChannelSidebar({
  workspaceId,
  selectedChannelId,
  onChannelSelect,
  onManageChannels,
  refreshTrigger,
  currentUserId,
}: ChatChannelSidebarProps) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelCounts, setChannelCounts] = useState<Record<string, { members: number; unread: number }>>({});
  const [totalMembers, setTotalMembers] = useState<number>(0);

  const loadChannels = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Use API endpoint instead of direct Supabase call
      const response = await fetch(`/api/chat-channels?workspace_id=${workspaceId}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch chat channels');
      }
      
      const data = await response.json();
      setChannels(data.channels || []);
      
      // Fetch channel stats (member counts, unread messages)
      await fetchChannelStats(data.channels || []);
      
    } catch (error) {
      console.error("Error loading chat channels:", error);
      toast.error("Failed to load chat channels");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannelStats = async (channels: ChatChannel[]) => {
    try {
      // Fetch member counts and unread message counts for each channel
      const statsPromises = channels.map(async (channel) => {
        try {
          // Get member count
          const memberResponse = await fetch(`/api/chat-channels/${channel.id}/members`, {
            method: 'GET',
            credentials: 'include',
          });
          
          let memberCount = 0;
          if (memberResponse.ok) {
            const memberData = await memberResponse.json();
            memberCount = memberData.count || 0;
          }

          // Get unread message count
          const unreadResponse = await fetch(`/api/chat-channels/${channel.id}/unread?user_id=${currentUserId}`, {
            method: 'GET',
            credentials: 'include',
          });
          
          let unreadCount = 0;
          if (unreadResponse.ok) {
            const unreadData = await unreadResponse.json();
            unreadCount = unreadData.count || 0;
          }

          return {
            channelId: channel.id,
            members: memberCount,
            unread: unreadCount,
          };
        } catch (error) {
          console.error(`Error fetching stats for channel ${channel.id}:`, error);
          return {
            channelId: channel.id,
            members: 0,
            unread: 0,
          };
        }
      });

      const stats = await Promise.all(statsPromises);
      
      // Convert to record format
      const countMap: Record<string, { members: number; unread: number }> = {};
      let totalMemberCount = 0;
      
      stats.forEach(stat => {
        countMap[stat.channelId] = {
          members: stat.members,
          unread: stat.unread,
        };
        totalMemberCount += stat.members;
      });

      console.log('[ChatChannelSidebar] Channel stats:', {
        totalChannels: channels.length,
        totalMemberCount,
        countMap,
      });

      setChannelCounts(countMap);
      setTotalMembers(totalMemberCount);
      
    } catch (error) {
      console.error('[ChatChannelSidebar] Failed to fetch channel stats:', error);
      // Set empty counts if API fails
      setChannelCounts({});
      setTotalMembers(0);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [workspaceId, refreshTrigger]);

  return (
    <div className="w-64 border-r border-border">
      <div className="p-3">
        <h3 className="font-medium text-foreground mb-3">Chat Channels</h3>
        
        <div className="space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-left font-normal",
              selectedChannelId === null 
                ? "bg-background/60 text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onChannelSelect(null)}
          >
            <Users className="h-4 w-4 mr-2" />
            <span>General Chat</span>
            <Badge className="ml-auto bg-background text-foreground dark:text-neutral-300" variant="outline">
              {totalMembers}
            </Badge>
          </Button>
          
          {loading ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">
              <div className="animate-pulse h-4 w-full bg-background rounded"></div>
            </div>
          ) : channels.length === 0 ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">
              No channels yet
            </div>
          ) : (
            channels.map((channel) => (
              <Button
                key={channel.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  selectedChannelId === channel.id 
                    ? "bg-background/60 text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onChannelSelect(channel.id)}
              >
                <Hash className="h-4 w-4 mr-2 text-green-400" />
                <span className="truncate">{channel.name}</span>
                <div className="ml-auto flex items-center gap-1">
                  {channelCounts[channel.id]?.unread > 0 && (
                    <Badge className="bg-red-500 text-white" variant="default">
                      {channelCounts[channel.id].unread}
                    </Badge>
                  )}
                  <Badge className="bg-background text-foreground dark:text-neutral-300" variant="outline">
                    {channelCounts[channel.id]?.members || 0}
                  </Badge>
                </div>
              </Button>
            ))
          )}
        </div>
      </div>
      
      <div className="p-3 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border mt-4"
          onClick={onManageChannels}
        >
          <Plus className="h-4 w-4 mr-2" />
          Manage Channels
        </Button>
      </div>
    </div>
  );
}
