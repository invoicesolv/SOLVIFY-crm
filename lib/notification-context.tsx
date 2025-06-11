"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UnreadMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface NotificationContextType {
  unreadMessages: { [userId: string]: UnreadMessage[] };
  totalUnread: number;
  markAsRead: (userId: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadMessages, setUnreadMessages] = useState<{ [userId: string]: UnreadMessage[] }>({});
  const [totalUnread, setTotalUnread] = useState(0);

  // Initialize with existing unread messages
  useEffect(() => {
    const initializeUnreadMessages = async () => {
      try {
        console.log('NotificationProvider: Initializing unread messages');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log('NotificationProvider: No authenticated user found');
          return;
        }

        console.log('NotificationProvider: Current user ID:', user.id);

        // Check for existing unread messages (messages sent to this user that they haven't seen)
        // For simplicity, we'll consider all messages from the last hour as potentially unread
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { data: recentMessages, error } = await supabase
          .from('chat_messages')
          .select('*')
          .gte('created_at', oneHourAgo)
          .neq('user_id', user.id); // Messages not from current user

        if (error) {
          console.error('NotificationProvider: Error fetching recent messages:', error);
          return;
        }

        console.log('NotificationProvider: Found recent messages:', recentMessages?.length || 0);

        if (recentMessages && recentMessages.length > 0) {
          // Process each message to see if it should be a notification
          for (const message of recentMessages) {
            // For private messages, check if current user is the recipient
            if (message.message_type === 'private') {
              const metadata = message.metadata || {};
              const privateRecipient = metadata.private_chat_with;
              
              if (privateRecipient === user.id) {
                console.log('NotificationProvider: Found unread private message from', message.user_id);
                
                // Fetch sender's info
                const { data: sender } = await supabase
                  .from('profiles')
                  .select('name')
                  .eq('user_id', message.user_id)
                  .single();

                const { data: teamMember } = await supabase
                  .from('team_members')
                  .select('name')
                  .eq('user_id', message.user_id)
                  .single();

                const senderName = sender?.name || teamMember?.name || 'Unknown User';
                
                // Add to unread messages
                setUnreadMessages(prev => {
                  const userId = message.user_id;
                  const userMessages = [...(prev[userId] || [])];
                  userMessages.push({
                    id: message.id,
                    sender_id: userId,
                    sender_name: senderName,
                    content: message.content,
                    created_at: message.created_at
                  });
                  return { ...prev, [userId]: userMessages };
                });
                
                setTotalUnread(prev => prev + 1);
              }
            }
            // For team messages, all team members should see them
            else if (message.message_type === 'text') {
              console.log('NotificationProvider: Found unread team message from', message.user_id);
              
              // Fetch sender's info
              const { data: sender } = await supabase
                .from('profiles')
                .select('name')
                .eq('user_id', message.user_id)
                .single();

              const { data: teamMember } = await supabase
                .from('team_members')
                .select('name')
                .eq('user_id', message.user_id)
                .single();

              const senderName = sender?.name || teamMember?.name || 'Unknown User';
              
              // Add to unread messages
              setUnreadMessages(prev => {
                const userId = message.user_id;
                const userMessages = [...(prev[userId] || [])];
                userMessages.push({
                  id: message.id,
                  sender_id: userId,
                  sender_name: senderName,
                  content: message.content,
                  created_at: message.created_at
                });
                return { ...prev, [userId]: userMessages };
              });
              
              setTotalUnread(prev => prev + 1);
            }
          }
        }

        console.log('NotificationProvider: Initialization complete');
      } catch (error) {
        console.error('NotificationProvider: Error initializing unread messages:', error);
      }
    };

    initializeUnreadMessages();
  }, []);

  useEffect(() => {
    console.log('NotificationProvider: Setting up real-time subscription');
    
    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('chat_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          console.log('NotificationProvider: New message received', payload);
          const newMessage = payload.new as any;
          
          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          console.log('NotificationProvider: Current user', user?.id);
          console.log('NotificationProvider: Message sender', newMessage.user_id);
          console.log('NotificationProvider: Message type', newMessage.message_type);
          console.log('NotificationProvider: Message metadata', newMessage.metadata);
          
          // Skip if it's a message from the current user
          if (newMessage.user_id === user?.id) {
            console.log('NotificationProvider: Skipping own message');
            return;
          }

          // For private messages, check if the current user is the intended recipient
          if (newMessage.message_type === 'private') {
            const metadata = newMessage.metadata || {};
            const privateRecipient = metadata.private_chat_with;
            
            // Only track private messages where current user is the recipient
            if (privateRecipient !== user?.id) {
              console.log('NotificationProvider: Skipping private message not intended for current user');
              return;
            }
            console.log('NotificationProvider: Processing private message for current user');
          }

          // Fetch sender's info
          const { data: sender } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', newMessage.user_id)
            .single();

          const { data: teamMember } = await supabase
            .from('team_members')
            .select('name')
            .eq('user_id', newMessage.user_id)
            .single();

          const senderName = sender?.name || teamMember?.name || 'Unknown User';
          console.log('NotificationProvider: Sender name resolved to', senderName);

          // Add to unread messages
          setUnreadMessages(prev => {
            const userId = newMessage.user_id;
            const userMessages = [...(prev[userId] || [])];
            userMessages.push({
              id: newMessage.id,
              sender_id: userId,
              sender_name: senderName,
              content: newMessage.content,
              created_at: newMessage.created_at
            });
            const newState = { ...prev, [userId]: userMessages };
            console.log('NotificationProvider: Updated unread messages', newState);
            return newState;
          });

          // Update total count
          setTotalUnread(prev => {
            const newTotal = prev + 1;
            console.log('NotificationProvider: Updated total unread count', newTotal);
            return newTotal;
          });
        }
      )
      .subscribe();

    console.log('NotificationProvider: Subscription created', channel);

    return () => {
      console.log('NotificationProvider: Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = useCallback((userId: string) => {
    console.log('NotificationProvider: Marking messages as read for user', userId);
    
    setUnreadMessages(prev => {
      const userMessageCount = prev[userId]?.length || 0;
      const newState = { ...prev };
      delete newState[userId];
      console.log('NotificationProvider: Updated unread messages after marking read', newState);
      
      // Update total count
      setTotalUnread(prevTotal => {
        const newTotal = prevTotal - userMessageCount;
        console.log('NotificationProvider: Updated total unread count after marking read', newTotal);
        return newTotal;
      });
      
      return newState;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    console.log('NotificationProvider: Marking all messages as read');
    setUnreadMessages({});
    setTotalUnread(0);
  }, []);

  // Debug log current state
  useEffect(() => {
    console.log('NotificationProvider: Current state', { 
      unreadMessages, 
      totalUnread,
      unreadMessageKeys: Object.keys(unreadMessages),
      unreadCounts: Object.entries(unreadMessages).map(([userId, messages]) => ({ userId, count: messages.length }))
    });
  }, [unreadMessages, totalUnread]);

  return (
    <NotificationContext.Provider value={{ unreadMessages, totalUnread, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
} 