import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  try {
    // Get user ID from session or headers
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || request.headers.get('user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for pagination and filtering
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';
    const orderBy = searchParams.get('orderBy') || 'name';
    const orderDir = searchParams.get('orderDir') || 'asc';
    
    // Calculate offset based on page number
    const offset = (page - 1) * pageSize;
    
    // Initialize Supabase client
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize database connection' }, { status: 500 });
    }
    
    // Clear schema cache to avoid column not found errors
    try {
      await supabase.rpc('pg_stat_clear_snapshot');
    } catch (cacheError) {
      console.error('Error clearing schema cache:', cacheError);
      // Continue anyway
    }
    
    // Build query with filtering if search parameter is provided
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,customer_number.ilike.%${search}%`);
    }
    
    // Add ordering
    query = query.order(orderBy, { ascending: orderDir === 'asc' });
    
    // Add pagination
    query = query.range(offset, offset + pageSize - 1);
    
    // Execute query
    const { data: customers, error, count } = await query;
    
    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
    
    // Calculate total pages
    const totalPages = count ? Math.ceil(count / pageSize) : 0;
    
    return NextResponse.json({
      customers: customers || [],
      pagination: {
        page,
        pageSize,
        totalPages,
        totalCount: count || 0,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error in GET /api/customers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 