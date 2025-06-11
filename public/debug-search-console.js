// Debug script for Search Console functionality

// Function to capture console output
function captureConsoleOutput() {
  const originalConsole = { ...console };
  const logs = [];
  
  // Override console methods
  console.log = (...args) => {
    logs.push({ type: 'log', args, time: new Date().toISOString() });
    originalConsole.log(...args);
  };
  
  console.error = (...args) => {
    logs.push({ type: 'error', args, time: new Date().toISOString() });
    originalConsole.error(...args);
  };
  
  console.warn = (...args) => {
    logs.push({ type: 'warn', args, time: new Date().toISOString() });
    originalConsole.warn(...args);
  };
  
  // Add debugging UI
  const addDebugUI = () => {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      z-index: 9999;
      max-width: 300px;
    `;
    
    const title = document.createElement('h4');
    title.textContent = 'Search Console Debug';
    title.style.margin = '0 0 10px 0';
    container.appendChild(title);
    
    const logCount = document.createElement('div');
    logCount.textContent = `Logs: 0 | Errors: 0`;
    container.appendChild(logCount);
    
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download Logs';
    downloadBtn.style.cssText = 'margin-top: 10px; padding: 5px;';
    downloadBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'search-console-debug.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    container.appendChild(downloadBtn);
    
    // Update counts every second
    setInterval(() => {
      const errorCount = logs.filter(log => log.type === 'error').length;
      const warningCount = logs.filter(log => log.type === 'warn').length;
      logCount.textContent = `Logs: ${logs.length} | Errors: ${errorCount} | Warnings: ${warningCount}`;
    }, 1000);
    
    document.body.appendChild(container);
  };
  
  // Reset console to original
  const resetConsole = () => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    return logs;
  };
  
  // Add a method to filter logs related to Search Console
  const getSearchConsoleLogs = () => {
    return logs.filter(log => {
      const content = JSON.stringify(log.args).toLowerCase();
      return content.includes('search console') || content.includes('searchconsole');
    });
  };
  
  return { logs, addDebugUI, resetConsole, getSearchConsoleLogs };
}

// Export for browser globals
window.SearchConsoleDebug = { captureConsoleOutput };

// Instructions
console.log(`
===========================================
SEARCH CONSOLE DEBUGGING HELPER
===========================================

To debug your Search Console integration:

1. In your browser console, run:
   const debugHelper = SearchConsoleDebug.captureConsoleOutput();
   debugHelper.addDebugUI();

2. Interact with Search Console features

3. Download logs using the UI button
===========================================
`); 