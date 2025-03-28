import { Transaction, MonthlyStats, CategorySummary } from './types';

const CATEGORIES = {
  FOOD_AND_DINING: [
    // Restaurants & Cafes
    'SA PANINERIA', 'PANADERIA', 'MAMA CARMEN', 'MCDONALDS', 'MANATACO',
    'BRUNCH DRUNCH', 'HUMMUS', 'BI BAP', 'BROOKLYN CRAFT', 'FORMATGERIA',
    'IL MAFIOSO', 'BENDITA', 'LUNA PALMA', 'PALMA BREAD', 'NERGES KOLGRILL',
    'MDQ', 'TB0701 PZA ESPANA', 'MONTANARI', 'RESTAURANT', 'CAFE', 'PIZZERIA',
    // Grocery & Specialty Food
    'ALBY MATCENTER', 'CARNICERIA', 'MERCADONA', 'LIDL', 'GROCERY',
    'SUPERMERCADO', 'SPAR', 'CARREFOUR'
  ],
  TECH_AND_SOFTWARE: [
    // AI & Design Tools
    'OPENAI', 'CHATGPT', 'MIDJOURNEY', 'ANIMAKER', 'CAPTIONS',
    // Web Services
    'WEBFLOW.COM', 'MONDAY.COM', 'UNSLASH', 'ADOBE', 'SOLVIFY',
    'FIVERR', 'MISSHOSTIN', 'TEMPL.IO', 'WPCLEVER', 'WEBKUL',
    'GSUITE', 'SLACK', 'PANDADOC', 'GO DADDY',
    // Social Media
    'X CORP', 'X PREMIUM'
  ],
  TRAVEL_AND_TRANSPORT: [
    // Airlines
    'RYANAIR', 'NORWEGIAN', 'SAS',
    // Local Transport
    'LIME', 'BOLT', 'SL', 'UBER', 'TAXI', 'METRO', 'BUS',
    // Food Delivery
    'WOLT', 'GLOVO'
  ],
  RETAIL_AND_SHOPPING: [
    // Department Stores
    'EL CORTE INGLES', 'RUSTA',
    // Tobacco Shops
    'EXPENDURIA', 'ESTANC', 'TABACOS',
    // Books & Convenience
    'WHSMITH', 'PRESSBYRAN',
    // Other Retail
    'TEN 10 CASTANOS', 'MM S.L.'
  ],
  BANKING_AND_FINANCIAL: [
    'BANCA MARCH', 'BANCOSABADELL', 'LA CAIXA', 'BANK', 'ATM',
    'WITHDRAWAL', 'DEPOSIT', 'TRANSFER', 'EXCHANGE'
  ],
  SERVICES_AND_UTILITIES: [
    // Health & Fitness
    'VITALFIT', 'NORDICWELL',
    // Beauty
    'PELUQUERIA', 'BLOSSOM',
    // Government & Utilities
    'POLISEN', 'TIEKOM', 'ENCO',
    'TELIA', 'MÅNADSAVGIFT', 'UTILITIES'
  ],
  ENTERTAINMENT: [
    'EPIC PALMA', 'CINEMA', 'MOVIE', 'SPOTIFY', 'NETFLIX',
    'STEAM', 'GAME', 'TICKET', 'EVENT', 'CONCERT'
  ]
};

// Helper function to get category from merchant name
function getMerchantCategory(reference: string): string | null {
  const upperRef = reference.toUpperCase();
  
  // Special case for income
  if (upperRef.includes('SWISH FRÅN') || 
      upperRef.includes('SALARY') || 
      upperRef.includes('REFUND')) {
    return 'INCOME';
  }
  
  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(keyword => upperRef.includes(keyword.toUpperCase()))) {
      return category;
    }
  }
  
  return null;
}

