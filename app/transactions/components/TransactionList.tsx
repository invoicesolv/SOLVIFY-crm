import { useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils';
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Filter } from 'lucide-react';
import { cn } from "@/lib/utils";

interface TransactionListProps {
  transactions: Transaction[];
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'INCOME':
      return 'bg-green-500/10 text-green-500';
    case 'FOOD':
      return 'bg-yellow-500/10 text-yellow-500';
    case 'TRANSPORT':
      return 'bg-blue-500/10 text-blue-500';
    case 'ENTERTAINMENT':
      return 'bg-purple-500/10 text-purple-500';
    case 'UTILITIES':
      return 'bg-orange-500/10 text-orange-500';
    case 'SHOPPING':
      return 'bg-pink-500/10 text-pink-500';
    case 'BUSINESS':
      return 'bg-indigo-500/10 text-indigo-500';
    case 'TOBACCO':
      return 'bg-red-500/10 text-red-500';
    case 'TRANSFERS':
      return 'bg-cyan-500/10 text-cyan-500';
    default:
      return 'bg-neutral-500/10 text-neutral-400';
  }
};

const getSourceColor = (source: 'Svea' | 'Revolut') => {
  switch (source) {
    case 'Svea':
      return 'bg-blue-500/5 text-blue-400';
    case 'Revolut':
      return 'bg-purple-500/5 text-purple-400';
  }
};

export function TransactionList({ transactions }: TransactionListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'Svea' | 'Revolut'>('ALL');
  
  const categories = ['ALL', ...Array.from(new Set(transactions.map(t => t.category || 'OTHER')))].sort();
  const sources = ['ALL', 'Svea', 'Revolut'];
  
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      transaction.reference.toLowerCase().includes(search.toLowerCase()) ||
      transaction.category?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = 
      categoryFilter === 'ALL' || transaction.category === categoryFilter;
      
    const matchesSource =
      sourceFilter === 'ALL' || transaction.source === sourceFilter;
    
    return matchesSearch && matchesCategory && matchesSource;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-neutral-900 border-neutral-700 text-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 h-10 bg-neutral-900 border-neutral-700 text-white rounded-md"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'ALL' | 'Svea' | 'Revolut')}
            className="h-10 px-3 bg-neutral-900 border-neutral-700 text-white rounded-md"
          >
            {sources.map(source => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {filteredTransactions.map((transaction, index) => (
          <Card
            key={index}
            className="p-4 bg-neutral-900 border-neutral-700 flex items-center justify-between hover:bg-neutral-800 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{transaction.reference}</p>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    getSourceColor(transaction.source)
                  )}>
                    {transaction.source}
                  </span>
                </div>
                <p className={cn(
                  "text-lg font-semibold",
                  transaction.amount > 0 ? "text-green-500" : "text-red-500"
                )}>
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-neutral-400">{transaction.date}</p>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    getCategoryColor(transaction.category || 'OTHER')
                  )}>
                    {transaction.category || 'OTHER'}
                  </span>
                </div>
                <p className="text-sm text-neutral-400">
                  Balance: {formatCurrency(transaction.balance)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
} 