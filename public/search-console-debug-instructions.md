# Debugging Search Console Integration

This document provides steps to diagnose and fix issues with Google Search Console integration in your Solvify CRM.

## Common Issues

1. **Authentication Problems**: Expired or invalid Search Console tokens
2. **Data Discrepancy**: Mismatch between Search Console data and what's displayed in CRM
3. **Missing Data**: No Search Console data showing in dashboard
4. **API Errors**: Failed API calls to Google Search Console

## Debugging Tools Provided

We've added several debugging tools to help:

1. **Search Console Debug Page**: `/search-console-debug.html`
2. **Debug Logging**: Enhanced console logs specifically for Search Console API calls
3. **Refresh Endpoint**: A dedicated API endpoint to refresh Search Console data

## Step-by-Step Debugging Instructions

### 1. Check Authentication Status

1. Navigate to `/search-console-debug.html` in your browser
2. Click the "Check Integration Status" button on the "Search Console Data" tab
3. If you see a success message with available sites, your authentication is working
4. If you see an error, you need to reconnect your Search Console account:
   - Go to Settings > Integrations
   - Disconnect Google Search Console if already connected
   - Reconnect with your Google account that has Search Console access

### 2. Verify Site Configuration

1. Go to Settings > User Settings
2. Check if a default Search Console site is configured
3. If not, select your primary site from the dropdown
4. The site should be in the format `sc-domain:example.com` or `https://www.example.com/`

### 3. Test Direct API Calls

1. Go to `/search-console-debug.html`
2. On the "Direct API" tab, enter your site URL from your settings
3. Select a date range (28 days is recommended for matching dashboard)
4. Click "Fetch Data"
5. Check the response for any errors or missing data

### 4. Debug Console Logs

To view detailed console logs:

1. Open your browser's developer tools (F12 or Right-click > Inspect)
2. Go to the Console tab
3. Filter by typing "Search Console" in the filter box
4. Look for error messages or warnings
5. For more comprehensive logging:
   ```javascript
   const debugHelper = SearchConsoleDebug.captureConsoleOutput();
   debugHelper.addDebugUI();
   ```

### 5. Check for Data Discrepancies

If your Search Console shows different data than what's in Google's interface:

1. Verify the date ranges match
2. Check if you're looking at the same property/site
3. Note that data in Search Console can take 2-3 days to fully process
4. Try manually refreshing data:
   - Go to your dashboard
   - Click the refresh icon on the Search Console widget
   - Or use the "Refresh Data" button on the `/search-console-debug.html` page

### 6. Reviewing API Response Structure

A valid Search Console API response should contain:

```json
{
  "overview": {
    "clicks": 123,
    "impressions": 4567,
    "ctr": 2.7,
    "position": 35.4
  },
  "queries": [
    {
      "keys": ["your search term"],
      "clicks": 45,
      "impressions": 789,
      "ctr": 5.7,
      "position": 12.3
    },
    // ...more queries
  ]
}
```

### 7. Still Having Issues?

If you're still experiencing problems:

1. Check if Google Search Console API is functioning properly by visiting [Google API Status Dashboard](https://status.cloud.google.com/)
2. Ensure your Google account has sufficient permissions on the Search Console property
3. Try reconnecting the integration with a Google account that has Owner/Administrator access
4. Contact support with your search-console-debug.json file (downloadable from the debug UI)

## Frequently Asked Questions

**Q: Why does the data in my dashboard differ from what I see in Google Search Console?**
A: The dashboard may be using cached data or different date ranges. Try refreshing the data and check the date range settings.

**Q: Why do I see "No data available" in the Search Console widget?**
A: This could be due to authentication issues, incorrect site configuration, or no data for the specified period. Use the debug tools to identify the specific cause.

**Q: After authenticating, I still don't see any sites available**
A: Ensure your Google account has access to Search Console properties. You might need to add your account as a user in Google Search Console first. 