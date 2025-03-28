import React, { useState, useMemo } from 'react';

interface Receipt {
  merchant: string | null;
  date: string | null;
  amount: number | null;
  details: string | null | { [key: string]: any };
  confidence: "high" | "medium" | "low";
  original_filename: string;
}

interface ReceiptsTableProps {
  receipts: Receipt[];
}

export function ReceiptsTable({ receipts }: ReceiptsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const getConfidenceColor = (confidence: "high" | "medium" | "low") => {
    switch (confidence) {
      case "high":
        return "bg-green-500/20 text-green-400";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400";
      case "low":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-neutral-500/20 text-neutral-400";
    }
  };

  const formatDetails = (details: string | null | { [key: string]: any }): string => {
    if (!details) return 'No details';
    if (typeof details === 'string') return details;
    
    // If details is an object, format it nicely
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  const filteredReceipts = useMemo(() => {
    if (!searchTerm) return receipts;
    
    const searchLower = searchTerm.toLowerCase();
    return receipts.filter(receipt => {
      const searchableValues = [
        receipt.merchant,
        receipt.date,
        receipt.amount?.toString(),
        formatDetails(receipt.details),
        receipt.confidence,
        receipt.original_filename
      ].map(value => value?.toLowerCase() || '');

      return searchableValues.some(value => value.includes(searchLower));
    });
  }, [receipts, searchTerm]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search receipts by any field..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg 
                     text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 
                     focus:ring-neutral-600 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 
                       hover:text-neutral-200"
            >
              ×
            </button>
          )}
        </div>
        <div className="text-sm text-neutral-400">
          {filteredReceipts.length} of {receipts.length} receipts
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-400">
          <thead className="text-xs uppercase bg-neutral-800">
            <tr>
              <th scope="col" className="px-6 py-3">Merchant</th>
              <th scope="col" className="px-6 py-3">Date</th>
              <th scope="col" className="px-6 py-3">Amount</th>
              <th scope="col" className="px-6 py-3">Details</th>
              <th scope="col" className="px-6 py-3">Confidence</th>
              <th scope="col" className="px-6 py-3">Filename</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.map((receipt, index) => (
              <tr key={index} className="border-b border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700">
                <td className="px-6 py-4 font-medium whitespace-nowrap">
                  {receipt.merchant || 'Unknown'}
                </td>
                <td className="px-6 py-4">
                  {receipt.date ? new Date(receipt.date).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  {receipt.amount ? `${receipt.amount.toFixed(2)} kr` : 'N/A'}
                </td>
                <td className="px-6 py-4 max-w-md truncate">
                  {formatDetails(receipt.details)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(receipt.confidence)}`}>
                    {receipt.confidence.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs opacity-50">
                  {receipt.original_filename || 'No file'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 