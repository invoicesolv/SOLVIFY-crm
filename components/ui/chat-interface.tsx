"use client";

import React, { useState, useEffect, useRef } from 'react'
import { useNotifications } from '@/lib/notification-context'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Paperclip, Smile, Calendar, FolderPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/database.types'

type ChatMessage = Tables<'chat_messages'> & {
  user_name?: string
  user_avatar?: string
}

interface ChatInterfaceProps {
  workspaceId: string
  currentUserId: string
  isPrivateChat?: boolean
  otherUserId?: string
}

// Simple Avatar component
function SimpleAvatar({ src, alt, className }: { src?: string | null, alt: string, className?: string }) {
  const initials = alt.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  
  return (
    <div className={`rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground ${className || 'w-8 h-8'}`}>
      {src ? (
        <img src={src} alt={alt} className={`rounded-full object-cover ${className || 'w-8 h-8'}`} />
      ) : (
        initials
      )}
    </div>
  )
}

export function ChatInterface({ workspaceId, currentUserId, isPrivateChat = false, otherUserId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { markAsRead, unreadMessages } = useNotifications()

  // Debug log for notifications
  useEffect(() => {
    console.log('ChatInterface: Current unread messages from context:', unreadMessages);
  }, [unreadMessages]);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (otherUserId) {
      markAsRead(otherUserId)
    }
  }, [otherUserId, markAsRead])

  // Fetch initial messages
  useEffect(() => {
    fetchMessages()
  }, [workspaceId])

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as ChatMessage
            
            // Filter messages based on chat type
            const shouldShowMessage = isPrivateChat 
              ? (newMessage.message_type === 'private' && 
                 ((newMessage.user_id === currentUserId && (newMessage.metadata as any)?.private_chat_with === otherUserId) ||
                  (newMessage.user_id === otherUserId && (newMessage.metadata as any)?.private_chat_with === currentUserId)))
              : (newMessage.message_type !== 'private')
            
            if (shouldShowMessage) {
              setMessages(prev => {
                // For your own messages, only handle temp message replacement
                if (newMessage.user_id === currentUserId) {
                  const tempMatch = prev.find(msg => 
                    msg.id.startsWith('temp-') && 
                    msg.content === newMessage.content &&
                    Math.abs(new Date(msg.created_at!).getTime() - new Date(newMessage.created_at!).getTime()) < 5000
                  )

                  if (tempMatch) {
                    // Replace temp message with real one
                    return prev.map(msg => 
                      msg.id === tempMatch.id 
                        ? { ...newMessage, user_name: 'Kevin Negash', user_avatar: undefined }
                        : msg
                    )
                  }
                  return prev // Don't add if no temp message found (optimistic update already shows it)
                }

                // For other users' messages
                const existingMessage = prev.find(msg => msg.id === newMessage.id)
                if (existingMessage) {
                  return prev // Skip if message already exists
                }

                // Fetch info for other users' messages
                fetchUserInfoAndAddMessage(newMessage, prev)
                return prev
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as ChatMessage
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? { ...updatedMessage, user_name: msg.user_name, user_avatar: msg.user_avatar } : msg)
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedMessage = payload.old as ChatMessage
            setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, isPrivateChat, currentUserId, otherUserId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Helper function to fetch user info and add message
  const fetchUserInfoAndAddMessage = async (newMessage: ChatMessage, currentMessages: ChatMessage[]) => {
    let userName = 'Unknown User'
    let userAvatar: string | undefined = undefined
    
    try {
      // Try to get from profiles first
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .eq('user_id', newMessage.user_id)
        .single()
      
      if (profile?.name && profile.name.trim()) {
        userName = profile.name.trim()
        userAvatar = profile.avatar_url || undefined
      } else {
        // Fallback to team_members
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('user_id, name, email')
          .eq('user_id', newMessage.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (teamMember?.name && teamMember.name.trim() && !teamMember.name.includes('Empty - No Data')) {
          userName = teamMember.name.trim()
        } else if (teamMember?.email && teamMember.email.trim()) {
          const emailName = teamMember.email.split('@')[0]
          userName = emailName.charAt(0).toUpperCase() + emailName.slice(1)
        }
      }
    } catch (error) {
      console.error('Error fetching user info for real-time message:', error)
    }
    
    const messageWithUserInfo = {
      ...newMessage,
      user_name: userName,
      user_avatar: userAvatar
    }
    
    setMessages(prev => [...prev, messageWithUserInfo])
  }

  const fetchMessages = async () => {
    try {
      setIsLoading(true)
      
      let messagesQuery = supabase.from('chat_messages').select('*')
      
      if (isPrivateChat && otherUserId) {
        // For private chats, we need to find messages between the two users
        // Get messages where:
        // 1. Current user sent to other user, OR
        // 2. Other user sent to current user
        messagesQuery = messagesQuery
          .eq('workspace_id', workspaceId)
          .eq('message_type', 'private')
          .or(`and(user_id.eq.${currentUserId},metadata->>private_chat_with.eq.${otherUserId}),and(user_id.eq.${otherUserId},metadata->>private_chat_with.eq.${currentUserId})`)
      } else {
        // Regular workspace chat
        messagesQuery = messagesQuery
          .eq('workspace_id', workspaceId)
          .neq('message_type', 'private')
      }
      
      const { data: messages, error: messagesError } = await messagesQuery
        .order('created_at', { ascending: true })

      if (messagesError) {
        console.error('Error fetching messages:', messagesError)
        return
      }

      if (!messages || messages.length === 0) {
        setMessages([])
        return
      }

      // Get unique user IDs from messages
      const userIds = [...new Set(messages.map(msg => msg.user_id))]
      
      // Fetch profiles for these users
      console.log('Chat: Fetching profiles for user IDs:', userIds)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', userIds)

      console.log('Chat: Profiles fetched:', profiles)
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
      }

      // Also try to get user info from team_members as fallback
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('user_id, name, email')
        .in('user_id', userIds)
        .order('created_at', { ascending: false }) // Get the most recent entry first

      if (teamError) {
        console.error('Error fetching team members:', teamError)
      }

      // Create a map of user_id to profile info
      const profileMap = new Map()
      const teamMemberMap = new Map()
      
      if (profiles) {
        profiles.forEach(profile => {
          // Only add if name exists and is not empty
          if (profile.name && profile.name.trim()) {
            profileMap.set(profile.user_id, profile)
          }
        })
      }
      
      if (teamMembers) {
        teamMembers.forEach(member => {
          // Only add if we don't already have this user and name exists and is valid
          if (!teamMemberMap.has(member.user_id) && 
              member.name && 
              member.name.trim() && 
              !member.name.includes('Empty - No Data')) {
            teamMemberMap.set(member.user_id, member)
          }
        })
      }

      // Combine messages with profile info
      const messagesWithUserInfo = messages.map(msg => {
        const profile = profileMap.get(msg.user_id)
        const teamMember = teamMemberMap.get(msg.user_id)
        
        // Prioritize profile name, then clean team member name, then email as last resort
        let userName = 'Unknown User'
        
        if (profile?.name && profile.name.trim()) {
          userName = profile.name.trim()
        } else if (teamMember?.name && teamMember.name.trim() && !teamMember.name.includes('Empty - No Data')) {
          userName = teamMember.name.trim()
        } else if (teamMember?.email && teamMember.email.trim()) {
          // Extract name from email if possible (before @)
          const emailName = teamMember.email.split('@')[0]
          userName = emailName.charAt(0).toUpperCase() + emailName.slice(1)
        }
        
        console.log(`Chat: User ${msg.user_id} mapped to name: ${userName}`, { profile, teamMember })
        
        return {
          ...msg,
          user_name: userName,
          user_avatar: profile?.avatar_url || null,
          profiles: profile || null
        }
      })

      setMessages(messagesWithUserInfo)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    const messageContent = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX

    try {
      const messageData = {
        content: messageContent,
        user_id: currentUserId,
        workspace_id: workspaceId,
        message_type: isPrivateChat ? 'private' : 'text',
        metadata: isPrivateChat && otherUserId ? { private_chat_with: otherUserId } : {}
      }

      // Create a timestamp for the message
      const messageTimestamp = new Date().toISOString()
      
      // Optimistic update - add message immediately to UI
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`, // Temporary ID
        content: messageContent,
        user_id: currentUserId,
        workspace_id: workspaceId,
        message_type: isPrivateChat ? 'private' : 'text',
        metadata: messageData.metadata,
        created_at: messageTimestamp,
        updated_at: messageTimestamp,
        reply_to: null,
        edited_at: null,
        user_name: 'Kevin Negash', // Your name
        user_avatar: undefined
      }

      // Add optimistic message
      setMessages(prev => {
        // Check if this message already exists (prevent duplicates)
        const isDuplicate = prev.some(msg => 
          msg.content === messageContent && 
          msg.user_id === currentUserId &&
          Math.abs(new Date(msg.created_at!).getTime() - new Date(messageTimestamp).getTime()) < 5000
        )
        
        return isDuplicate ? prev : [...prev, tempMessage]
      })

      const { data, error } = await supabase
        .from('chat_messages')
        .insert(messageData)
        .select()
        .single()

      if (error) {
        console.error('Error sending message:', error)
        // Remove the optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
        setNewMessage(messageContent) // Restore the message content
        return
      }

      // Only replace if the temporary message still exists
      if (data) {
        setMessages(prev => {
          const tempExists = prev.some(msg => msg.id === tempMessage.id)
          if (!tempExists) return prev // If temp message is gone, don't update
          
          return prev.map(msg => 
            msg.id === tempMessage.id 
              ? { ...data, user_name: 'Kevin Negash', user_avatar: undefined }
              : msg
          )
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setNewMessage(messageContent) // Restore the message content on error
    }
  }

  const sendSpecialMessage = async (type: 'calendar_event' | 'project_update', content: string, metadata: any) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          content,
          user_id: currentUserId,
          workspace_id: workspaceId,
          message_type: type,
          metadata
        })

      if (error) {
        console.error('Error sending special message:', error)
      }
    } catch (error) {
      console.error('Error sending special message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderMessage = (message: ChatMessage) => {
    const isCurrentUser = message.user_id === currentUserId

    if (message.message_type === 'calendar_event') {
      return (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <SimpleAvatar 
              src={message.user_avatar} 
              alt={message.user_name || 'User'}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {message.user_name}
            </span>
            <span className="text-xs text-muted-foreground/70">
              {formatTime(message.created_at!)}
            </span>
          </div>
          <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-2xl p-3.5 ml-8 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100 text-sm">Calendar Event</span>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{message.content}</p>
            {message.metadata && (
              <div className="mt-2 text-xs text-blue-600/80 dark:text-blue-300/80">
                {JSON.stringify(message.metadata)}
              </div>
            )}
          </div>
        </motion.div>
      )
    }

    if (message.message_type === 'project_update') {
      return (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <SimpleAvatar 
              src={message.user_avatar} 
              alt={message.user_name || 'User'}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {message.user_name}
            </span>
            <span className="text-xs text-muted-foreground/70">
              {formatTime(message.created_at!)}
            </span>
          </div>
          <div className="bg-green-50/80 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/50 rounded-2xl p-3.5 ml-8 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <FolderPlus className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-900 dark:text-green-100 text-sm">Project Update</span>
            </div>
            <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">{message.content}</p>
            {message.metadata && typeof message.metadata === 'object' && message.metadata !== null && (
              <div className="mt-2 text-xs text-green-600/80 dark:text-green-300/80">
                Project: {(message.metadata as any).project_name} - {(message.metadata as any).milestone}
              </div>
            )}
          </div>
        </motion.div>
      )
    }

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mb-3 flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`flex gap-2.5 max-w-[75%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <SimpleAvatar 
            src={message.user_avatar} 
            alt={message.user_name || 'User'}
          />
          <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                {message.user_name}
              </span>
              <span className="text-xs text-muted-foreground/70">
                {formatTime(message.created_at!)}
              </span>
            </div>
            <div
              className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
                isCurrentUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/80 text-foreground border border-border/50'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        <AnimatePresence>
          {messages.map(renderMessage)}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-border/50 flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => sendSpecialMessage(
              'calendar_event',
              'Created a new team meeting for tomorrow at 2 PM',
              { event_type: 'meeting', date: new Date().toISOString() }
            )}
            className="px-3 py-1.5 text-xs bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100/80 dark:hover:bg-blue-900/30 transition-all duration-200 border border-blue-200/50 dark:border-blue-800/50"
          >
            📅 Quick Event
          </button>
          <button
            onClick={() => sendSpecialMessage(
              'project_update',
              'Project milestone completed!',
              { project_name: 'Website Redesign', milestone: 'Design Phase Complete' }
            )}
            className="px-3 py-1.5 text-xs bg-green-50/80 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full hover:bg-green-100/80 dark:hover:bg-green-900/30 transition-all duration-200 border border-green-200/50 dark:border-green-800/50"
          >
            🚀 Project Update
          </button>
        </div>
      </div>

      {/* Message Input - Fixed at bottom */}
      <div className="p-4 border-t border-border/50 bg-card/50 flex-shrink-0">
        <div className="relative">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="w-full px-4 py-3 pr-24 pb-12 border border-border/60 rounded-2xl resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 bg-background/80 backdrop-blur-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm"
            rows={1}
            style={{ minHeight: '60px', maxHeight: '120px' }}
          />
          
          {/* Bottom row with attach, emoji, and send buttons */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
                <Paperclip className="h-4 w-4" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
                <Smile className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 