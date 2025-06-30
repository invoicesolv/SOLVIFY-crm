import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromToken } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content, workspaceId, messageType = 'text', metadata = {}, otherUserId } = body

    if (!content || !workspaceId) {
      return NextResponse.json({ error: 'Content and workspace ID are required' }, { status: 400 })
    }

    if (!content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 })
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

    // Prepare message data
    const messageData = {
      content: content.trim(),
      user_id: user.id,
      workspace_id: workspaceId,
      message_type: messageType,
      metadata: messageType === 'private' && otherUserId 
        ? { ...metadata, private_chat_with: otherUserId }
        : metadata
    }

    // Insert the message
    const { data: message, error: insertError } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting message:', insertError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Get user info for the response
    let userName = 'Unknown User'
    let userAvatar = null

    try {
      // Try to get from profiles first
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id, name, avatar_url')
        .eq('user_id', user.id)
        .single()

      if (profile?.name && profile.name.trim()) {
        userName = profile.name.trim()
        userAvatar = profile.avatar_url
      } else {
        // Fallback to team_members
        const { data: teamMember } = await supabaseAdmin
          .from('team_members')
          .select('user_id, name, email')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .single()

        if (teamMember?.name && teamMember.name.trim() && !teamMember.name.includes('Empty - No Data')) {
          userName = teamMember.name.trim()
        } else if (teamMember?.email && teamMember.email.trim()) {
          const emailName = teamMember.email.split('@')[0]
          userName = emailName.charAt(0).toUpperCase() + emailName.slice(1)
        }
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
    }

    const messageWithUserInfo = {
      ...message,
      user_name: userName,
      user_avatar: userAvatar
    }

    return NextResponse.json({ message: messageWithUserInfo })
  } catch (error) {
    console.error('Error in send message API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
