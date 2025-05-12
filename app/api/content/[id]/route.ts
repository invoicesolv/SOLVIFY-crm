import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const contentId = params.id;
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Get the content item
    const { data: content, error: contentError } = await supabase
      .from('generated_content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (contentError) {
      console.error('Error fetching content item:', contentError);
      return NextResponse.json({ error: 'Failed to fetch content item' }, { status: 500 });
    }

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check if user has access to the workspace this content belongs to
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('workspace_id', content.workspace_id)
      .maybeSingle();

    const { data: ownedWorkspace, error: ownedError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', content.workspace_id)
      .eq('owner_id', session.user.id)
      .maybeSingle();

    if ((membershipError || !membership) && (ownedError || !ownedWorkspace)) {
      return NextResponse.json({ error: 'Access to this content denied' }, { status: 403 });
    }

    return NextResponse.json({ content });

  } catch (error) {
    console.error('Error fetching content item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const contentId = params.id;
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Get the existing content to check permissions
    const { data: existingContent, error: contentError } = await supabase
      .from('generated_content')
      .select('workspace_id, user_id')
      .eq('id', contentId)
      .single();

    if (contentError || !existingContent) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check if user has access to the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('is_admin')
      .eq('user_id', session.user.id)
      .eq('workspace_id', existingContent.workspace_id)
      .maybeSingle();

    const { data: ownedWorkspace, error: ownedError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', existingContent.workspace_id)
      .eq('owner_id', session.user.id)
      .maybeSingle();

    // User must either be admin/owner of workspace or the original creator
    const isAdmin = membership?.is_admin === true;
    const isOwner = ownedWorkspace !== null;
    const isCreator = existingContent.user_id === session.user.id;

    if (!isAdmin && !isOwner && !isCreator) {
      return NextResponse.json({ error: 'You do not have permission to update this content' }, { status: 403 });
    }

    // Update the content
    const updateData = await req.json();
    
    // Validate required fields
    if (!updateData.title || !updateData.content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // Don't allow updating workspace_id or user_id
    delete updateData.workspace_id;
    delete updateData.user_id;
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: updatedContent, error: updateError } = await supabase
      .from('generated_content')
      .update(updateData)
      .eq('id', contentId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating content:', updateError);
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
    }

    return NextResponse.json({ content: updatedContent });

  } catch (error) {
    console.error('Error updating content:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const contentId = params.id;
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Get the existing content to check permissions
    const { data: existingContent, error: contentError } = await supabase
      .from('generated_content')
      .select('workspace_id, user_id')
      .eq('id', contentId)
      .single();

    if (contentError || !existingContent) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check if user has access to the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('is_admin')
      .eq('user_id', session.user.id)
      .eq('workspace_id', existingContent.workspace_id)
      .maybeSingle();

    const { data: ownedWorkspace, error: ownedError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', existingContent.workspace_id)
      .eq('owner_id', session.user.id)
      .maybeSingle();

    // User must either be admin/owner of workspace or the original creator
    const isAdmin = membership?.is_admin === true;
    const isOwner = ownedWorkspace !== null;
    const isCreator = existingContent.user_id === session.user.id;

    if (!isAdmin && !isOwner && !isCreator) {
      return NextResponse.json({ error: 'You do not have permission to delete this content' }, { status: 403 });
    }

    // Delete the content
    const { error: deleteError } = await supabase
      .from('generated_content')
      .delete()
      .eq('id', contentId);

    if (deleteError) {
      console.error('Error deleting content:', deleteError);
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting content:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 