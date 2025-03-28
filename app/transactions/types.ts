export interface Transaction {
  reference: string;
  date: string;
  amount: number;
  balance: number;
  category?: string;
  source: 'Svea' | 'Revolut';
  user_id?: string;
}

export interface MonthlyStats {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  transactions: Transaction[];
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  transactions: Transaction[];
} 