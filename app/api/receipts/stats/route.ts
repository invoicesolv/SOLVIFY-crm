import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), 'public/receipts/images');
    const invoicesDir = path.join(process.cwd(), 'public/receipts/invoices');
    
    // Count files in both directories
    const imageFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir).length : 0;
    const invoiceFiles = fs.existsSync(invoicesDir) ? fs.readdirSync(invoicesDir).length : 0;
    
    // TODO: Get actual matched count from database
    const matched = 0;
    const total = imageFiles + invoiceFiles;
    
    return NextResponse.json({
      total,
      matched,
      unmatched: total - matched
    });
  } catch (error) {
    console.error('Error getting receipt stats:', error);
    return NextResponse.json(
      { error: 'Failed to get receipt statistics' },
      { status: 500 }
    );
  }
} 