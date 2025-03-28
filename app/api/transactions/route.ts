import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read transactions from the CSV file
    const csvPath = path.join(process.cwd(), 'public', 'account-statement_2024-01-01_2024-12-31_en_17a8da.csv');
    const fileContent = await fs.readFile(csvPath, 'utf-8');
    
    // Parse CSV content
    const lines = fileContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const transactions = lines.slice(1).map((line, index) => {
      const values = line.split(',');
      const amount = parseFloat(values[3]?.trim()?.replace(/"/g, '') || '0');
      
      const transaction: any = {
        id: `t${index}`, // Generate a unique ID
        date: values[0]?.trim()?.replace(/"/g, ''),
        reference: values[2]?.trim()?.replace(/"/g, ''),
        amount: amount.toString(), // Convert to string as expected by the analyze endpoint
        type: amount < 0 ? 'CARD_PAYMENT' : 'CARD_CREDIT' // Determine type based on amount
      };
      return transaction;
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error reading transactions:', error);
    return NextResponse.json(
      { error: 'Failed to read transactions' },
      { status: 500 }
    );
  }
} 