import { NextRequest, NextResponse } from 'next/server';
import { promises as dns } from 'dns';

export async function POST(req: NextRequest) {
  try {
    const { domain, token } = await req.json();

    if (!domain || !token) {
      return NextResponse.json({ error: 'Domain and token are required' }, { status: 400 });
    }

    const expectedRecord = `vibe-verification=${token}`;
    console.log(`[DNS Verify] Checking domain: ${domain} for TXT record: ${expectedRecord}`);

    try {
      const records = await dns.resolveTxt(domain);
      console.log(`[DNS Verify] Found TXT records for ${domain}:`, records);

      const isVerified = records.some(recordParts => recordParts.join('').trim() === expectedRecord.trim());

      if (isVerified) {
        return NextResponse.json({ verified: true, message: 'Domain verified successfully!' });
      } else {
        console.log(`[DNS Verify] Verification failed. Expected record not found.`);
        return NextResponse.json({ 
          verified: false, 
          message: 'TXT record not found or does not match.',
          foundRecords: records.flat() 
        });
      }
    } catch (error: any) {
      console.error('DNS lookup failed:', error);
      // Common error for non-existent domain
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return NextResponse.json({ verified: false, message: 'Domain not found or no TXT records exist.' }, { status: 404 });
      }
      return NextResponse.json({ verified: false, message: 'DNS lookup failed. Please try again later.' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in verify-dns handler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 