export function categorizeTransaction(reference: string): string {
  const upperRef = reference.toUpperCase();
  
  // First try to get category from merchant name
  const merchantCategory = getMerchantCategory(reference);
  if (merchantCategory) {
    return merchantCategory;
  }
  
  // Handle card payments by looking at the description after CARD_PAYMENT
  if (upperRef.startsWith('CARD_PAYMENT')) {
    const paymentDescription = upperRef.replace('CARD_PAYMENT', '').trim();
    const paymentCategory = getMerchantCategory(paymentDescription);
    if (paymentCategory) {
      return paymentCategory;
    }
  }
  
  // Special case for transfers
  if (upperRef.includes('TO') || upperRef.includes('FROM')) {
    return 'BANKING_AND_FINANCIAL';
  }
  
  // Log uncategorized transactions for analysis
  console.log('Uncategorized transaction:', reference);
  
  // Default to BANKING_AND_FINANCIAL for any remaining card-related transactions
  if (upperRef.includes('CARD') || upperRef.includes('PAYMENT')) {
    return 'BANKING_AND_FINANCIAL';
  }
  
  return 'BANKING_AND_FINANCIAL';
}

export function parseAmount(amount: string): number {
  if (!amount) return 0;
  // Remove spaces and replace comma with dot for decimal
  const cleanAmount = amount.trim().replace(/\s+/g, '').replace(',', '.');
  return parseFloat(cleanAmount);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK'
  }).format(amount);
}

function processSveaCSV(csvContent: string): Transaction[] {
  console.log('=== Processing Svea CSV ===');
  const lines = csvContent.split('\n').filter(line => line.trim());
  console.log(`Total Svea lines: ${lines.length}`);
  
  if (lines.length < 5) {
    console.error('Svea CSV has too few lines:', lines);
    return [];
  }
  
  const dataLines = lines.slice(5);
  const transactions: Transaction[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < dataLines.length; i += 4) {
    if (i + 3 >= dataLines.length) break;
    
    const reference = dataLines[i].trim();
    const date = dataLines[i + 1].trim();
    const amount = parseAmount(dataLines[i + 2]);
    const balance = parseAmount(dataLines[i + 3]);
    
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const category = categorizeTransaction(reference);
      transactions.push({
        reference,
        date,
        amount,
        balance,
        category,
        source: 'Svea'
      });
      processedCount++;
      console.log(`Processed Svea: ${date} | ${reference} | ${formatCurrency(amount)} | ${category}`);
    } else {
      skippedCount++;
      console.warn('Skipped invalid Svea entry:', { reference, date, amount, balance });
    }
  }
  
  console.log(`=== Svea Processing Complete ===`);
  console.log(`Processed: ${processedCount}, Skipped: ${skippedCount}`);
  return transactions;
}

function processRevolutCSV(csvContent: string): Transaction[] {
  console.log('=== Processing Revolut CSV ===');
  const lines = csvContent.split('\n').filter(line => line.trim());
  console.log(`Total Revolut lines: ${lines.length}`);
  
  if (lines.length < 2) {
    console.error('Revolut CSV has too few lines:', lines);
    return [];
  }
  
  const headers = lines[0].split(',');
  const dataLines = lines.slice(1);
  const transactions: Transaction[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const line of dataLines) {
    const fields = line.split(',');
    if (fields.length < 10) {
      console.warn('Skipping invalid Revolut line:', line);
      skippedCount++;
      continue;
    }
    
    const type = fields[0];
    const completedDate = fields[3].split(' ')[0]; // Get just the date part
    const description = fields[4];
    const amount = parseAmount(fields[5]);
    const balance = parseAmount(fields[9]);
    const reference = `${type}: ${description}`;
    
    if (completedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const category = categorizeTransaction(type + ' ' + description);
      transactions.push({
        reference,
        date: completedDate,
        amount,
        balance,
        category,
        source: 'Revolut'
      });
      processedCount++;
      console.log(`Processed Revolut: ${completedDate} | ${reference} | ${formatCurrency(amount)} | ${category}`);
    } else {
      skippedCount++;
      console.warn('Skipped invalid Revolut entry:', { type, completedDate, description, amount, balance });
    }
  }
  
  console.log(`=== Revolut Processing Complete ===`);
  console.log(`Processed: ${processedCount}, Skipped: ${skippedCount}`);
  return transactions;
}

