import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, RefreshCw, ChevronDown } from 'lucide-react';

export function FortnoxDateFetcher({ userId, onFetchComplete }: { userId: string; workspaceId?: string; onFetchComplete?: (invoices: any[]) => void }) {
  // Get workspace ID from local storage if not provided
  const [workspaceId, setWorkspaceId] = useState<string>('');
  
  useEffect(() => {
    // Try to get workspace ID from local storage
    try {
      const storedWorkspaceId = localStorage.getItem('activeWorkspace');
      if (storedWorkspaceId) {
        console.log('Found workspace ID in localStorage:', storedWorkspaceId);
        setWorkspaceId(storedWorkspaceId);
      } else {
        console.log('No workspace ID found in localStorage');
      }
    } catch (e) {
      console.error('Error getting workspace ID from local storage:', e);
    }
  }, []);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFetchCustomRange = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates");
      return;
    }

    if (!userId) {
      alert("User ID is required. Please make sure you're logged in.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const url = `/api/fortnox/invoices/fetch-range?startDate=${startDate}&endDate=${endDate}`;
      const headers: Record<string, string> = {
        'user-id': userId
      };
      
      // Only add workspace-id if it exists
      if (workspaceId) {
        headers['workspace-id'] = workspaceId;
      }
      
      console.log(`Sending request to ${url} with headers:`, headers);
      
      const response = await fetch(url, {
        headers
      });

      const responseText = await response.text();
      console.log(`Raw response: ${responseText}`);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        console.error(`Error fetching invoices: Status ${response.status}`, data);
        throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
      }

      setResults(data);
      // Handle both response formats (uppercase/lowercase)
      const invoicesData = data.Invoices || data.invoices || [];
      alert(`Fetched successfully! Found ${invoicesData.length || 0} invoices`);
      
      // Call the onFetchComplete callback if provided
      if (onFetchComplete) {
        onFetchComplete(invoicesData);
      }
    } catch (error) {
      console.error("Error in fetch:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
      alert(`Error fetching invoices: ${error instanceof Error ? error.message : "Unknown error occurred"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchYear = async (year: number) => {
    if (!userId) {
      alert("User ID is required. Please make sure you're logged in.");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const url = `/api/fortnox/invoices/fetch-year?year=${year}`;
      const headers: Record<string, string> = {
        'user-id': userId
      };
      
      // Only add workspace-id if it exists
      if (workspaceId) {
        headers['workspace-id'] = workspaceId;
      }
      
      console.log(`Sending request to ${url} with headers:`, headers);
      
      const response = await fetch(url, {
        headers
      });

      const responseText = await response.text();
      console.log(`Raw response: ${responseText}`);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        console.error(`Error fetching invoices: Status ${response.status}`, data);
        throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
      }

      setResults(data);
      // Handle both response formats (uppercase/lowercase)
      const invoicesData = data.Invoices || data.invoices || [];
      alert(`Fetched successfully! Found ${invoicesData.length || 0} invoices for ${year}`);
      
      // Call the onFetchComplete callback if provided
      if (onFetchComplete) {
        onFetchComplete(invoicesData);
      }
    } catch (error) {
      console.error("Error in fetch:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
      alert(`Error fetching invoices: ${error instanceof Error ? error.message : "Unknown error occurred"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleResults = () => {
    setIsResultsOpen(!isResultsOpen);
  };

  return (
    <div className="w-full border rounded-lg shadow-sm bg-background dark:bg-gray-800 p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-1">Fortnox Date Fetcher</h3>
        <p className="text-sm text-foreground0 dark:text-gray-400">Test invoice fetching with different date ranges</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="dateRange" className="mb-2 block">Custom Date Range</Label>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[240px]">
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start date"
              />
            </div>
            <div className="flex-1 min-w-[240px]">
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End date"
              />
            </div>
            <Button onClick={handleFetchCustomRange} disabled={isLoading}>
              {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
              Fetch
            </Button>
          </div>
        </div>
        
        <hr className="my-4 border-border dark:border-gray-700" />
        
        <div>
          <Label className="mb-2 block">Quick Year Fetcher</Label>
          <div className="flex flex-wrap gap-2">
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(year => (
              <Button 
                key={year} 
                variant="outline" 
                onClick={() => handleFetchYear(year)}
                disabled={isLoading}
              >
                {year}
              </Button>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {results && (
          <>
            <hr className="my-4 border-border dark:border-gray-700" />
            <div className="border rounded overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 bg-muted dark:bg-gray-700 cursor-pointer" 
                onClick={toggleResults}
              >
                <h4 className="font-medium">Results ({(results.Invoices || results.invoices || []).length} invoices)</h4>
                <ChevronDown className={`h-4 w-4 transition-transform ${isResultsOpen ? 'rotate-180' : ''}`} />
              </div>
              {isResultsOpen && (
                <div className="p-3">
                  <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded-md overflow-auto max-h-96 text-xs">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 