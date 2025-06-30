import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromToken } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspace_id')
    const isPrivateChat = searchParams.get('is_private_chat') === 'true'
    const otherUserId = searchParams.get('other_user_id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has access to this workspace
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    let messagesQuery = supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (isPrivateChat && otherUserId) {
      // For private chats, get messages between the two users
      messagesQuery = messagesQuery
        .eq('message_type', 'private')
        .or(`and(user_id.eq.${user.id},metadata->>private_chat_with.eq.${otherUserId}),and(user_id.eq.${otherUserId},metadata->>private_chat_with.eq.${user.id})`)
    } else {
      // Regular workspace chat (exclude private messages)
      messagesQuery = messagesQuery.neq('message_type', 'private')
    }

    const { data: messages, error: messagesError } = await messagesQuery
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Get user info for messages
    if (messages && messages.length > 0) {
      const userIds = [...new Set(messages.map(msg => msg.user_id))]

      // Fetch profiles
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', userIds)

      // Fetch team members as fallback
      const { data: teamMembers } = await supabaseAdmin
        .from('team_members')
        .select('user_id, name, email')
        .in('user_id', userIds)
        .eq('workspace_id', workspaceId)

      // Create user info maps
      const profileMap = new Map()
      const teamMemberMap = new Map()

      if (profiles) {
        profiles.forEach(profile => {
          if (profile.name && profile.name.trim()) {
            profileMap.set(profile.user_id, profile)
          }
        })
      }

      if (teamMembers) {
        teamMembers.forEach(member => {
          if (member.name && member.name.trim() && !member.name.includes('Empty - No Data')) {
            teamMemberMap.set(member.user_id, member)
          }
        })
      }

      // Enhance messages with user info
      const messagesWithUserInfo = messages.map(msg => {
        const profile = profileMap.get(msg.user_id)
        const teamMember = teamMemberMap.get(msg.user_id)

        let userName = 'Unknown User'
        
        if (profile?.name && profile.name.trim()) {
          userName = profile.name.trim()
        } else if (teamMember?.name && teamMember.name.trim()) {
          userName = teamMember.name.trim()
        } else if (teamMember?.email && teamMember.email.trim()) {
          const emailName = teamMember.email.split('@')[0]
          userName = emailName.charAt(0).toUpperCase() + emailName.slice(1)
        }

        return {
          ...msg,
          user_name: userName,
          user_avatar: profile?.avatar_url || null
        }
      })

      return NextResponse.json({ messages: messagesWithUserInfo })
    }

    return NextResponse.json({ messages: [] })
  } catch (error) {
    console.error('Error in chat messages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
