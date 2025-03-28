import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Fetch transactions from Supabase
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, date, amount, reference, supplier')
      .order('date', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Format transactions to match expected interface
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction.id,
      date: transaction.date,
      amount: parseFloat(transaction.amount),
      reference: transaction.reference || '',
      supplier: transaction.supplier || undefined
    }));

    return NextResponse.json(formattedTransactions);
  } catch (error) {
    console.error('Failed to list transactions:', error);
    return NextResponse.json(
      { error: 'Failed to list transactions' },
      { status: 500 }
    );
  }
} 