export function processTransactions(sveaContent: string, revolutContent?: string): Transaction[] {
  console.log('=== Starting Transaction Processing ===');
  
  const sveaTransactions = processSveaCSV(sveaContent);
  const revolutTransactions = revolutContent 
    ? processRevolutCSV(revolutContent) 
    : [];
  
  // Filter for 2024 transactions only
  const allTransactions = [...sveaTransactions, ...revolutTransactions].filter(transaction => {
    const year = transaction.date.substring(0, 4);
    const is2024 = year === '2024';
    if (!is2024) {
      console.log(`Filtered out non-2024 transaction: ${transaction.date} | ${transaction.reference}`);
    }
    return is2024;
  });
  
  // Sort by date descending
  const sortedTransactions = allTransactions.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  console.log('=== Transaction Processing Summary ===');
  console.log(`Total Svea Transactions: ${sveaTransactions.length}`);
  console.log(`Total Revolut Transactions: ${revolutTransactions.length}`);
  console.log(`Total 2024 Transactions: ${sortedTransactions.length}`);
  
  // Log category distribution
  const categoryDistribution = new Map<string, number>();
  sortedTransactions.forEach(t => {
    const category = t.category || 'Uncategorized';
    categoryDistribution.set(category, (categoryDistribution.get(category) || 0) + 1);
  });
  
  console.log('Category Distribution:');
  Array.from(categoryDistribution.entries()).forEach(([category, count]) => {
    console.log(`${category}: ${count} transactions`);
  });
  
  // Log sample transactions from each category
  console.log('\nSample Transactions by Category:');
  Array.from(categoryDistribution.keys()).forEach(category => {
    const categoryTransactions = sortedTransactions.filter(t => t.category === category);
    const sample = categoryTransactions[0];
    if (sample) {
      console.log(`${category} example: ${sample.date} | ${sample.reference} | ${formatCurrency(sample.amount)}`);
    }
  });
  
  return sortedTransactions;
}

export function getMonthlyStats(transactions: Transaction[]): MonthlyStats[] {
  const monthlyMap = new Map<string, MonthlyStats>();
  
  // Initialize all months of 2024
  const months = [
    '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
    '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'
  ];
  
  months.forEach(month => {
    monthlyMap.set(month, {
      month,
      income: 0,
      expenses: 0,
      balance: 0,
      transactions: []
    });
  });
  
  // Process transactions
  transactions.forEach(transaction => {
    const month = transaction.date.substring(0, 7); // YYYY-MM
    const current = monthlyMap.get(month);
    
    if (current) {
      if (transaction.amount > 0) {
        current.income += transaction.amount;
      } else {
        current.expenses += Math.abs(transaction.amount);
      }
      
      current.balance = current.income - current.expenses;
      current.transactions.push(transaction);
    }
  });
  
  // Return only months that have transactions or are in the current/past months
  const currentMonth = new Date().toISOString().substring(0, 7);
  return Array.from(monthlyMap.values())
    .filter(stats => stats.transactions.length > 0 || stats.month <= currentMonth)
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function getCategorySummary(transactions: Transaction[]): CategorySummary[] {
  const categoryMap = new Map<string, CategorySummary>();
  
  transactions.forEach(transaction => {
    const category = transaction.category || 'OTHER';
    const current = categoryMap.get(category) || {
      category,
      total: 0,
      count: 0,
      transactions: []
    };
    
    current.total += Math.abs(transaction.amount);
    current.count += 1;
    current.transactions.push(transaction);
    categoryMap.set(category, current);
  });
  
  return Array.from(categoryMap.values())
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
} 