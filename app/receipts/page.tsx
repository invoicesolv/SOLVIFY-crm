"use client";

import { useEffect, useState } from 'react';
import { SidebarDemo } from '@/components/ui/code.demo';
import { ReceiptsTable } from '@/components/ReceiptsTable';

interface Receipt {
  merchant: string | null;
  date: string | null;
  amount: number | null;
  details: string | null;
  confidence: "high" | "medium" | "low";
  original_filename: string;
}

interface ReceiptsData {
  timestamp: string;
  receipts: Receipt[];
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [timestamp, setTimestamp] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        // Fetch the specific receipts file
        const response = await fetch('/receipts/cleaned_receipts_20250315_162813.json');
        if (!response.ok) {
          throw new Error('Failed to fetch receipts data');
        }
        const data: ReceiptsData = await response.json();
        setReceipts(data.receipts);
        setTimestamp(data.timestamp);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load receipts');
        console.error('Error loading receipts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, []);

  return (
    <SidebarDemo>
      <div className="p-6">
        <div className="rounded-xl border border-border bg-background p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Receipts</h1>
            {timestamp && (
              <span className="text-sm text-muted-foreground">
                Last updated: {new Date(timestamp).toLocaleString()}
              </span>
            )}
          </div>
          {loading ? (
            <div className="text-muted-foreground">Loading receipts...</div>
          ) : error ? (
            <div className="text-red-600 dark:text-red-400">{error}</div>
          ) : (
            <ReceiptsTable receipts={receipts} />
          )}
        </div>
      </div>
    </SidebarDemo>
  );
} 