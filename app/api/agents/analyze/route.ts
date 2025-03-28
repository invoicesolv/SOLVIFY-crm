import { NextResponse } from 'next/server';

// Types for transactions and receipts
interface Transaction {
  id: string;
  date: string;
  amount: string;
  reference?: string;
  description?: string;
  type: string;
  created_at?: string;
}

interface Receipt {
  id: string;
  date: string;
  amount: number;
  merchant?: string;
  file_path: string;
  text_content: {
    english: string;
    swedish: string;
  };
  error?: string | null;
}

interface Match {
  transaction: Transaction;
  confidence: number;
  reasons: string[];
}

interface PotentialMatch {
  receipt_id: string;
  receipt_data: {
    date: string;
    amount: number;
    merchant?: string;
    file_path: string;
    raw_text?: string;
  };
  matches: Array<{
    transaction_id: string;
    confidence: number;
    reasons: string[];
    transaction_data: {
      date: string | null;
      amount: number;
      reference: string;
      type: string;
    };
  }>;
}

// Utility function to calculate string similarity (0-1)
function stringSimilarity(str1: string, str2: string): number {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  
  // Direct substring match gets high similarity
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.9;
  }

  // Calculate Levenshtein distance-based similarity
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let j = 0; j <= str1.length; j += 1) {
    distance[0][j] = j;
  }
  for (let i = 0; i <= str2.length; i += 1) {
    distance[i][0] = i;
  }

  for (let i = 1; i <= str2.length; i += 1) {
    for (let j = 1; j <= str1.length; j += 1) {
      const indicator = str1[j - 1] === str2[i - 1] ? 0 : 1;
      distance[i][j] = Math.min(
        distance[i][j - 1] + 1,
        distance[i - 1][j] + 1,
        distance[i - 1][j - 1] + indicator
      );
    }
  }
  
  return 1 - (distance[str2.length][str1.length] / maxLength);
}

