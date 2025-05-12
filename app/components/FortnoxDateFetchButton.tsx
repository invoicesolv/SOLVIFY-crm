'use client';

import { useState } from 'react';

// Date analysis response type
interface DateAnalysis {
  invoice_dates: string[];
  due_dates: string[];
  years: number[];
  months_by_year: Record<number, number[]>;
  analysis: {
    earliest_date: string | null;
    latest_date: string | null;
    total_invoices: number;
  };
}

export function FortnoxDateFetchButton({ workspaceId }: { workspaceId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateData, setDateData] = useState<DateAnalysis | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchDates = async () => {
    setLoading(true);
    setError(null);
    try {
      // Call our API endpoint
      const headers: HeadersInit = {};
      if (workspaceId) {
        headers['workspace-id'] = workspaceId;
      }

      const response = await fetch('/api/fortnox/dates', { headers });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dates from Fortnox');
      }
      
      const data = await response.json();
      setDateData(data);
      setShowDetails(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching dates:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  return (
    <div className="space-y-4">
      <button
        onClick={fetchDates}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Analyzing Fortnox Dates...' : 'Analyze Fortnox Dates'}
      </button>

      {error && (
        <div className="p-4 border border-red-500 bg-red-50 text-red-700 rounded-md">
          <h3 className="font-bold">Error</h3>
          <p>{error}</p>
        </div>
      )}

      {dateData && (
        <div className="border rounded-md p-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Fortnox Date Analysis</h2>
            <p className="text-gray-600">
              Analysis of {dateData.analysis.total_invoices} invoices from Fortnox
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-block px-2 py-1 bg-gray-100 rounded-full text-sm">
                Earliest: {dateData.analysis.earliest_date || 'N/A'}
              </span>
              <span className="inline-block px-2 py-1 bg-gray-100 rounded-full text-sm">
                Latest: {dateData.analysis.latest_date || 'N/A'}
              </span>
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Total: {dateData.analysis.total_invoices} invoices
              </span>
            </div>

            <div>
              <button 
                onClick={() => setShowDetails(!showDetails)} 
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                <span>{showDetails ? 'Hide' : 'Show'} Years</span>
                <span className="ml-1">{showDetails ? '▲' : '▼'}</span>
              </button>
              
              {showDetails && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {dateData.years.map(year => (
                    <div key={year} className="border rounded-md p-2">
                      <h3 className="font-bold">{year}</h3>
                      <div className="mt-2">
                        <h4 className="text-sm font-medium">Available months:</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dateData.months_by_year[year]?.map(month => (
                            <span 
                              key={`${year}-${month}`} 
                              className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-xs"
                            >
                              {formatMonthName(month)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            Data fetched at {new Date().toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
} 