import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { supabase } from '@/lib/supabase';
import { parse } from 'csv-parse/sync';

export async function POST(
  request: NextRequest,
  { params }: { params: { source: string } }
) {
  try {
    console.log('Domain upload request received:', {
      source: params.source,
      method: request.method,
      contentType: request.headers.get('content-type')
    });

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('Authentication failed: No session or user ID');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('User authenticated:', {
      userId: session.user.id,
      email: session.user.email
    });

    // Validate source
    const source = params.source;
    if (!['ahrefs', 'majestic'].includes(source)) {
      console.log('Invalid source provided:', source);
      return NextResponse.json(
        { error: 'Invalid source. Must be either "ahrefs" or "majestic"' },
        { status: 400 }
      );
    }

    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('No file found in form data');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('File received:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      console.log('Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV file' },
        { status: 400 }
      );
    }

    // Read and parse the CSV file
    const text = await file.text();
    console.log('CSV content preview:', text.substring(0, 200) + '...');

    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log('Parsed records count:', records.length);
    if (records.length > 0) {
      console.log('First record sample:', records[0]);
    }

    // Transform the data based on the source
    const domains = records.map((record: any) => {
      if (source === 'ahrefs') {
        // Map the exact column names from your Ahrefs.csv
        return {
          domain: record.Target || '',
          domainRating: parseFloat(record['Domain Rating'] || '0'),
          trafficValue: 0, // Not provided in your CSV
          organicTraffic: parseInt(record['Total Traffic (desc)'] || '0'),
          referringDomains: parseInt(record['Ref domains Dofollow'] || '0'),
          organicKeywords: parseInt(record['Total Keywords'] || '0'),
          source: 'ahrefs',
          lastUpdated: new Date().toISOString(),
          user_id: session.user.id,
          // Additional metrics from your CSV
          urlRating: parseFloat(record['URL Rating'] || '0'),
          ahrefsRank: parseInt(record['Ahrefs Rank'] || '0'),
          refDomainsGov: parseInt(record['Ref domains Governmental'] || '0'),
          refDomainsEdu: parseInt(record['Ref domains Educational'] || '0'),
          totalBacklinks: parseInt(record['Total Backlinks'] || '0')
        };
      } else {
        // Majestic data format remains unchanged
        return {
          domain: record.Domain || record.domain || '',
          domainRating: parseFloat(record['Trust Flow'] || record.TrustFlow || '0'),
          trafficValue: parseFloat(record['Topic Value'] || record.TopicValue || '0'),
          organicTraffic: parseInt(record['External Backlinks'] || record.Backlinks || '0'),
          referringDomains: parseInt(record['Referring Domains'] || record.RefDomains || '0'),
          organicKeywords: parseInt(record['Referenced URLs'] || record.RefURLs || '0'),
          source: 'majestic',
          lastUpdated: new Date().toISOString(),
          user_id: session.user.id
        };
      }
    });

    console.log('Transformed domains count:', domains.length);
    if (domains.length > 0) {
      console.log('First transformed domain:', domains[0]);
    }

    // Save to database
    console.log('Attempting to save to Supabase...');
    const { data, error } = await supabase
      .from('domains')
      .upsert(domains, {
        onConflict: 'domain,source,user_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save domains: ' + error.message },
        { status: 500 }
      );
    }

    console.log('Successfully saved domains:', {
      savedCount: data?.length || 0
    });

    return NextResponse.json({
      success: true,
      domains: data
    });

  } catch (error) {
    console.error('Error processing domain upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
} 