function parseDate(dateStr: string | { created_at: string } | any) {
  try {
    // If it's an object with created_at, use that
    if (typeof dateStr === 'object' && dateStr?.created_at) {
      const date = new Date(dateStr.created_at);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // If it's a string, try to parse it directly
    if (typeof dateStr === 'string') {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Calculate match confidence between a receipt and transaction
function calculateMatchConfidence(receipt: any, transaction: any): { confidence: number; reasons: string[] } {
  let confidence = 0;
  const reasons: string[] = [];
  const weights = { amount: 0.4, date: 0.3, merchant: 0.3 };  // Normalized weights

  // Skip empty receipts or transactions
  if (!receipt || !transaction) {
    return { confidence: 0, reasons: ['Invalid receipt or transaction'] };
  }

  // Skip receipts with zero amount
  if (receipt.total_amount === 0) {
    return { confidence: 0, reasons: ['Receipt has zero amount'] };
  }

  // Date matching (30% weight)
  const receiptDate = parseDate(receipt.date);
  const transactionDate = parseDate(transaction);
  if (receiptDate && transactionDate) {
    const dateDiff = Math.abs(new Date(receiptDate).getTime() - new Date(transactionDate).getTime());
    const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
    if (daysDiff === 0) {
      confidence += weights.date;
      reasons.push("Same date");
    } else if (daysDiff <= 2) {
      confidence += weights.date * 0.5;
      reasons.push(`Close date (within ${Math.round(daysDiff)} days)`);
    } else if (daysDiff <= 5) {
      confidence += weights.date * 0.2;
      reasons.push(`Near date (within ${Math.round(daysDiff)} days)`);
    }
  }

  // Amount matching (40% weight)
  // Convert transaction amount to positive for comparison
  const transactionAmount = Math.abs(parseFloat(transaction.amount));
  const receiptAmount = Math.abs(receipt.total_amount);
  const amountDiff = Math.abs(receiptAmount - transactionAmount);
  
  // Calculate percentage difference for more flexible matching
  const percentageDiff = receiptAmount > 0 ? (amountDiff / receiptAmount) * 100 : 100;
  
  if (amountDiff < 0.01) {
    confidence += weights.amount;
    reasons.push("Exact amount match");
  } else if (percentageDiff < 1.0) {
    confidence += weights.amount * 0.8;
    reasons.push("Very close amount (< 1% difference)");
  } else if (percentageDiff < 5.0) {
    confidence += weights.amount * 0.6;
    reasons.push("Similar amount (< 5% difference)");
  } else if (percentageDiff < 10.0) {
    confidence += weights.amount * 0.3;
    reasons.push("Somewhat similar amount (< 10% difference)");
  }

  // Merchant/Reference matching (30% weight)
  const receiptMerchant = receipt.supplier_name?.toLowerCase() || '';
  const transactionRef = (transaction.reference || transaction.description || '').toLowerCase();
  
  // Skip empty merchant names
  if (receiptMerchant === 'unknown' || receiptMerchant === 'error' || receiptMerchant === '') {
    // Don't penalize, but don't add points either
  } else {
    // Check for common keywords in digital services
    const digitalServices = {
      'google': ['google', 'google cloud', 'google storage', 'google *'],
      'github': ['github', 'github.com', 'github *'],
      'slack': ['slack', 'slack.com', 'slack technologies'],
      'microsoft': ['microsoft', 'ms *', 'azure', 'microsoft *'],
      'aws': ['aws', 'amazon web services', 'amazon aws'],
      'digitalocean': ['digitalocean', 'digital ocean'],
      'heroku': ['heroku', 'salesforce heroku'],
      'openai': ['openai', 'chat.openai.com'],
      'fiverr': ['fiverr', 'fiverr.com', 'fiverr international'],
      'cursor': ['cursor', 'cursor pro', 'anysphere']
    };

    // Check for digital service matches
    let merchantMatched = false;
    for (const [service, keywords] of Object.entries(digitalServices)) {
      if (keywords.some(k => receiptMerchant.includes(k) || transactionRef.includes(k))) {
        confidence += weights.merchant;
        reasons.push(`Digital service match (${service})`);
        merchantMatched = true;
        break;
      }
    }

    // If no digital service match, use text similarity
    if (!merchantMatched) {
      const textSimilarity = stringSimilarity(receiptMerchant, transactionRef);
      if (textSimilarity > 0.8) {
        confidence += weights.merchant;
        reasons.push("Strong merchant name match");
      } else if (textSimilarity > 0.5) {
        confidence += weights.merchant * 0.5;
        reasons.push("Partial merchant name match");
      } else if (textSimilarity > 0.3) {
        confidence += weights.merchant * 0.2;
        reasons.push("Weak merchant name match");
      }
    }
  }

  return { confidence, reasons };
}

export async function POST(req: Request) {
  try {
    const { transactions, receipts } = await req.json();
    
    console.log('Analyze API - Request received:', {
      transactionsCount: transactions?.length || 0,
      receiptsCount: receipts?.length || 0,
      firstTransaction: transactions?.[0] ? { 
        id: transactions[0].id,
        date: transactions[0].date,
        amount: transactions[0].amount,
        reference: transactions[0].reference
      } : null,
      firstReceipt: receipts?.[0] ? {
        id: receipts[0].id,
        filename: receipts[0].filename,
        supplier_name: receipts[0].supplier_name,
        date: receipts[0].date,
        total_amount: receipts[0].total_amount
      } : null
    });

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      console.log('Analyze API - No transactions provided');
      return new NextResponse(JSON.stringify({
        potential_matches: [],
        stats: {
          total_transactions: 0,
          matched_receipts: 0,
          transactions_without_receipts: 0
        }
      }));
    }

    if (!receipts || !Array.isArray(receipts) || receipts.length === 0) {
      console.log('Analyze API - No receipts provided');
      return new NextResponse(JSON.stringify({
        potential_matches: [],
        stats: {
          total_transactions: transactions.length,
          matched_receipts: 0,
          transactions_without_receipts: transactions.length
        }
      }));
    }

    // Filter out non-payment transactions (only exclude CARD_REFUND)
    const validTransactionTypes = ['CARD_PAYMENT', 'CARD_CREDIT'];
    const filteredTransactions = transactions.filter((t: Transaction) => {
      // If transaction has no type field or type is empty, include it by default
      if (!t.type) return true;
      
      // Check if it's a valid transaction type
      return validTransactionTypes.includes(t.type);
    });

    console.log('Analyze API - Filtered transactions:', {
      originalCount: transactions.length,
      filteredCount: filteredTransactions.length,
      firstTransaction: filteredTransactions.length > 0 ? {
        id: filteredTransactions[0].id,
        date: filteredTransactions[0].date,
        amount: filteredTransactions[0].amount,
        type: filteredTransactions[0].type || 'undefined'
      } : null
    });

    // If all transactions were filtered out, use the original transactions
    if (filteredTransactions.length === 0 && transactions.length > 0) {
      console.log('Analyze API - Warning: All transactions were filtered out. Using original transactions.');
      filteredTransactions.push(...transactions);
    }

    // Find potential matches for each receipt
    const potentialMatches: Array<{
      receipt_id: string;
      receipt_data: {
        date: string;
        amount: number;
        merchant?: string;
        file_path: string;
      };
      matches: Array<{
        transaction_id: string;
        confidence: number;
        reasons: string[];
        transaction_data: {
          date: string | null;
          amount: number;
          reference: string;
          type: string;
        };
      }>;
    }> = [];

    // Limit the number of receipts to process to avoid performance issues
    const MAX_RECEIPTS = 20;
    const validReceipts = receipts
      .filter(r => r && r.total_amount > 0 && r.supplier_name && r.supplier_name !== 'Unknown' && r.supplier_name !== 'Error')
      .slice(0, MAX_RECEIPTS);
    
    console.log(`Analyze API - Processing ${validReceipts.length} valid receipts out of ${receipts.length} total receipts`);

    // Process each receipt
    for (const receipt of validReceipts) {
      console.log('Analyze API - Processing receipt:', {
        id: receipt.id,
        filename: receipt.filename,
        supplier_name: receipt.supplier_name,
        date: receipt.date,
        total_amount: receipt.total_amount
      });

      // Limit the number of transactions to compare with each receipt
      // This significantly improves performance for large datasets
      const MAX_TRANSACTIONS_PER_RECEIPT = 100;
      const transactionsToCompare = filteredTransactions.slice(0, MAX_TRANSACTIONS_PER_RECEIPT);

      const matches = transactionsToCompare
        .map((transaction: Transaction) => {
          const { confidence, reasons } = calculateMatchConfidence(receipt, transaction);
          return {
            transaction_id: transaction.id,
            confidence: confidence * 100, // Convert to percentage
            reasons,
            transaction_data: {
              date: parseDate(transaction.date),
              amount: parseFloat(transaction.amount),
              reference: transaction.reference || '',
              type: transaction.type
            }
          };
        })
        .filter((match: { confidence: number }) => match.confidence > 10) // Lower threshold to show more potential matches
        .sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence)
        .slice(0, 5); // Only keep top 5 matches per receipt

      console.log('Analyze API - Matches found for receipt:', {
        receiptId: receipt.id,
        matchCount: matches.length,
        topMatch: matches.length > 0 ? {
          transactionId: matches[0].transaction_id,
          confidence: matches[0].confidence,
          reasons: matches[0].reasons
        } : null
      });

      if (matches.length > 0) {
        potentialMatches.push({
          receipt_id: receipt.id,
          receipt_data: {
            date: receipt.date,
            amount: receipt.total_amount,
            merchant: receipt.supplier_name,
            file_path: receipt.filename
          },
          matches
        });
      }
    }

    // Calculate statistics
    const stats = {
      total_transactions: filteredTransactions.length,
      matched_receipts: potentialMatches.length,
      transactions_without_receipts: filteredTransactions.length - potentialMatches.length,
      limited_processing: receipts.length > MAX_RECEIPTS
    };

    console.log('Analyze API - Results:', {
      potentialMatchesCount: potentialMatches.length,
      stats
    });

    // Return the results
    return new NextResponse(JSON.stringify({
      potential_matches: potentialMatches,
      stats
    }));

  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to analyze transactions and receipts',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
} 