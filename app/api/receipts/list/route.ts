import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const SUPPORTED_EXTENSIONS = ['.pdf', '.heic', '.jpg', '.jpeg', '.png'];

export async function GET() {
  try {
    const receiptsDir = path.join(process.cwd(), 'public', 'receipts', 'invoices');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }
    
    const files = await fs.promises.readdir(receiptsDir);
    const supportedFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) || SUPPORTED_EXTENSIONS.includes(ext.toLowerCase());
    });

    const receipts = supportedFiles.map(filename => ({
      id: filename,
      filename: filename,
      text_content: {
        english: '',
        swedish: ''
      },
      error: null
    }));
    
    console.log(`Found ${receipts.length} receipts to process`);
    return NextResponse.json(receipts);
  } catch (error) {
    console.error('Failed to list receipts:', error);
    return NextResponse.json({ error: 'Failed to list receipts' }, { status: 500 });
  }
} 