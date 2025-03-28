"use client";

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Calculator, Receipt } from "lucide-react";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Transaction, MonthlyStats, CategorySummary } from './types';
import { processTransactions, getMonthlyStats, getCategorySummary, formatCurrency } from './utils';
import { TransactionList } from './components/TransactionList';
import { TransactionCharts } from './components/TransactionCharts';
import { Button } from "@/components/ui/button";
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';

export default function TransactionsPage() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!session?.user?.id) {
        console.error('No user session found for transactions');
        setError('User authentication required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Fetch user's transactions from Supabase
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', session.user.id)
          .order('date', { ascending: false });
        
        if (transactionsError) {
          throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
        }
        
        if (!transactionsData || transactionsData.length === 0) {
          // If no transactions in database, fall back to demo data
          // Load Svea transactions
          const sveaResponse = await fetch('/Svea.csv');
          if (!sveaResponse.ok) {
            throw new Error(`Failed to fetch Svea CSV: ${sveaResponse.status} ${sveaResponse.statusText}`);
          }
          const sveaContent = await sveaResponse.text();
          
          // Load Revolut transactions
          const revolutResponse = await fetch('/account-statement_2024-01-01_2024-12-31_en_17a8da.csv');
          if (!revolutResponse.ok) {
            throw new Error(`Failed to fetch Revolut CSV: ${revolutResponse.status} ${revolutResponse.statusText}`);
          }
          const revolutContent = await revolutResponse.text();
          
          // Process both transaction sets
          const processedTransactions = processTransactions(sveaContent, revolutContent);
          if (processedTransactions.length === 0) {
            throw new Error('No transactions were parsed from the CSV files');
          }
          
          setTransactions(processedTransactions);
          
          const monthStats = getMonthlyStats(processedTransactions);
          setMonthlyStats(monthStats);
        } else {
          // Use transactions from database
          setTransactions(transactionsData);
          
          const monthStats = getMonthlyStats(transactionsData);
          setMonthlyStats(monthStats);
        }
        
        // Set the most recent month as selected
        if (monthlyStats.length > 0) {
          setSelectedMonth(monthlyStats[0].month);
        }
        
        const categoryStats = getCategorySummary(
          selectedMonth 
            ? transactions.filter(t => t.date.startsWith(selectedMonth))
            : transactions
        );
        setCategorySummary(categoryStats);
        
      } catch (error) {
        console.error('Failed to load transactions:', error);
        setError(error instanceof Error ? error.message : 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [session]);

  // Update category summary when selected month changes
  useEffect(() => {
    if (transactions.length > 0) {
      const filteredTransactions = selectedMonth
        ? transactions.filter((t: Transaction) => t.date.startsWith(selectedMonth))
        : transactions;
      
      const categoryStats = getCategorySummary(filteredTransactions);
      setCategorySummary(categoryStats);
    }
  }, [selectedMonth, transactions]);

  const currentMonthStats = monthlyStats.find(stats => stats.month === selectedMonth) 
    || { income: 0, expenses: 0, balance: 0 };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <SidebarDemo>
      <div className="p-6">
        <Card className="p-6 bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-neutral-400" />
              <h1 className="text-xl font-semibold text-white">Transactions</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-neutral-900 border-neutral-700 text-white rounded-md p-2"
              >
                {monthlyStats.map(stats => (
                  <option key={stats.month} value={stats.month}>
                    {formatMonth(stats.month)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4 bg-neutral-900 border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Income</h3>
              <p className="text-2xl font-semibold text-green-500">
                {formatCurrency(currentMonthStats.income)}
              </p>
            </Card>
            <Card className="p-4 bg-neutral-900 border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Expenses</h3>
              <p className="text-2xl font-semibold text-red-500">
                {formatCurrency(Math.abs(currentMonthStats.expenses))}
              </p>
            </Card>
            <Card className="p-4 bg-neutral-900 border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Balance</h3>
              <p className={`text-2xl font-semibold ${currentMonthStats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(currentMonthStats.balance)}
              </p>
            </Card>
          </div>

          {/* Charts */}
          <div className="mt-6">
            <TransactionCharts
              monthlyStats={monthlyStats}
              categorySummary={categorySummary}
            />
          </div>

          {/* Transactions List */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Transactions for {formatMonth(selectedMonth)}
            </h2>
            {loading ? (
              <div className="bg-neutral-900 rounded-lg p-4 text-neutral-400 text-center">
                Loading transactions...
              </div>
            ) : error ? (
              <div className="bg-red-500/10 text-red-500 rounded-lg p-4 text-center">
                {error}
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-neutral-900 rounded-lg p-4 text-neutral-400 text-center">
                No transactions to display
              </div>
            ) : (
              <TransactionList 
                transactions={selectedMonth 
                  ? transactions.filter(t => t.date.startsWith(selectedMonth))
                  : transactions
                } 
              />
            )}
          </div>
        </Card>
      </div>
    </SidebarDemo>
  );
} 